/**
 * Import auth users into target Supabase project via Admin API.
 * Preserves original UUIDs so all foreign keys remain valid.
 *
 * Prereq: schema (01-schema.sql) is already applied in target.
 * The handle_new_user trigger WILL fire for each createUser call,
 * auto-inserting rows into public.profiles and public.user_roles.
 * After this script, README step 5 truncates those tables before
 * importing the real public-schema data.
 *
 * Usage:
 *   TARGET_URL=https://YOUR-NEW.supabase.co \
 *   TARGET_SERVICE_KEY=<target_service_role_key> \
 *   bun run scripts/import-auth-users.ts
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const TARGET_URL = process.env.TARGET_URL;
const TARGET_SERVICE_KEY = process.env.TARGET_SERVICE_KEY;

if (!TARGET_URL || !TARGET_SERVICE_KEY) {
  console.error("Missing TARGET_URL or TARGET_SERVICE_KEY env vars.");
  process.exit(1);
}

const admin = createClient(TARGET_URL, TARGET_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ExportedUser = {
  id: string;
  email: string | null;
  phone: string | null;
  email_confirmed_at: string | null;
  phone_confirmed_at: string | null;
  raw_user_meta_data: Record<string, unknown>;
  raw_app_meta_data: Record<string, unknown>;
  created_at: string;
};

async function main() {
  const raw = await readFile("migration-package/data/auth-users.json", "utf-8");
  const users: ExportedUser[] = JSON.parse(raw);

  console.log(`Importing ${users.length} users into ${TARGET_URL}...\n`);

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const u of users) {
    if (!u.email && !u.phone) {
      console.warn(`⏭️  Skipping ${u.id}: no email/phone`);
      skipped++;
      continue;
    }

    const { error } = await admin.auth.admin.createUser({
      id: u.id, // PRESERVE UUID — critical for FK integrity
      email: u.email ?? undefined,
      phone: u.phone ?? undefined,
      email_confirm: !!u.email_confirmed_at,
      phone_confirm: !!u.phone_confirmed_at,
      user_metadata: u.raw_user_meta_data,
      app_metadata: u.raw_app_meta_data,
    });

    if (error) {
      const msg = error.message?.toLowerCase() ?? "";
      if (msg.includes("already") || msg.includes("duplicate") || msg.includes("exists")) {
        console.log(`⏭️  Already exists: ${u.email ?? u.phone}`);
        skipped++;
      } else {
        console.error(`❌ Failed ${u.email ?? u.phone}: ${error.message}`);
        failed++;
      }
    } else {
      console.log(`✅ Created: ${u.email ?? u.phone} (${u.id})`);
      created++;
    }
  }

  console.log(`\n──────── Summary ────────`);
  console.log(`Created: ${created}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Failed:  ${failed}`);
  console.log(`\nNext: README step 5 — TRUNCATE public.profiles, public.user_roles`);
  console.log(`(handle_new_user populated them; the real import will repopulate from JSON).`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
