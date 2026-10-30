# webapp-UI

## 18+ gallery and owner access

When Supabase is configured, age confirmations are stored in its `adult_sketch_viewers` table. Run `supabase/adult-sketch-viewers.sql` once in the Supabase SQL Editor to create the table and secure recording function. Without Supabase, records fall back to `adult-sketch-viewers.json` under `DATA_DIR` (or the local `data/` directory), which requires persistent storage in production.

Configure these environment variables on the API server before enabling the feature:

- `AUTH_SECRET`: a long random secret used to sign access cookies (use at least 32 random characters).
- `ADMIN_EMAIL`: the owner's login email.
- `ADMIN_PASSWORD`: a strong owner login password.
- `DATA_DIR`: only needed for the local JSON fallback; with Supabase configured, the persistent disk is not required for viewer records.

Open `/admin` to sign in and view the recorded access list. The age check is a self-attestation; it does not independently verify the visitor's age or email address.
