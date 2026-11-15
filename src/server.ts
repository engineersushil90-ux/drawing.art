import express from 'express';
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import sharp from 'sharp';
import multer from 'multer';

import {
  join,
  relative,
  sep,
  extname,
  basename,
  resolve,
} from 'node:path';
import { readFile, writeFile, mkdir, rename, stat as statFile, unlink } from 'node:fs/promises';

import { readdir } from 'node:fs/promises';


const browserDistFolder =
  join(import.meta.dirname, '../browser');


const app = express();
app.set('trust proxy', 1);

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
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

function hashAdminPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `scrypt$${salt.toString('base64url')}$${hash.toString('base64url')}`;
}

function isAdminPasswordValid(password: string, storedHash: string): boolean {
  const [algorithm, saltValue, hashValue] = storedHash.split('$');
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false;
  try {
    const salt = Buffer.from(saltValue, 'base64url');
    const expectedHash = Buffer.from(hashValue, 'base64url');
    const suppliedHash = scryptSync(password, salt, expectedHash.length);
    return expectedHash.length > 0 && timingSafeEqual(suppliedHash, expectedHash);
  } catch {
    return false;
  }
}

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
  const authorization = req.headers.authorization || '';
  const bearerToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : undefined;
  return hasValidSignedToken(token, expectedValue) || hasValidSignedToken(bearerToken, expectedValue);
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
    : typeof req.body?.access_token === 'string'
      ? req.body.access_token
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
  paymentRequestedAt?: string | null;
}

interface AdultViewerRow {
  name: string;
  email: string;
  first_viewed_at: string;
  last_viewed_at: string;
  views: number;
  access_id: string | null;
  is_payment: boolean;
  payment_requested_at?: string | null;
}

async function readAdultViewers(): Promise<AdultViewer[]> {
  if (supabaseEnabled) {
    const rows = await supabaseRequest<AdultViewerRow[]>(
      'adult_sketch_viewers?select=name,email,first_viewed_at,last_viewed_at,views,access_id,is_payment,payment_requested_at&order=last_viewed_at.desc'
    );
    return rows.map(row => ({
      name: row.name,
      email: row.email,
      firstViewedAt: row.first_viewed_at,
      lastViewedAt: row.last_viewed_at,
      views: Number(row.views) || 0,
      accessId: row.access_id || undefined,
      isPayment: Boolean(row.is_payment),
      paymentRequestedAt: row.payment_requested_at || null
    }));
  }

  try {
    const viewers = JSON.parse(await readDataFile('adult-sketch-viewers.json')) as Array<Partial<AdultViewer> & Pick<AdultViewer, 'name' | 'email' | 'firstViewedAt' | 'lastViewedAt' | 'views'>>;
    return viewers.map(viewer => ({
      ...viewer,
      isPayment: viewer.isPayment === true,
      paymentRequestedAt: viewer.paymentRequestedAt || null
    }));
  } catch {
    return [];
  }
}

async function findAdultViewerByAccessId(accessId: string): Promise<AdultViewer | undefined> {
  if (supabaseEnabled) {
    const rows = await supabaseRequest<AdultViewerRow[]>(
      `adult_sketch_viewers?select=name,email,first_viewed_at,last_viewed_at,views,access_id,is_payment,payment_requested_at&access_id=eq.${encodeURIComponent(accessId)}&limit=1`
    );
    const row = rows[0];
    return row && {
      name: row.name,
      email: row.email,
      firstViewedAt: row.first_viewed_at,
      lastViewedAt: row.last_viewed_at,
      views: Number(row.views) || 0,
      accessId: row.access_id || undefined,
      isPayment: Boolean(row.is_payment),
      paymentRequestedAt: row.payment_requested_at || null
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
      viewers.push({ name, email, firstViewedAt: now, lastViewedAt: now, views: 1, accessId, isPayment: false, paymentRequestedAt: null });
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
        body: JSON.stringify({ is_payment: isPayment, payment_requested_at: null })
      }
    );
    return rows[0] ? Boolean(rows[0].is_payment) : undefined;
  }

  const viewers = await readAdultViewers();
  const viewer = viewers.find(item => item.email === email);
  if (!viewer) return undefined;
  viewer.isPayment = isPayment;
  viewer.paymentRequestedAt = null;
  await saveDataFile('adult-sketch-viewers.json', JSON.stringify(viewers, null, 2));
  return viewer.isPayment;
}

async function requestAdultViewerPayment(accessId: string): Promise<string | undefined> {
  const requestedAt = new Date().toISOString();
  if (supabaseEnabled) {
    const rows = await supabaseRequest<AdultViewerRow[]>(
      `adult_sketch_viewers?access_id=eq.${encodeURIComponent(accessId)}&is_payment=eq.false`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ payment_requested_at: requestedAt })
      }
    );
    return rows[0]?.payment_requested_at || undefined;
  }

  const viewers = await readAdultViewers();
  const viewer = viewers.find(item => item.accessId === accessId);
  if (!viewer || viewer.isPayment) return undefined;
  viewer.paymentRequestedAt = requestedAt;
  await saveDataFile('adult-sketch-viewers.json', JSON.stringify(viewers, null, 2));
  return requestedAt;
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

