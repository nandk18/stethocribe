# Migrating StethoScribe from Lovable Cloud → Your Own Supabase

This package contains everything you need to move your project to a self-hosted Supabase project.

## ⚠️ Read this first

1. **Lovable Cloud cannot be re-enabled** once disabled on this project. Decide carefully.
2. **`.env` and `src/integrations/supabase/client.ts` are auto-managed** while Cloud is enabled. Disable Cloud BEFORE swapping these files (Connectors → Lovable Cloud → Disable Cloud).
3. **Edge functions stop auto-deploying.** You must use the Supabase CLI for every future change.
4. **Lovable AI Gateway (`LOVABLE_API_KEY`) won't work** off Cloud. The two functions using it must be switched to direct OpenAI/Anthropic calls (the other 6 already use direct keys).

---

## Step-by-step cutover

### 1. Create your new Supabase project
- Go to https://supabase.com/dashboard → New Project
- Note: `Project URL`, `anon key`, `service_role key`

### 2. Apply the schema
- Open **SQL Editor** in your new project
- Paste & run `01-schema.sql` from this folder
- Verify all 16 tables exist under **Table Editor**

### 3. Migrate auth users (passwords preserved)
Supabase has a built-in user migration that preserves bcrypt hashes:
```bash
# Install Supabase CLI if needed
npm i -g supabase

# Export users from source (Lovable Cloud)
supabase db dump --data-only --schema auth \
  --db-url "postgresql://postgres:<SOURCE_DB_PASSWORD>@db.hwvtzapsmjptqilrzsfi.supabase.co:5432/postgres" \
  -f auth-users.sql

# Apply to target — but FIRST disable the handle_new_user trigger to avoid duplicate profile rows
psql "<TARGET_DB_URL>" -c "ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;"
psql "<TARGET_DB_URL>" -f auth-users.sql
psql "<TARGET_DB_URL>" -c "ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;"
```

Get the source DB password from Lovable Cloud → Settings → Database.

### 4. Export data from Lovable Cloud
```bash
cd migration-package
bun install @supabase/supabase-js
SOURCE_URL=https://hwvtzapsmjptqilrzsfi.supabase.co \
SOURCE_SERVICE_KEY=<source_service_role_key> \
bun run scripts/export-data.ts
```
Files land in `migration-package/data/`.

### 5. Import data into your new project
```bash
# Truncate auto-created profiles/user_roles first (handle_new_user created them during auth migration)
psql "<TARGET_DB_URL>" -c "TRUNCATE public.profiles, public.user_roles RESTART IDENTITY CASCADE;"

TARGET_URL=https://YOUR-NEW.supabase.co \
TARGET_SERVICE_KEY=<target_service_role_key> \
bun run scripts/import-data.ts
```

### 6. Migrate storage files
```bash
SOURCE_URL=https://hwvtzapsmjptqilrzsfi.supabase.co \
SOURCE_SERVICE_KEY=<source_service_role_key> \
TARGET_URL=https://YOUR-NEW.supabase.co \
TARGET_SERVICE_KEY=<target_service_role_key> \
bun run scripts/migrate-storage.ts
```

### 7. Add secrets to your new project
In Supabase Dashboard → Edge Functions → Manage secrets, add:
- `OPENAI_API_KEY` — from platform.openai.com
- `ANTHROPIC_API_KEY` — from console.anthropic.com

(`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are set automatically.)

### 8. Deploy edge functions
```bash
supabase login
supabase link --project-ref YOUR-NEW-REF
supabase functions deploy
```
Deploys all 8 functions: `generate-prescription-pdf`, `transcribe-audio`, `format-soap-notes`, `summarize-lab-result`, `invite-staff`, `remove-staff`, `send-lab-order`, `reformat-notes`.

### 9. Configure auth
- Dashboard → Authentication → URL Configuration:
  - Site URL: `https://stethoscribe.lovable.app` (or your domain)
  - Redirect URLs: add `https://stethoscribe.lovable.app/**` and `http://localhost:5173/**`
- Authentication → Providers → Email: disable "Confirm email" (matches current behavior)
- (Optional) Enable Google OAuth

### 10. Disable Lovable Cloud and swap the client
**Once everything above is verified working in the new project:**
- Connectors → Lovable Cloud → Disable Cloud
- Replace `.env` contents with:
  ```
  VITE_SUPABASE_URL="https://YOUR-NEW.supabase.co"
  VITE_SUPABASE_PUBLISHABLE_KEY="<new_anon_key>"
  VITE_SUPABASE_PROJECT_ID="YOUR-NEW-REF"
  ```
- Restart the preview / redeploy

### 11. Smoke test
- Log in (existing user)
- Open a patient's history
- Open `/rx/<some-existing-prescription-id>` in incognito
- Create a new visit → record audio → verify edge functions work

---

## Files in this package
- `01-schema.sql` — full schema, RLS, functions, triggers, storage buckets
- `scripts/export-data.ts` — dump source data to JSON
- `scripts/import-data.ts` — load JSON into target
- `scripts/migrate-storage.ts` — copy all storage files

## Rollback
If something fails BEFORE step 10, you've changed nothing on Lovable Cloud — just abandon the new project. After step 10, rollback requires reverting `.env` to the old values; Cloud cannot be re-enabled.
