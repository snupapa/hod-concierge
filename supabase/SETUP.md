# Supabase Setup

## 1. Create or choose your Supabase project

Use your existing Supabase account and pick the project you want to connect to `House of Deb`.

## 2. Run the database schema

Open the Supabase SQL editor and run:

- [schema.sql](C:\Users\Snu\Personal%20Projects\conceirge-page\supabase\schema.sql)

This creates:

- `inquiries`
- `admin_users`
- row-level security policies for admin access
- indexes and update triggers

After that, add your admin email:

```sql
insert into public.admin_users (email)
values ('you@example.com');
```

## 3. Add your site env file

Create a local `.env` in the project root using:

- [\.env.example](C:\Users\Snu\Personal%20Projects\conceirge-page\.env.example)

Set:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
VITE_SUPABASE_FUNCTIONS_URL=https://your-project-ref.functions.supabase.co
```

## 4. Deploy the Edge Function

This project includes:

- [submit-inquiry function](C:\Users\Snu\Personal%20Projects\conceirge-page\supabase\functions\submit-inquiry\index.ts)

Deploy it with the Supabase CLI:

```bash
supabase login
supabase link --project-ref your-project-ref
supabase functions deploy submit-inquiry --no-verify-jwt
```

`--no-verify-jwt` is important because the public website submits this function without a logged-in user.

## 5. Add notification secrets

If you want email alerts on every new inquiry, set these function secrets:

```bash
supabase secrets set RESEND_API_KEY=re_xxx
supabase secrets set NOTIFY_TO_EMAIL=you@example.com
supabase secrets set NOTIFY_FROM_EMAIL=House of Deb <inquiries@yourdomain.com>
```

If these are not set, the form still works and stores inquiries in Supabase, but no notification email is sent.

## 6. Configure Supabase Auth redirect URLs

For the admin magic-link sign-in, add these redirect URLs in Supabase Auth settings:

- `http://localhost:5173/admin.html`
- your production admin URL, for example `https://yourdomain.com/admin.html`

## 7. Run locally

```powershell
.\start-dev.ps1
```

Pages:

- Public site: `http://localhost:5173`
- Admin dashboard: `http://localhost:5173/admin.html`

## Notes

- The public form now submits through the Edge Function instead of inserting directly from the browser.
- Spam protection currently includes a honeypot field, minimum fill time, and IP-based rate limiting in the Edge Function.
- The admin dashboard uses Supabase email magic links and only shows data to emails listed in `admin_users`.