app.post('/api/18plus/payment-request', async (req, res, next) => {
  const accessId = getAdultAccessId(req);
  if (!accessId) {
    res.status(403).json({ error: 'Open the 18+ gallery before reporting a payment.' });
    return;
  }
  try {
    const paymentRequestedAt = await requestAdultViewerPayment(accessId);
    if (!paymentRequestedAt) {
      res.status(409).json({ error: 'This viewer is already paid or could not be found.' });
      return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({ ok: true, paymentRequestedAt });
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

interface AdminUserRow {
  username: string;
  password_hash: string;
  is_active: boolean;
}

async function seedInitialAdminUser(): Promise<AdminUserRow> {
  if (!supabaseEnabled || !adminUsername || !adminPassword) {
    throw new Error('Configured Supabase admin credentials are missing');
  }
  const existing = await supabaseRequest<AdminUserRow[]>(
    `admin_users?select=username,password_hash,is_active&username=eq.${encodeURIComponent(adminUsername)}&limit=1`
  );
  if (existing.length) {
    if (isAdminPasswordValid(adminPassword, existing[0].password_hash)) return existing[0];
    const updated = await supabaseRequest<AdminUserRow[]>(
      `admin_users?username=eq.${encodeURIComponent(adminUsername)}`,
      {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({ password_hash: hashAdminPassword(adminPassword) })
      }
    );
    if (!updated.length) throw new Error('Configured admin account could not be updated');
    return updated[0];
  }
  const inserted = await supabaseRequest<AdminUserRow[]>(
    'admin_users?on_conflict=username',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        username: adminUsername,
        password_hash: hashAdminPassword(adminPassword),
        is_active: true
      })
    }
  );
  if (!inserted.length) throw new Error('Configured admin account could not be created');
  return inserted[0];
}

app.post('/api/admin/login', async (req, res) => {
  const username = typeof req.body?.username === 'string'
    ? req.body.username.trim().toLowerCase()
    : typeof req.body?.email === 'string'
      ? req.body.email.trim().toLowerCase()
      : '';
  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!authSecret || authSecret.length < 32) {
    res.status(503).json({ error: 'Admin login is not configured on the server.' });
    return;
  }

  if (supabaseEnabled) {
    try {
      const adminUser = adminUsername && adminPassword && username === adminUsername
        ? await seedInitialAdminUser()
        : (await supabaseRequest<AdminUserRow[]>(
          `admin_users?select=username,password_hash,is_active&username=eq.${encodeURIComponent(username)}&limit=1`
        ))[0];
      if (!adminUser?.is_active || !isAdminPasswordValid(password, adminUser.password_hash)) {
        res.status(401).json({ error: 'Invalid credentials' });
        return;
      }
    } catch (error) {
      console.error('Admin database login failed:', error);
      if (error instanceof Error && error.name === 'TimeoutError') {
        res.status(503).json({ error: 'Admin database request timed out. Check the Supabase connection and try again.' });
        return;
      }
      res.status(503).json({ error: 'Admin user table is unavailable. Run the latest Supabase SQL setup, then try again.' });
      return;
    }
  } else {
    if (!adminUsername || !adminPassword) {
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
  }

  const expiresAt = Date.now() + 60 * 60 * 8 * 1000;
  const accessToken = makeSignedToken('owner', expiresAt);
  setSignedCookie(req, res, adminCookieName, 'owner', 60 * 60 * 8);
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ ok: true, accessToken });
});

app.get('/api/admin/session', requireOwner, (_req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.json({ ok: true });
});

app.get('/api/18plus/viewer-count', async (_req, res, next) => {
  try {
    const viewerCount = await countAdultViewers();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ viewerCount });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/18plus-viewers', requireOwner, async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json((await readAdultViewers()).map(({ name, email, firstViewedAt, lastViewedAt, views, isPayment, paymentRequestedAt }) => ({
      name, email, firstViewedAt, lastViewedAt, views, isPayment, paymentRequestedAt
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
const ADULT_PAYMENT_REQUIRED = false;

async function getBlurredPreview(imagePath: string): Promise<Buffer> {
  const fileInfo = await statFile(imagePath);
  const cacheKey = `${imagePath}:${fileInfo.mtimeMs}`;
  let preview = blurredPreviewCache.get(cacheKey);
  if (!preview) {
    preview = sharp(imagePath)
      .rotate()
      .resize({ width: 720, withoutEnlargement: true })
      .blur(36)
      .jpeg({ quality: 48 })
      .toBuffer({ resolveWithObject: true })
      .then(async ({ data, info }) => sharp(data)
        .composite([{ input: await getWatermarkOverlay(info.width, info.height) }])
        .jpeg({ quality: 48 })
        .toBuffer());
    blurredPreviewCache.set(cacheKey, preview);
    if (blurredPreviewCache.size > 100) {
      const oldestKey = blurredPreviewCache.keys().next().value;
      if (oldestKey) blurredPreviewCache.delete(oldestKey);
    }
    preview.catch(() => blurredPreviewCache.delete(cacheKey));
  }
  return preview;
}

let watermarkTemplatePromise: Promise<string> | undefined;

async function getWatermarkOverlay(width: number, height: number): Promise<Buffer> {
  watermarkTemplatePromise ??= readFile(join(process.cwd(), 'tools', 'drawing-watermark.svg'), 'utf8');
  const template = await watermarkTemplatePromise;
  return Buffer.from(template
    .replaceAll('{{WIDTH}}', String(width))
    .replaceAll('{{HEIGHT}}', String(height)));
}

async function getWatermarkedImage(imagePath: string, width = 960): Promise<Buffer> {
  const imageInfo = await statFile(imagePath);
  const cacheKey = `${imagePath}:${imageInfo.mtimeMs}:${width}`;
  let preview = watermarkedPreviewCache.get(cacheKey);
  if (preview) return preview;

  preview = renderWatermarkedImage(imagePath, width);
  watermarkedPreviewCache.set(cacheKey, preview);
  if (watermarkedPreviewCache.size > 100) {
    const oldestKey = watermarkedPreviewCache.keys().next().value;
    if (oldestKey) watermarkedPreviewCache.delete(oldestKey);
  }
  preview.catch(() => watermarkedPreviewCache.delete(cacheKey));
  return preview;
}

const watermarkedPreviewCache = new Map<string, Promise<Buffer>>();

async function renderWatermarkedImage(imagePath: string, width: number): Promise<Buffer> {
  const { data, info } = await sharp(imagePath)
    .rotate()
    .resize({ width, withoutEnlargement: true })
    .toBuffer({ resolveWithObject: true });

  return sharp(data)
    .composite([{ input: await getWatermarkOverlay(info.width, info.height) }])
    .webp({ quality: 82 })
    .toBuffer();
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
  const adultFilePath = `18+Sketches/${file.replaceAll('\\', '/')}`;
  const imagePath = await resolveStoredDrawingPath(adultFilePath);
  if (!file || !imagePath || !imageExtensions.has(extname(adultFilePath).toLowerCase())) {
    res.sendStatus(404);
    return;
  }
  const isFreePreview = file.split(/[\\/]/).includes('TopFive');
  if (ADULT_PAYMENT_REQUIRED && !viewer.isPayment && !isFreePreview) {
    try {
      res.type('image/jpeg').send(await getBlurredPreview(imagePath));
    } catch (error) {
      next(error);
    }
    return;
  }
  try {
    res.type('image/webp').send(await getWatermarkedImage(imagePath));
  } catch (error) {
    next(error);
  }
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
const uploadedDrawingsRoot = join(dataDirectory, 'drawings');
const uploadedComicPagesRoot = join(dataDirectory, 'comics');
const supabaseUrl = process.env['SUPABASE_URL']?.replace(/\/+$/, '');
const supabaseServiceRoleKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const supabaseAnonKey = process.env['SUPABASE_ANON_KEY'];
const supabaseEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey);

async function resolveStoredDrawingPath(filePath: string): Promise<string | null> {
  const parts = filePath.split(/[\\/]/);
  if (parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))) return null;

  for (const root of [drawingsRoot, uploadedDrawingsRoot]) {
    const absolutePath = resolve(root, ...parts);
    const relativePath = relative(root, absolutePath);
    if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || absolutePath === root) return null;

    try {
      if ((await statFile(absolutePath)).isFile()) return absolutePath;
    } catch (error) {
      if (error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code))) continue;
      throw error;
    }
  }

  return null;
}

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
    signal: AbortSignal.timeout(12_000),
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

