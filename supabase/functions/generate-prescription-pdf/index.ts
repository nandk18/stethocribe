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
    if (!visit_id || !prescription_id) {
      throw new Error("visit_id and prescription_id are required");
    }

    // Fetch all needed data
    const { data: prescription, error: pErr } = await supabaseAdmin
      .from("prescriptions")
      .select("*")
      .eq("id", prescription_id)
      .single();
    if (pErr || !prescription) throw new Error("Prescription not found");

    const { data: visit } = await supabaseAdmin
      .from("visits")
      .select("*, patients(*)")
      .eq("id", visit_id)
      .single();
    if (!visit) throw new Error("Visit not found");

    const { data: doctor } = await supabaseAdmin
      .from("doctors")
      .select("*")
      .eq("id", prescription.doctor_id)
      .single();

    const { data: clinic } = await supabaseAdmin
      .from("clinics")
      .select("*")
      .eq("id", visit.clinic_id)
      .single();

    const { data: notes } = await supabaseAdmin
      .from("clinical_notes")
      .select("soap_notes")
      .eq("visit_id", visit_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    const patient = visit.patients;
    const soap = notes?.soap_notes || {};
    const meds = (prescription.medications as any[]) || [];
    const investigations = (prescription.investigations as string[]) || [];
    const vitals = visit.vitals || {};

    const getAge = (dob: string | null) => {
      if (!dob) return "N/A";
      return String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)));
    };

    // Generate HTML for PDF
    const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; font-size: 11px; color: #1a1a1a; padding: 24px; max-width: 800px; margin: 0 auto; }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 16px; }
  .clinic-name { font-size: 18px; font-weight: 700; color: #2563eb; }
  .clinic-info { font-size: 10px; color: #666; margin-top: 2px; }
  .doctor-info { text-align: right; }
  .doctor-name { font-size: 14px; font-weight: 600; }
  .doctor-detail { font-size: 10px; color: #666; }
  .patient-bar { display: flex; justify-content: space-between; background: #f0f4ff; padding: 10px 14px; border-radius: 6px; margin-bottom: 14px; }
  .patient-bar span { font-size: 11px; }
  .patient-bar strong { color: #2563eb; }
  .section { margin-bottom: 14px; }
  .section-title { font-size: 12px; font-weight: 700; color: #2563eb; text-transform: uppercase; letter-spacing: 0.5px; border-bottom: 1px solid #e5e7eb; padding-bottom: 3px; margin-bottom: 6px; }
  .soap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .soap-item label { font-weight: 600; font-size: 10px; color: #666; text-transform: uppercase; }
  .soap-item p { margin-top: 2px; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #2563eb; color: #fff; font-size: 10px; padding: 6px 8px; text-align: left; }
  td { border-bottom: 1px solid #e5e7eb; padding: 6px 8px; font-size: 11px; }
  tr:nth-child(even) { background: #f9fafb; }
  .rx-symbol { font-size: 16px; font-weight: 700; color: #2563eb; margin-right: 4px; }
  .vitals-row { display: flex; gap: 16px; flex-wrap: wrap; margin-top: 4px; }
  .vital-chip { background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 4px; padding: 3px 8px; font-size: 10px; }
  .follow-up { background: #fef3c7; padding: 8px 12px; border-radius: 6px; font-size: 11px; margin-top: 10px; }
  .footer { margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #999; }
  .signature { text-align: right; margin-top: 20px; }
  .signature-line { border-top: 1px solid #333; width: 200px; margin-left: auto; margin-top: 30px; padding-top: 4px; font-size: 11px; }
</style></head><body>
  <div class="header">
    <div>
      <div class="clinic-name">${clinic?.name || "Clinic"}</div>
      ${clinic?.address ? `<div class="clinic-info">${clinic.address}</div>` : ""}
      ${clinic?.phone ? `<div class="clinic-info">Tel: ${clinic.phone}</div>` : ""}
    </div>
    <div class="doctor-info">
      <div class="doctor-name">${doctor?.name || "Doctor"}</div>
      ${doctor?.qualification ? `<div class="doctor-detail">${doctor.qualification}</div>` : ""}
      ${doctor?.registration_number ? `<div class="doctor-detail">Reg: ${doctor.registration_number}</div>` : ""}
      ${doctor?.specialty ? `<div class="doctor-detail">${doctor.specialty}</div>` : ""}
    </div>
  </div>

  <div class="patient-bar">
    <span><strong>Patient:</strong> ${patient?.name || "—"}</span>
    <span><strong>ID:</strong> ${patient?.healthcare_id || "—"}</span>
    <span><strong>Age/Gender:</strong> ${getAge(patient?.dob)}y / ${patient?.gender || "—"}</span>
    <span><strong>Date:</strong> ${new Date().toLocaleDateString("en-IN")}</span>
  </div>

  ${Object.keys(vitals).length > 0 ? `
  <div class="section">
    <div class="section-title">Vitals</div>
    <div class="vitals-row">
      ${vitals.bp ? `<div class="vital-chip">BP: ${vitals.bp.systolic}/${vitals.bp.diastolic} mmHg</div>` : ""}
      ${vitals.pulse ? `<div class="vital-chip">Pulse: ${vitals.pulse} bpm</div>` : ""}
      ${vitals.temperature ? `<div class="vital-chip">Temp: ${vitals.temperature}°F</div>` : ""}
      ${vitals.spo2 ? `<div class="vital-chip">SpO2: ${vitals.spo2}%</div>` : ""}
      ${vitals.weight ? `<div class="vital-chip">Weight: ${vitals.weight} kg</div>` : ""}
    </div>
  </div>` : ""}

  <div class="section">
    <div class="section-title">Clinical Notes</div>
    <div class="soap-grid">
      <div class="soap-item"><label>Subjective</label><p>${(soap as any).subjective || "—"}</p></div>
      <div class="soap-item"><label>Objective</label><p>${(soap as any).objective || "—"}</p></div>
      <div class="soap-item"><label>Assessment</label><p>${(soap as any).assessment || "—"}</p></div>
      <div class="soap-item"><label>Plan</label><p>${(soap as any).plan || "—"}</p></div>
    </div>
  </div>

  ${meds.length > 0 ? `
  <div class="section">
    <div class="section-title"><span class="rx-symbol">℞</span> Medications</div>
    <table>
      <thead><tr><th>#</th><th>Drug</th><th>Dosage</th><th>Frequency</th><th>Duration</th><th>Instructions</th></tr></thead>
      <tbody>
        ${meds.map((m: any, i: number) => `<tr><td>${i + 1}</td><td>${m.name}</td><td>${m.dosage || "—"}</td><td>${m.frequency || "—"}</td><td>${m.duration || "—"}</td><td>${m.instructions || "—"}</td></tr>`).join("")}
      </tbody>
    </table>
  </div>` : ""}

  ${investigations.length > 0 ? `
  <div class="section">
    <div class="section-title">Investigations Advised</div>
    <p>${investigations.join(", ")}</p>
  </div>` : ""}

  ${prescription.follow_up_date ? `
  <div class="follow-up">
    <strong>Follow-up:</strong> ${new Date(prescription.follow_up_date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
  </div>` : ""}

  ${prescription.notes ? `
  <div class="section" style="margin-top:10px">
    <div class="section-title">Additional Notes</div>
    <p>${prescription.notes}</p>
  </div>` : ""}

  <div class="signature">
    <div class="signature-line">${doctor?.name || "Doctor"}</div>
  </div>

  <div class="footer">
    <span>Generated by StethoScribe</span>
    <span>${new Date().toLocaleString("en-IN")}</span>
  </div>
</body></html>`;

    // Store HTML as a text file (browser can render/print as PDF)
    const now = new Date();
    const path = `${visit.clinic_id}/${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${prescription_id}.html`;

    const htmlBlob = new Blob([html], { type: "text/html" });
    const arrayBuf = await htmlBlob.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuf);

    const { error: uploadErr } = await supabaseAdmin.storage
      .from("prescriptions")
      .upload(path, uint8, {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      throw new Error(`Failed to upload prescription: ${uploadErr.message}`);
    }

    // Update prescription with the path
    await supabaseAdmin
      .from("prescriptions")
      .update({ pdf_url: path })
      .eq("id", prescription_id);

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
