/**
 * Imports JSON data exported by export-data.ts into the TARGET Supabase project.
 *
 * Usage:
 *   TARGET_URL=https://YOUR-NEW-PROJECT.supabase.co \
 *   TARGET_SERVICE_KEY=<new_project_service_role_key> \
 *   bun run migration-package/scripts/import-data.ts
 *
 * IMPORTANT:
 *  - Run AFTER applying 01-schema.sql to the target project.
 *  - Run AFTER migrating auth.users (handle_new_user trigger creates profile rows
 *    automatically, so you may need to TRUNCATE public.profiles + user_roles
 *    on the target before importing — see the README).
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { join } from "path";

const TARGET_URL = process.env.TARGET_URL;
const TARGET_SERVICE_KEY = process.env.TARGET_SERVICE_KEY;
if (!TARGET_URL || !TARGET_SERVICE_KEY) {
  console.error("Set TARGET_URL and TARGET_SERVICE_KEY env vars.");
  process.exit(1);
}

const TABLES = [
  "clinics", "labs", "profiles", "user_roles", "doctors",
  "patients", "visits", "appointments", "clinical_notes",
  "prescriptions", "document_shares", "patient_documents",
  "note_templates", "clinic_labs", "lab_orders", "lab_results",
];

const supabase = createClient(TARGET_URL, TARGET_SERVICE_KEY, {
  auth: { persistSession: false },
});

const DATA_DIR = join(import.meta.dir, "..", "data");

for (const table of TABLES) {
  let rows: any[];
  try {
    rows = JSON.parse(readFileSync(join(DATA_DIR, `${table}.json`), "utf-8"));
  } catch {
    console.log(`- ${table}: no file, skipping`);
    continue;
  }
  if (!rows.length) { console.log(`- ${table}: empty`); continue; }

  // Insert in chunks of 500
  const CHUNK = 500;
  let ok = 0, fail = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: "id" });
    if (error) { console.error(`  ✗ chunk ${i}: ${error.message}`); fail += chunk.length; }
    else ok += chunk.length;
  }
  console.log(`✓ ${table}: ${ok} inserted, ${fail} failed`);
}
console.log("\nDone.");
