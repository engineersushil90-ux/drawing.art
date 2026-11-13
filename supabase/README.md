# Supabase setup

1. Create a Supabase project on the Free plan.
2. Open **SQL Editor**, paste `schema.sql`, and run it. This creates the likes and visit tables, daily activity counters (using India time), atomic increment functions, and seeds the current counts. Run the updated SQL again after pulling changes so existing projects get the daily counters.
3. Paste `adult-sketch-viewers.sql` into the SQL Editor and run it. It creates or migrates the viewer table with the server-controlled payment flag and access identifier.
4. In **Project Settings → API**, copy the Project URL, the publishable/anon key, and the server-side `service_role` key.
5. In **Authentication → Providers**, enable email sign-in. Configure SMTP under **Authentication → SMTP Settings**, and set the email template to show the one-time token with `{{ .Token }}`.
6. In Render, open the `drawing.art` service's **Environment** page and add:
   - `SUPABASE_URL` = the Supabase Project URL
   - `SUPABASE_ANON_KEY` = the publishable/anon key (used server-side for email OTP)
   - `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` key
   - `AUTH_SECRET` = a random secret with at least 32 characters
7. Save changes and redeploy the Render service.

Keep both Supabase keys in Render's server environment. Never add the `service_role` key to Angular code or commit it to this repository.

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present, `/api/likes`, `/api/visits`, and viewer/payment records use Supabase. Email OTP verification also requires `SUPABASE_ANON_KEY`. Without the service-role key, local development continues to use JSON files in `data/`.

The site's `/admin` page is used to mark a verified email as paid after checking a ₹20 UPI transfer. Payment verification is manual until a supported payment gateway is configured.