async function countAdultViewers(): Promise<number> {
  if (!supabaseEnabled || !supabaseUrl || !supabaseServiceRoleKey) {
    return (await readAdultViewers()).length;
  }

  const response = await fetch(`${supabaseUrl}/rest/v1/adult_sketch_viewers?select=email`, {
    method: 'HEAD',
    headers: {
      apikey: supabaseServiceRoleKey,
      Authorization: 'Bearer ' + supabaseServiceRoleKey,
      Prefer: 'count=exact',
      Range: '0-0'
    },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) {
    throw new Error(`Supabase viewer count failed (${response.status}): ${await response.text()}`);
  }

  const contentRange = response.headers.get('content-range');
  const count = contentRange?.match(/\/(\d+)$/)?.[1];
  if (count === undefined) {
    throw new Error('Supabase did not return an exact viewer count');
  }
  return Number(count);
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

const artworkUploadCategories = new Map([
  ['Pencil Sketches', 'PencilSketches'],
  ['Color Art', 'ColorArt'],
  ['18+ Sketches', '18+Sketches']
]);

const artworkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 1, fieldSize: 100 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }
    callback(null, true);
  }
});

function parseArtworkUpload(req: express.Request, res: express.Response, next: express.NextFunction): void {
  artworkUpload.single('image')(req, res, error => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        error: error.code === 'LIMIT_FILE_SIZE'
          ? 'Images must be 15 MB or smaller.'
          : 'Upload one JPG, PNG, or WebP image.'
      });
      return;
    }
    next(error);
  });
}

const comicPageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024, files: 1, fields: 2, fieldSize: 100, parts: 3 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }
    callback(null, true);
  }
});

function parseComicPageUpload(req: express.Request, res: express.Response, next: express.NextFunction): void {
  comicPageUpload.single('image')(req, res, error => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      res.status(error.code === 'LIMIT_FILE_SIZE' ? 413 : 400).json({
        error: error.code === 'LIMIT_FILE_SIZE'
          ? 'Comic pages must be 15 MB or smaller.'
          : 'Upload one JPG, PNG, or WebP comic page.'
      });
      return;
    }
    next(error);
  });
}

interface ComicPageManifest {
  [comicAndPart: string]: string[];
}

const comicIdPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const comicPageFilePattern = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\.webp$/i;
let comicPageWriteQueue: Promise<void> = Promise.resolve();

function readComicPageManifest(): Promise<ComicPageManifest> {
  return readDataFile('hindi-comic-pages.json').then(content => {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Hindi comic page manifest must be an object');
    }
    const manifest: ComicPageManifest = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (!Array.isArray(value) || !value.every(file => typeof file === 'string' && comicPageFilePattern.test(file))) {
        throw new Error(`Invalid Hindi comic page manifest entry: ${key}`);
      }
      manifest[key] = value;
    }
    return manifest;
  }).catch(error => {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
    throw error;
  });
}

function comicPageKey(comicId: string, partId: string): string {
  return `${comicId}/${partId}`;
}

function getComicPageUrl(comicId: string, partId: string, file: string): string {
  return `/api/hindi-comics/page?file=${encodeURIComponent(`${comicId}/${partId}/${file}`)}`;
}

