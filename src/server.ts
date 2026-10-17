import express from 'express';

import {
  join,
  relative,
  extname,
  basename,
} from 'node:path';
import { readFile, writeFile, mkdir, rename } from 'node:fs/promises';

import { readdir } from 'node:fs/promises';


const browserDistFolder =
  join(import.meta.dirname, '../browser');


const app = express();
app.use(express.json());


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
const supabaseEnabled = Boolean(supabaseUrl && supabaseServiceRoleKey);

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
        '/drawings/' +
        pathParts
          .map(part =>
            encodeURIComponent(part)
          )
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

      res.json(drawings);

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
  

