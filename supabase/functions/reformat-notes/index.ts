import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY not configured");
    }

    const { existing_content, new_template_name, field_definitions } = await req.json();

    if (!existing_content || !new_template_name || !field_definitions) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: existing_content, new_template_name, field_definitions" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fieldList = field_definitions
      .map((f: { key: string; label: string; placeholder: string }) => `"${f.key}": "${f.label} — ${f.placeholder}"`)
      .join(",\n");

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 2000,
        system: `You are a medical documentation assistant. You will receive existing clinical notes and must reformat them to fit a new documentation template called "${new_template_name}". Preserve all clinical information — do not add or remove medical facts. Return ONLY valid JSON with exactly the fields requested, no markdown, no explanation.`,
        messages: [{
          role: "user",
          content: `Existing clinical notes:\n${existing_content}\n\nReformat into this "${new_template_name}" template. Return JSON with exactly these fields:\n{\n${fieldList}\n}`,
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Claude API error:", response.status, errorText);

      let errorMessage: string;
      let errorCode: string;

      if (response.status === 401) {
        errorMessage = "Anthropic API key is invalid.";
        errorCode = "invalid_key";
      } else if (response.status === 429) {
        errorMessage = "Anthropic account has no credits. Please add billing at console.anthropic.com";
        errorCode = "no_credits";
      } else {
        errorMessage = `Reformat failed: ${errorText.slice(0, 200)}`;
        errorCode = "api_error";
      }

      return new Response(
        JSON.stringify({ error: errorMessage, error_code: errorCode }),
        { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const claudeResponse = await response.json();
    const content = claudeResponse.content[0].text;
    const cleaned = content.replace(/```json|```/g, "").trim();
    const reformatted = JSON.parse(cleaned);

    return new Response(JSON.stringify(reformatted), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("reformat-notes error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error", error_code: "internal" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