async function resolveComicPagePath(filePath: string): Promise<string | null> {
  const parts = filePath.split(/[\\/]/);
  if (
    parts.length !== 3
    || !comicIdPattern.test(parts[0])
    || !comicIdPattern.test(parts[1])
    || !comicPageFilePattern.test(parts[2])
  ) return null;

  const absolutePath = resolve(uploadedComicPagesRoot, ...parts);
  const relativePath = relative(uploadedComicPagesRoot, absolutePath);
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || absolutePath === uploadedComicPagesRoot) return null;

  try {
    return (await statFile(absolutePath)).isFile() ? absolutePath : null;
  } catch (error) {
    if (error instanceof Error && 'code' in error && ['ENOENT', 'ENOTDIR'].includes(String(error.code))) return null;
    throw error;
  }
}

function getTimestampFromDrawingTitle(title: string): string | undefined {
  const match = /^SK_(\d{14})$/.exec(title);
  if (!match) return undefined;
  const timestamp = match[1];
  return `${timestamp.slice(0, 4)}-${timestamp.slice(4, 6)}-${timestamp.slice(6, 8)}T${timestamp.slice(8, 10)}:${timestamp.slice(10, 12)}:${timestamp.slice(12, 14)}Z`;
}


interface Artwork {

  title: string;

  category: string;

  year: string;

  date?: string;

  addedAt?: string;

  image: string;

  imageSmall?: string;

  imageLarge?: string;

  imageSmallWidth?: number;

  imageLargeWidth?: number;

  alt: string;

  isFreePreview?: boolean;

  isPayment?: boolean;

}

interface ResponsiveImageVariants {
  small: string;
  large: string;
  smallWidth: number;
  largeWidth: number;
}

let drawingImageVariantsPromise: Promise<Record<string, ResponsiveImageVariants>> | undefined;

function readDrawingImageVariants(): Promise<Record<string, ResponsiveImageVariants>> {
  if (!drawingImageVariantsPromise) {
    drawingImageVariantsPromise = readFile(
      join(process.cwd(), 'public', 'drawing-image-variants.json'),
      'utf8'
    ).then(content => JSON.parse(content) as Record<string, ResponsiveImageVariants>)
      .catch(error => {
        if (error instanceof Error && 'code' in error && error.code === 'ENOENT') return {};
        throw error;
      });
  }
  return drawingImageVariantsPromise;
}


/*
 * Scan public/drawings recursively.
 */
async function scanDrawings(
  directory: string = drawingsRoot
): Promise<Artwork[]> {

  const drawings: Artwork[] = [];
  const imageVariants = await readDrawingImageVariants();


  async function scan(
    currentDirectory: string,
    sourceRoot: string
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

        await scan(fullPath, sourceRoot);

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
          sourceRoot,
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
      const fileInfo = await statFile(fullPath);
      const addedAt = getTimestampFromDrawingTitle(title) ?? fileInfo.mtime.toISOString();


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
      const responsiveVariants = category === '18+ Sketches'
        ? undefined
        : imageVariants[`drawings/${pathParts.join('/')}`];
      const variants = responsiveVariants ?? (category === '18+ Sketches'
        ? undefined
        : {
          small: getArtworkPreviewUrl(`drawings/${pathParts.join('/')}`, 480),
          large: getArtworkPreviewUrl(`drawings/${pathParts.join('/')}`, 960),
          smallWidth: 480,
          largeWidth: 960
        });

      drawings.push({

        title,

        category,

        year,

        ...(date
          ? { date }
          : {}),

        addedAt,

        image: imagePath,

        ...(variants
          ? {
            imageSmall: variants.small,
            imageLarge: variants.large,
            imageSmallWidth: variants.smallWidth,
            imageLargeWidth: variants.largeWidth
          }
          : {}),

        alt: title,

        ...(category === '18+ Sketches'
          ? { isFreePreview: pathParts.includes('TopFive') }
          : {}),

      });

    }

  }


  await scan(directory, directory);
  if (directory === drawingsRoot) {
    try {
      if ((await statFile(uploadedDrawingsRoot)).isDirectory()) {
        await scan(uploadedDrawingsRoot, uploadedDrawingsRoot);
      }
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }
  }


  return drawings;

}

function getArtworkPreviewUrl(imagePath: string, width: number): string {
  return `/api/drawings/preview?file=${encodeURIComponent(imagePath)}&width=${width}`;
}

