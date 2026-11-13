import express from 'express';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';

import {
  join,
  relative,
  sep,
  extname,
  basename,
  resolve,
} from 'node:path';
import { readFile, writeFile, mkdir, rename, stat as statFile } from 'node:fs/promises';

import { readdir } from 'node:fs/promises';


const browserDistFolder =
  join(import.meta.dirname, '../browser');


const app = express();

const allowedApiOrigins = new Set([
  'https://smarttraffic.in',
  'https://www.smarttraffic.in',
  'http://localhost:4200'
]);

app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;

  if (origin && allowedApiOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    res.sendStatus(origin && allowedApiOrigins.has(origin) ? 204 : 403);
    return;
  }

  next();
});

app.use(express.json());

const authSecret = process.env['AUTH_SECRET'];
const adminUsername = (process.env['ADMIN_USERNAME'] || process.env['ADMIN_EMAIL'])?.trim().toLowerCase();
const adminPassword = process.env['ADMIN_PASSWORD'];
const ageCookieName = 'adult_access';
const adminCookieName = 'owner_session';

function makeSignedToken(value: string, expiresAt: number): string {
  const payload = Buffer.from(`${value}:${expiresAt}`).toString('base64url');
  const signature = createHmac('sha256', authSecret || 'not-configured').update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function hasValidSignedToken(token: string | undefined, expectedValue: string): boolean {
  return getSignedTokenValue(token) === expectedValue;
}

function getSignedTokenValue(token: string | undefined): string | null {
  if (!authSecret || authSecret.length < 32) return null;
  if (!token) return null;

  const [payload, suppliedSignature] = token.split('.');
  if (!payload || !suppliedSignature) return null;
  const expectedSignature = createHmac('sha256', authSecret).update(payload).digest('base64url');
  const supplied = Buffer.from(suppliedSignature);
  const expected = Buffer.from(expectedSignature);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;

  try {
    const decoded = Buffer.from(payload, 'base64url').toString('utf8');
    const separator = decoded.lastIndexOf(':');
    const expiresAt = Number(decoded.slice(separator + 1));
    return separator > 0 && expiresAt > Date.now()
      ? decoded.slice(0, separator)
      : null;
  } catch {
    return null;
  }
}

function hasValidToken(req: express.Request, cookieName: string, expectedValue: string): boolean {
  const cookieHeader = req.headers.cookie || '';
  const token = cookieHeader.split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
  return hasValidSignedToken(token, expectedValue);
}

function setSignedCookie(req: express.Request, res: express.Response, name: string, value: string, maxAgeSeconds: number): void {
  const secure = process.env['NODE_ENV'] === 'production' || req.headers['x-forwarded-proto']?.toString().split(',')[0] === 'https';
  const sameSite = secure ? 'None' : 'Lax';
  const secureFlag = secure ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${name}=${makeSignedToken(value, Date.now() + maxAgeSeconds * 1000)}; Max-Age=${maxAgeSeconds}; Path=/; HttpOnly; SameSite=${sameSite}${secureFlag}`);
}

function requireOwner(req: express.Request, res: express.Response, next: express.NextFunction): void {
  if (!hasValidToken(req, adminCookieName, 'owner')) {
    res.status(401).json({ error: 'Owner login required' });
    return;
  }
  next();
}

function getAdultAccessId(req: express.Request): string | null {
  const imageAccessToken = typeof req.query['access_token'] === 'string'
    ? req.query['access_token']
    : undefined;
  const cookieHeader = req.headers.cookie || '';
  const cookieToken = cookieHeader.split(';')
    .map(part => part.trim())
    .find(part => part.startsWith(`${ageCookieName}=`))
    ?.slice(ageCookieName.length + 1);
  const accessIdPattern = /^adult-image:([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

  for (const token of [imageAccessToken, cookieToken]) {
    const value = getSignedTokenValue(token);
    const match = value?.match(accessIdPattern);
    if (match) return match[1];
  }

  return null;
}

interface AdultViewer {
  name: string;
  email: string;
  firstViewedAt: string;
  lastViewedAt: string;
  views: number;
  accessId?: string;
  isPayment: boolean;
}

interface AdultViewerRow {
  name: string;
  email: string;
  first_viewed_at: string;
  last_viewed_at: string;
  views: number;
  access_id: string | null;
  is_payment: boolean;
}

async function readAdultViewers(): Promise<AdultViewer[]> {
  if (supabaseEnabled) {
    const rows = await supabaseRequest<AdultViewerRow[]>(
      'adult_sketch_viewers?select=name,email,first_viewed_at,last_viewed_at,views,access_id,is_payment&order=last_viewed_at.desc'
    );
    return rows.map(row => ({
      name: row.name,
      email: row.email,
      firstViewedAt: row.first_viewed_at,
      lastViewedAt: row.last_viewed_at,
      views: Number(row.views) || 0,
      accessId: row.access_id || undefined,
      isPayment: Boolean(row.is_payment)
    }));
  }

  try {
    const viewers = JSON.parse(await readDataFile('adult-sketch-viewers.json')) as Array<Partial<AdultViewer> & Pick<AdultViewer, 'name' | 'email' | 'firstViewedAt' | 'lastViewedAt' | 'views'>>;
    return viewers.map(viewer => ({
      ...viewer,
      isPayment: viewer.isPayment === true
    }));
  } catch {
    return [];
  }
}

async function findAdultViewerByAccessId(accessId: string): Promise<AdultViewer | undefined> {
  if (supabaseEnabled) {
    const rows = await supabaseRequest<AdultViewerRow[]>(
      `adult_sketch_viewers?select=name,email,first_viewed_at,last_viewed_at,views,access_id,is_payment&access_id=eq.${encodeURIComponent(accessId)}&limit=1`
    );
    const row = rows[0];
    return row && {
      name: row.name,
      email: row.email,
      firstViewedAt: row.first_viewed_at,
      lastViewedAt: row.last_viewed_at,
      views: Number(row.views) || 0,
      accessId: row.access_id || undefined,
      isPayment: Boolean(row.is_payment)
    };
  }

  return (await readAdultViewers()).find(viewer => viewer.accessId === accessId);
}

let adultViewersWriteQueue: Promise<void> = Promise.resolve();

function recordAdultViewer(name: string, email: string, accessId: string): Promise<boolean> {
  const update = adultViewersWriteQueue.then(async () => {
    if (supabaseEnabled) {
      const saved = await supabaseRequest<AdultViewerRow>(
        'rpc/record_adult_sketch_viewer',
        {
          method: 'POST',
          body: JSON.stringify({ p_name: name, p_email: email, p_access_id: accessId })
        }
      );
      return Boolean(saved.is_payment);
    }

    const viewers = await readAdultViewers();
    const now = new Date().toISOString();
    const existing = viewers.find(viewer => viewer.email === email);
    if (existing) {
      existing.name = name;
      existing.lastViewedAt = now;
      existing.views += 1;
      existing.accessId = accessId;
    } else {
      viewers.push({ name, email, firstViewedAt: now, lastViewedAt: now, views: 1, accessId, isPayment: false });
    }
    await saveDataFile('adult-sketch-viewers.json', JSON.stringify(viewers, null, 2));
    return existing?.isPayment === true;
  });
  adultViewersWriteQueue = update.then(() => undefined, () => undefined);
  return update;
}

async function setAdultViewerPayment(email: string, isPayment: boolean): Promise<boolean | undefined> {
  if (supabaseEnabled) {
    const rows = await supabaseRequest<AdultViewerRow[]>(
      `adult_sketch_viewers?email=eq.${encodeURIComponent(email)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ is_payment: isPayment })
      }
    );
    return rows[0] ? Boolean(rows[0].is_payment) : undefined;
  }

  const viewers = await readAdultViewers();
  const viewer = viewers.find(item => item.email === email);
  if (!viewer) return undefined;
  viewer.isPayment = isPayment;
  await saveDataFile('adult-sketch-viewers.json', JSON.stringify(viewers, null, 2));
  return viewer.isPayment;
}

