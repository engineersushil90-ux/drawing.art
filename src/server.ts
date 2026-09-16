import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';

import express from 'express';

import {
  join,
  relative,
  extname,
  basename,
} from 'node:path';
import { readFile, writeFile, mkdir } from 'node:fs/promises';

import { readdir } from 'node:fs/promises';


const browserDistFolder =
  join(import.meta.dirname, '../browser');


const app = express();
app.use(express.json());
const angularApp =
  new AngularNodeAppEngine();


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

const visitsFile = join(
  process.cwd(),
  'data',
  'visits.json'
);

async function readVisits(): Promise<number> {

  try {

    const data = await readFile(
      visitsFile,
      'utf8'
    );

    const parsed = JSON.parse(data);

    return Number(parsed.visits) || 0;

  } catch {

    return 0;

  }

}

async function saveVisits(
  visits: number
): Promise<void> {

  await mkdir(
    join(process.cwd(), 'data'),
    {
      recursive: true
    }
  );

  await writeFile(
    visitsFile,
    JSON.stringify(
      { visits },
      null,
      2
    ),
    'utf8'
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

app.post('/api/visits', async (req, res, next) => {

  try {

    const visits = await readVisits();

    const newVisits = visits + 1;

    await saveVisits(newVisits);

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

const likesFile = join(process.cwd(), 'data', 'likes.json');

let likesWriteQueue = Promise.resolve();

async function readLikes(): Promise<Record<string, number>> {
  try {
    const data = await readFile(likesFile, 'utf8');
    const parsed = JSON.parse(data);

    return parsed.likes ?? {};
  } catch {
    return {};
  }
}

async function saveLikes(likes: Record<string, number>): Promise<void> {
  await mkdir(join(process.cwd(), 'data'), {
    recursive: true
  });

  await writeFile(
    likesFile,
    JSON.stringify({ likes }, null, 2),
    'utf8'
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

    likesWriteQueue = likesWriteQueue.then(async () => {
      const likes = await readLikes();

      likes[image] = (likes[image] || 0) + 1;

      await saveLikes(likes);

      res.json({
        image,
        likes: likes[image]
      });
    }).catch(error => {
      next(error);
    });

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


/**
 * Handle all other requests
 * by rendering Angular.
 */
app.use(
  (req, res, next) => {

    angularApp
      .handle(req)

      .then(
        response =>
          response
            ? writeResponseToNodeResponse(
                response,
                res
              )
            : next()
      )

      .catch(next);

  }
);


/**
 * Start the server.
 */
if (
  isMainModule(import.meta.url)
  ||
  process.env['pm_id']
) {

  const port =
    process.env['PORT'] || 4000;


  app.listen(
    port,
    (error) => {

      if (error) {

        throw error;

      }


      console.log(
        `Node Express server listening on http://localhost:${port}`
      );

    }
  );

}




/**
 * Request handler used by Angular CLI
 * and Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

export default reqHandler;
  

