import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { visit_id, prescription_id } = await req.json();
    if (!visit_id || !prescription_id) throw new Error("visit_id and prescription_id are required");

    const { data: prescription, error: pErr } = await supabaseAdmin.from("prescriptions").select("*").eq("id", prescription_id).single();
    if (pErr || !prescription) throw new Error("Prescription not found");

    const { data: visit } = await supabaseAdmin.from("visits").select("*, patients(*)").eq("id", visit_id).single();
    if (!visit) throw new Error("Visit not found");

    const { data: doctor } = await supabaseAdmin.from("doctors").select("*").eq("id", prescription.doctor_id).single();
    const { data: clinic } = await supabaseAdmin.from("clinics").select("*").eq("id", visit.clinic_id).single();
    const { data: notes } = await supabaseAdmin.from("clinical_notes").select("soap_notes").eq("visit_id", visit_id).order("created_at", { ascending: false }).limit(1).single();

    const patient = visit.patients;
    const soap = notes?.soap_notes || {};
    const meds = (prescription.medications as any[]) || [];
    const investigations = (prescription.investigations as string[]) || [];
    const vitals = visit.vitals || {};

    const getAge = (dob: string | null) => {
      if (!dob) return "N/A";
      return String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
    };

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>
  @page { size: A4; margin: 20mm 15mm; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0D6E6E; padding-bottom: 12px; margin-bottom: 14px; }
  .clinic-name { font-size: 20px; font-weight: 800; color: #0D6E6E; }
  .clinic-sub { font-size: 10px; color: #555; margin-top: 3px; line-height: 1.5; }
  .doctor-block { text-align: right; }
  .doctor-name { font-size: 14px; font-weight: 700; }
  .doctor-sub { font-size: 10px; color: #555; line-height: 1.6; }
  .patient-bar { background: #f0faf9; border: 1px solid rgba(13,110,110,0.2); border-radius: 6px; padding: 10px 14px; margin-bottom: 12px; display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .field label { font-size: 9px; color: #777; text-transform: uppercase; font-weight: 600; }
  .field p { font-size: 11px; font-weight: 600; margin-top: 1px; }
  .vitals-bar { display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px; }
  .vital { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 4px; padding: 4px 10px; font-size: 10px; }
  .vital span { font-weight: 700; color: #0D6E6E; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 11px; font-weight: 800; color: #0D6E6E; text-transform: uppercase; letter-spacing: 0.8px; border-bottom: 1px solid rgba(13,110,110,0.25); padding-bottom: 4px; margin-bottom: 8px; }
  .soap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
  .soap-item label { font-size: 9px; font-weight: 700; color: #777; text-transform: uppercase; }
  .soap-item p { margin-top: 3px; font-size: 11px; line-height: 1.5; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 10px; }
  thead tr { background: #0D6E6E; color: white; }
  th { padding: 7px 8px; text-align: left; font-weight: 600; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; }
  tr:nth-child(even) { background: #f9fafb; }
  .followup { background: #fffbeb; border: 1px solid #fcd34d; border-radius: 4px; padding: 8px 12px; font-size: 11px; margin-top: 10px; }
  .signature { margin-top: 30px; text-align: right; }
  .sig-line { border-top: 1px solid #333; width: 180px; margin-left: auto; padding-top: 4px; font-size: 10px; }
  .footer { margin-top: 20px; border-top: 1px solid #e5e7eb; padding-top: 8px; display: flex; justify-content: space-between; font-size: 9px; color: #aaa; }
</style></head><body>
  <div class="header">
    <div>
      <div class="clinic-name">${clinic?.name || "Clinic"}</div>
      <div class="clinic-sub">${clinic?.address || ""}${clinic?.phone ? "<br>Tel: " + clinic.phone : ""}</div>
    </div>
    <div class="doctor-block">
      <div class="doctor-name">${doctor?.name || "Doctor"}</div>
      <div class="doctor-sub">
        ${doctor?.qualification || ""}${doctor?.registration_number ? "<br>Reg: " + doctor.registration_number : ""}${doctor?.specialty ? "<br>" + doctor.specialty : ""}
      </div>
    </div>
  </div>

  <div class="patient-bar">
    <div class="field"><label>Patient</label><p>${patient?.name || "—"}</p></div>
    <div class="field"><label>Healthcare ID</label><p>${patient?.healthcare_id || "—"}</p></div>
    <div class="field"><label>Age / Gender</label><p>${getAge(patient?.dob)}y / ${patient?.gender || "—"}</p></div>
    <div class="field"><label>Date</label><p>${new Date().toLocaleDateString("en-IN")}</p></div>
  </div>

  ${Object.keys(vitals).length > 0 ? `
  <div class="section">
    <div class="section-title">Vitals</div>
    <div class="vitals-bar">
      ${vitals.bp ? `<div class="vital"><span>BP</span> ${vitals.bp.systolic || vitals.bp_sys || ""}/${vitals.bp.diastolic || vitals.bp_dia || ""} mmHg</div>` : ""}
      ${vitals.pulse ? `<div class="vital"><span>Pulse</span> ${vitals.pulse} bpm</div>` : ""}
      ${vitals.temperature ? `<div class="vital"><span>Temp</span> ${vitals.temperature}°F</div>` : ""}
      ${vitals.spo2 ? `<div class="vital"><span>SpO2</span> ${vitals.spo2}%</div>` : ""}
      ${vitals.weight ? `<div class="vital"><span>Weight</span> ${vitals.weight} kg</div>` : ""}
    </div>
  </div>` : ""}

  <div class="section">
    <div class="section-title">Clinical Notes (SOAP)</div>
    <div class="soap-grid">
      <div class="soap-item"><label>Subjective</label><p>${(soap as any).subjective || "—"}</p></div>
      <div class="soap-item"><label>Objective</label><p>${(soap as any).objective || "—"}</p></div>
      <div class="soap-item"><label>Assessment</label><p>${(soap as any).assessment || "—"}</p></div>
      <div class="soap-item"><label>Plan</label><p>${(soap as any).plan || "—"}</p></div>
    </div>
  </div>

  ${meds.length > 0 ? `
  <div class="section">
    <div class="section-title">℞ Prescription</div>
    <table>
      <thead><tr><th>#</th><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
      <tbody>
        ${meds.map((m: any, i: number) => `<tr><td>${i + 1}</td><td>${m.name}</td><td>${m.dosage || "—"}</td><td>${m.frequency || "—"}</td><td>${m.duration || "—"}</td><td>${m.instructions || "—"}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  ${investigations.length > 0 ? `
  <div class="section">
    <div class="section-title">Investigations</div>
    <p>${investigations.join(", ")}</p>
  </div>` : ""}

  ${prescription.follow_up_date ? `
  <div class="followup">
    📅 <strong>Follow-up:</strong> ${new Date(prescription.follow_up_date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
  </div>` : ""}

  ${prescription.notes ? `
  <div class="section" style="margin-top:10px">
    <div class="section-title">Additional Notes</div>
    <p>${prescription.notes}</p>
  </div>` : ""}

  <div class="signature">
    <div class="sig-line">${doctor?.name || "Doctor"}<br>${doctor?.qualification || ""}<br>${doctor?.registration_number ? "Reg: " + doctor.registration_number : ""}</div>
  </div>

  <div class="footer">
    <span>Generated by StethoScribe</span>
    <span>${new Date().toLocaleString("en-IN")}</span>
  </div>
</body></html>`;

    const now = new Date();
    const path = `${visit.clinic_id}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${prescription_id}.html`;

    const bytes = new TextEncoder().encode(html);
    const { error: uploadErr } = await supabaseAdmin.storage.from("prescriptions").upload(path, bytes, {
      contentType: "text/html",
      upsert: true,
    });

    if (uploadErr) throw new Error(`Failed to upload: ${uploadErr.message}`);

    await supabaseAdmin.from("prescriptions").update({ pdf_url: path }).eq("id", prescription_id);

    return new Response(
      JSON.stringify({ success: true, path }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("generate-prescription-pdf error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
