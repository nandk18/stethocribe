import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { transcript, patient_context } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are an expert medical scribe for Indian clinical settings. Convert the doctor's dictation or clinical notes into structured SOAP notes and extract prescriptions. The speech may be in English or Indian regional languages.

Return ONLY valid JSON with this exact structure:
{
  "subjective": "Patient's symptoms, history, complaints in clear medical language",
  "objective": "Physical examination findings, vitals, observable data",
  "assessment": "Diagnosis, differential diagnoses, clinical reasoning",
  "plan": "Treatment plan, follow-up instructions",
  "medications": [{"name": "drug name", "dosage": "dose", "frequency": "how often", "duration": "how long", "instructions": "special instructions"}],
  "investigations": ["list of recommended tests"],
  "icd_suggestions": ["relevant ICD-10 codes"],
  "follow_up_recommendation": "when to follow up"
}

If any section has no information, use an empty string or empty array. Be thorough and professional.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Clinical notes/dictation:\n\n${transcript}${patient_context ? `\n\nPatient context: ${JSON.stringify(patient_context)}` : ""}` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      throw new Error("AI processing failed");
    }

    const aiResult = await response.json();
    const content = aiResult.choices?.[0]?.message?.content;

    // Parse the JSON from the AI response
    let parsed;
    try {
      // Try to extract JSON from potential markdown code blocks
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[1].trim() : content.trim());
    } catch {
      // If parsing fails, return the raw content as subjective
      parsed = {
        subjective: content,
        objective: "",
        assessment: "",
        plan: "",
        medications: [],
        investigations: [],
        icd_suggestions: [],
        follow_up_recommendation: "",
      };
    }

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("format-soap-notes error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
