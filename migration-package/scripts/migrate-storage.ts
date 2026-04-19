/**
 * Copies all files from SOURCE storage buckets to TARGET storage buckets.
 *
 * Usage:
 *   SOURCE_URL=https://hwvtzapsmjptqilrzsfi.supabase.co \
 *   SOURCE_SERVICE_KEY=<source_service_role_key> \
 *   TARGET_URL=https://YOUR-NEW.supabase.co \
 *   TARGET_SERVICE_KEY=<target_service_role_key> \
 *   bun run migration-package/scripts/migrate-storage.ts
 *
 * IMPORTANT: Run AFTER 01-schema.sql (which creates the buckets on target).
 */
import { createClient } from "@supabase/supabase-js";

const { SOURCE_URL, SOURCE_SERVICE_KEY, TARGET_URL, TARGET_SERVICE_KEY } = process.env;
if (!SOURCE_URL || !SOURCE_SERVICE_KEY || !TARGET_URL || !TARGET_SERVICE_KEY) {
  console.error("Set SOURCE_URL, SOURCE_SERVICE_KEY, TARGET_URL, TARGET_SERVICE_KEY.");
  process.exit(1);
}

const BUCKETS = [
  "clinic-assets", "signatures", "prescriptions",
  "audio-recordings", "patient-documents", "lab-results",
];

const src = createClient(SOURCE_URL, SOURCE_SERVICE_KEY, { auth: { persistSession: false } });
const dst = createClient(TARGET_URL, TARGET_SERVICE_KEY, { auth: { persistSession: false } });

async function listAll(client: any, bucket: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  const { data, error } = await client.storage.from(bucket).list(prefix, { limit: 1000 });
  if (error) { console.error(`list ${bucket}/${prefix}:`, error.message); return out; }
  for (const item of data ?? []) {
    const path = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null || (item.metadata == null && !item.name.includes("."))) {
      // folder
      out.push(...(await listAll(client, bucket, path)));
    } else {
      out.push(path);
    }
  }
  return out;
}

for (const bucket of BUCKETS) {
  console.log(`\n=== ${bucket} ===`);
  const files = await listAll(src, bucket);
  console.log(`  ${files.length} files`);
  let ok = 0, fail = 0;
  for (const path of files) {
    const { data: blob, error: dErr } = await src.storage.from(bucket).download(path);
    if (dErr || !blob) { console.error(`  ✗ download ${path}: ${dErr?.message}`); fail++; continue; }
    const { error: uErr } = await dst.storage.from(bucket).upload(path, blob, { upsert: true });
    if (uErr) { console.error(`  ✗ upload ${path}: ${uErr.message}`); fail++; continue; }
    ok++;
    if (ok % 25 === 0) console.log(`  ...${ok}/${files.length}`);
  }
  console.log(`  ✓ ${ok} copied, ${fail} failed`);
}
console.log("\nStorage migration complete.");