app.post('/api/18plus/confirm', async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const isAdult = req.body?.isAdult === true;
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !isAdult) {
    res.status(400).json({ error: 'Enter your name and a valid email, and confirm you are 18 or older.' });
    return;
  }
  if (!authSecret || authSecret.length < 32) {
    res.status(503).json({ error: 'Age access is not configured on the server.' });
    return;
  }
  try {
    const accessId = randomUUID();
    const isPayment = await recordAdultViewer(name, email, accessId);
    const tokenExpiresAt = Date.now() + 60 * 60 * 24 * 30 * 1000;
    const imageAccessToken = makeSignedToken(`adult-image:${accessId}`, tokenExpiresAt);
    setSignedCookie(req, res, ageCookieName, `adult-image:${accessId}`, 60 * 60 * 24 * 30);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ok: true, imageAccessToken, isPayment });
  } catch (error) {
    next(error);
  }
});

app.post('/api/18plus/verify', async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  const isAdult = req.body?.isAdult === true;
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !/^\d{4,10}$/.test(token) || !isAdult) {
    res.status(400).json({ error: 'Enter your name, a valid email, the email code, and confirm you are 18 or older.' });
    return;
  }
  if (!authSecret || authSecret.length < 32) {
    res.status(503).json({ error: 'Age access is not configured on the server.' });
    return;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: 'Email verification is not configured on the server.' });
    return;
  }

  let verifiedEmail: string | undefined;
  try {
    const result = await supabaseAuthRequest<{ user?: { email?: string } }>(
      'verify',
      { email, token, type: 'email' }
    );
    verifiedEmail = result.user?.email?.trim().toLowerCase();
  } catch (error) {
    console.warn('Adult gallery email verification failed:', error);
    res.status(401).json({ error: 'That code is invalid or expired. Request a new code and try again.' });
    return;
  }

  if (verifiedEmail !== email) {
    res.status(401).json({ error: 'The verified email did not match. Request a new code and try again.' });
    return;
  }

  try {
    const accessId = randomUUID();
    const isPayment = await recordAdultViewer(name, email, accessId);
    const tokenExpiresAt = Date.now() + 60 * 60 * 24 * 30 * 1000;
    const accessToken = makeSignedToken(`adult-image:${accessId}`, tokenExpiresAt);
    setSignedCookie(req, res, ageCookieName, `adult-image:${accessId}`, 60 * 60 * 24 * 30);
    res.json({ ok: true, imageAccessToken: accessToken, isPayment });
  } catch (error) {
    next(error);
  }
});

