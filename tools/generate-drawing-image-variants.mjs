import {
  mkdir,
  readdir,
  stat,
  writeFile
} from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import sharp from 'sharp';

const projectRoot = process.cwd();
const drawingsRoot = join(projectRoot, 'public', 'drawings');
const optimizedRoot = join(projectRoot, 'public', 'drawings-optimized');
const publicCategories = new Set(['PencilSketches', 'ColorArt', 'FeatureDrawing']);
const imageExtensions = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.gif']);
const imageWidths = [480, 960];
let generatedVariants = 0;
const imageManifest = {};

async function optimizeImage(sourcePath, relativePath) {
  const metadata = await sharp(sourcePath, { limitInputPixels: 40_000_000 }).metadata();
  if (!metadata.width || !metadata.height || (metadata.pages || 1) > 1) {
    console.log(`Skipping responsive variants for unsupported image: ${relativePath}`);
    return;
  }

  const orientedWidth = [5, 6, 7, 8].includes(metadata.orientation)
    ? metadata.height
    : metadata.width;
  const sourceInfo = await stat(sourcePath);
  const cacheVersion = Math.trunc(sourceInfo.mtimeMs);
  const extension = extname(relativePath);
  const outputBase = basename(relativePath, extension);
  const directoryParts = relativePath.split(/[\\/]/);
  directoryParts.pop();
  const outputDirectory = join(optimizedRoot, ...directoryParts);
  await mkdir(outputDirectory, { recursive: true });

  for (const width of imageWidths) {
    const outputPath = join(outputDirectory, `${outputBase}-${width}.webp`);
    try {
      if ((await stat(outputPath)).mtimeMs >= sourceInfo.mtimeMs) continue;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'ENOENT')) throw error;
    }

    await sharp(sourcePath, { limitInputPixels: 40_000_000 })
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toFile(outputPath);
    generatedVariants++;
  }

  const optimizedRelativeDirectory = relativePath.split(/[\\/]/).slice(0, -1);
  imageManifest[`drawings/${relativePath.replaceAll('\\', '/')}`] = {
    small: `/drawings-optimized/${[
      ...optimizedRelativeDirectory,
      `${outputBase}-480.webp`
    ].map(encodeURIComponent).join('/')}?v=${cacheVersion}`,
    large: `/drawings-optimized/${[
      ...optimizedRelativeDirectory,
      `${outputBase}-960.webp`
    ].map(encodeURIComponent).join('/')}?v=${cacheVersion}`,
    smallWidth: Math.min(orientedWidth, imageWidths[0]),
    largeWidth: Math.min(orientedWidth, imageWidths[1])
  };
}

async function scanDirectory(directory, relativeDirectory = '') {
  const entries = await readdir(directory, { withFileTypes: true });
  for (const entry of entries) {
    const sourcePath = join(directory, entry.name);
    const relativePath = join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      await scanDirectory(sourcePath, relativePath);
      continue;
    }
    if (imageExtensions.has(extname(entry.name).toLowerCase())) {
      await optimizeImage(sourcePath, relativePath);
    }
  }
}

const categoryEntries = await readdir(drawingsRoot, { withFileTypes: true });
for (const entry of categoryEntries) {
  if (!entry.isDirectory() || !publicCategories.has(entry.name)) continue;
  await scanDirectory(join(drawingsRoot, entry.name), entry.name);
}

await writeFile(
  join(projectRoot, 'public', 'drawing-image-variants.json'),
  JSON.stringify(imageManifest, null, 2),
  'utf8'
);
console.log(`Updated ${generatedVariants} responsive WebP image variant(s).`);
