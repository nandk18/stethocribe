import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
}

// Romanized transliterations that work with standard PDF fonts
const TRANSLATIONS: Record<string, Record<string, string>> = {
  Tamil: { clinic: "Maruthuvamanai", doctor: "Maruthvar", patient: "Noyaali", date: "Thethi", rx: "Marunthu Seettu", followUp: "Maru Santhippu", morning: "Kaalai", afternoon: "Mathiyam", evening: "Maalai", night: "Iravu", investigations: "Parisodhanaikal", soap: "Maruthva Kurippukal" },
  Hindi: { clinic: "Aspatal", doctor: "Doctor", patient: "Mariz", date: "Tarikh", rx: "Nuskha", followUp: "Agli Mulakat", morning: "Subah", afternoon: "Dopahar", evening: "Shaam", night: "Raat", investigations: "Jaanch", soap: "Chikitsa Notes" },
  Telugu: { clinic: "Asupathri", doctor: "Vaidyudu", patient: "Rogi", date: "Thedhi", rx: "Prescription", followUp: "Thaduparthi Visit", morning: "Udayam", afternoon: "Madhyahnam", evening: "Sayanthram", night: "Rathri", investigations: "Parikshalu", soap: "Vaidya Notes" },
  Kannada: { clinic: "Aspathre", doctor: "Vaidyaru", patient: "Rogi", date: "Dinanka", rx: "Prescription", followUp: "Mundina Bheti", morning: "Beligere", afternoon: "Madhyahna", evening: "Sanje", night: "Rathri", investigations: "Tapaasanegalu", soap: "Vaidyakiya Notes" },
  Malayalam: { clinic: "Aashupathri", doctor: "Doctor", patient: "Rogi", date: "Theeyathi", rx: "Kurippadhi", followUp: "Aduththa Sandarshanam", morning: "Raavile", afternoon: "Uchaykku", evening: "Vaikunneeram", night: "Raathri", investigations: "Parishodhankal", soap: "Clinical Kurippukal" },
  Marathi: { clinic: "Rugnalay", doctor: "Doctor", patient: "Rugna", date: "Tarikh", rx: "Prescription", followUp: "Pudhili Bhet", morning: "Sakaali", afternoon: "Dupari", evening: "Sandhyakaali", night: "Raatri", investigations: "Tapasnya", soap: "Vaidyakiya Nondi" },
  Bengali: { clinic: "Haspataal", doctor: "Daktar", patient: "Rogi", date: "Tarikh", rx: "Prescription", followUp: "Poroborti Sakkhat", morning: "Sokal", afternoon: "Dupur", evening: "Bikel", night: "Raat", investigations: "Poriksha", soap: "Clinical Note" },
  Gujarati: { clinic: "Hospital", doctor: "Doctor", patient: "Dardi", date: "Tarikh", rx: "Prescription", followUp: "Aagli Mulakat", morning: "Savar", afternoon: "Bapor", evening: "Saanj", night: "Raat", investigations: "Tapaas", soap: "Tabeebi Nondh" },
  Punjabi: { clinic: "Haspataal", doctor: "Daktar", patient: "Mariz", date: "Tarikh", rx: "Nuskha", followUp: "Agli Mulakat", morning: "Savere", afternoon: "Dupehar", evening: "Shaam", night: "Raat", investigations: "Jaanch", soap: "Clinical Notes" },
  Odia: { clinic: "Daktarkhana", doctor: "Daktar", patient: "Rogi", date: "Tarikh", rx: "Prescription", followUp: "Parabarti Bhet", morning: "Sakala", afternoon: "Diprahar", evening: "Sandhya", night: "Ratri", investigations: "Pariksha", soap: "Chikitsa Note" },
  Assamese: { clinic: "Chikitsalay", doctor: "Chikitsok", patient: "Rogi", date: "Tarikh", rx: "Prescription", followUp: "Poroborti Sakkhat", morning: "Puwa", afternoon: "Duporiya", evening: "Abeli", night: "Rati", investigations: "Poriksha", soap: "Chikitsa Toka" },
  Urdu: { clinic: "Aspatal", doctor: "Doctor", patient: "Mariz", date: "Tarikh", rx: "Nuskha", followUp: "Agli Mulaqat", morning: "Subah", afternoon: "Dopehar", evening: "Shaam", night: "Raat", investigations: "Test", soap: "Tibbi Notes" },
  Konkani: { clinic: "Hospital", doctor: "Doctor", patient: "Dukhi", date: "Tarikh", rx: "Prescription", followUp: "Fudli Bhet", morning: "Sokallim", afternoon: "Donparam", evening: "Sanjechim", night: "Ratim", investigations: "Tapaasni", soap: "Clinical Note" },
  Manipuri: { clinic: "Hospital", doctor: "Doctor", patient: "Laina Leibak", date: "Tarik", rx: "Prescription", followUp: "Ahing Taba", morning: "Nungaiba", afternoon: "Nungthil", evening: "Numidang", night: "Ahan", investigations: "Test", soap: "Clinical Note" },
  Sindhi: { clinic: "Aspatal", doctor: "Doctor", patient: "Mariz", date: "Tarikh", rx: "Nuskha", followUp: "Agli Mulaqat", morning: "Subho", afternoon: "Biapahri", evening: "Shaam", night: "Raat", investigations: "Jaanch", soap: "Tibbi Notes" },
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
      .from("clinics").select("id, name, address, phone, regional_language")
      .eq("id", visit.clinic_id).single()
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

    const lang = clinic?.regional_language || null
    const t = lang && TRANSLATIONS[lang] ? TRANSLATIONS[lang] : null
    console.log("Regional language:", lang, "Has translations:", !!t)

    const getAge = (dob: string) => dob
      ? String(Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : "N/A"

    // Create PDF document
    const pdfDoc = await PDFDocument.create()
    const page = pdfDoc.addPage([595, 842]) // A4
    const { width, height } = page.getSize()

    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
    const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique)

    const teal = rgb(0.051, 0.431, 0.431)
    const dark = rgb(0.1, 0.1, 0.1)
    const gray = rgb(0.4, 0.4, 0.4)
    const white = rgb(1, 1, 1)
    const lightTeal = rgb(0.941, 0.980, 0.980)
    const headerBg = rgb(0.035, 0.271, 0.271)

    let y = height - 30
    const left = 40
    const right = width - 40
    const lineH = 16

    const drawText = (text: string, x: number, yPos: number, size = 10, font = fontRegular, color = dark) => {
      const safe = String(text || "").replace(/[^\x20-\x7E]/g, "")
      if (!safe) return
      try { page.drawText(safe, { x, y: yPos, size, font, color }) } catch {}
    }

    const drawLine = (yPos: number, color = teal, thickness = 1) => {
      page.drawLine({ start: { x: left, y: yPos }, end: { x: right, y: yPos }, thickness, color })
    }

    const drawRect = (x: number, yPos: number, w: number, h: number, color = lightTeal) => {
      page.drawRectangle({ x, y: yPos - h, width: w, height: h, color })
    }

    const truncate = (str: string, max: number) =>
      str && str.length > max ? str.substring(0, max) + "..." : str || ""

    // -- HEADER BACKGROUND --
    const headerH = t ? 70 : 60
    drawRect(left, y + 10, right - left, headerH, headerBg)

    // Clinic name + transliterated subtitle
    drawText(clinic?.name || "Clinic", left + 10, y - 5, 18, fontBold, white)
    if (t) {
      drawText("(" + t.clinic + ")", left + 10, y - 20, 9, fontItalic, rgb(0.7, 0.9, 0.9))
    }
    const addrY = t ? y - 33 : y - 22
    drawText(clinic?.address || "", left + 10, addrY, 8, fontRegular, rgb(0.8, 0.9, 0.9))
    drawText(clinic?.phone ? "Tel: " + clinic.phone : "", left + 10, addrY - 11, 8, fontRegular, rgb(0.8, 0.9, 0.9))

    // Doctor block right side
    const drName = doctor?.name || "Doctor"
    const drNameW = fontBold.widthOfTextAtSize(drName, 12)
    drawText(drName, right - drNameW - 10, y - 5, 12, fontBold, white)
    if (t) {
      const drSub = "(" + t.doctor + ")"
      const drSubW = fontItalic.widthOfTextAtSize(drSub, 9)
      drawText(drSub, right - drSubW - 10, y - 18, 9, fontItalic, rgb(0.7, 0.9, 0.9))
    }
    const drDetailY = t ? y - 30 : y - 19
    const drQual = doctor?.qualification || ""
    drawText(drQual, right - fontRegular.widthOfTextAtSize(drQual, 8) - 10, drDetailY, 8, fontRegular, rgb(0.8, 0.9, 0.9))
    const drReg = doctor?.registration_number ? "Reg: " + doctor.registration_number : ""
    drawText(drReg, right - fontRegular.widthOfTextAtSize(drReg, 8) - 10, drDetailY - 11, 8, fontRegular, rgb(0.8, 0.9, 0.9))
    const drSpec = doctor?.specialty || ""
    drawText(drSpec, right - fontRegular.widthOfTextAtSize(drSpec, 8) - 10, drDetailY - 22, 8, fontRegular, rgb(0.8, 0.9, 0.9))

    y -= (headerH + 10)

    // -- PATIENT BAR --
    page.drawRectangle({ x: left, y: y - 36, width: right - left, height: 40, borderColor: teal, borderWidth: 0.5, color: lightTeal })

    const colW = (right - left) / 4
    const patLabel = t ? t.patient + " / Patient" : "Patient"
    const dateLabel = t ? t.date + " / Date" : "Date"
    const fields: [string, string][] = [
      [patLabel, patient?.name || "—"],
      ["Healthcare ID", patient?.healthcare_id || "—"],
      ["Age / Gender", `${getAge(patient?.dob)}y / ${patient?.gender || "—"}`],
      [dateLabel, new Date().toLocaleDateString("en-IN")],
    ]
    fields.forEach(([label, value], i) => {
      const x = left + 8 + i * colW
      drawText(label, x, y - 4, 7, fontBold, gray)
      drawText(truncate(value, 20), x, y - 16, 9, fontBold, i === 1 ? teal : dark)
    })

    y -= 50

    // -- VITALS --
    if (Object.keys(vitals).length > 0) {
      drawText("VITALS", left, y, 8, fontBold, teal)
      y -= 4
      drawLine(y, teal, 0.5)
      y -= 14

      const vitalItems = [
        vitals.bp_sys ? `BP: ${vitals.bp_sys}/${vitals.bp_dia} mmHg` : null,
        vitals.pulse ? `Pulse: ${vitals.pulse} bpm` : null,
        vitals.temp || vitals.temperature ? `Temp: ${vitals.temp || vitals.temperature}F` : null,
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
        if (vx > right - 60) { vx = left; y -= 20 }
      })
      y -= 26
    }

    // -- CHIEF COMPLAINT --
    if (visit.chief_complaint) {
      drawText("CHIEF COMPLAINT", left, y, 8, fontBold, teal)
      y -= 4
      drawLine(y, teal, 0.5)
      y -= 14
      drawText(truncate(visit.chief_complaint, 90), left, y, 10, fontRegular, dark)
      y -= 20
    }

    // -- SOAP NOTES --
    if (soap.assessment || soap.subjective) {
      const soapLabel = t ? t.soap + " / CLINICAL NOTES (SOAP)" : "CLINICAL NOTES (SOAP)"
      drawText(soapLabel, left, y, 8, fontBold, teal)
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

    // -- MEDICATIONS WITH TIMING COLUMNS --
    if (meds.length > 0) {
      const rxLabel = t ? t.rx + " / Rx PRESCRIPTION" : "Rx PRESCRIPTION"
      drawText(rxLabel, left, y, 10, fontBold, teal)
      y -= 4
      drawLine(y, teal, 1)
      y -= 6

      // Columns: #, Drug, Dosage, M, A, E, N, Duration
      const cw = [22, 110, 55, 38, 38, 38, 38, 55]
      const cx = [left]
      cw.forEach((w, i) => cx.push(cx[i] + w))

      // Header labels with transliterated timing
      const mHead = t ? "M (" + t.morning.substring(0, 4) + ")" : "M"
      const aHead = t ? "A (" + t.afternoon.substring(0, 4) + ")" : "A"
      const eHead = t ? "E (" + t.evening.substring(0, 4) + ")" : "E"
      const nHead = t ? "N (" + t.night.substring(0, 4) + ")" : "N"
      const headers = ["#", "Drug / Medicine", "Dosage", mHead, aHead, eHead, nHead, "Duration"]

      drawRect(left, y + 4, right - left, 18, teal)
      headers.forEach((h, i) => drawText(h, cx[i] + 2, y - 6, 7, fontBold, white))
      y -= 20

      meds.forEach((m: any, idx: number) => {
        if (idx % 2 === 0) drawRect(left, y + 4, right - left, 16, rgb(0.97, 0.99, 0.99))
        const row = [
          String(idx + 1),
          m.name || "—",
          m.dosage || "—",
          m.morning ? "Y" : "-",
          m.afternoon ? "Y" : "-",
          m.evening ? "Y" : "-",
          m.night ? "Y" : "-",
          m.duration || "—"
        ]
        row.forEach((val, i) => {
          drawText(truncate(val, i === 1 ? 18 : 14), cx[i] + 2, y - 4, 9,
            i === 1 ? fontBold : fontRegular,
            [3, 4, 5, 6].includes(i) && val === "Y" ? teal : dark)
        })
        y -= 16
      })
      y -= 8
    }

    // -- INVESTIGATIONS --
    if (investigations.length > 0) {
      const invLabel = t ? t.investigations + " / INVESTIGATIONS" : "INVESTIGATIONS"
      drawText(invLabel, left, y, 8, fontBold, teal)
      y -= 4
      drawLine(y, teal, 0.5)
      y -= 14
      drawText(investigations.join("  |  "), left, y, 9, fontRegular, dark)
      y -= 20
    }

    // -- FOLLOW UP --
    if (prescription.follow_up_date) {
      const fuLabel = t ? t.followUp + " / Follow-up" : "Follow-up"
      page.drawRectangle({ x: left, y: y - 16, width: right - left, height: 20, borderColor: rgb(0.99, 0.83, 0.2), borderWidth: 0.5, color: rgb(1, 0.99, 0.88) })
      drawText(fuLabel + ": " + new Date(prescription.follow_up_date).toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" }), left + 8, y - 4, 10, fontBold, rgb(0.5, 0.35, 0))
      y -= 28
    }

    // -- SIGNATURE --
    y -= 20
    const sigX = right - 180
    page.drawLine({ start: { x: sigX, y }, end: { x: right, y }, thickness: 0.5, color: dark })
    drawText(doctor?.name || "Doctor", sigX, y - 14, 10, fontBold, dark)
    drawText(doctor?.qualification || "", sigX, y - 26, 8, fontRegular, gray)
    drawText(doctor?.registration_number ? "Reg: " + doctor.registration_number : "", sigX, y - 37, 8, fontRegular, gray)

    // -- FOOTER --
    drawLine(50, rgb(0.8, 0.8, 0.8), 0.5)
    drawText("Generated by StethoScribe", left, 38, 8, fontRegular, gray)
    const dateStr = new Date().toLocaleString("en-IN")
    const dateW = fontRegular.widthOfTextAtSize(dateStr, 8)
    drawText(dateStr, right - dateW, 38, 8, fontRegular, gray)

    // -- LANGUAGE TAG --
    if (t && lang) {
      drawText("Language: " + lang, left + 180, 38, 7, fontItalic, gray)
    }

    // Serialize PDF
    const pdfBytes = await pdfDoc.save()

    // Upload to storage
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