app.post('/api/18plus/verify-link', async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const accessToken = typeof req.body?.accessToken === 'string' ? req.body.accessToken.trim() : '';
  const isAdult = req.body?.isAdult === true;
  if (!name || name.length > 100 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || !accessToken || accessToken.length > 4096 || !isAdult) {
    res.status(400).json({ error: 'Email link details are incomplete. Request a new link and try again.' });
    return;
  }
  if (!authSecret || authSecret.length < 32) {
    res.status(503).json({ error: 'Age access is not configured on the server.' });
    return;
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(503).json({ error: 'Email verification is not configured on the server.' });
    return;
  }

  let verifiedEmail: string | undefined;
  try {
    const user = await supabaseAuthGetUser(accessToken);
    verifiedEmail = user.email?.trim().toLowerCase();
  } catch (error) {
    console.warn('Adult gallery email-link verification failed:', error);
    res.status(401).json({ error: 'That email link is invalid or expired. Request a new link and try again.' });
    return;
  }
  if (verifiedEmail !== email) {
    res.status(401).json({ error: 'The email link does not match the entered email. Request a new link.' });
    return;
  }

  try {
    const accessId = randomUUID();
    const isPayment = await recordAdultViewer(name, email, accessId);
    const tokenExpiresAt = Date.now() + 60 * 60 * 24 * 30 * 1000;
    const imageAccessToken = makeSignedToken(`adult-image:${accessId}`, tokenExpiresAt);
    setSignedCookie(req, res, ageCookieName, `adult-image:${accessId}`, 60 * 60 * 24 * 30);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ok: true, imageAccessToken, isPayment });
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/login', (req, res) => {
  const username = typeof req.body?.username === 'string'
    ? req.body.username.trim().toLowerCase()
    : typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!authSecret || authSecret.length < 32 || !adminUsername || !adminPassword) {
    res.status(503).json({ error: 'Admin login is not configured on the server.' });
    return;
  }
  const submittedPassword = Buffer.from(password);
  const configuredPassword = Buffer.from(adminPassword);
  const passwordMatches = submittedPassword.length === configuredPassword.length && timingSafeEqual(submittedPassword, configuredPassword);
  if (username !== adminUsername || !passwordMatches) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  setSignedCookie(req, res, adminCookieName, 'owner', 60 * 60 * 8);
  res.json({ ok: true });
});

