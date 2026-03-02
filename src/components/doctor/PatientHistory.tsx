import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Calendar, ChevronDown, FileText, Pill, ExternalLink, Loader2 } from "lucide-react";

function PrescriptionLinkButton({ pdfUrl }: { pdfUrl: string }) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.storage
        .from("prescriptions")
        .createSignedUrl(pdfUrl, 600);
      if (data?.signedUrl) {
        window.open(data.signedUrl, "_blank");
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ExternalLink className="mr-1 h-3 w-3" />} View Prescription
    </Button>
  );
}

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
  prescriptions: { medications: any; investigations: any; follow_up_date: string | null; pdf_url: string | null }[];
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
          prescriptions(medications, investigations, follow_up_date, pdf_url)
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
      <p className="text-sm text-muted-foreground">{history.length} previous visit{history.length !== 1 ? "s" : ""}</p>
      {history.map(visit => {
        const soap = visit.clinical_notes?.[0]?.soap_notes;
        const meds = visit.prescriptions?.[0]?.medications;
        const pdfUrl = visit.prescriptions?.[0]?.pdf_url;

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

              {soap?.assessment && (
                <p className="text-sm font-semibold text-foreground">{soap.assessment}</p>
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
                      {soap.subjective && <div><span className="font-semibold text-foreground">Subjective:</span> <span className="text-muted-foreground">{soap.subjective}</span></div>}
                      {soap.objective && <div><span className="font-semibold text-foreground">Objective:</span> <span className="text-muted-foreground">{soap.objective}</span></div>}
                      {soap.assessment && <div><span className="font-semibold text-foreground">Assessment:</span> <span className="text-muted-foreground">{soap.assessment}</span></div>}
                      {soap.plan && <div><span className="font-semibold text-foreground">Plan:</span> <span className="text-muted-foreground">{soap.plan}</span></div>}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {pdfUrl && (
                  <PrescriptionLinkButton pdfUrl={pdfUrl} />
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
