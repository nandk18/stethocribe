import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, Calendar, ChevronDown, FileText, Pill, ExternalLink, Loader2, Phone, Mail, AlertTriangle, Activity, User } from "lucide-react";

function PrescriptionLinkButton({ pdfUrl }: { pdfUrl: string }) {
  const [loading, setLoading] = useState(false);
  const handleClick = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.storage.from("prescriptions").createSignedUrl(pdfUrl, 600);
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch {} finally { setLoading(false); }
  };
  return (
    <Button variant="ghost" size="sm" className="text-xs h-7" onClick={handleClick} disabled={loading}>
      {loading ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ExternalLink className="mr-1 h-3 w-3" />} View Prescription
    </Button>
  );
}

type Patient = {
  id: string; name: string; healthcare_id: string | null; gender: string | null;
  dob: string | null; phone: string | null; email: string | null;
  blood_group: string | null; allergies: any; chronic_conditions: any;
};

type HistoryVisit = {
  id: string; visit_date: string | null; token_number: number;
  chief_complaint: string | null; status: string | null;
  doctors: { name: string; qualification: string | null } | null;
  clinical_notes: { soap_notes: any; raw_transcript: string | null }[];
  prescriptions: { medications: any; investigations: any; follow_up_date: string | null; pdf_url: string | null; notes: string | null }[];
};

export default function PatientDetailPage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [visits, setVisits] = useState<HistoryVisit[]>([]);
  const [loading, setLoading] = useState(true);

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  useEffect(() => {
    if (!patientId || !profile?.clinic_id) return;
    const fetch = async () => {
      setLoading(true);
      const [patientRes, visitsRes] = await Promise.all([
        supabase.from("patients").select("*").eq("id", patientId).eq("clinic_id", profile.clinic_id).single(),
        supabase.from("visits").select(`
          id, visit_date, token_number, chief_complaint, status,
          doctors(name, qualification),
          clinical_notes(soap_notes, raw_transcript),
          prescriptions(medications, investigations, follow_up_date, pdf_url, notes)
        `).eq("patient_id", patientId).order("visit_date", { ascending: false }).limit(50),
      ]);
      if (patientRes.data) setPatient(patientRes.data as any);
      if (visitsRes.data) {
        setVisits(visitsRes.data.map((v: any) => ({
          ...v,
          doctors: Array.isArray(v.doctors) ? v.doctors[0] ?? null : v.doctors,
        })));
      }
      setLoading(false);
    };
    fetch();
  }, [patientId, profile?.clinic_id]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      </DashboardLayout>
    );
  }

  if (!patient) {
    return (
      <DashboardLayout>
        <div className="text-center py-20">
          <p className="text-muted-foreground">Patient not found.</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/patients")}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Patients
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <Button variant="ghost" size="sm" className="mb-4" onClick={() => navigate("/dashboard/patients")}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Patients
      </Button>

      {/* Patient Header */}
      <Card className="shadow-card mb-6">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start gap-4">
            <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-2xl bg-primary/10 font-display text-xl font-bold text-primary">
              {patient.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="font-display text-2xl font-bold text-foreground">{patient.name}</h1>
              {patient.healthcare_id && <p className="font-mono text-sm text-primary">{patient.healthcare_id}</p>}
              <div className="flex flex-wrap items-center gap-3 mt-2 text-sm text-muted-foreground">
                {patient.gender && <span className="capitalize">{patient.gender}</span>}
                {patient.dob && <span>{getAge(patient.dob)}y</span>}
                {patient.blood_group && <Badge variant="outline" className="text-xs">{patient.blood_group}</Badge>}
                {patient.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{patient.phone}</span>}
                {patient.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{patient.email}</span>}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {patient.allergies && Array.isArray(patient.allergies) && (patient.allergies as string[]).map((a: string) => (
                  <Badge key={a} variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-xs">
                    <AlertTriangle className="mr-1 h-3 w-3" /> {a}
                  </Badge>
                ))}
                {patient.chronic_conditions && Array.isArray(patient.chronic_conditions) && (patient.chronic_conditions as string[]).map((c: string) => (
                  <Badge key={c} variant="outline" className="border-orange-400/30 bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400 text-xs">
                    <Activity className="mr-1 h-3 w-3" /> {c}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Visit History */}
      <h2 className="font-display text-lg font-semibold text-foreground mb-3">Visit History</h2>
      {visits.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Calendar className="mb-4 h-12 w-12 text-muted-foreground/20" />
            <h3 className="font-display text-lg font-semibold text-muted-foreground">No Visits</h3>
            <p className="text-sm text-muted-foreground">No visit history for this patient yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{visits.length} visit{visits.length !== 1 ? "s" : ""}</p>
          {visits.map(visit => {
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
                    <Badge variant="outline" className="text-[10px] capitalize">{visit.status}</Badge>
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
                            <FileText className="mr-1 h-3 w-3" /> Full Notes <ChevronDown className="ml-1 h-3 w-3" />
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
                    {pdfUrl && <PrescriptionLinkButton pdfUrl={pdfUrl} />}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </DashboardLayout>
  );
}