app.post('/api/admin/drawings', requireOwner, (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || !allowedApiOrigins.has(origin)) {
    res.status(403).json({ error: 'Sketch uploads are only allowed from the site.' });
    return;
  }
  next();
}, parseArtworkUpload, async (req, res, next) => {

  const categoryFolder = typeof req.body?.category === 'string'
    ? artworkUploadCategories.get(req.body.category)
    : undefined;
  if (!categoryFolder) {
    res.status(400).json({ error: 'Choose Pencil Sketches, Color Art, or 18+ Sketches.' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'Choose an image to upload.' });
    return;
  }

  let metadata: Awaited<ReturnType<ReturnType<typeof sharp>['metadata']>>;
  try {
    metadata = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 }).metadata();
  } catch {
    res.status(400).json({ error: 'The image file could not be read. Upload a valid JPG, PNG, or WebP image.' });
    return;
  }
  const extension = metadata.format === 'jpeg'
    ? '.jpeg'
    : metadata.format === 'png'
      ? '.png'
      : metadata.format === 'webp'
        ? '.webp'
        : '';
  if (
    !extension
    || !metadata.width
    || !metadata.height
    || metadata.width * metadata.height > 40_000_000
    || (metadata.pages || 1) > 1
  ) {
    res.status(400).json({ error: 'The image must be a single-frame JPG, PNG, or WebP under 40 megapixels.' });
    return;
  }
  try {
    await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 960, withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    res.status(400).json({ error: 'The image could not be decoded. Please upload a complete, valid image file.' });
    return;
  }

  const date = currentIndiaDate();
  const timestamp = new Date().toISOString().replace(/\D/g, '').slice(0, 14);
  const fileName = `SK_${timestamp}_${randomUUID().slice(0, 8)}${extension}`;
  const relativePath = `${categoryFolder}/${date}/${fileName}`;
  const destinationDirectory = join(uploadedDrawingsRoot, categoryFolder, date);
  const destinationPath = join(destinationDirectory, fileName);

  try {
    await mkdir(destinationDirectory, { recursive: true });
    await writeFile(destinationPath, req.file.buffer, { flag: 'wx' });
    res.status(201).json({
      ok: true,
      image: `drawings/${relativePath.replaceAll('\\', '/')}`,
      category: req.body.category
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/hindi-comics/pages', async (req, res, next) => {
  const comicId = typeof req.query['comic'] === 'string' ? req.query['comic'] : '';
  const partId = typeof req.query['part'] === 'string' ? req.query['part'] : '';
  if (!comicIdPattern.test(comicId) || !comicIdPattern.test(partId)) {
    res.status(400).json({ error: 'Choose a valid comic and part.' });
    return;
  }
  try {
    const manifest = await readComicPageManifest();
    const files = manifest[comicPageKey(comicId, partId)] || [];
    res.setHeader('Cache-Control', 'no-store');
    res.json({ pages: files.map(file => getComicPageUrl(comicId, partId, file)) });
  } catch (error) {
    next(error);
  }
});

app.get('/api/hindi-comics/page', async (req, res, next) => {
  const file = typeof req.query['file'] === 'string' ? req.query['file'] : '';
  try {
    const parts = file.split(/[\\/]/);
    if (parts.length !== 3 || !comicIdPattern.test(parts[0]) || !comicIdPattern.test(parts[1])) {
      res.sendStatus(404);
      return;
    }
    const manifest = await readComicPageManifest();
    if (!manifest[comicPageKey(parts[0], parts[1])]?.includes(parts[2])) {
      res.sendStatus(404);
      return;
    }
    const imagePath = await resolveComicPagePath(file);
    if (!imagePath) {
      res.sendStatus(404);
      return;
    }
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type('image/webp').send(await getWatermarkedImage(imagePath, 1600));
  } catch (error) {
    next(error);
  }
});

app.post('/api/admin/hindi-comics/pages', requireOwner, (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || !allowedApiOrigins.has(origin)) {
    res.status(403).json({ error: 'Comic uploads are only allowed from the site.' });
    return;
  }
  next();
}, parseComicPageUpload, async (req, res, next) => {
  const comicId = typeof req.body?.comicId === 'string' ? req.body.comicId : '';
  const partId = typeof req.body?.partId === 'string' ? req.body.partId : '';
  if (!comicIdPattern.test(comicId) || !comicIdPattern.test(partId)) {
    res.status(400).json({ error: 'Choose a valid comic and part.' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ error: 'Choose a comic page image to upload.' });
    return;
  }

  let optimizedImage: Buffer;
  try {
    const image = sharp(req.file.buffer, { limitInputPixels: 40_000_000 });
    const metadata = await image.metadata();
    if (
      !['jpeg', 'png', 'webp'].includes(metadata.format || '')
      || !metadata.width
      || !metadata.height
      || metadata.width * metadata.height > 40_000_000
      || (metadata.pages || 1) > 1
    ) {
      res.status(400).json({ error: 'The comic page must be a single-frame JPG, PNG, or WebP under 40 megapixels.' });
      return;
    }
    optimizedImage = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width: 1800, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    res.status(400).json({ error: 'The comic page could not be decoded. Upload a complete, valid image file.' });
    return;
  }

  const file = `${randomUUID()}.webp`;
  const destinationDirectory = join(uploadedComicPagesRoot, comicId, partId);
  const destinationPath = join(destinationDirectory, file);
  try {
    await mkdir(destinationDirectory, { recursive: true });
    await writeFile(destinationPath, optimizedImage, { flag: 'wx' });
    const update = comicPageWriteQueue.then(async () => {
      const manifest = await readComicPageManifest();
      const key = comicPageKey(comicId, partId);
      const pages = manifest[key] || [];
      pages.push(file);
      manifest[key] = pages;
      await saveDataFile('hindi-comic-pages.json', JSON.stringify(manifest, null, 2));
      return pages.length;
    });
    comicPageWriteQueue = update.then(() => undefined, () => undefined);
    const pageNumber = await update;
    res.status(201).json({
      ok: true,
      page: getComicPageUrl(comicId, partId, file),
      pageNumber
    });
  } catch (error) {
    next(error);
  }
});


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

interface StoredCustomDrawingRequest {
  id: string;
  name: string;
  email: string;
  description: string;
  createdAt: string;
  referenceFile: string | null;
}

const customDrawingRequestImagesDirectory = join(dataDirectory, 'custom-drawing-request-images');
const customDrawingRequestRateLimit = new Map<string, number[]>();
const customDrawingRequestRateWindowMs = 60 * 60 * 1000;
const customDrawingRequestRateMax = 3;
let customDrawingRequestWriteQueue: Promise<void> = Promise.resolve();

const customDrawingRequestUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4, fieldSize: 8 * 1024, parts: 5 },
  fileFilter: (_req, file, callback) => {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      callback(new multer.MulterError('LIMIT_UNEXPECTED_FILE', file.fieldname));
      return;
    }
    callback(null, true);
  }
});

function isWithinCustomDrawingRequestRateLimit(ipAddress: string): boolean {
  const now = Date.now();
  const recentSubmissions = (customDrawingRequestRateLimit.get(ipAddress) || [])
    .filter(timestamp => now - timestamp < customDrawingRequestRateWindowMs);
  if (recentSubmissions.length >= customDrawingRequestRateMax) {
    customDrawingRequestRateLimit.set(ipAddress, recentSubmissions);
    return false;
  }

  recentSubmissions.push(now);
  customDrawingRequestRateLimit.set(ipAddress, recentSubmissions);
  if (customDrawingRequestRateLimit.size > 5000) {
    for (const [address, timestamps] of customDrawingRequestRateLimit) {
      if (!timestamps.some(timestamp => now - timestamp < customDrawingRequestRateWindowMs)) {
        customDrawingRequestRateLimit.delete(address);
      }
    }
  }
  return true;
}

function parseCustomDrawingRequestUpload(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
): void {
  customDrawingRequestUpload.single('referenceImage')(req, res, error => {
    if (!error) {
      next();
      return;
    }
    if (error instanceof multer.MulterError) {
      const tooLarge = error.code === 'LIMIT_FILE_SIZE';
      res.status(tooLarge ? 413 : 400).json({
        error: tooLarge
          ? 'The reference image must be 5 MB or smaller.'
          : 'Upload one JPG, PNG, or WebP reference image.'
      });
      return;
    }
    next(error);
  });
}

app.post('/api/custom-drawing-requests', (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || !allowedApiOrigins.has(origin)) {
    res.status(403).json({ error: 'Drawing requests can only be submitted from the site.' });
    return;
  }
  const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
  if (!isWithinCustomDrawingRequestRateLimit(ipAddress)) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return;
  }
  next();
}, parseCustomDrawingRequestUpload, async (req, res, next) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const description = typeof req.body?.description === 'string' ? req.body.description.trim() : '';
  const website = typeof req.body?.website === 'string' ? req.body.website.trim() : '';
  const minimumDescriptionLength = req.file ? 4 : 15;
  if (
    !name || name.length > 80
    || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254
    || description.length < minimumDescriptionLength || description.length > 2000
    || website
  ) {
    res.status(400).json({ error: `Provide your name, a valid email address, and a ${minimumDescriptionLength} to 2000 character drawing description.` });
    return;
  }

  const id = randomUUID();
  let optimizedReference: Buffer | null = null;
  if (req.file) {
    try {
      const image = sharp(req.file.buffer, { limitInputPixels: 40_000_000 });
      const metadata = await image.metadata();
      if (
        !['jpeg', 'png', 'webp'].includes(metadata.format || '')
        || !metadata.width
        || !metadata.height
        || metadata.width * metadata.height > 40_000_000
        || (metadata.pages || 1) > 1
      ) {
        res.status(400).json({ error: 'The reference image must be a valid JPG, PNG, or WebP image.' });
        return;
      }
      optimizedReference = await sharp(req.file.buffer, { limitInputPixels: 40_000_000 })
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    } catch {
      res.status(400).json({ error: 'The reference image could not be read. Please upload a valid image.' });
      return;
    }
  }

  const request: StoredCustomDrawingRequest = {
    id,
    name,
    email,
    description,
    createdAt: new Date().toISOString(),
    referenceFile: optimizedReference ? `${id}.webp` : null
  };

  try {
    if (optimizedReference && request.referenceFile) {
      await mkdir(customDrawingRequestImagesDirectory, { recursive: true });
      await writeFile(join(customDrawingRequestImagesDirectory, request.referenceFile), optimizedReference);
    }
    const update = customDrawingRequestWriteQueue.then(async () => {
      const requests = JSON.parse(await readDataFile('custom-drawing-requests.json')) as StoredCustomDrawingRequest[];
      requests.unshift(request);
      await saveDataFile('custom-drawing-requests.json', JSON.stringify(requests, null, 2));
    });
    customDrawingRequestWriteQueue = update.then(() => undefined, () => undefined);
    await update;
    res.status(201).json({ ok: true, id });
  } catch (error) {
    if (request.referenceFile) {
      try {
        await unlink(join(customDrawingRequestImagesDirectory, request.referenceFile));
      } catch (cleanupError) {
        console.error('Failed to clean up an unsaved drawing request reference image:', cleanupError);
      }
    }
    next(error);
  }
});

app.get('/api/admin/custom-drawing-requests', requireOwner, async (_req, res, next) => {
  try {
    const requests = JSON.parse(await readDataFile('custom-drawing-requests.json')) as StoredCustomDrawingRequest[];
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(requests.slice(0, 100).map(({ referenceFile, ...request }) => ({
      ...request,
      hasReferenceImage: Boolean(referenceFile)
    })));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/custom-drawing-requests/:id/reference', requireOwner, async (req, res, next) => {
  const requestId = typeof req.params['id'] === 'string' ? req.params['id'] : '';
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
    res.status(400).json({ error: 'Provide a valid drawing request.' });
    return;
  }
  try {
    const requests = JSON.parse(await readDataFile('custom-drawing-requests.json')) as StoredCustomDrawingRequest[];
    const request = requests.find(item => item.id === requestId);
    if (!request?.referenceFile) {
      res.status(404).json({ error: 'Reference image not found.' });
      return;
    }
    const image = await readFile(join(customDrawingRequestImagesDirectory, request.referenceFile));
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.type('image/webp').send(image);
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      res.status(404).json({ error: 'Reference image not found.' });
      return;
    }
    next(error);
  }
});

