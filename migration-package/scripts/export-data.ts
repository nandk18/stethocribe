/**
 * Exports all table data from the SOURCE Supabase project to JSON files.
 *
 * Usage:
 *   SOURCE_URL=https://hwvtzapsmjptqilrzsfi.supabase.co \
 *   SOURCE_SERVICE_KEY=<service_role_key> \
 *   bun run migration-package/scripts/export-data.ts
 *
 * Output: ./migration-package/data/<table>.json
 *
 * Get your service_role key from Lovable Cloud → Settings → API
 */
import { createClient } from "@supabase/supabase-js";
import { writeFileSync, mkdirSync } from "fs";
import { join } from "path";

const SOURCE_URL = process.env.SOURCE_URL;
const SOURCE_SERVICE_KEY = process.env.SOURCE_SERVICE_KEY;
if (!SOURCE_URL || !SOURCE_SERVICE_KEY) {
  console.error("Set SOURCE_URL and SOURCE_SERVICE_KEY env vars.");
  process.exit(1);
}

// Order matters: parents first so foreign-key inserts succeed on import
const TABLES = [
  "clinics", "labs", "profiles", "user_roles", "doctors",
  "patients", "visits", "appointments", "clinical_notes",
  "prescriptions", "document_shares", "patient_documents",
  "note_templates", "clinic_labs", "lab_orders", "lab_results",
];

const supabase = createClient(SOURCE_URL, SOURCE_SERVICE_KEY, {
  auth: { persistSession: false },
});

const OUT_DIR = join(import.meta.dir, "..", "data");
mkdirSync(OUT_DIR, { recursive: true });

for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select("*");
  if (error) { console.error(`✗ ${table}:`, error.message); continue; }
  writeFileSync(join(OUT_DIR, `${table}.json`), JSON.stringify(data, null, 2));
  console.log(`✓ ${table}: ${data?.length ?? 0} rows`);
}
console.log("\nDone. Files in ./migration-package/data/");
