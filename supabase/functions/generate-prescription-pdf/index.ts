import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    )

    const { visit_id, prescription_id } = await req.json()
    if (!visit_id || !prescription_id) throw new Error("visit_id and prescription_id are required")

    const { data: prescription } = await supabaseAdmin
      .from("prescriptions").select("*").eq("id", prescription_id).single()
    if (!prescription) throw new Error("Prescription not found")

    const { data: visit } = await supabaseAdmin
      .from("visits").select("*, patients(*)").eq("id", visit_id).single()
    if (!visit) throw new Error("Visit not found")

    const { data: doctor } = await supabaseAdmin
      .from("doctors").select("*").eq("id", prescription.doctor_id).single()
    const { data: clinic } = await supabaseAdmin
      .from("clinics").select("*").eq("id", visit.clinic_id).single()
    const { data: notes } = await supabaseAdmin
      .from("clinical_notes").select("soap_notes")
      .eq("visit_id", visit_id)
      .order("created_at", { ascending: false })
      .limit(1).maybeSingle()

    const patient = visit.patients as any
    const soap = (notes?.soap_notes || {}) as any
    const meds = (prescription.medications || []) as any[]
    const vitals = (visit.vitals || {}) as any
    const investigations = (prescription.investigations || []) as string[]

    const getAge = (dob: string) => dob
      ? String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : "N/A"

    // Create PDF document
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)

    const teal = rgb(0.051, 0.431, 0.431)
    const dark = rgb(0.1, 0.1, 0.1)
    const gray = rgb(0.4, 0.4, 0.4)
    const white = rgb(1, 1, 1)

    let y = height - 30
    const left = 40
    const right = width - 40
    const lineH = 16

    const drawText = (text: string, x: number, yPos: number, size = 10, font = fontRegular, color = dark) => {
      page.drawText(String(text || ""), { x, y: yPos, size, font, color })
    }

    const drawLine = (yPos: number, color = teal, thickness = 1) => {
      page.drawLine({ start: { x: left, y: yPos }, end: { x: right, y: yPos }, thickness, color })
    }

    const drawRect = (x: number, yPos: number, w: number, h: number, color = rgb(0.941, 0.980, 0.980)) => {
      page.drawRectangle({ x, y: yPos - h, width: w, height: h, color })
    }

    const truncate = (str: string, max: number) =>
      str && str.length > max ? str.substring(0, max) + "..." : str || ""

    // ── HEADER ──────────────────────────────────────────
    drawRect(left, y + 10, right - left, 60, rgb(0.035, 0.271, 0.271))

    drawText(clinic?.name || "Clinic", left + 10, y - 5, 18, fontBold, white)
    drawText(clinic?.address || "", left + 10, y - 22, 8, fontRegular, rgb(0.8, 0.9, 0.9))
    drawText(clinic?.phone ? "Tel: " + clinic.phone : "", left + 10, y - 33, 8, fontRegular, rgb(0.8, 0.9, 0.9))

    const drName = doctor?.name || "Doctor"
    const drNameW = fontBold.widthOfTextAtSize(drName, 12)
    drawText(drName, right - drNameW - 10, y - 5, 12, fontBold, white)
    const drQual = doctor?.qualification || ""
    const drQualW = fontRegular.widthOfTextAtSize(drQual, 8)
    drawText(drQual, right - drQualW - 10, y - 19, 8, fontRegular, rgb(0.8, 0.9, 0.9))
    const drReg = doctor?.registration_number ? "Reg: " + doctor.registration_number : ""
    const drRegW = fontRegular.widthOfTextAtSize(drReg, 8)
    drawText(drReg, right - drRegW - 10, y - 30, 8, fontRegular, rgb(0.8, 0.9, 0.9))
    const drSpec = doctor?.specialty || ""
    const drSpecW = fontRegular.widthOfTextAtSize(drSpec, 8)
    drawText(drSpec, right - drSpecW - 10, y - 41, 8, fontRegular, rgb(0.8, 0.9, 0.9))

    y -= 70

    // ── PATIENT BAR ─────────────────────────────────────
    page.drawRectangle({ x: left, y: y - 36, width: right - left, height: 40, borderColor: teal, borderWidth: 0.5, color: rgb(0.941, 0.980, 0.980) })

    const colW = (right - left) / 4
    const fields: [string, string][] = [
      ["Patient", patient?.name || "—"],
      ["Healthcare ID", patient?.healthcare_id || "—"],
      ["Age / Gender", `${getAge(patient?.dob)}y / ${patient?.gender || "—"}`],
      ["Date", new Date().toLocaleDateString("en-IN")],
    ]
    fields.forEach(([label, value], i) => {
      const x = left + 8 + i * colW
      drawText(label, x, y - 4, 7, fontBold, gray)
      drawText(truncate(value, 20), x, y - 16, 9, fontBold, i === 1 ? teal : dark)
    })

    y -= 50

    // ── VITALS ──────────────────────────────────────────
    if (Object.keys(vitals).length > 0) {
      drawText("VITALS", left, y, 8, fontBold, teal)
      y -= 4
      drawLine(y, teal, 0.5)
      y -= 14

      const vitalItems = [
        vitals.bp_sys ? `BP: ${vitals.bp_sys}/${vitals.bp_dia} mmHg` : null,
        vitals.pulse ? `Pulse: ${vitals.pulse} bpm` : null,
        vitals.temp || vitals.temperature ? `Temp: ${vitals.temp || vitals.temperature}°F` : null,
        vitals.spo2 ? `SpO2: ${vitals.spo2}%` : null,
        vitals.weight ? `Wt: ${vitals.weight} kg` : null,
        vitals.height ? `Ht: ${vitals.height} cm` : null,
      ].filter(Boolean) as string[]

      let vx = left
      vitalItems.forEach(v => {
        const vw = fontRegular.widthOfTextAtSize(v, 9) + 16
        page.drawRectangle({ x: vx, y: y - 12, width: vw, height: 16, color: rgb(0.96, 0.99, 0.99), borderColor: teal, borderWidth: 0.4 })
        drawText(v, vx + 6, y - 4, 9, fontRegular, dark)
        vx += vw + 6
      })
      y -= 26
    }

    // ── CHIEF COMPLAINT ─────────────────────────────────
    if (visit.chief_complaint) {
      drawText("CHIEF COMPLAINT", left, y, 8, fontBold, teal)
      y -= 4
      drawLine(y, teal, 0.5)
      y -= 14
      drawText(truncate(visit.chief_complaint, 90), left, y, 10, fontRegular, dark)
      y -= 20
    }

    // ── SOAP NOTES ──────────────────────────────────────
    if (soap.assessment || soap.subjective) {
      drawText("CLINICAL NOTES (SOAP)", left, y, 8, fontBold, teal)
      y -= 4
      drawLine(y, teal, 0.5)
      y -= 14

      const soapFields: [string, string][] = [
        ["S - Subjective", soap.subjective],
        ["O - Objective", soap.objective],
        ["A - Assessment", soap.assessment],
        ["P - Plan", soap.plan],
      ]

      soapFields.forEach(([label, value]) => {
        if (!value) return
        drawText(label + ":", left, y, 8, fontBold, gray)
        const words = String(value).split(" ")
        let line = ""
        let lx = left + 120
        words.forEach(word => {
          const test = line + word + " "
          if (fontRegular.widthOfTextAtSize(test, 9) > right - left - 125) {
            drawText(line.trim(), lx, y, 9, fontRegular, dark)
            line = word + " "
            y -= lineH - 4
            lx = left + 120
          } else {
            line = test
          }
        })
        if (line.trim()) drawText(line.trim(), lx, y, 9, fontRegular, dark)
        y -= lineH
      })
      y -= 6
    }

    // ── MEDICATIONS ─────────────────────────────────────
    if (meds.length > 0) {
      drawText("℞  PRESCRIPTION", left, y, 10, fontBold, teal)
      y -= 4
      drawLine(y, teal, 1)
      y -= 6

      const cols = [30, 130, 60, 60, 60, 100]
      const colX = [left]
      cols.forEach((w, i) => colX.push(colX[i] + w))
      const headers = ["#", "Drug", "Dosage", "Freq", "Duration", "Instructions"]

      drawRect(left, y + 4, right - left, 18, teal)
      headers.forEach((h, i) => drawText(h, colX[i] + 3, y - 6, 8, fontBold, white))
      y -= 20

      meds.forEach((m: any, idx: number) => {
        if (idx % 2 === 0) drawRect(left, y + 4, right - left, 16, rgb(0.97, 0.99, 0.99))
        const row = [String(idx + 1), m.name || "—", m.dosage || "—", m.frequency || "—", m.duration || "—", m.instructions || "—"]
        row.forEach((val, i) => drawText(truncate(val, i === 1 ? 18 : 14), colX[i] + 3, y - 4, 9, i === 1 ? fontBold : fontRegular, dark))
        y -= 16
      })
      y -= 8
    }

    // ── INVESTIGATIONS ──────────────────────────────────
    if (investigations.length > 0) {
      drawText("INVESTIGATIONS ADVISED", left, y, 8, fontBold, teal)
      y -= 4
      drawLine(y, teal, 0.5)
      y -= 14
      drawText(investigations.join("  •  "), left, y, 9, fontRegular, dark)
      y -= 20
    }

    // ── FOLLOW UP ───────────────────────────────────────
    if (prescription.follow_up_date) {
      page.drawRectangle({ x: left, y: y - 16, width: right - left, height: 20, borderColor: rgb(0.99, 0.83, 0.2), borderWidth: 0.5, color: rgb(1, 0.99, 0.88) })
      drawText("Follow-up: " + new Date(prescription.follow_up_date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }), left + 8, y - 4, 10, fontBold, rgb(0.5, 0.35, 0))
      y -= 28
    }

    // ── SIGNATURE ───────────────────────────────────────
    y -= 20
    const sigX = right - 180
    page.drawLine({ start: { x: sigX, y }, end: { x: right, y }, thickness: 0.5, color: dark })
    drawText(doctor?.name || "Doctor", sigX, y - 14, 10, fontBold, dark)
    drawText(doctor?.qualification || "", sigX, y - 26, 8, fontRegular, gray)
    drawText(doctor?.registration_number ? "Reg: " + doctor.registration_number : "", sigX, y - 37, 8, fontRegular, gray)

    // ── FOOTER ──────────────────────────────────────────
    drawLine(50, rgb(0.8, 0.8, 0.8), 0.5)
    drawText("Generated by StethoScribe", left, 38, 8, fontRegular, gray)
    const dateStr = new Date().toLocaleString("en-IN")
    const dateW = fontRegular.widthOfTextAtSize(dateStr, 8)
    drawText(dateStr, right - dateW, 38, 8, fontRegular, gray)

    // Serialize PDF
    const pdfBytes = await pdfDoc.save()

    // Upload to storage as .pdf
    const path = `${visit.clinic_id}/${new Date().getFullYear()}/${prescription_id}.pdf`
    await supabaseAdmin.storage.from("prescriptions").upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    })

    await supabaseAdmin.from("prescriptions").update({ pdf_url: path }).eq("id", prescription_id)

    return new Response(JSON.stringify({ success: true, path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error) {
    console.error("PDF generation error:", error)
    return new Response(JSON.stringify({ error: String(error) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
