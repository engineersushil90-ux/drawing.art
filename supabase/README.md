# Supabase setup

1. Create a Supabase project on the Free plan.
2. Open **SQL Editor**, paste `schema.sql`, and run it. This creates the likes and visit tables, daily activity counters (using India time), atomic increment functions, and seeds the current counts. Run the updated SQL again after pulling changes so existing projects get the daily counters.
3. In **Project Settings → API**, copy the Project URL and the server-side `service_role` key.
4. In Render, open the `drawing.art` service's **Environment** page and add:
   - `SUPABASE_URL` = the Supabase Project URL
   - `SUPABASE_SERVICE_ROLE_KEY` = the `service_role` key
5. Save changes and redeploy the Render service.

Keep the `service_role` key only in Render's server environment. Never add it to Angular code or commit it to this repository.

When both variables are present, `/api/likes` and `/api/visits` use Supabase. Without them, local development continues to use the JSON files in `data/`.
