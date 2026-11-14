# Supabase setup

1. Create a Supabase project on the Free plan.
2. Open **SQL Editor**, paste `schema.sql`, and run it. This creates the likes and visit tables, daily activity counters (using India time), atomic increment functions, and seeds the current counts. Run the updated SQL again after pulling changes so existing projects get the daily counters.
3. Paste `adult-sketch-viewers.sql` into the SQL Editor and run it. It creates or migrates the viewer table, adds the payment-request timestamp, and creates the private `admin_users` table.
4. In **Project Settings → API**, copy the Project URL, the publishable/anon key, and the server-side `service_role` key.
5. Email sign-in and redirect URL configuration are not required for the current adult gallery flow; it does not send verification emails.
7. In Render, open the `drawing.art` service's **Environment** page and add:
   - `SUPABASE_URL` = the Supabase Project URL
   - `SUPABASE_ANON_KEY` = optional for legacy email-link verification; not used by the current gallery flow
   - `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` key
   - `AUTH_SECRET` = a random secret with at least 32 characters
8. Save changes and redeploy the Render service and the updated application code.

Keep both Supabase keys in Render's server environment. Never add the `service_role` key to Angular code or commit it to this repository.

When `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are present, `/api/likes`, `/api/visits`, and viewer/payment records use Supabase. Without the service-role key, local development continues to use JSON files in `data/`. The gallery does not verify email ownership; manually approved payment status applies to anyone who enters the same email.

The site's `/admin` page requires owner sign-in before it shows registered viewer names, emails, view times, and the total count. The separate count endpoint returns only the aggregate count.
