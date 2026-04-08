import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, FileText, Pill, ExternalLink } from "lucide-react";
import VitalsTrends from "@/components/vitals/VitalsTrends";
import { renderClinicalNotes } from "@/lib/templateFields";

type Props = {
  patientId: string;
  currentVisitId: string;
};

type HistoryVisit = {
  id: string;
  visit_date: string | null;
  token_number: number;
  chief_complaint: string | null;
  status: string | null;
  doctors: { name: string; qualification: string | null } | null;
  clinical_notes: { soap_notes: any; raw_transcript: string | null }[];
  prescriptions: { id: string; medications: any; investigations: any; follow_up_date: string | null; pdf_url: string | null }[];
};

export default function PatientHistory({ patientId, currentVisitId }: Props) {
  const [history, setHistory] = useState<HistoryVisit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("visits")
        .select(`
          id, visit_date, token_number, chief_complaint, status,
          doctors(name, qualification),
          clinical_notes(soap_notes, raw_transcript),
          prescriptions(id, medications, investigations, follow_up_date, pdf_url)
        `)
        .eq("patient_id", patientId)
        .neq("id", currentVisitId)
        .order("visit_date", { ascending: false })
        .limit(20);

      if (!error && data) {
        setHistory(data.map((v: any) => ({
          ...v,
          doctors: Array.isArray(v.doctors) ? v.doctors[0] ?? null : v.doctors,
        })));
      }
      setLoading(false);
    };
    fetchHistory();
  }, [patientId, currentVisitId]);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <Calendar className="mb-4 h-12 w-12 text-muted-foreground/20" />
          <h3 className="font-display text-lg font-semibold text-muted-foreground">First Visit</h3>
          <p className="text-sm text-muted-foreground">No previous visit history for this patient</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <VitalsTrends patientId={patientId} />
      <p className="text-sm text-muted-foreground">{history.length} previous visit{history.length !== 1 ? "s" : ""}</p>
      {history.map(visit => {
        const soap = visit.clinical_notes?.[0]?.soap_notes;
        const meds = visit.prescriptions?.[0]?.medications;
        const prescriptionId = visit.prescriptions?.[0]?.id;

        // Get a display field for the summary line
        const displayField = soap?.assessment || soap?.diagnosis || soap?.admission_diagnosis || soap?.current_status;

        return (
          <Card key={visit.id} className="shadow-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{visit.visit_date}</span>
                    <Badge variant="outline" className="text-[10px]">#{visit.token_number}</Badge>
                  </div>
                  {visit.doctors && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Dr. {visit.doctors.name}{visit.doctors.qualification && `, ${visit.doctors.qualification}`}
                    </p>
                  )}
                </div>
                <Badge variant="outline" className="text-[10px]">{visit.status}</Badge>
              </div>

              {visit.chief_complaint && (
                <p className="text-sm text-muted-foreground">{visit.chief_complaint}</p>
              )}

              {displayField && (
                <p className="text-sm font-semibold text-foreground">{displayField}</p>
              )}

              {meds && Array.isArray(meds) && meds.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {meds.map((m: any, i: number) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">
                      <Pill className="mr-0.5 h-2.5 w-2.5" /> {m.name} {m.dosage}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                {soap && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-xs h-7">
                        <FileText className="mr-1 h-3 w-3" /> View Full Notes <ChevronDown className="ml-1 h-3 w-3" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="mt-2 space-y-2 rounded-lg bg-muted/50 p-3 text-xs">
                      {renderClinicalNotes(soap)}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {prescriptionId && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => window.open(`/rx/${prescriptionId}`, "_blank")}
                  >
                    <ExternalLink className="mr-1 h-3 w-3" /> View Prescription
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