type ArtworkReviewStatus = 'pending' | 'approved' | 'rejected';

interface StoredArtworkReview {
  id: string;
  imagePath: string;
  name: string;
  rating: number;
  comment: string;
  createdAt: string;
  status: ArtworkReviewStatus;
}

interface ArtworkReviewRow {
  id: string;
  image_path: string;
  name: string;
  rating: number;
  comment: string;
  created_at: string;
  status: ArtworkReviewStatus;
}

const reviewRateLimit = new Map<string, number[]>();
const reviewRateWindowMs = 15 * 60 * 1000;
const reviewRateMax = 3;

function isWithinReviewRateLimit(ipAddress: string): boolean {
  const now = Date.now();
  const recentSubmissions = (reviewRateLimit.get(ipAddress) || [])
    .filter(timestamp => now - timestamp < reviewRateWindowMs);

  if (recentSubmissions.length >= reviewRateMax) {
    reviewRateLimit.set(ipAddress, recentSubmissions);
    return false;
  }

  recentSubmissions.push(now);
  reviewRateLimit.set(ipAddress, recentSubmissions);

  if (reviewRateLimit.size > 5000) {
    for (const [address, timestamps] of reviewRateLimit) {
      if (!timestamps.some(timestamp => now - timestamp < reviewRateWindowMs)) {
        reviewRateLimit.delete(address);
      }
    }
  }

  return true;
}

async function validateReviewImagePath(value: unknown): Promise<string | null> {
  if (typeof value !== 'string') return null;
  const imagePath = value.replace(/^\/+/, '');
  if (!imagePath.startsWith('drawings/')) return null;

  const filePath = imagePath.slice('drawings/'.length);
  const parts = filePath.split('/');
  const allowedFolders = new Set(['PencilSketches', '18+Sketches', 'ColorArt', 'FeatureDrawing']);
  if (
    parts.length < 2
    || !allowedFolders.has(parts[0])
    || parts.some(part => !part || part === '.' || part === '..' || part.includes('\\'))
    || !imageExtensions.has(extname(filePath).toLowerCase())
  ) {
    return null;
  }

  return await resolveStoredDrawingPath(filePath) ? imagePath : null;
}

app.get('/api/drawings/preview', async (req, res, next) => {
  try {
    const imagePath = await validateReviewImagePath(req.query['file']);
    const width = Number(req.query['width']);
    if (!imagePath || imagePath.startsWith('drawings/18+Sketches/') || ![480, 960].includes(width)) {
      res.sendStatus(404);
      return;
    }

    const filePath = await resolveStoredDrawingPath(imagePath.slice('drawings/'.length));
    if (!filePath) {
      res.sendStatus(404);
      return;
    }

    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.type('image/webp').send(await getWatermarkedImage(filePath, width));
  } catch (error) {
    next(error);
  }
});

async function readArtworkReviews(
  imagePath?: string,
  status?: ArtworkReviewStatus
): Promise<StoredArtworkReview[]> {
  if (supabaseEnabled) {
    const filters = [
      'select=id,image_path,name,rating,comment,created_at,status',
      'order=created_at.desc',
      'limit=250'
    ];
    if (imagePath) {
      filters.push(`image_path=eq.${encodeURIComponent(imagePath).replace(/\+/g, '%2B')}`);
    }
    if (status) filters.push(`status=eq.${status}`);

    const rows = await supabaseRequest<ArtworkReviewRow[]>(
      `artwork_reviews?${filters.join('&')}`
    );
    return rows.map(row => ({
      id: row.id,
      imagePath: row.image_path,
      name: row.name,
      rating: Number(row.rating),
      comment: row.comment,
      createdAt: row.created_at,
      status: row.status
    }));
  }

  const reviews = JSON.parse(await readDataFile('artwork-reviews.json')) as StoredArtworkReview[];
  return reviews
    .filter(review => (!imagePath || review.imagePath === imagePath) && (!status || review.status === status))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
}

async function readArtworkReviewCounts(): Promise<Record<string, number>> {
  const counts: Record<string, number> = Object.create(null) as Record<string, number>;

  if (supabaseEnabled) {
    const pageSize = 1000;
    let offset = 0;
    while (true) {
      const rows = await supabaseRequest<Array<{ image_path: string }>>(
        `artwork_reviews?select=image_path&status=eq.approved&order=id.asc&limit=${pageSize}&offset=${offset}`
      );
      for (const row of rows) {
        counts[row.image_path] = (counts[row.image_path] || 0) + 1;
      }
      if (rows.length < pageSize) break;
      offset += pageSize;
    }
    return counts;
  }

  const reviews = JSON.parse(await readDataFile('artwork-reviews.json')) as StoredArtworkReview[];
  for (const review of reviews) {
    if (review.status === 'approved') {
      counts[review.imagePath] = (counts[review.imagePath] || 0) + 1;
    }
  }
  return counts;
}

let artworkReviewWriteQueue: Promise<void> = Promise.resolve();

