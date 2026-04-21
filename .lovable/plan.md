

## Migrate auth users via Supabase Admin API (UUID-preserving, password reset on first login)

Add two scripts to `migration-package/scripts/` and rewrite README step 3.

### What gets built

**`scripts/export-auth-users.ts`**
- Connects to source (Lovable Cloud) with `SOURCE_SERVICE_KEY`
- Paginates `supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 })` until exhausted
- For each user, captures: `id`, `email`, `phone`, `email_confirmed_at`, `phone_confirmed_at`, `raw_user_meta_data`, `raw_app_meta_data`, `created_at`
- Writes JSON array to `migration-package/data/auth-users.json`
- Logs totals

**`scripts/import-auth-users.ts`**
- Connects to target with `TARGET_SERVICE_KEY`
- Reads `data/auth-users.json`
- For each user calls `targetAdmin.auth.admin.createUser({ id, email, phone, email_confirm: true, user_metadata, app_metadata })` — passing the original `id` preserves UUIDs so all FKs (`profiles.user_id`, `doctors.user_id`, `visits.doctor_id`, etc.) remain valid
- Skips on duplicate (idempotent re-runs)
- IMPORTANT: the existing `01-schema.sql` defines the `handle_new_user` trigger on `auth.users`. Each `createUser` call will fire it and auto-insert a `profiles` row. This collides with the data import in step 5 of the README. The script must instruct the operator to disable the trigger first (already covered in README step 5 as a `TRUNCATE`, but order matters).
- After import, logs counts; on completion prints next-steps

**Operational order (updated README)**
```text
1. Create new Supabase project
2. Apply 01-schema.sql
3. Export + import auth users (Admin API)         ← new
4. Export public-schema data (export-data.ts)
5. TRUNCATE profiles, user_roles                  ← clears trigger-created rows
   Import data (import-data.ts)
6. Migrate storage
7. Add edge function secrets
8. Deploy edge functions
9. Configure auth (URL, providers)
10. Disable Lovable Cloud, swap .env
11. Force password reset for all users           ← see below
12. Smoke test
```

**Step 11 — force password reset (added to README)**
Two options, user picks one after migration:
- **Bulk email**: run a one-off script that calls `targetAdmin.auth.resetPasswordForEmail(email, { redirectTo: "https://stethoscribe.lovable.app/reset-password" })` for every user
- **Lazy reset**: do nothing — users hit "Forgot password?" on the existing `Auth.tsx` page on first login attempt. Simpler, no mass email, but users won't know to do it without communication.

Recommend the bulk-email path with a pre-announcement to staff.

### What this preserves vs loses

| Item | Preserved? |
|---|---|
| User UUIDs (all FKs remain valid) | Yes |
| Email, phone, metadata | Yes |
| Email-confirmed flag | Yes |
| Password hashes | **No** — Admin API doesn't expose them |
| OAuth identities (Google) | **No** — users re-link on next Google sign-in |

### Files touched
- `migration-package/scripts/export-auth-users.ts` — new
- `migration-package/scripts/import-auth-users.ts` — new
- `migration-package/scripts/send-password-resets.ts` — new (optional bulk reset)
- `migration-package/README.md` — rewrite step 3, add step 11, reorder steps

### Env vars needed
- Export: `SOURCE_URL`, `SOURCE_SERVICE_KEY`
- Import: `TARGET_URL`, `TARGET_SERVICE_KEY`
- Reset: `TARGET_URL`, `TARGET_SERVICE_KEY`, `RESET_REDIRECT_URL`

