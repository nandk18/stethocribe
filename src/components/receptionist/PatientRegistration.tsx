import { useState, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Search, UserPlus } from "lucide-react";

export default function PatientRegistration() {
  const { profile, user } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [chiefComplaint, setChiefComplaint] = useState("");

  // Vitals
  const [bpSystolic, setBpSystolic] = useState("");
  const [bpDiastolic, setBpDiastolic] = useState("");
  const [pulse, setPulse] = useState("");
  const [temp, setTemp] = useState("");
  const [weight, setWeight] = useState("");
  const [height, setHeight] = useState("");
  const [spo2, setSpo2] = useState("");

  const handleSearch = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2 || !profile?.clinic_id) { setSearchResults([]); return; }
    setSearching(true);
    const { data } = await supabase
      .from("patients")
      .select("id, name, phone, gender, dob")
      .eq("clinic_id", profile.clinic_id)
      .ilike("name", `%${query}%`)
      .limit(5);
    setSearchResults(data ?? []);
    setSearching(false);
  }, [profile?.clinic_id]);

  const createVisitForPatient = async (patientId: string) => {
    if (!profile?.clinic_id) return;
    try {
      // Get next token number
      const today = new Date().toISOString().split("T")[0];
      const { count } = await supabase
        .from("visits")
        .select("id", { count: "exact", head: true })
        .eq("clinic_id", profile.clinic_id)
        .eq("visit_date", today);

      const tokenNumber = (count ?? 0) + 1;
      const vitals: any = {};
      if (bpSystolic && bpDiastolic) vitals.bp = { systolic: +bpSystolic, diastolic: +bpDiastolic };
      if (pulse) vitals.pulse = +pulse;
      if (temp) vitals.temperature = +temp;
      if (weight) vitals.weight = +weight;
      if (height) vitals.height = +height;
      if (spo2) vitals.spo2 = +spo2;

      const { error } = await supabase.from("visits").insert({
        clinic_id: profile.clinic_id,
        patient_id: patientId,
        visit_date: today,
        token_number: tokenNumber,
        chief_complaint: chiefComplaint || null,
        vitals,
        created_by: user!.id,
      });
      if (error) throw error;
      toast.success(`Token #${tokenNumber} issued`);
      resetForm();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleNewPatient = async () => {
    if (!name.trim() || !profile?.clinic_id) { toast.error("Patient name is required"); return; }
    setSaving(true);
    try {
      const { data: patient, error } = await supabase
        .from("patients")
        .insert({
          clinic_id: profile.clinic_id,
          name: name.trim(),
          dob: dob || null,
          gender: gender || null,
          phone: phone || null,
          email: email || null,
          blood_group: bloodGroup || null,
        })
        .select()
        .single();
      if (error) throw error;
      await createVisitForPatient(patient.id);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleExistingPatient = async (patientId: string) => {
    await createVisitForPatient(patientId);
  };

  const resetForm = () => {
    setName(""); setDob(""); setGender(""); setPhone(""); setEmail("");
    setBloodGroup(""); setChiefComplaint("");
    setBpSystolic(""); setBpDiastolic(""); setPulse(""); setTemp("");
    setWeight(""); setHeight(""); setSpo2("");
    setShowForm(false); setSearchQuery(""); setSearchResults([]);
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <Card className="shadow-card">
        <CardHeader>
          <CardTitle className="font-display text-lg flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" /> Search Patient
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Search by name or phone..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
          />
          {searchResults.length > 0 && (
            <div className="space-y-2">
              {searchResults.map(p => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-3">
                  <div>
                    <p className="font-medium text-foreground">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.phone} • {p.gender}</p>
                  </div>
                  <Button size="sm" onClick={() => handleExistingPatient(p.id)}>
                    Check In
                  </Button>
                </div>
              ))}
            </div>
          )}
          {!showForm && (
            <Button variant="outline" onClick={() => setShowForm(true)} className="w-full">
              <UserPlus className="mr-2 h-4 w-4" /> New Patient
            </Button>
          )}
        </CardContent>
      </Card>

      {/* New Patient Form */}
      {showForm && (
        <Card className="shadow-card animate-fade-in">
          <CardHeader>
            <CardTitle className="font-display text-lg">New Patient Registration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label>Full Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="Patient name" /></div>
              <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210" /></div>
              <div className="space-y-2"><Label>Date of Birth</Label><Input type="date" value={dob} onChange={e => setDob(e.target.value)} /></div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={setGender}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="patient@email.com" /></div>
              <div className="space-y-2">
                <Label>Blood Group</Label>
                <Select value={bloodGroup} onValueChange={setBloodGroup}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(bg => (
                      <SelectItem key={bg} value={bg}>{bg}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Chief Complaint</Label>
              <Input value={chiefComplaint} onChange={e => setChiefComplaint(e.target.value)} placeholder="Fever, headache..." />
            </div>

            {/* Vitals */}
            <div>
              <Label className="mb-3 block text-sm font-semibold">Vitals</Label>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">BP (sys/dia)</Label>
                  <div className="flex gap-1">
                    <Input placeholder="120" value={bpSystolic} onChange={e => setBpSystolic(e.target.value)} className="text-center" />
                    <span className="self-center text-muted-foreground">/</span>
                    <Input placeholder="80" value={bpDiastolic} onChange={e => setBpDiastolic(e.target.value)} className="text-center" />
                  </div>
                </div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Pulse (bpm)</Label><Input placeholder="72" value={pulse} onChange={e => setPulse(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Temp (°F)</Label><Input placeholder="98.6" value={temp} onChange={e => setTemp(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">SpO2 (%)</Label><Input placeholder="98" value={spo2} onChange={e => setSpo2(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Weight (kg)</Label><Input placeholder="70" value={weight} onChange={e => setWeight(e.target.value)} /></div>
                <div className="space-y-1"><Label className="text-xs text-muted-foreground">Height (cm)</Label><Input placeholder="170" value={height} onChange={e => setHeight(e.target.value)} /></div>
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
              <Button onClick={handleNewPatient} disabled={saving} className="flex-1">
                {saving ? "Registering..." : "Register & Issue Token"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
