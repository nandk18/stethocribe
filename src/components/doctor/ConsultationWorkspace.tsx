import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Mic, FileText, Pill, CheckCircle, AlertTriangle, Activity, History, ClipboardList, FolderOpen } from "lucide-react";
import VoiceRecorder from "@/components/doctor/VoiceRecorder";
import PatientHistory from "@/components/doctor/PatientHistory";
import PrescriptionShareModal from "@/components/doctor/PrescriptionShareModal";
import DocumentsTab from "@/components/doctor/DocumentsTab";
import TemplateSelector from "@/components/doctor/TemplateSelector";
import EMRExportButtons from "@/components/doctor/EMRExportButtons";
import { useIsMobile } from "@/hooks/use-mobile";

type Visit = {
  id: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
  vitals: any;
  patient_id: string;
  patient: {
    id: string; name: string; healthcare_id?: string | null; gender: string | null; dob: string | null;
    blood_group?: string | null; allergies: any; chronic_conditions: any;
    phone?: string | null; email?: string | null;
  } | null;
};

type Medication = {
  name: string; dosage: string; morning: boolean; afternoon: boolean;
  evening: boolean; night: boolean; duration: string; notes: string;
};

export default function ConsultationWorkspace({ visit, onComplete }: { visit: Visit; onComplete: () => void }) {
  const { profile } = useAuth();
  const { clinic, doctor } = useClinic();
  const isMobile = useIsMobile();
  const [tab, setTab] = useState("summary");

  // SOAP Notes
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  // Template
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);

  // Prescription
  const [medications, setMedications] = useState<Medication[]>([
    { name: "", dosage: "", morning: false, afternoon: false, evening: false, night: false, duration: "", notes: "" },
  ]);
  const [investigations, setInvestigations] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [prescriptionNotes, setPrescriptionNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Sharing modal
  const [shareOpen, setShareOpen] = useState(false);
  const [sharePdfUrl, setSharePdfUrl] = useState<string | null>(null);

  const getAge = (dob: string | null) => {
    if (!dob) return "N/A";
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  const vitals = visit.vitals || {};

  const handleTranscriptProcessed = (soapData: any) => {
    if (soapData.subjective) setSubjective(soapData.subjective);
    if (soapData.objective) setObjective(soapData.objective);
    if (soapData.assessment) setAssessment(soapData.assessment);
    if (soapData.plan) setPlan(soapData.plan);
    if (soapData.medications?.length) {
      setMedications(soapData.medications.map((m: any) => ({
        name: m.name || "",
        dosage: m.dosage || "",
        morning: !!m.morning,
        afternoon: !!m.afternoon,
        evening: !!m.evening,
        night: !!m.night,
        duration: m.duration || "",
        notes: m.notes || m.instructions || "",
      })));
    }
    if (soapData.investigations?.length) setInvestigations(soapData.investigations.join(", "));
    setTab("soap");
    toast.success("SOAP notes generated from transcript!");
  };

  const addMedRow = () => setMedications(prev => [...prev, { name: "", dosage: "", morning: false, afternoon: false, evening: false, night: false, duration: "", notes: "" }]);
  const removeMedRow = (idx: number) => setMedications(prev => prev.filter((_, i) => i !== idx));
  const updateMed = (idx: number, field: keyof Medication, value: any) => {
    setMedications(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const handleCompleteConsultation = async () => {
    if (!assessment.trim()) {
      toast.error("Please fill in at least the Assessment in SOAP notes before completing.");
      setTab("soap");
      return;
    }
    setSaving(true);
    try {
      const { data: doctorRow } = await supabase
        .from("doctors").select("id").eq("user_id", profile!.user_id).single();
      if (!doctorRow) throw new Error("Doctor profile not found");

      await supabase.from("clinical_notes").insert({
        visit_id: visit.id, doctor_id: doctorRow.id,
        soap_notes: { subjective, objective, assessment, plan },
      });

      const validMeds = medications.filter(m => m.name.trim());
      let prescriptionId: string | null = null;
      if (validMeds.length > 0 || investigations.trim()) {
        const { data: prescData } = await supabase.from("prescriptions").insert({
          visit_id: visit.id, doctor_id: doctorRow.id,
          medications: validMeds,
          investigations: investigations ? investigations.split(",").map(s => s.trim()) : [],
          follow_up_date: followUpDate || null,
          notes: prescriptionNotes || null,
        }).select("id").single();
        prescriptionId = prescData?.id ?? null;
      }

      await supabase.from("visits").update({ status: "completed", doctor_id: doctorRow.id }).eq("id", visit.id);

      // Save default template for doctor
      if (selectedTemplate?.id) {
        await supabase.from("doctors").update({ default_template_id: selectedTemplate.id } as any).eq("id", doctorRow.id);
      }

      // Trigger PDF generation and show share modal
      if (prescriptionId) {
        const { data: pdfResult, error: pdfError } = await supabase.functions.invoke("generate-prescription-pdf", {
          body: { visit_id: visit.id, prescription_id: prescriptionId },
        });
        if (!pdfError && pdfResult?.path) {
          setSharePdfUrl(pdfResult.path);
          setShareOpen(true);
          toast.success("Prescription generated!");
        } else {
          toast.success("Consultation completed! (PDF generation in progress)");
          onComplete();
        }
      } else {
        toast.success("Consultation completed!");
        onComplete();
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const mobileTabItems = [
    { value: "summary", label: "Sum" },
    { value: "history", label: "Hist" },
    { value: "record", label: "Rec" },
    { value: "soap", label: "SOAP" },
    { value: "prescription", label: "Rx" },
    { value: "documents", label: "Docs" },
  ];

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Patient Header */}
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 font-display text-lg font-bold text-primary">
                #{visit.token_number}
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">{visit.patient?.name}</h2>
                <div className="flex items-center gap-2 flex-wrap">
                  {visit.patient?.healthcare_id && (
                    <span className="font-mono text-xs text-primary">{visit.patient.healthcare_id}</span>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {visit.patient?.gender} • {getAge(visit.patient?.dob ?? null)}y
                    {visit.patient?.blood_group && ` • ${visit.patient.blood_group}`}
                  </span>
                </div>
                {visit.chief_complaint && (
                  <p className="text-sm font-medium text-foreground mt-1 bg-warning/10 text-warning px-2 py-0.5 rounded-lg inline-block">
                    {visit.chief_complaint}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {visit.patient?.allergies && Array.isArray(visit.patient.allergies) && visit.patient.allergies.length > 0 && (
                (visit.patient.allergies as string[]).map((a: string) => (
                  <Badge key={a} variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg">
                    <AlertTriangle className="mr-1 h-3 w-3" /> {a}
                  </Badge>
                ))
              )}
              {visit.patient?.chronic_conditions && Array.isArray(visit.patient.chronic_conditions) && visit.patient.chronic_conditions.length > 0 && (
                (visit.patient.chronic_conditions as string[]).map((c: string) => (
                  <Badge key={c} variant="outline" className="border-warning/30 bg-warning/10 text-warning rounded-lg">
                    {c}
                  </Badge>
                ))
              )}
            </div>
          </div>

          {Object.keys(vitals).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {vitals.bp && (
                <div className="flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 text-xs">
                  <Activity className="h-3 w-3 text-primary" />
                  <span className="font-medium">BP:</span> {vitals.bp.systolic}/{vitals.bp.diastolic}
                </div>
              )}
              {vitals.pulse && <div className="rounded-lg bg-muted px-3 py-1.5 text-xs"><span className="font-medium">Pulse:</span> {vitals.pulse}</div>}
              {vitals.temperature && <div className="rounded-lg bg-muted px-3 py-1.5 text-xs"><span className="font-medium">Temp:</span> {vitals.temperature}°F</div>}
              {vitals.spo2 && <div className="rounded-lg bg-muted px-3 py-1.5 text-xs"><span className="font-medium">SpO2:</span> {vitals.spo2}%</div>}
              {vitals.weight && <div className="rounded-lg bg-muted px-3 py-1.5 text-xs"><span className="font-medium">Wt:</span> {vitals.weight}kg</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mobile: pill row tabs */}
      {isMobile ? (
        <div className="space-y-4">
          <div className="flex gap-1">
            {mobileTabItems.map(item => (
              <button
                key={item.value}
                className={`flex-1 py-2 text-xs font-medium rounded-full transition-all ${
                  tab === item.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                }`}
                onClick={() => setTab(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Content */}
          {tab === "summary" && renderSummary()}
          {tab === "history" && visit.patient && <PatientHistory patientId={visit.patient.id} currentVisitId={visit.id} />}
          {tab === "record" && <VoiceRecorder visitId={visit.id} onTranscriptProcessed={handleTranscriptProcessed} />}
          {tab === "soap" && renderSoap()}
          {tab === "prescription" && renderPrescription()}
          {tab === "documents" && visit.patient && profile?.clinic_id && (
            <DocumentsTab visitId={visit.id} patientId={visit.patient.id} clinicId={profile.clinic_id} />
          )}

          <Button
            className="w-full h-12 rounded-xl font-medium"
            onClick={handleCompleteConsultation}
            disabled={saving}
          >
            <CheckCircle className="mr-2 h-5 w-5" />
            {saving ? "Saving..." : "Complete Consultation"}
          </Button>
        </div>
      ) : (
        /* Desktop: standard tabs */
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="rounded-xl">
            <TabsTrigger value="summary" className="rounded-lg">Summary</TabsTrigger>
            <TabsTrigger value="history" className="rounded-lg"><History className="mr-1.5 h-3.5 w-3.5" /> History</TabsTrigger>
            <TabsTrigger value="record" className="rounded-lg"><Mic className="mr-1.5 h-3.5 w-3.5" /> Voice</TabsTrigger>
            <TabsTrigger value="soap" className="rounded-lg"><FileText className="mr-1.5 h-3.5 w-3.5" /> SOAP</TabsTrigger>
            <TabsTrigger value="prescription" className="rounded-lg"><Pill className="mr-1.5 h-3.5 w-3.5" /> Rx</TabsTrigger>
            <TabsTrigger value="documents" className="rounded-lg"><FolderOpen className="mr-1.5 h-3.5 w-3.5" /> Docs</TabsTrigger>
          </TabsList>

          <TabsContent value="summary">{renderSummary()}</TabsContent>
          <TabsContent value="history">
            {visit.patient && <PatientHistory patientId={visit.patient.id} currentVisitId={visit.id} />}
          </TabsContent>
          <TabsContent value="record">
            <VoiceRecorder visitId={visit.id} onTranscriptProcessed={handleTranscriptProcessed} />
          </TabsContent>
          <TabsContent value="soap">{renderSoap()}</TabsContent>
          <TabsContent value="prescription">{renderPrescription()}</TabsContent>
          <TabsContent value="documents">
            {visit.patient && profile?.clinic_id && (
              <DocumentsTab visitId={visit.id} patientId={visit.patient.id} clinicId={profile.clinic_id} />
            )}
          </TabsContent>
        </Tabs>
      )}

      {/* Desktop: Complete button */}
      {!isMobile && (
        <div className="flex justify-end">
          <Button size="lg" className="rounded-xl font-medium" onClick={handleCompleteConsultation} disabled={saving}>
            <CheckCircle className="mr-2 h-4 w-4" />
            {saving ? "Saving..." : "Complete Consultation"}
          </Button>
        </div>
      )}

      {/* Sharing modal with EMR export */}
      <PrescriptionShareModal
        open={shareOpen}
        onClose={() => { setShareOpen(false); onComplete(); }}
        prescriptionPdfUrl={sharePdfUrl}
        patient={visit.patient ? {
          name: visit.patient.name,
          phone: visit.patient.phone || null,
          email: visit.patient.email || null,
          healthcare_id: visit.patient.healthcare_id || null,
        } : null}
        clinicName={clinic?.name || "Clinic"}
        doctorName={doctor?.name || "Doctor"}
        emrExportProps={visit.patient ? {
          patient: { name: visit.patient.name, healthcare_id: visit.patient.healthcare_id, dob: visit.patient.dob, gender: visit.patient.gender, phone: visit.patient.phone },
          visit: { id: visit.id, chief_complaint: visit.chief_complaint },
          doctor: { name: doctor?.name || "", registration_number: doctor?.registration_number || "" },
          soap: { subjective, objective, assessment, plan },
          medications,
          investigations: investigations ? investigations.split(",").map(s => s.trim()) : [],
          followUpDate,
        } : undefined}
      />
    </div>
  );

  function renderSummary() {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="p-6">
          <h3 className="font-display font-semibold mb-3">Patient Summary</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label className="text-xs text-muted-foreground">Full Name</Label><p className="font-medium">{visit.patient?.name}</p></div>
            <div><Label className="text-xs text-muted-foreground">Healthcare ID</Label><p className="font-mono font-medium text-primary">{visit.patient?.healthcare_id || "—"}</p></div>
            <div><Label className="text-xs text-muted-foreground">Age / Gender</Label><p className="font-medium">{getAge(visit.patient?.dob ?? null)}y / {visit.patient?.gender}</p></div>
            <div><Label className="text-xs text-muted-foreground">Blood Group</Label><p className="font-medium">{visit.patient?.blood_group || "—"}</p></div>
            <div><Label className="text-xs text-muted-foreground">Chief Complaint</Label><p className="font-medium">{visit.chief_complaint || "—"}</p></div>
            <div><Label className="text-xs text-muted-foreground">Chronic Conditions</Label>
              <p className="font-medium">
                {visit.patient?.chronic_conditions && Array.isArray(visit.patient.chronic_conditions) && visit.patient.chronic_conditions.length > 0
                  ? (visit.patient.chronic_conditions as string[]).join(", ") : "None"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  function renderSoap() {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="space-y-4 p-6">
          {profile?.clinic_id && (
            <TemplateSelector
              clinicId={profile.clinic_id}
              doctorDefaultTemplateId={(doctor as any)?.default_template_id || null}
              onTemplateChange={setSelectedTemplate}
            />
          )}
          <div className="space-y-2"><Label className="font-semibold">Subjective</Label><Textarea rows={3} value={subjective} onChange={e => setSubjective(e.target.value)} placeholder="Patient's symptoms and history..." className="rounded-lg" /></div>
          <div className="space-y-2"><Label className="font-semibold">Objective</Label><Textarea rows={3} value={objective} onChange={e => setObjective(e.target.value)} placeholder="Physical exam findings, vitals..." className="rounded-lg" /></div>
          <div className="space-y-2"><Label className="font-semibold">Assessment</Label><Textarea rows={3} value={assessment} onChange={e => setAssessment(e.target.value)} placeholder="Diagnosis and clinical reasoning..." className="rounded-lg" /></div>
          <div className="space-y-2"><Label className="font-semibold">Plan</Label><Textarea rows={3} value={plan} onChange={e => setPlan(e.target.value)} placeholder="Treatment plan, follow-up..." className="rounded-lg" /></div>
        </CardContent>
      </Card>
    );
  }

  function renderPrescription() {
    return (
      <Card className="rounded-2xl border-0 shadow-sm">
        <CardContent className="space-y-4 p-6">
          <div>
            <Label className="font-semibold mb-3 block">Medications (Rx)</Label>
            <div className="space-y-3">
              {medications.map((med, i) => (
                <div key={i} className="rounded-xl bg-muted/30 p-3 space-y-2">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Input placeholder="Drug name" value={med.name} onChange={e => updateMed(i, "name", e.target.value)} className="col-span-2 sm:col-span-1 rounded-lg" />
                    <Input placeholder="Dosage" value={med.dosage} onChange={e => updateMed(i, "dosage", e.target.value)} className="rounded-lg" />
                    <Input placeholder="Duration" value={med.duration} onChange={e => updateMed(i, "duration", e.target.value)} className="rounded-lg" />
                  </div>
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-xs font-medium text-muted-foreground">Timing:</span>
                    {(["morning", "afternoon", "evening", "night"] as const).map(time => (
                      <label key={time} className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <Checkbox
                          checked={med[time]}
                          onCheckedChange={(v) => updateMed(i, time, !!v)}
                          className="h-4 w-4"
                        />
                        <span className="capitalize">{time.charAt(0).toUpperCase()}</span>
                      </label>
                    ))}
                    <Input placeholder="Notes" value={med.notes} onChange={e => updateMed(i, "notes", e.target.value)} className="flex-1 min-w-[120px] rounded-lg text-xs h-8" />
                    <Button variant="ghost" size="sm" onClick={() => removeMedRow(i)} className="text-destructive h-8 w-8 p-0">✕</Button>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={addMedRow} className="mt-2 rounded-lg">+ Add Medication</Button>
          </div>

          <div className="space-y-2"><Label className="font-semibold">Investigations</Label><Input value={investigations} onChange={e => setInvestigations(e.target.value)} placeholder="CBC, LFT, ECG..." className="rounded-lg" /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2"><Label className="font-semibold">Follow-up Date</Label><Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2"><Label className="font-semibold">Notes</Label><Input value={prescriptionNotes} onChange={e => setPrescriptionNotes(e.target.value)} placeholder="Additional notes..." className="rounded-lg" /></div>
          </div>
        </CardContent>
      </Card>
    );
  }
}
