import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is authenticated admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error("Invalid token");

    // Check caller is admin
    const { data: callerProfile } = await supabase
      .from("profiles")
      .select("role, clinic_id, full_name")
      .eq("user_id", user.id)
      .single();

    if (!callerProfile || callerProfile.role !== "admin") {
      throw new Error("Only admins can invite staff");
    }

    const { email, role, clinic_id } = await req.json();
    if (!email || !role || !clinic_id) throw new Error("Missing email, role, or clinic_id");
    if (clinic_id !== callerProfile.clinic_id) throw new Error("Clinic mismatch");
    if (!["doctor", "receptionist"].includes(role)) throw new Error("Invalid role");

    // Get clinic name for the invite
    const { data: clinic } = await supabase
      .from("clinics")
      .select("name")
      .eq("id", clinic_id)
      .single();

    const origin = req.headers.get("origin") || "https://stethocribe.lovable.app";

    // Invite user via Supabase Auth Admin API
    const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(email, {
      data: {
        full_name: email,
        invited_role: role,
        invited_clinic_id: clinic_id,
        clinic_name: clinic?.name || "your clinic",
        invited_by: callerProfile.full_name || "Admin",
      },
      redirectTo: `${origin}/accept-invite`,
    });

    if (inviteErr) throw inviteErr;

    // Update the auto-created profile with the correct role and clinic
    if (inviteData?.user) {
      await supabase
        .from("profiles")
        .update({ role, clinic_id })
        .eq("user_id", inviteData.user.id);

      await supabase
        .from("user_roles")
        .upsert({ user_id: inviteData.user.id, role }, { onConflict: "user_id,role" });

      // If doctor, create doctor record
      if (role === "doctor") {
        await supabase.from("doctors").insert({
          clinic_id,
          user_id: inviteData.user.id,
          name: email,
        });
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
