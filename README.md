# webapp-UI

## 18+ gallery and owner access

All images in the 18+ gallery are currently free after the visitor confirms they are at least 18. Payment-based locking is temporarily disabled in both the gallery and image API; the existing payment/admin tracking code remains available if paid access is re-enabled later.

The gallery collects a name and email without email verification, then displays the 18+ drawings after the age confirmation. When Supabase is configured, viewer details and payment statuses are stored in its `adult_sketch_viewers` table. Run `supabase/adult-sketch-viewers.sql` in the Supabase SQL Editor to create or migrate the table and secure recording function. Without the database service-role key, records fall back to `adult-sketch-viewers.json` under `DATA_DIR` (or the local `data/` directory), which requires persistent storage in production. Email ownership is not checked.

Configure these environment variables on the API server before enabling the feature:

- `AUTH_SECRET`: a long random secret used to sign access cookies (use at least 32 random characters).
- `SUPABASE_URL`: the Supabase Project URL.
- `SUPABASE_ANON_KEY`: optional for legacy email-link verification; it is not used by the current gallery flow.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service role key, used for persistent viewer and payment records.
- `ADMIN_USERNAME`: the owner's login name (or use `ADMIN_EMAIL` to keep email-based login).
- `ADMIN_PASSWORD`: a strong owner login password.
- `DATA_DIR`: needed for the local JSON fallback; with Supabase configured, the persistent disk is not required for viewer records.

Open `/admin` to sign in, review registered viewer emails, and manually approve or revoke payment status. Automatic payment verification is not configured; UPI payments must be checked by the owner. The age check remains a self-attestation and does not independently verify the visitor's age.
