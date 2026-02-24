import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, AlertTriangle, Stethoscope, ArrowRight, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Visit = {
  id: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
  vitals: any;
  created_at: string;
  patient_id: string;
  patient: { id: string; name: string; healthcare_id: string | null; gender: string | null; dob: string | null; blood_group: string | null; allergies: any; chronic_conditions: any } | null;
};

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [visits, setVisits] = useState<Visit[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchVisits = useCallback(async () => {
    if (!profile?.clinic_id) return;
    const today = new Date().toISOString().split("T")[0];
    const { data, error } = await supabase
      .from("visits")
      .select("id, token_number, status, chief_complaint, vitals, created_at, patient_id, patients!inner(id, name, healthcare_id, gender, dob, blood_group, allergies, chronic_conditions)")
      .eq("clinic_id", profile.clinic_id)
      .eq("visit_date", today)
      .order("token_number", { ascending: true });

    if (!error && data) {
      setVisits(data.map((v: any) => ({ ...v, patient: v.patients })));
    }
    setLoading(false);
  }, [profile?.clinic_id]);

  useEffect(() => {
    fetchVisits();
    const channel = supabase
      .channel("doctor-visits")
      .on("postgres_changes", { event: "*", schema: "public", table: "visits" }, () => fetchVisits())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchVisits]);

  const handleStartConsultation = async (visit: Visit) => {
    if (visit.status === "waiting") {
      await supabase.from("visits").update({ status: "in_progress" }).eq("id", visit.id);
    }
    navigate(`/dashboard/consultation/${visit.id}`);
  };

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const getWaitTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  const statusColor = (status: string) => {
    if (status === "waiting") return "bg-warning/15 text-warning border-warning/30";
    if (status === "in_progress") return "bg-info/15 text-info border-info/30";
    if (status === "completed") return "bg-success/15 text-success border-success/30";
    return "bg-muted text-muted-foreground";
  };

  const filteredVisits = visits.filter(v => {
    if (filter === "all") return true;
    return v.status === filter;
  });

  const counts = {
    all: visits.length,
    waiting: visits.filter(v => v.status === "waiting").length,
    in_progress: visits.filter(v => v.status === "in_progress").length,
    completed: visits.filter(v => v.status === "completed").length,
  };

  return (
    <DashboardLayout>
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-2xl font-bold text-foreground">Today's Queue</h1>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
          <Badge variant="outline" className="text-sm px-3 py-1">{counts.all} patients</Badge>
        </div>
      </div>

      {/* Filter tabs */}
      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList>
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger>
          <TabsTrigger value="waiting">Waiting ({counts.waiting})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({counts.in_progress})</TabsTrigger>
          <TabsTrigger value="completed">Completed ({counts.completed})</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Queue list */}
      <div className="space-y-3">
        {loading ? (
          [1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)
        ) : filteredVisits.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Stethoscope className="mb-4 h-16 w-16 text-muted-foreground/20" />
            <h3 className="font-display text-lg font-semibold text-muted-foreground">No patients {filter !== "all" ? `${filter.replace("_", " ")}` : "today"}</h3>
          </div>
        ) : (
          filteredVisits.map(visit => (
            <Card
              key={visit.id}
              className="shadow-card transition-all hover:shadow-elevated cursor-pointer"
              onClick={() => handleStartConsultation(visit)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {/* Token */}
                  <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 font-display text-xl font-bold text-primary">
                    #{visit.token_number}
                  </div>

                  {/* Patient info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground truncate">{visit.patient?.name}</p>
                      {visit.patient?.healthcare_id && (
                        <span className="font-mono text-[10px] text-primary">{visit.patient.healthcare_id}</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {visit.patient?.gender}{visit.patient?.dob && `, ${getAge(visit.patient.dob)}y`}
                      {visit.patient?.blood_group && ` · ${visit.patient.blood_group}`}
                    </p>
                    {visit.chief_complaint && (
                      <p className="text-sm text-foreground/80 mt-1 truncate">{visit.chief_complaint}</p>
                    )}
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {/* Vitals status */}
                      {visit.vitals && Object.keys(visit.vitals).length > 0 ? (
                        <Badge variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">🟢 Vitals recorded</Badge>
                      ) : (
                        <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">🔴 No vitals</Badge>
                      )}
                      {visit.patient?.allergies && Array.isArray(visit.patient.allergies) && visit.patient.allergies.length > 0 && (
                        <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">
                          <AlertTriangle className="mr-1 h-2.5 w-2.5" /> Allergies
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* Right side */}
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <Badge variant="outline" className={statusColor(visit.status)}>
                      {visit.status.replace("_", " ")}
                    </Badge>
                    {visit.status === "waiting" && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" /> {getWaitTime(visit.created_at)}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant={visit.status === "completed" ? "outline" : "default"}
                      className="text-xs"
                      onClick={(e) => { e.stopPropagation(); handleStartConsultation(visit); }}
                    >
                      {visit.status === "waiting" && <><ArrowRight className="mr-1 h-3 w-3" /> Start</>}
                      {visit.status === "in_progress" && <><ArrowRight className="mr-1 h-3 w-3" /> Continue</>}
                      {visit.status === "completed" && <><Eye className="mr-1 h-3 w-3" /> View Notes</>}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
