/**
 * OPTIONAL: Send password reset emails to every user after migration.
 * Use this if you want a "bulk reset" experience instead of relying on
 * users clicking "Forgot password?" themselves.
 *
 * Reads from migration-package/data/auth-users.json (produced by export-auth-users.ts).
 *
 * Usage:
 *   TARGET_URL=https://YOUR-NEW.supabase.co \
 *   TARGET_SERVICE_KEY=<target_service_role_key> \
 *   RESET_REDIRECT_URL=https://stethoscribe.lovable.app/reset-password \
 *   bun run scripts/send-password-resets.ts
 *
 * ⚠️  Pre-announce to staff before running — they'll all get an email.
 * ⚠️  Mind Supabase's email rate limits (default ~30/hour on free tier).
 *     Consider configuring a custom SMTP provider first.
 */
import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";

const TARGET_URL = process.env.TARGET_URL;
const TARGET_SERVICE_KEY = process.env.TARGET_SERVICE_KEY;
const RESET_REDIRECT_URL = process.env.RESET_REDIRECT_URL;

if (!TARGET_URL || !TARGET_SERVICE_KEY || !RESET_REDIRECT_URL) {
  console.error("Missing TARGET_URL, TARGET_SERVICE_KEY, or RESET_REDIRECT_URL env vars.");
  process.exit(1);
}

const admin = createClient(TARGET_URL, TARGET_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ExportedUser = { id: string; email: string | null };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const raw = await readFile("migration-package/data/auth-users.json", "utf-8");
  const users: ExportedUser[] = JSON.parse(raw);
  const withEmail = users.filter((u) => !!u.email);

  console.log(`Sending reset emails to ${withEmail.length} users (redirect: ${RESET_REDIRECT_URL})`);
  console.log(`Throttling at ~2s/email to respect rate limits.\n`);

  let sent = 0;
  let failed = 0;

  for (const u of withEmail) {
    const { error } = await admin.auth.resetPasswordForEmail(u.email!, {
      redirectTo: RESET_REDIRECT_URL,
    });
    if (error) {
      console.error(`❌ ${u.email}: ${error.message}`);
      failed++;
    } else {
      console.log(`✅ Sent: ${u.email}`);
      sent++;
    }
    await sleep(2000);
  }

  console.log(`\n──────── Summary ────────`);
  console.log(`Sent:   ${sent}`);
  console.log(`Failed: ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
