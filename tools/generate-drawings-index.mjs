import {
  readdir,
  writeFile
} from 'node:fs/promises';

import {
  join,
  relative,
  extname,
  basename
} from 'node:path';

const projectRoot = process.cwd();

const drawingsRoot =
  join(projectRoot, 'public', 'drawings');

const outputFile =
  join(projectRoot, 'public', 'drawings.json');

const categories = {
  'PencilSketches': 'Pencil Sketches',
  '18+Sketches': '18+ Sketches',
  'ColorArt': 'Color Art',
  'FeatureDrawing': 'Feature Drawing'
};

const imageExtensions = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif'
]);

async function scanDirectory(
  directory,
  category
) {
  const entries = await readdir(
    directory,
    { withFileTypes: true }
  );

  const drawings = [];

  for (const entry of entries) {

    const fullPath =
      join(directory, entry.name);

    // If directory, scan it recursively
    if (entry.isDirectory()) {

      const nestedDrawings =
        await scanDirectory(
          fullPath,
          category
        );

      drawings.push(
        ...nestedDrawings
      );

      continue;
    }

    // Ignore non-image files
    const extension =
      extname(entry.name).toLowerCase();

    if (!imageExtensions.has(extension)) {
      continue;
    }

    /*
      Example:

      public/drawings/
      PencilSketches/
      2026-09-14/
      my-sketch.jpg
    */

    const relativePath =
      relative(
        join(projectRoot, 'public'),
        fullPath
      ).replaceAll('\\', '/');

    const pathParts =
      relativePath.split('/');

    // drawings / category / date / image
    const date =
      pathParts.length >= 3
        ? pathParts[2]
        : '';

    const title =
      basename(
        entry.name,
        extension
      );

    const year =
      /^\d{4}/.test(date)
        ? date.substring(0, 4)
        : new Date()
            .getFullYear()
            .toString();

    drawings.push({
      title,
      category,
      year,
      date,
      image: relativePath,
      alt: title
    });
  }

  return drawings;
}

async function generateDrawings() {

  const categoryFolders =
    await readdir(
      drawingsRoot,
      { withFileTypes: true }
    );

  let allDrawings = [];

  for (
    const folder
    of categoryFolders
  ) {

    if (!folder.isDirectory()) {
      continue;
    }

    const category =
      categories[folder.name];

    if (!category) {
      continue;
    }

    const categoryPath =
      join(
        drawingsRoot,
        folder.name
      );

    const drawings =
      await scanDirectory(
        categoryPath,
        category
      );

    allDrawings.push(
      ...drawings
    );
  }

  // Sort newest first
  allDrawings.sort(
    (a, b) =>
      b.date.localeCompare(a.date)
  );

  await writeFile(
    outputFile,
    JSON.stringify(
      allDrawings,
      null,
      2
    ),
    'utf8'
  );

  const featured =
    allDrawings.filter(
      drawing =>
        drawing.category ===
        'Feature Drawing'
    );

  console.log(
    `Indexed ${allDrawings.length} drawing(s) and ${featured.length} featured drawing(s).`
  );

  console.log(
    `Generated: ${outputFile}`
  );
}

generateDrawings().catch(error => {
  console.error(
    'Failed to generate drawings:',
    error
  );

  process.exit(1);
});