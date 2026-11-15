# webapp-UI

## Artwork watermarks

The image-variant build embeds a repeating `SK DRAWING` watermark in the 480px and 960px WebP previews used by the public gallery and lightbox. The Angular build excludes `public/drawings/`, so the original artwork files are not served as frontend assets. The 18+ image API also returns a watermarked preview no wider than 960px.

This prevents the site from serving clean originals, but cannot stop screenshots or removal attempts. Keep original artwork out of any publicly accessible source repository or storage.

## 18+ gallery and owner access

All images in the 18+ gallery are currently free after the visitor confirms they are at least 18. Payment-based locking is temporarily disabled in both the gallery and image API; the existing payment/admin tracking code remains available if paid access is re-enabled later.

The gallery collects a name and email without email verification, then displays the 18+ drawings after the age confirmation. When Supabase is configured, viewer details and payment statuses are stored in its `adult_sketch_viewers` table. Run `supabase/adult-sketch-viewers.sql` in the Supabase SQL Editor to create or migrate the table and secure recording function. Without the database service-role key, records fall back to `adult-sketch-viewers.json` under `DATA_DIR` (or the local `data/` directory), which requires persistent storage in production. Email ownership is not checked.

Configure these environment variables on the API server before enabling the feature:

- `AUTH_SECRET`: a long random secret used to sign access cookies (use at least 32 random characters).
- `SUPABASE_URL`: the Supabase Project URL.
- `SUPABASE_ANON_KEY`: optional for legacy email-link verification; it is not used by the current gallery flow.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service role key, used for persistent viewer and payment records.
- `DATA_DIR`: needed for the local JSON fallback; with Supabase configured, the persistent disk is not required for viewer records.

## Uploading sketches

Sign in at `/admin` and use **Upload a sketch** to add a JPG, PNG, or WebP (up to 15 MB) to Pencil Sketches, Color Art, or 18+ Sketches. A case-insensitive name check prevents uploading another drawing with an existing filename stem; the admin page also lists uploaded sketches and lets the owner delete them. Only images uploaded through the admin page can be deleted there; drawings included in the repository are not deletable. Uploaded originals are stored under `DATA_DIR/drawings`; the gallery serves watermarked previews. Configure `DATA_DIR` to a persistent disk path on the API host so uploads survive restarts and deployments.

To add Hindi comic pages, sign in at `/admin`, choose **Upload a Hindi comic page**, select the comic and part, then upload each page in reading order. Pages are optimized and stored under `DATA_DIR/comics`, and the reader displays watermarked previews in that order. Configure `DATA_DIR` to a persistent disk path on the API host so comic pages survive restarts and deployments.

Comic images already in the repository can instead go under `public/drawings/Comics/<ComicName>/`, using names like `Part1.png`, `Part1-2.png`, and `Part1-3.png`. These are served in the matching Hindi Comics reader part and excluded from the regular drawings gallery.

Open `/admin` and sign in with the configured owner credentials to view the 18+ gallery's registered names, emails, last-view times, and total unique email count. Viewer details require admin authentication. Email ownership and the age check are not independently verified.
