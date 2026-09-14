import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { basename, extname, join } from 'node:path';

const drawingsRoot = join(process.cwd(), 'public', 'drawings');
const outputFile = join(process.cwd(), 'src', 'app', 'core', 'data', 'drawings.generated.ts');
const imageExtensions = new Set(['.avif', '.gif', '.jpeg', '.jpg', '.png', '.webp']);

if (!existsSync(drawingsRoot)) mkdirSync(drawingsRoot, { recursive: true });

const categories = [
  { folder: 'PencilSketches', label: 'Pencil Sketches' },
  { folder: 'ColorArt', label: 'Color Art' }
];

function imageRecords(folder, category, date = '') {
  const fullPath = join(drawingsRoot, folder, date);
  if (!existsSync(fullPath)) return [];
  return readdirSync(fullPath)
    .filter((file) => imageExtensions.has(extname(file).toLowerCase()))
    .filter((file) => statSync(join(fullPath, file)).isFile())
    .sort((a, b) => b.localeCompare(a))
    .map((file) => {
      const title = basename(file, extname(file)).replace(/[-_]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
      const imagePath = date ? `/drawings/${folder}/${date}/${file}` : `/drawings/${folder}/${file}`;
      return { title, category, year: date.slice(0, 4) || '', date, image: imagePath, alt: title };
    });
}

const drawings = categories.flatMap(({ folder, label }) => {
  const categoryRoot = join(drawingsRoot, folder);
  if (!existsSync(categoryRoot)) return [];
  const datedFolders = readdirSync(categoryRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(entry.name))
    .map((entry) => entry.name).sort((a, b) => b.localeCompare(a)).slice(0, 5);
  return [...datedFolders.flatMap((date) => imageRecords(folder, label, date)), ...imageRecords(folder, label)];
}).sort((a, b) => b.date.localeCompare(a.date) || a.category.localeCompare(b.category));

const featuredDrawing = imageRecords('FeatureDrawing', 'Featured Drawing')[0] ?? null;

mkdirSync(join(process.cwd(), 'src', 'app', 'core', 'data'), { recursive: true });
writeFileSync(outputFile, `// Generated automatically. Do not edit directly.\nexport const localDrawings = ${JSON.stringify(drawings, null, 2)} as const;\nexport const featuredDrawing = ${JSON.stringify(featuredDrawing, null, 2)} as const;\n`);
console.log(`Indexed ${drawings.length} gallery image(s) and ${featuredDrawing ? '1' : '0'} featured drawing.`);
