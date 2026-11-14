# Drawing uploads

Use the two folders in this directory:

- `PencilSketches` for pencil and portrait drawings
- `ColorArt` for colored drawings and paintings
- `FeatureDrawing` for the large image shown on the Home page

Put JPG, JPEG, PNG, WEBP, GIF, or AVIF images directly into either folder. You can also organize each folder with dated subfolders such as `2026-09-14`; the five newest dates are shown first.

To rename images in a folder with sortable date-and-time names, copy `RnameImage.bat` into the folder containing the images and run it there. Names use `SK_YYYYMMDDHHMMSS` (for example, `SK_20261114080423.jpg`), and the newest timestamped images appear first in the gallery.

`npm run build` and `npm run start:dev` generate 480px and 960px WebP variants for public drawings. These are build artifacts under the ignored `public/drawings-optimized` folder; keep the original images in Git because they remain the full-size/lightbox fallback. 18+ images are excluded from this optimization and remain behind the adult-access API.
