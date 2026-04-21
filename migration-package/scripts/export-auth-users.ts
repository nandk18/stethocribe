/**
 * Export auth users from source Supabase project via Admin API.
 *
 * Usage:
 *   SOURCE_URL=https://hwvtzapsmjptqilrzsfi.supabase.co \
 *   SOURCE_SERVICE_KEY=<source_service_role_key> \
 *   bun run scripts/export-auth-users.ts
 *
 * Output: migration-package/data/auth-users.json
 */
import { createClient } from "@supabase/supabase-js";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

const SOURCE_URL = process.env.SOURCE_URL;
const SOURCE_SERVICE_KEY = process.env.SOURCE_SERVICE_KEY;

if (!SOURCE_URL || !SOURCE_SERVICE_KEY) {
  console.error("Missing SOURCE_URL or SOURCE_SERVICE_KEY env vars.");
  process.exit(1);
}

const admin = createClient(SOURCE_URL, SOURCE_SERVICE_KEY, {
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
  const all: ExportedUser[] = [];
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error(`listUsers failed on page ${page}:`, error);
      process.exit(1);
    }
    const users = data?.users ?? [];
    if (users.length === 0) break;

    for (const u of users) {
      all.push({
        id: u.id,
        email: u.email ?? null,
        phone: u.phone ?? null,
        email_confirmed_at: u.email_confirmed_at ?? null,
        phone_confirmed_at: u.phone_confirmed_at ?? null,
        raw_user_meta_data: (u.user_metadata ?? {}) as Record<string, unknown>,
        raw_app_meta_data: (u.app_metadata ?? {}) as Record<string, unknown>,
        created_at: u.created_at,
      });
    }

    console.log(`Page ${page}: fetched ${users.length} users (total ${all.length})`);
    if (users.length < perPage) break;
    page++;
  }

  const outPath = "migration-package/data/auth-users.json";
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, JSON.stringify(all, null, 2));
  console.log(`\n✅ Exported ${all.length} users to ${outPath}`);
  console.log("\nNote: password hashes are NOT included (Admin API limitation).");
  console.log("Users will need to reset passwords after migration (see step 11).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