app.get('/api/admin/18plus-viewers', requireOwner, async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json((await readAdultViewers()).map(({ name, email, firstViewedAt, lastViewedAt, views, isPayment }) => ({
      name, email, firstViewedAt, lastViewedAt, views, isPayment
    })));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/18plus-viewers/payment', requireOwner, async (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || !allowedApiOrigins.has(origin)) {
    res.status(403).json({ error: 'Payment status updates are only allowed from the site.' });
    return;
  }
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const isPayment = req.body?.isPayment;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254 || typeof isPayment !== 'boolean') {
    res.status(400).json({ error: 'Provide a valid email and a true or false payment status.' });
    return;
  }
  try {
    const savedPaymentStatus = await setAdultViewerPayment(email, isPayment);
    if (savedPaymentStatus === undefined) {
      res.status(404).json({ error: 'No verified viewer was found for that email.' });
      return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ok: true, isPayment: savedPaymentStatus });
  } catch (error) {
    next(error);
  }
});

const blurredPreviewCache = new Map<string, Promise<Buffer>>();

async function getBlurredPreview(imagePath: string): Promise<Buffer> {
  const fileInfo = await statFile(imagePath);
  const cacheKey = `${imagePath}:${fileInfo.mtimeMs}`;
  let preview = blurredPreviewCache.get(cacheKey);
  if (!preview) {
    preview = sharp(imagePath)
      .resize({ width: 720, withoutEnlargement: true })
      .blur(36)
      .jpeg({ quality: 48 })
      .toBuffer();
    blurredPreviewCache.set(cacheKey, preview);
    if (blurredPreviewCache.size > 100) {
      const oldestKey = blurredPreviewCache.keys().next().value;
      if (oldestKey) blurredPreviewCache.delete(oldestKey);
    }
    preview.catch(() => blurredPreviewCache.delete(cacheKey));
  }
  return preview;
}

app.get('/api/18plus/image', async (req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  const accessId = getAdultAccessId(req);
  if (!accessId) {
    res.sendStatus(403);
    return;
  }
  const viewer = await findAdultViewerByAccessId(accessId);
  if (!viewer) {
    res.sendStatus(403);
    return;
  }
  const file = typeof req.query['file'] === 'string' ? req.query['file'] : '';
  const adultRoot = resolve(drawingsRoot, '18+Sketches');
  const imagePath = resolve(adultRoot, file);
  const pathFromAdultRoot = relative(adultRoot, imagePath);
  if (!file || !pathFromAdultRoot || pathFromAdultRoot.startsWith('..') || imagePath === adultRoot || !imagePath.startsWith(`${adultRoot}${sep}`) || !imageExtensions.has(extname(imagePath).toLowerCase())) {
    res.sendStatus(404);
    return;
  }
  const isFreePreview = file.split(/[\\/]/).includes('TopFive');
  if (!viewer.isPayment && !isFreePreview) {
    try {
      res.type('image/jpeg').send(await getBlurredPreview(imagePath));
    } catch (error) {
      next(error);
    }
    return;
  }
  res.sendFile(imagePath, error => error && next(error));
});


/*
 * Folder containing your drawings.
 *
 * Project:
 *
 * public/
 *   drawings/
 *     ColorArt/
 *     PencilSketches/
 *     18+Sketches/
 *     FeatureDrawing/
 */
const drawingsRoot = join(
  process.cwd(),
  'public',
  'drawings'
);

