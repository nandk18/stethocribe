import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mic, MicOff, FileText, Pill, CheckCircle, AlertTriangle, Activity } from "lucide-react";
import VoiceRecorder from "@/components/doctor/VoiceRecorder";

type Visit = {
  id: string;
  token_number: number;
  status: string;
  chief_complaint: string | null;
  vitals: any;
  patient_id: string;
  patient: {
    id: string; name: string; gender: string | null; dob: string | null;
    allergies: any; chronic_conditions: any;
  } | null;
};

type Medication = { name: string; dosage: string; frequency: string; duration: string; instructions: string };

export default function ConsultationWorkspace({ visit, onComplete }: { visit: Visit; onComplete: () => void }) {
  const { profile } = useAuth();
  const [tab, setTab] = useState("summary");

  // SOAP Notes
  const [subjective, setSubjective] = useState("");
  const [objective, setObjective] = useState("");
  const [assessment, setAssessment] = useState("");
  const [plan, setPlan] = useState("");

  // Prescription
  const [medications, setMedications] = useState<Medication[]>([
    { name: "", dosage: "", frequency: "", duration: "", instructions: "" },
  ]);
  const [investigations, setInvestigations] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [prescriptionNotes, setPrescriptionNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
    if (soapData.medications?.length) setMedications(soapData.medications);
    if (soapData.investigations?.length) setInvestigations(soapData.investigations.join(", "));
    setTab("soap");
    toast.success("SOAP notes generated from transcript!");
  };

  const addMedRow = () => setMedications(prev => [...prev, { name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const removeMedRow = (idx: number) => setMedications(prev => prev.filter((_, i) => i !== idx));
  const updateMed = (idx: number, field: keyof Medication, value: string) => {
    setMedications(prev => prev.map((m, i) => i === idx ? { ...m, [field]: value } : m));
  };

  const handleCompleteConsultation = async () => {
    setSaving(true);
    try {
      // Get doctor record
      const { data: doctor } = await supabase
        .from("doctors")
        .select("id")
        .eq("user_id", profile!.user_id)
        .single();

      if (!doctor) throw new Error("Doctor profile not found");

      // Save clinical notes
      await supabase.from("clinical_notes").insert({
        visit_id: visit.id,
        doctor_id: doctor.id,
        soap_notes: { subjective, objective, assessment, plan },
      });

      // Save prescription
      const validMeds = medications.filter(m => m.name.trim());
      if (validMeds.length > 0 || investigations.trim()) {
        await supabase.from("prescriptions").insert({
          visit_id: visit.id,
          doctor_id: doctor.id,
          medications: validMeds,
          investigations: investigations ? investigations.split(",").map(s => s.trim()) : [],
          follow_up_date: followUpDate || null,
          notes: prescriptionNotes || null,
        });
      }

      // Mark visit complete
      await supabase.from("visits").update({ status: "completed", doctor_id: doctor.id }).eq("id", visit.id);

      toast.success("Consultation completed!");
      onComplete();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Patient Header */}
      <Card className="shadow-card">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 font-display text-lg font-bold text-primary">
                #{visit.token_number}
              </div>
              <div>
                <h2 className="font-display text-xl font-bold text-foreground">{visit.patient?.name}</h2>
                <p className="text-sm text-muted-foreground">
                  {visit.patient?.gender} • {getAge(visit.patient?.dob ?? null)}y
                  {visit.chief_complaint && ` • ${visit.chief_complaint}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {visit.patient?.allergies && Array.isArray(visit.patient.allergies) && visit.patient.allergies.length > 0 && (
                <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive">
                  <AlertTriangle className="mr-1 h-3 w-3" />
                  {(visit.patient.allergies as string[]).join(", ")}
                </Badge>
              )}
            </div>
          </div>

          {/* Vitals bar */}
          {Object.keys(vitals).length > 0 && (
            <div className="mt-3 flex flex-wrap gap-3">
              {vitals.bp && (
                <div className="flex items-center gap-1.5 rounded-md bg-muted px-3 py-1.5 text-xs">
                  <Activity className="h-3 w-3 text-primary" />
                  <span className="font-medium">BP:</span> {vitals.bp.systolic}/{vitals.bp.diastolic}
                </div>
              )}
              {vitals.pulse && <div className="rounded-md bg-muted px-3 py-1.5 text-xs"><span className="font-medium">Pulse:</span> {vitals.pulse}</div>}
              {vitals.temperature && <div className="rounded-md bg-muted px-3 py-1.5 text-xs"><span className="font-medium">Temp:</span> {vitals.temperature}°F</div>}
              {vitals.spo2 && <div className="rounded-md bg-muted px-3 py-1.5 text-xs"><span className="font-medium">SpO2:</span> {vitals.spo2}%</div>}
              {vitals.weight && <div className="rounded-md bg-muted px-3 py-1.5 text-xs"><span className="font-medium">Wt:</span> {vitals.weight}kg</div>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Workspace Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="record"><Mic className="mr-1.5 h-3.5 w-3.5" /> Voice Record</TabsTrigger>
          <TabsTrigger value="soap"><FileText className="mr-1.5 h-3.5 w-3.5" /> SOAP Notes</TabsTrigger>
          <TabsTrigger value="prescription"><Pill className="mr-1.5 h-3.5 w-3.5" /> Prescription</TabsTrigger>
        </TabsList>

        <TabsContent value="summary">
          <Card className="shadow-card">
            <CardContent className="p-6">
              <h3 className="font-display font-semibold mb-3">Patient Summary</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <div><Label className="text-xs text-muted-foreground">Full Name</Label><p className="font-medium">{visit.patient?.name}</p></div>
                <div><Label className="text-xs text-muted-foreground">Age / Gender</Label><p className="font-medium">{getAge(visit.patient?.dob ?? null)}y / {visit.patient?.gender}</p></div>
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
        </TabsContent>

        <TabsContent value="record">
          <VoiceRecorder visitId={visit.id} onTranscriptProcessed={handleTranscriptProcessed} />
        </TabsContent>

        <TabsContent value="soap">
          <Card className="shadow-card">
            <CardContent className="space-y-4 p-6">
              <div className="space-y-2"><Label className="font-semibold">Subjective</Label><Textarea rows={3} value={subjective} onChange={e => setSubjective(e.target.value)} placeholder="Patient's symptoms and history..." /></div>
              <div className="space-y-2"><Label className="font-semibold">Objective</Label><Textarea rows={3} value={objective} onChange={e => setObjective(e.target.value)} placeholder="Physical exam findings, vitals..." /></div>
              <div className="space-y-2"><Label className="font-semibold">Assessment</Label><Textarea rows={3} value={assessment} onChange={e => setAssessment(e.target.value)} placeholder="Diagnosis and clinical reasoning..." /></div>
              <div className="space-y-2"><Label className="font-semibold">Plan</Label><Textarea rows={3} value={plan} onChange={e => setPlan(e.target.value)} placeholder="Treatment plan, follow-up..." /></div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="prescription">
          <Card className="shadow-card">
            <CardContent className="space-y-4 p-6">
              <div>
                <Label className="font-semibold mb-3 block">Medications (℞)</Label>
                <div className="space-y-3">
                  {medications.map((med, i) => (
                    <div key={i} className="grid grid-cols-6 gap-2 items-end">
                      <div className="col-span-2"><Input placeholder="Drug name" value={med.name} onChange={e => updateMed(i, "name", e.target.value)} /></div>
                      <Input placeholder="Dosage" value={med.dosage} onChange={e => updateMed(i, "dosage", e.target.value)} />
                      <Input placeholder="Frequency" value={med.frequency} onChange={e => updateMed(i, "frequency", e.target.value)} />
                      <Input placeholder="Duration" value={med.duration} onChange={e => updateMed(i, "duration", e.target.value)} />
                      <Button variant="ghost" size="sm" onClick={() => removeMedRow(i)} className="text-destructive">✕</Button>
                    </div>
                  ))}
                </div>
                <Button variant="outline" size="sm" onClick={addMedRow} className="mt-2">+ Add Medication</Button>
              </div>

              <div className="space-y-2"><Label className="font-semibold">Investigations</Label><Input value={investigations} onChange={e => setInvestigations(e.target.value)} placeholder="CBC, LFT, ECG..." /></div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label className="font-semibold">Follow-up Date</Label><Input type="date" value={followUpDate} onChange={e => setFollowUpDate(e.target.value)} /></div>
                <div className="space-y-2"><Label className="font-semibold">Notes</Label><Input value={prescriptionNotes} onChange={e => setPrescriptionNotes(e.target.value)} placeholder="Additional notes..." /></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Complete button */}
      <div className="flex justify-end">
        <Button size="lg" onClick={handleCompleteConsultation} disabled={saving}>
          <CheckCircle className="mr-2 h-4 w-4" />
          {saving ? "Saving..." : "Complete Consultation"}
        </Button>
      </div>
    </div>
  );
}
