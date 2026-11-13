# webapp-UI

## 18+ gallery and owner access

The five images under `public/drawings/18+Sketches/**/TopFive/` are free previews. Other adult images stay blurred until the site owner verifies a ₹20 one-time UPI payment and marks the viewer's `isPayment` status as `true` from `/admin`. The payment flag is stored on the server and is never accepted from the visitor's browser. UPI payment instructions are not configured yet; update the gallery message when payment details are ready.

The gallery collects a name and email without email verification, then displays the free previews and blurred remaining images. When Supabase is configured, viewer details and payment statuses are stored in its `adult_sketch_viewers` table. Run `supabase/adult-sketch-viewers.sql` in the Supabase SQL Editor to create or migrate the table and secure recording function. Without the database service-role key, records fall back to `adult-sketch-viewers.json` under `DATA_DIR` (or the local `data/` directory), which requires persistent storage in production. Since email ownership is not checked, anyone can enter an email that has already been approved for paid access.

Configure these environment variables on the API server before enabling the feature:

- `AUTH_SECRET`: a long random secret used to sign access cookies (use at least 32 random characters).
- `SUPABASE_URL`: the Supabase Project URL.
- `SUPABASE_ANON_KEY`: optional for legacy email-link verification; it is not used by the current gallery flow.
- `SUPABASE_SERVICE_ROLE_KEY`: the server-only service role key, used for persistent viewer and payment records.
- `ADMIN_USERNAME`: the owner's login name (or use `ADMIN_EMAIL` to keep email-based login).
- `ADMIN_PASSWORD`: a strong owner login password.
- `DATA_DIR`: needed for the local JSON fallback; with Supabase configured, the persistent disk is not required for viewer records.

Open `/admin` to sign in, review registered viewer emails, and manually approve or revoke payment status. Automatic payment verification is not configured; UPI payments must be checked by the owner. The age check remains a self-attestation and does not independently verify the visitor's age.
