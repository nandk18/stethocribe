import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import ConsultationWorkspace from "@/components/doctor/ConsultationWorkspace";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Clock, AlertTriangle, Stethoscope } from "lucide-react";

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

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [selectedVisit, setSelectedVisit] = useState<Visit | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchVisits = useCallback(async () => {
    if (!profile?.clinic_id) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("visits")
      .select("id, token_number, status, chief_complaint, vitals, created_at, patient_id, patients!inner(id, name, gender, dob, allergies, chronic_conditions)")
      .eq("clinic_id", profile.clinic_id)
      .eq("visit_date", today)
      .in("status", ["waiting", "in_progress"])
      .order("token_number", { ascending: true });

    if (!error && data) {
      const mapped = data.map((v: any) => ({ ...v, patient: v.patients }));
      setVisits(mapped);
      // Update selected visit if still exists
      if (selectedVisit) {
        const updated = mapped.find(v => v.id === selectedVisit.id);
        if (updated) setSelectedVisit(updated);
      }
    }
    setLoading(false);
  }, [profile?.clinic_id, selectedVisit?.id]);

  useEffect(() => {
    fetchVisits();
    const channel = supabase
      .channel("doctor-visits")
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => fetchVisits())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchVisits]);

  const handleSelectVisit = async (visit: Visit) => {
    // Mark as in_progress
    if (visit.status === "waiting") {
      await supabase.from("visits").update({ status: "in_progress" }).eq("id", visit.id);
    }
    setSelectedVisit(visit);
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    const years = Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
    return years;
  };

  const statusColor = (status: string) => {
    if (status === "waiting") return "bg-warning/15 text-warning border-warning/30";
    if (status === "in_progress") return "bg-info/15 text-info border-info/30";
    return "bg-muted text-muted-foreground";
  };

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-5rem)] gap-6">
        {/* Left: Queue */}
        <div className="w-80 flex-shrink-0 overflow-auto">
          <h2 className="font-display text-lg font-bold text-foreground mb-4">Today's Queue</h2>
          <div className="space-y-2">
            {loading ? (
              [1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />)
            ) : visits.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No patients waiting</p>
            ) : (
              visits.map(visit => (
                <Card
                  key={visit.id}
                  className={`cursor-pointer shadow-card transition-all hover:shadow-elevated ${
                    selectedVisit?.id === visit.id ? "ring-2 ring-primary" : ""
                  }`}
                  onClick={() => handleSelectVisit(visit)}
                >
                  <CardContent className="p-3">
                    <div className="flex items-start gap-3">
                      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 font-display text-sm font-bold text-primary">
                        #{visit.token_number}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{visit.patient?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {visit.patient?.gender && `${visit.patient.gender}`}
                          {visit.patient?.dob && `, ${getAge(visit.patient.dob)}y`}
                        </p>
                        {visit.chief_complaint && (
                          <p className="text-xs text-muted-foreground mt-1 truncate">{visit.chief_complaint}</p>
                        )}
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${statusColor(visit.status)}`}>
                            {visit.status.replace("_", " ")}
                          </Badge>
                          {visit.patient?.allergies && Array.isArray(visit.patient.allergies) && visit.patient.allergies.length > 0 && (
                            <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                              <AlertTriangle className="mr-1 h-2.5 w-2.5" /> Allergies
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        {/* Right: Consultation Workspace */}
        <div className="flex-1 overflow-auto">
          {selectedVisit ? (
            <ConsultationWorkspace visit={selectedVisit} onComplete={() => {
              setSelectedVisit(null);
              fetchVisits();
            }} />
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
    </DashboardLayout>
  );
}
