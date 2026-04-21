# Migrating StethoScribe from Lovable Cloud → Your Own Supabase

This package contains everything you need to move your project to a self-hosted Supabase project.

## ⚠️ Read this first

1. **Lovable Cloud cannot be re-enabled** once disabled on this project. Decide carefully.
2. **`.env` and `src/integrations/supabase/client.ts` are auto-managed** while Cloud is enabled. Disable Cloud BEFORE swapping these files (Connectors → Lovable Cloud → Disable Cloud).
3. **Edge functions stop auto-deploying.** You must use the Supabase CLI for every future change.
4. **Lovable AI Gateway (`LOVABLE_API_KEY`) won't work** off Cloud. The two functions using it must be switched to direct OpenAI/Anthropic calls (the other 6 already use direct keys).
5. **Password hashes cannot be migrated** via the Admin API. All users will need to reset their passwords after migration (see step 11).

---

## Step-by-step cutover

### 1. Create your new Supabase project
- Go to https://supabase.com/dashboard → New Project
- Note: `Project URL`, `anon key`, `service_role key`

### 2. Apply the schema
- Open **SQL Editor** in your new project
- Paste & run `01-schema.sql` from this folder **in a single execution** (ordering matters)
- Verify all 16 tables exist under **Table Editor**

### 3. Migrate auth users (Admin API, UUID-preserving)

This uses the Supabase Admin API instead of a raw DB dump — no source DB password required.

```bash
cd migration-package
bun install @supabase/supabase-js

# Export users from source (Lovable Cloud)
SOURCE_URL=https://hwvtzapsmjptqilrzsfi.supabase.co \
SOURCE_SERVICE_KEY=<source_service_role_key> \
bun run scripts/export-auth-users.ts

# Import into target — preserves original UUIDs so all FKs remain valid
TARGET_URL=https://YOUR-NEW.supabase.co \
TARGET_SERVICE_KEY=<target_service_role_key> \
bun run scripts/import-auth-users.ts
```

**What's preserved:** UUIDs, email, phone, metadata, email-confirmed flag.
**What's lost:** password hashes (handled in step 11), Google OAuth identity links (users re-link on next Google sign-in).

> Each `createUser` call fires the `handle_new_user` trigger and auto-creates rows in `public.profiles` and `public.user_roles`. Step 5 truncates those before importing the real data.

Get the source `service_role` key from Lovable Cloud → Backend → Settings → API.

### 4. Export public-schema data from Lovable Cloud
```bash
SOURCE_URL=https://hwvtzapsmjptqilrzsfi.supabase.co \
SOURCE_SERVICE_KEY=<source_service_role_key> \
bun run scripts/export-data.ts
```
Files land in `migration-package/data/`.

### 5. Import data into your new project
```bash
# Clear trigger-created rows from step 3 first
psql "<TARGET_DB_URL>" -c "TRUNCATE public.profiles, public.user_roles RESTART IDENTITY CASCADE;"

TARGET_URL=https://YOUR-NEW.supabase.co \
TARGET_SERVICE_KEY=<target_service_role_key> \
bun run scripts/import-data.ts
```

`<TARGET_DB_URL>` is in Supabase Dashboard → Project Settings → Database → Connection string (URI).

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
- (Optional) Enable Google OAuth — existing users will re-link their Google identity on first sign-in

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

### 11. Force password reset for all users

Pick one approach:

**A) Bulk email (recommended)** — pre-announce to staff first:
```bash
TARGET_URL=https://YOUR-NEW.supabase.co \
TARGET_SERVICE_KEY=<target_service_role_key> \
RESET_REDIRECT_URL=https://stethoscribe.lovable.app/reset-password \
bun run scripts/send-password-resets.ts
```
The script throttles at ~2s/email. Configure custom SMTP in Supabase first if you have many users (default email rate limits are tight).

**B) Lazy reset** — do nothing. Users hit "Forgot password?" on the existing login page when they can't sign in. Simpler, but users won't know to do it without a heads-up.

### 12. Smoke test
- Reset your own password, then log in
- Open a patient's history
- Open `/rx/<some-existing-prescription-id>` in incognito
- Create a new visit → record audio → verify edge functions work

---

## Files in this package
- `01-schema.sql` — full schema, RLS, functions, triggers, storage buckets
- `scripts/export-auth-users.ts` — dump auth users via Admin API
- `scripts/import-auth-users.ts` — recreate users in target, preserving UUIDs
- `scripts/send-password-resets.ts` — optional bulk password-reset emails
- `scripts/export-data.ts` — dump source public-schema data to JSON
- `scripts/import-data.ts` — load JSON into target
- `scripts/migrate-storage.ts` — copy all storage files

## Rollback
If something fails BEFORE step 10, you've changed nothing on Lovable Cloud — just abandon the new project. After step 10, rollback requires reverting `.env` to the old values; Cloud cannot be re-enabled.