const defaultDataDirectory = join(process.cwd(), 'data');
const dataDirectory = process.env['DATA_DIR'] || defaultDataDirectory;
const supabaseUrl = process.env['SUPABASE_URL']?.replace(/\/+$/, '');
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const supabaseEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey);

function currentIndiaDate(): string {
  const dateParts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const part = (type: string) => dateParts.find(value => value.type === type)?.value ?? '';

  return `${part('year')}-${part('month')}-${part('day')}`;
}

interface DailyActivity {
  date: string;
  likes: number;
  visits: number;
}

async function readDailyActivity(): Promise<DailyActivity> {
  const date = currentIndiaDate();

  if (supabaseEnabled) {
    const rows = await supabaseRequest<Array<{ likes: number; visits: number }>>(
      `daily_activity?select=likes,visits&activity_date=eq.${date}`
    );
    const activity = rows[0];

    return {
      date,
      likes: Number(activity?.likes) || 0,
      visits: Number(activity?.visits) || 0
    };
  }

  try {
    const stored = JSON.parse(await readDataFile('daily-activity.json')) as DailyActivity;

    return stored.date === date
      ? { date, likes: Number(stored.likes) || 0, visits: Number(stored.visits) || 0 }
      : { date, likes: 0, visits: 0 };
  } catch {
    return { date, likes: 0, visits: 0 };
  }
}

let dailyActivityWriteQueue: Promise<void> = Promise.resolve();

function incrementDailyActivity(counter: 'likes' | 'visits'): Promise<DailyActivity> {
  const update = dailyActivityWriteQueue.then(async () => {
    const current = await readDailyActivity();
    const activity = {
      ...current,
      [counter]: current[counter] + 1
    };

    await saveDataFile('daily-activity.json', JSON.stringify(activity, null, 2));
    return activity;
  });

  dailyActivityWriteQueue = update.then(() => undefined, () => undefined);
  return update;
}

async function supabaseRequest<T>(
  endpoint: string,
  init: RequestInit = {}
): Promise<T> {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Supabase environment variables are not configured');
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/${endpoint}`, {
    ...init,
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: `Bearer ${supabaseServiceRoleKey}`,
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers
    }
  });

  if (!response.ok) {
    throw new Error(`Supabase request failed (${response.status}): ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

async function supabaseAuthRequest<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase Auth environment variables are not configured');
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/${endpoint}`, {
    method: 'POST',
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });
  const responseText = await response.text();
  let responseBody: unknown;
  try {
    responseBody = responseText ? JSON.parse(responseText) : {};
  } catch {
    responseBody = responseText;
  }
  if (!response.ok) {
    throw new Error(`Supabase Auth request failed (${response.status}): ${JSON.stringify(responseBody)}`);
  }
  return responseBody as T;
}

async function supabaseAuthGetUser(accessToken: string): Promise<{ email?: string }> {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase Auth environment variables are not configured');
  }
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${accessToken}`
    }
  });
  if (!response.ok) {
    throw new Error(`Supabase Auth user verification failed (${response.status})`);
  }
  return response.json() as Promise<{ email?: string }>;
}

async function readDataFile(fileName: string): Promise<string> {
  try {
    return await readFile(join(dataDirectory, fileName), 'utf8');
  } catch (error) {
    if (dataDirectory === defaultDataDirectory) {
      throw error;
    }

    // Seed a new persistent disk with the JSON files committed in the repo.
    return readFile(join(defaultDataDirectory, fileName), 'utf8');
  }
}

async function saveDataFile(fileName: string, content: string): Promise<void> {
  await mkdir(dataDirectory, { recursive: true });

  const filePath = join(dataDirectory, fileName);
  const temporaryPath = `${filePath}.tmp`;

  await writeFile(temporaryPath, content, 'utf8');
  await rename(temporaryPath, filePath);
}

async function readVisits(): Promise<number> {
  if (supabaseEnabled) {
    const rows = await supabaseRequest<Array<{ visits: number }>>(
      'site_visits?select=visits&id=eq.1'
    );

    return Number(rows[0]?.visits) || 0;
  }

  try {

    const data = await readDataFile('visits.json');

    const parsed = JSON.parse(data);

    return Number(parsed.visits) || 0;

  } catch {

    return 0;

  }

}