app.get('/api/review-counts', async (req, res, next) => {
  try {
    const counts = await readArtworkReviewCounts();
    const accessId = getAdultAccessId(req);
    const viewer = accessId ? await findAdultViewerByAccessId(accessId) : undefined;
    const visibleCounts = Object.fromEntries(
      Object.entries(counts).filter(([imagePath]) =>
        viewer || !imagePath.startsWith('drawings/18+Sketches/')
      )
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(visibleCounts);
  } catch (error) {
    next(error);
  }
});

app.get('/api/reviews', async (req, res, next) => {
  try {
    const imagePath = await validateReviewImagePath(req.query['image']);
    if (!imagePath) {
      res.status(400).json({ error: 'Select a valid artwork to view its reviews.' });
      return;
    }

    if (imagePath.startsWith('drawings/18+Sketches/')) {
      const accessId = getAdultAccessId(req);
      if (!accessId || !await findAdultViewerByAccessId(accessId)) {
        res.status(403).json({ error: 'Confirm adult access to view these reviews.' });
        return;
      }
    }

    const reviews = await readArtworkReviews(imagePath, 'approved');
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(reviews.slice(0, 100).map(({ id, imagePath: reviewImagePath, name, rating, comment, createdAt }) => ({
      id,
      imagePath: reviewImagePath,
      name,
      rating,
      comment,
      createdAt
    })));
  } catch (error) {
    next(error);
  }
});

app.post('/api/reviews', async (req, res, next) => {
  const origin = req.headers.origin;
  if (!origin || !allowedApiOrigins.has(origin)) {
    res.status(403).json({ error: 'Reviews can only be submitted from the site.' });
    return;
  }

  const imagePath = await validateReviewImagePath(req.body?.image);
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const comment = typeof req.body?.comment === 'string' ? req.body.comment.trim() : '';
  const rating = req.body?.rating;
  const website = typeof req.body?.website === 'string' ? req.body.website.trim() : '';

  if (!imagePath || name.length > 60 || comment.length < 5 || comment.length > 1000
    || !Number.isInteger(rating) || rating < 1 || rating > 5 || website) {
    res.status(400).json({ error: 'Provide a rating and a comment of 5 to 1000 characters.' });
    return;
  }

  try {
    if (imagePath.startsWith('drawings/18+Sketches/')) {
      const accessId = getAdultAccessId(req);
      if (!accessId || !await findAdultViewerByAccessId(accessId)) {
        res.status(403).json({ error: 'Confirm adult access before reviewing this artwork.' });
        return;
      }
    }

    const ipAddress = req.ip || req.socket.remoteAddress || 'unknown';
    if (!isWithinReviewRateLimit(ipAddress)) {
      res.status(429).json({ error: 'Too many reviews. Please try again later.' });
      return;
    }

    const review: StoredArtworkReview = {
      id: randomUUID(),
      imagePath,
      name: name || 'Guest',
      rating,
      comment,
      createdAt: new Date().toISOString(),
      status: 'pending'
    };

    if (supabaseEnabled) {
      const rows = await supabaseRequest<ArtworkReviewRow[]>(
        'artwork_reviews?select=id,image_path,name,rating,comment,created_at,status',
        {
          method: 'POST',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            image_path: review.imagePath,
            name: review.name,
            rating: review.rating,
            comment: review.comment,
            status: review.status
          })
        }
      );
      if (!rows.length) throw new Error('Review submission was not saved');
    } else {
      const update = artworkReviewWriteQueue.then(async () => {
        const reviews = JSON.parse(await readDataFile('artwork-reviews.json')) as StoredArtworkReview[];
        reviews.unshift(review);
        await saveDataFile('artwork-reviews.json', JSON.stringify(reviews, null, 2));
      });
      artworkReviewWriteQueue = update.then(() => undefined, () => undefined);
      await update;
    }

    res.status(202).json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/reviews', requireOwner, async (_req, res, next) => {
  try {
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(await readArtworkReviews(undefined, 'pending'));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin/review-image', requireOwner, async (req, res, next) => {
  try {
    const imagePath = await validateReviewImagePath(req.query['image']);
    if (!imagePath) {
      res.status(404).json({ error: 'Artwork image not found.' });
      return;
    }

    const filePath = await resolveStoredDrawingPath(imagePath.slice('drawings/'.length));
    if (!filePath) {
      res.status(404).json({ error: 'Artwork image not found.' });
      return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.sendFile(filePath, error => error && next(error));
  } catch (error) {
    next(error);
  }
});

app.patch('/api/admin/reviews/:id', requireOwner, async (req, res, next) => {
  const origin = req.headers.origin;
  const reviewId = typeof req.params['id'] === 'string' ? req.params['id'] : '';
  const status = req.body?.status;
  if (!origin || !allowedApiOrigins.has(origin)) {
    res.status(403).json({ error: 'Review moderation is only allowed from the site.' });
    return;
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(reviewId)
    || (status !== 'approved' && status !== 'rejected')) {
    res.status(400).json({ error: 'Provide a valid review and moderation status.' });
    return;
  }

  try {
    if (supabaseEnabled) {
      const rows = await supabaseRequest<ArtworkReviewRow[]>(
        `artwork_reviews?id=eq.${encodeURIComponent(reviewId)}&select=id,image_path,name,rating,comment,created_at,status`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({ status })
        }
      );
      if (!rows.length) {
        res.status(404).json({ error: 'Review not found.' });
        return;
      }
    } else {
      const update = artworkReviewWriteQueue.then(async () => {
        const reviews = JSON.parse(await readDataFile('artwork-reviews.json')) as StoredArtworkReview[];
        const review = reviews.find(item => item.id === reviewId);
        if (!review) return false;
        review.status = status;
        await saveDataFile('artwork-reviews.json', JSON.stringify(reviews, null, 2));
        return true;
      });
      artworkReviewWriteQueue = update.then(() => undefined, () => undefined);
      if (!await update) {
        res.status(404).json({ error: 'Review not found.' });
        return;
      }
    }

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

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
    const requestedImage = req.body?.image;
    const image = typeof requestedImage === 'string'
      ? requestedImage.replace(/^\/+/, '')
      : '';

    if (
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
  
