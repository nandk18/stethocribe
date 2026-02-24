import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useClinic } from "@/hooks/useClinic";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Building2, User, Save, Loader2, UserPlus, Send, Smartphone } from "lucide-react";

export default function Settings() {
  const { user, profile } = useAuth();
  const { clinic, doctor, loading, refetch } = useClinic();
  const [saving, setSaving] = useState(false);

  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");

  const [doctorName, setDoctorName] = useState("");
  const [qualification, setQualification] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [specialty, setSpecialty] = useState("");

  // Staff invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("receptionist");
  const [inviting, setInviting] = useState(false);

  useEffect(() => {
    if (clinic) {
      setClinicName(clinic.name || "");
      setClinicAddress(clinic.address || "");
      setClinicPhone(clinic.phone || "");
    }
  }, [clinic]);

  useEffect(() => {
    if (doctor) {
      setDoctorName(doctor.name || "");
      setQualification(doctor.qualification || "");
      setRegNumber(doctor.registration_number || "");
      setSpecialty(doctor.specialty || "");
    }
  }, [doctor]);

  const handleSaveClinic = async () => {
    if (!profile?.clinic_id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("clinics").update({
        name: clinicName, address: clinicAddress || null, phone: clinicPhone || null,
      }).eq("id", profile.clinic_id);
      if (error) throw error;
      toast.success("Clinic details saved!");
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleSaveDoctor = async () => {
    if (!profile?.clinic_id || !user) return;
    setSaving(true);
    try {
      if (doctor) {
        const { error } = await supabase.from("doctors").update({
          name: doctorName, qualification, registration_number: regNumber, specialty,
        }).eq("id", doctor.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("doctors").insert({
          clinic_id: profile.clinic_id, user_id: user.id,
          name: doctorName, qualification, registration_number: regNumber, specialty,
        });
        if (error) throw error;
      }
      toast.success("Doctor profile saved!");
      refetch();
    } catch (err: any) { toast.error(err.message); }
    finally { setSaving(false); }
  };

  const handleInviteStaff = async () => {
    if (!inviteEmail.trim() || !profile?.clinic_id) return;
    setInviting(true);
    try {
      const { error } = await supabase.functions.invoke("invite-staff", {
        body: { email: inviteEmail, role: inviteRole, clinic_id: profile.clinic_id },
      });
      if (error) throw error;
      toast.success(`Invitation sent to ${inviteEmail} as ${inviteRole}`);
      setInviteEmail("");
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setInviting(false);
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

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your clinic and doctor profile</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Building2 className="h-5 w-5 text-primary" /> Clinic Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Clinic Name</Label><Input value={clinicName} onChange={e => setClinicName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} /></div>
            <Button onClick={handleSaveClinic} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> Save Clinic Details
            </Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5 text-primary" /> Doctor Profile
              {!doctor && <span className="text-xs text-destructive font-normal ml-2">(Not set up yet)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Doctor Name</Label><Input value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr. Name" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Qualification</Label><Input value={qualification} onChange={e => setQualification(e.target.value)} placeholder="MBBS, MD" /></div>
              <div className="space-y-2"><Label>Specialty</Label><Input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="General Medicine" /></div>
            </div>
            <div className="space-y-2"><Label>Registration Number</Label><Input value={regNumber} onChange={e => setRegNumber(e.target.value)} placeholder="MCI-123456" /></div>
            <Button onClick={handleSaveDoctor} disabled={saving}>
              <Save className="mr-2 h-4 w-4" /> {doctor ? "Update" : "Create"} Doctor Profile
            </Button>
          </CardContent>
        </Card>

        {/* Invite Staff */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <UserPlus className="h-5 w-5 text-primary" /> Invite Staff
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Invite doctors and receptionists to your clinic. They'll receive an email to create their account.
            </p>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input type="email" placeholder="staff@clinic.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={setInviteRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="doctor">Doctor</SelectItem>
                  <SelectItem value="receptionist">Receptionist</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleInviteStaff} disabled={inviting || !inviteEmail.trim()}>
              <Send className="mr-2 h-4 w-4" /> {inviting ? "Sending..." : "Send Invitation"}
            </Button>
          </CardContent>
        </Card>

        {/* Mobile App */}
        <Card className="shadow-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Smartphone className="h-5 w-5 text-primary" /> Mobile App
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              To build the native app, export this project to GitHub, clone locally, run <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">npm run build && npx cap sync</code>, then open in Android Studio or Xcode.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
