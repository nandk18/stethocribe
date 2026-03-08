import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FileText, Loader2 } from "lucide-react";

const SYSTEM_TEMPLATES = [
  { name: "SOAP Notes", description: "Standard Subjective Objective Assessment Plan" },
  { name: "SOAP Detailed", description: "Extended SOAP with HPI and ROS" },
  { name: "Clinical Notes", description: "General clinical documentation" },
  { name: "General Health Check-Up", description: "Routine annual health examination" },
  { name: "General Inpatient Admission", description: "Hospital admission documentation" },
  { name: "Follow-Up Visit", description: "Return patient review" },
  { name: "Referral Letter", description: "Patient referral to specialist" },
  { name: "Prescription Only", description: "Quick prescription without detailed notes" },
  { name: "Oncology Consultation", description: "Cancer care consultation template" },
  { name: "EKA EMR Format", description: "Compatible with EKA.care EMR system" },
];

async function getDoctorForUserTemplates(userId: string, clinicId: string) {
  const { data: dr } = await supabase
    .from("doctors").select("*").eq("user_id", userId).single();
  if (dr) return dr;
  const { data: prof } = await supabase
    .from("profiles").select("full_name").eq("user_id", userId).single();
  const { data: newDr } = await supabase
    .from("doctors")
    .insert({ clinic_id: clinicId, user_id: userId, name: prof?.full_name || "Admin Doctor", specialty: "General Medicine" })
    .select().single();
  return newDr;
}

export default function TemplatesPage() {
  const { profile } = useAuth();
  const { doctor } = useClinic();
  const [doctorRecord, setDoctorRecord] = useState<any>(null);
  const [enabledTemplates, setEnabledTemplates] = useState<string[]>(["SOAP Notes"]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("library");

  useEffect(() => {
    const init = async () => {
      if (doctor) {
        setDoctorRecord(doctor);
        await fetchDoctorTemplates(doctor.id);
      } else if (profile?.role === "admin" && profile?.user_id && profile?.clinic_id) {
        const dr = await getDoctorForUserTemplates(profile.user_id, profile.clinic_id);
        if (dr) {
          setDoctorRecord(dr);
          await fetchDoctorTemplates(dr.id);
        } else {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };
    init();
  }, [doctor, profile?.role, profile?.user_id, profile?.clinic_id]);

  const fetchDoctorTemplates = async (doctorId: string) => {
    const { data } = await supabase
      .from("doctors")
      .select("enabled_templates")
      .eq("id", doctorId)
      .single();
    if (data?.enabled_templates) {
      setEnabledTemplates(data.enabled_templates as string[]);
    }
    setLoading(false);
  };

  const toggleTemplate = async (templateName: string) => {
    if (!doctorRecord) return;
    let updated: string[];
    if (enabledTemplates.includes(templateName)) {
      if (enabledTemplates.length <= 1) {
        toast.error("You must have at least one template enabled");
        return;
      }
      updated = enabledTemplates.filter(t => t !== templateName);
    } else {
      updated = [...enabledTemplates, templateName];
    }
    setEnabledTemplates(updated);

    const { error } = await supabase
      .from("doctors")
      .update({ enabled_templates: updated } as any)
      .eq("id", doctorRecord.id);
    if (error) {
      toast.error("Failed to update templates");
      fetchDoctorTemplates(doctorRecord.id);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </DashboardLayout>
    );
  }

  const myTemplates = SYSTEM_TEMPLATES.filter(t => enabledTemplates.includes(t.name));

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Templates</h1>
        <p className="text-sm text-muted-foreground">Manage your clinical note templates</p>
      </div>

      <div className="max-w-2xl">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-xl mb-4">
            <TabsTrigger value="my" className="rounded-lg">My Templates</TabsTrigger>
            <TabsTrigger value="library" className="rounded-lg">Library</TabsTrigger>
          </TabsList>

          <TabsContent value="my">
            {myTemplates.length === 0 ? (
              <Card className="rounded-2xl border-0 shadow-sm">
                <CardContent className="p-8 text-center">
                  <FileText className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">No templates enabled. Go to Library to enable templates.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {myTemplates.map(t => (
                  <Card key={t.name} className="rounded-xl border-0 shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                          <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium text-sm text-foreground">{t.name}</p>
                          <p className="text-xs text-muted-foreground">{t.description}</p>
                        </div>
                      </div>
                      <Switch
                        checked={true}
                        onCheckedChange={() => toggleTemplate(t.name)}
                      />
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="library">
            <div className="space-y-2">
              {SYSTEM_TEMPLATES.map(t => (
                <Card key={t.name} className="rounded-xl border-0 shadow-sm">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <FileText className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{t.name}</p>
                        <p className="text-xs text-muted-foreground">{t.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={enabledTemplates.includes(t.name)}
                      onCheckedChange={() => toggleTemplate(t.name)}
                    />
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