async function saveVisits(
  visits: number
): Promise<void> {

  await saveDataFile(
    'visits.json',
    JSON.stringify(
      { visits },
      null,
      2
    )
  );

}

app.get('/api/visits', async (req, res, next) => {

  try {

    const visits = await readVisits();

    res.json(visits);

  } catch (error) {

    console.error(
      'Failed to read visits:',
      error
    );

    next(error);

  }

});

app.get('/api/today', async (req, res, next) => {
  try {
    res.json(await readDailyActivity());
  } catch (error) {
    console.error('Failed to read daily activity:', error);
    next(error);
  }
});

let visitsWriteQueue: Promise<void> = Promise.resolve();

function incrementFileVisit(): Promise<number> {
  const update = visitsWriteQueue.then(async () => {
    const newVisits = (await readVisits()) + 1;
    await saveVisits(newVisits);
    return newVisits;
  });

  visitsWriteQueue = update.then(() => undefined, () => undefined);
  return update;
}

app.post('/api/visits', async (req, res, next) => {

  try {

    const newVisits = supabaseEnabled
      ? await supabaseRequest<number>('rpc/increment_visits', {
          method: 'POST',
          body: '{}'
        })
      : await incrementFileVisit();

    if (!supabaseEnabled) {
      await incrementDailyActivity('visits');
    }

    res.json({
      visits: newVisits
    });

  } catch (error) {

    console.error(
      'Failed to record visit:',
      error
    );

    next(error);

  }

});


/*
 * Folder name → category displayed by Angular.
 */
const categoryNames: Record<string, string> = {

  ColorArt: 'Color Art',

  PencilSketches: 'Pencil Sketches',

  '18+Sketches': '18+ Sketches',

  FeatureDrawing: 'Feature Drawing',

};


const imageExtensions = new Set([

  '.jpg',

  '.jpeg',

  '.png',

  '.webp',

  '.gif',

  '.avif',

]);


interface Artwork {

  title: string;

  category: string;

  year: string;

  date?: string;

  image: string;

  alt: string;

  isFreePreview?: boolean;

  isPayment?: boolean;

}


/*
 * Scan public/drawings recursively.
 */
async function scanDrawings(
  directory: string = drawingsRoot
): Promise<Artwork[]> {

  const drawings: Artwork[] = [];


  async function scan(
    currentDirectory: string
  ): Promise<void> {

    const entries = await readdir(
      currentDirectory,
      {
        withFileTypes: true
      }
    );


    for (const entry of entries) {

      const fullPath = join(
        currentDirectory,
        entry.name
      );


      /*
       * If directory → scan it.
       */
      if (entry.isDirectory()) {

        await scan(fullPath);

        continue;
      }


      /*
       * Ignore files that aren't images.
       */
      const extension =
        extname(entry.name).toLowerCase();


      if (!imageExtensions.has(extension)) {

        continue;

      }


      /*
       * Get path relative to public/drawings.
       */
      const relativePath =
        relative(
          drawingsRoot,
          fullPath
        );


      const pathParts =
        relativePath.split(/[\\/]/);


      /*
       * First folder determines category.
       *
       * Example:
       *
       * 18+Sketches
       */
      const folderName =
        pathParts[0];


      const category =
        categoryNames[folderName]
        ?? folderName;


      /*
       * Find date folder.
       *
       * Example:
       *
       * 2026-09-14
       */
      const dateFolder =
        pathParts.find(
          part =>
            /^\d{4}-\d{2}-\d{2}$/.test(part)
        );


      const date =
        dateFolder ?? '';


      const year =
        date
          ? date.substring(0, 4)
          : '';


      /*
       * File name without extension.
       *
       * SK123456.jpeg
       *
       * becomes:
       *
       * SK123456
       */
      const title =
        basename(
          entry.name,
          extension
        );


      /*
       * Build browser URL.
       */
      const imagePath =
        category === '18+ Sketches'
          ? `/api/18plus/image?file=${encodeURIComponent(pathParts.slice(1).join('/'))}`
          : '/drawings/' +
            pathParts
              .map(part => encodeURIComponent(part))
              .join('/');


      drawings.push({

        title,

        category,

        year,

        ...(date
          ? { date }
          : {}),

        image: imagePath,

        alt: title,

        ...(category === '18+ Sketches'
          ? { isFreePreview: pathParts.includes('TopFive') }
          : {}),

      });

    }

  }


  await scan(directory);


  return drawings;

}


