import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PatientRegistration from "@/components/receptionist/PatientRegistration";
import TodayQueue from "@/components/receptionist/TodayQueue";
import ConsultationWorkspace from "@/components/doctor/ConsultationWorkspace";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CalendarDays, Stethoscope, UserPlus } from "lucide-react";

type Visit = {
  id: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
  vitals: any;
  created_at: string;
  patient_id: string;
  patient: { id: string; name: string; gender: string | null; dob: string | null; allergies: any; chronic_conditions: any } | null;
};

function AdminQueueView() {
  const { profile } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);
  const [addPatientOpen, setAddPatientOpen] = useState(false);

  const fetchVisits = useCallback(async () => {
    if (!profile?.clinic_id) return;
    const today = new Date().toISOString().split("T")[0];
    const { data } = await supabase
      .from("visits")
      .select("id, token_number, status, chief_complaint, vitals, created_at, patient_id, patients!inner(id, name, gender, dob, allergies, chronic_conditions)")
      .eq("clinic_id", profile.clinic_id)
      .eq("visit_date", today)
      .order("token_number", { ascending: true });
    if (data) setVisits(data.map((v: any) => ({ ...v, patient: v.patients })));
    setLoading(false);
  }, [profile?.clinic_id]);

  useEffect(() => {
    fetchVisits();
    const channel = supabase
      .channel("admin-visits")
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => fetchVisits())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchVisits]);

  const statusColor = (status: string) => {
    if (status === "waiting") return "bg-warning/15 text-warning border-warning/30";
    if (status === "in_progress") return "bg-info/15 text-info border-info/30";
    if (status === "completed") return "bg-success/15 text-success border-success/30";
    return "bg-muted text-muted-foreground";
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  return (
    <Tabs defaultValue="reception" className="space-y-4">
      <div className="flex items-center justify-between">
        <TabsList>
          <TabsTrigger value="reception"><CalendarDays className="mr-2 h-4 w-4" /> Reception View</TabsTrigger>
          <TabsTrigger value="doctor"><Stethoscope className="mr-2 h-4 w-4" /> Doctor View</TabsTrigger>
        </TabsList>
        <Dialog open={addPatientOpen} onOpenChange={setAddPatientOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><UserPlus className="mr-2 h-4 w-4" /> Add Patient</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>Register & Queue Patient</DialogTitle></DialogHeader>
            <PatientRegistration onSuccess={() => { setAddPatientOpen(false); fetchVisits(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <TabsContent value="reception">
        <TodayQueue />
      </TabsContent>

      <TabsContent value="doctor">
        <div className="flex h-[calc(100vh-14rem)] gap-6">
          <div className="w-80 flex-shrink-0 overflow-auto">
            <h2 className="font-display text-lg font-bold text-foreground mb-4">Active Queue</h2>
            <div className="space-y-2">
              {loading ? (
                [1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)
              ) : visits.filter(v => v.status === "waiting" || v.status === "in_progress").length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No patients waiting</p>
              ) : (
                visits.filter(v => v.status === "waiting" || v.status === "in_progress").map(visit => (
                  <Card key={visit.id} className={`cursor-pointer shadow-card transition-all hover:shadow-elevated ${selectedVisit?.id === visit.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => { if (visit.status === "waiting") supabase.from("visits").update({ status: "in_progress" }).eq("id", visit.id); setSelectedVisit(visit); }}>
                    <CardContent className="p-3">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-sm font-bold text-primary">#{visit.token_number}</div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">{visit.patient?.name}</p>
                          <p className="text-xs text-muted-foreground">{visit.patient?.gender}{visit.patient?.dob && `, ${getAge(visit.patient.dob)}y`}</p>
                          {visit.chief_complaint && <p className="text-xs text-muted-foreground mt-1 truncate">{visit.chief_complaint}</p>}
                          <Badge variant="outline" className={`text-[10px] mt-1 ${statusColor(visit.status)}`}>{visit.status.replace("_", " ")}</Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
          <div className="flex-1 overflow-auto">
            {selectedVisit ? (
              <ConsultationWorkspace visit={selectedVisit} onComplete={() => { setSelectedVisit(null); fetchVisits(); }} />
            ) : (
              <div className="flex h-full items-center justify-center">
                <div className="text-center">
                  <Stethoscope className="mx-auto mb-4 h-16 w-16 text-muted-foreground/20" />
                  <h3 className="font-display text-lg font-semibold text-muted-foreground">Select a patient</h3>
                  <p className="text-sm text-muted-foreground">Click on a patient from the queue to begin consultation</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}

export default function AdminDashboard() {
  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Admin Dashboard</h1>
        <p className="text-sm text-muted-foreground">Manage your clinic operations</p>
      </div>
      <AdminQueueView />
    </DashboardLayout>
  );
}