/**
 * Dynamic drawings API
 */
app.get(
  '/api/drawings',
  async (req, res, next) => {

    try {

      const drawings =
        await scanDrawings();

      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('Referrer-Policy', 'no-referrer');
      const accessId = getAdultAccessId(req);
      const viewer = accessId ? await findAdultViewerByAccessId(accessId) : undefined;
      res.json(viewer
        ? drawings.map(drawing => drawing.category === '18+ Sketches'
          ? { ...drawing, isPayment: viewer.isPayment }
          : drawing)
        : drawings.filter(drawing => drawing.category !== '18+ Sketches'));

    } catch (error) {

      console.error(
        'Failed to scan drawings:',
        error
      );

      next(error);

    }

  }
);

let likesWriteQueue = Promise.resolve();

async function readLikes(): Promise<Record<string, number>> {
  if (supabaseEnabled) {
    const rows = await supabaseRequest<Array<{ image_path: string; likes: number }>>(
      'likes?select=image_path,likes'
    );

    return Object.fromEntries(
      rows.map(row => [row.image_path.replace(/^\/+/, ''), Number(row.likes) || 0])
    );
  }

  try {
    const data = await readDataFile('likes.json');
    const parsed = JSON.parse(data);
    const storedLikes = parsed.likes ?? {};
    const likes: Record<string, number> = {};

    for (const [image, count] of Object.entries(storedLikes)) {
      const normalizedImage = image.replace(/^\/+/, '');
      likes[normalizedImage] = (likes[normalizedImage] || 0) + (Number(count) || 0);
    }

    return likes;
  } catch {
    return {};
  }
}

async function saveLikes(likes: Record<string, number>): Promise<void> {
  await saveDataFile(
    'likes.json',
    JSON.stringify({ likes }, null, 2),
  );
}

app.get('/api/likes', async (req, res, next) => {
  try {
    const likes = await readLikes();

    res.json(likes);
  } catch (error) {
    console.error('Failed to read likes:', error);
    next(error);
  }
});

app.post('/api/likes', async (req, res, next) => {
  try {
    const image = req.body?.image;

    if (
      typeof image !== 'string' ||
      !image.startsWith('drawings/')
    ) {
      res.status(400).json({
        error: 'Invalid drawing image'
      });

      return;
    }

    if (supabaseEnabled) {
      const likes = await supabaseRequest<number>('rpc/increment_like', {
        method: 'POST',
        body: JSON.stringify({ p_image_path: image })
      });

      res.json({ image, likes });
      return;
    }

    const update = likesWriteQueue.then(async () => {
      const likes = await readLikes();
      likes[image] = (likes[image] || 0) + 1;
      await saveLikes(likes);
      await incrementDailyActivity('likes');
      return { image, likes: likes[image] };
    });

    likesWriteQueue = update.then(() => undefined, () => undefined);
    res.json(await update);

  } catch (error) {
    next(error);
  }
});


/**
 * Serve static files from /browser
 */
app.use(
  express.static(
    browserDistFolder,
    {
      maxAge: '1y',
      index: false,
      redirect: false,
    }
  )
);

app.use(
  (req, res, next) => {
    if (
      req.method === 'GET' &&
      !req.path.startsWith('/api/') &&
      req.accepts('html')
    ) {
      res.sendFile(join(browserDistFolder, 'index.html'));
      return;
    }

    next();
  }
);

const port = Number(process.env['PORT'] || 4000);

app.listen(port, '0.0.0.0', () => {
  console.log(`Node Express server listening on 0.0.0.0:${port}`);
});
  
