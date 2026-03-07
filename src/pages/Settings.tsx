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
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Building2, User, Save, Loader2, UserPlus, Send, Smartphone, Shield, Users, Trash2, Globe } from "lucide-react";

const LANGUAGES = [
  "Tamil","Hindi","Telugu","Kannada","Malayalam","Marathi",
  "Bengali","Gujarati","Punjabi","Odia","Assamese","Urdu",
  "Konkani","Manipuri","Sindhi"
];

export default function Settings() {
  const { user, profile } = useAuth();
  const { clinic, doctor, loading, refetch } = useClinic();
  const [saving, setSaving] = useState(false);

  const [clinicName, setClinicName] = useState("");
  const [clinicAddress, setClinicAddress] = useState("");
  const [clinicPhone, setClinicPhone] = useState("");
  const [regionalLanguage, setRegionalLanguage] = useState("Tamil");

  const [doctorName, setDoctorName] = useState("");
  const [qualification, setQualification] = useState("");
  const [regNumber, setRegNumber] = useState("");
  const [specialty, setSpecialty] = useState("");

  // Staff invite
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<string>("receptionist");
  const [inviting, setInviting] = useState(false);

  // Change password
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  // Team
  const [team, setTeam] = useState<any[]>([]);
  const [loadingTeam, setLoadingTeam] = useState(false);

  useEffect(() => {
    if (clinic) {
      setClinicName(clinic.name || "");
      setClinicAddress(clinic.address || "");
      setClinicPhone(clinic.phone || "");
      setRegionalLanguage((clinic as any).regional_language || "Tamil");
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

  useEffect(() => {
    if (profile?.clinic_id && profile.role === "admin") {
      fetchTeam();
    }
  }, [profile]);

  const fetchTeam = async () => {
    if (!profile?.clinic_id) return;
    setLoadingTeam(true);
    const { data: profileData } = await supabase
      .from("profiles")
      .select("user_id, full_name, role, created_at")
      .eq("clinic_id", profile.clinic_id)
      .order("role");
    setTeam(profileData || []);
    setLoadingTeam(false);
  };

  const handleSaveClinic = async () => {
    if (!profile?.clinic_id) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("clinics").update({
        name: clinicName,
        address: clinicAddress || null,
        phone: clinicPhone || null,
        regional_language: regionalLanguage,
      } as any).eq("id", profile.clinic_id);
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
      const { data, error } = await supabase.functions.invoke("invite-staff", {
        body: { email: inviteEmail, role: inviteRole },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(data?.message || `Invitation sent to ${inviteEmail} as ${inviteRole}`);
      setInviteEmail("");
      fetchTeam();
    } catch (err: any) {
      toast.error(err.message || "Failed to send invitation");
    } finally {
      setInviting(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmNewPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (!user?.email) return;
    setChangingPassword(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user.email, password: currentPassword,
      });
      if (signInError) { toast.error("Current password is incorrect"); setChangingPassword(false); return; }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success("Password updated successfully");
      setCurrentPassword(""); setNewPassword(""); setConfirmNewPassword("");
    } catch (err: any) { toast.error(err.message); }
    finally { setChangingPassword(false); }
  };

  const handleRemoveStaff = async (userId: string, name: string) => {
    if (!confirm(`Remove ${name || "this member"} from the clinic?`)) return;
    try {
      await supabase.from("profiles").update({ clinic_id: null }).eq("user_id", userId);
      toast.success("Staff member removed");
      fetchTeam();
    } catch (err: any) { toast.error(err.message); }
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

  const doctors = team.filter(m => m.role === "doctor");
  const receptionists = team.filter(m => m.role === "receptionist");
  const admins = team.filter(m => m.role === "admin");

  return (
    <DashboardLayout>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your clinic, profile, and security</p>
      </div>

      <div className="space-y-6 max-w-2xl">
        {/* Clinic Details */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Building2 className="h-5 w-5 text-primary" /> Clinic Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Clinic Name</Label><Input value={clinicName} onChange={e => setClinicName(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={clinicAddress} onChange={e => setClinicAddress(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={clinicPhone} onChange={e => setClinicPhone(e.target.value)} className="rounded-lg" /></div>
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Globe className="h-4 w-4 text-primary" /> Regional Language</Label>
              <Select value={regionalLanguage} onValueChange={setRegionalLanguage}>
                <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {LANGUAGES.map(lang => (
                    <SelectItem key={lang} value={lang}>{lang}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Used for bilingual prescription headers</p>
            </div>
            <Button onClick={handleSaveClinic} disabled={saving} className="rounded-lg">
              <Save className="mr-2 h-4 w-4" /> Save Clinic Details
            </Button>
          </CardContent>
        </Card>

        {/* Doctor Profile */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <User className="h-5 w-5 text-primary" /> Doctor Profile
              {!doctor && <span className="text-xs text-destructive font-normal ml-2">(Not set up yet)</span>}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Doctor Name</Label><Input value={doctorName} onChange={e => setDoctorName(e.target.value)} placeholder="Dr. Name" className="rounded-lg" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Qualification</Label><Input value={qualification} onChange={e => setQualification(e.target.value)} placeholder="MBBS, MD" className="rounded-lg" /></div>
              <div className="space-y-2"><Label>Specialty</Label><Input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="General Medicine" className="rounded-lg" /></div>
            </div>
            <div className="space-y-2"><Label>Registration Number</Label><Input value={regNumber} onChange={e => setRegNumber(e.target.value)} placeholder="MCI-123456" className="rounded-lg" /></div>
            <Button onClick={handleSaveDoctor} disabled={saving} className="rounded-lg">
              <Save className="mr-2 h-4 w-4" /> {doctor ? "Update" : "Create"} Doctor Profile
            </Button>
          </CardContent>
        </Card>

        {/* Security */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Shield className="h-5 w-5 text-primary" /> Security
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2"><Label>Current Password</Label><Input type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} placeholder="••••••••" className="rounded-lg" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>New Password</Label><Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" className="rounded-lg" /></div>
              <div className="space-y-2"><Label>Confirm New Password</Label><Input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} placeholder="Re-enter" className="rounded-lg" /></div>
            </div>
            <Button onClick={handleChangePassword} disabled={changingPassword || !currentPassword || !newPassword} className="rounded-lg">
              <Shield className="mr-2 h-4 w-4" /> {changingPassword ? "Updating..." : "Update Password"}
            </Button>
          </CardContent>
        </Card>

        {/* Invite Staff (Admin only) */}
        {profile?.role === "admin" && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <UserPlus className="h-5 w-5 text-primary" /> Invite Staff
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Invite doctors and receptionists. They'll receive an email to activate their account.
              </p>
              <div className="space-y-2">
                <Label>Email Address</Label>
                <Input type="email" placeholder="staff@clinic.com" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} className="rounded-lg" />
              </div>
              <div className="space-y-2">
                <Label>Role</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="rounded-lg"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doctor">Doctor</SelectItem>
                    <SelectItem value="receptionist">Receptionist</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleInviteStaff} disabled={inviting || !inviteEmail.trim()} className="rounded-lg">
                <Send className="mr-2 h-4 w-4" /> {inviting ? "Sending..." : "Send Invitation"}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Team Management (Admin only) */}
        {profile?.role === "admin" && (
          <Card className="rounded-2xl border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display">
                <Users className="h-5 w-5 text-primary" /> Team
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingTeam ? (
                <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
              ) : team.length === 0 ? (
                <p className="text-sm text-muted-foreground">No team members yet. Invite staff above.</p>
              ) : (
                <div className="space-y-4">
                  {/* Admins */}
                  {admins.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Admins</p>
                      <div className="space-y-2">
                        {admins.map(member => renderTeamMember(member, "bg-primary/10 text-primary"))}
                      </div>
                    </div>
                  )}
                  {/* Doctors */}
                  {doctors.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Doctors</p>
                      <div className="space-y-2">
                        {doctors.map(member => renderTeamMember(member, "bg-info/10 text-info"))}
                      </div>
                    </div>
                  )}
                  {/* Receptionists */}
                  {receptionists.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Receptionists</p>
                      <div className="space-y-2">
                        {receptionists.map(member => renderTeamMember(member, "bg-warning/10 text-warning"))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Mobile App */}
        <Card className="rounded-2xl border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-display">
              <Smartphone className="h-5 w-5 text-primary" /> Mobile App
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              To build the native app, export this project to GitHub, clone locally, run <code className="rounded-lg bg-muted px-1.5 py-0.5 text-xs font-mono">npm run build && npx cap sync</code>, then open in Android Studio or Xcode.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );

  function renderTeamMember(member: any, badgeClass: string) {
    return (
      <div key={member.user_id} className="flex items-center justify-between rounded-xl bg-muted/30 p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
            {(member.full_name || "?").charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="font-medium text-foreground text-sm">{member.full_name || "Unnamed"}</p>
            <Badge className={`capitalize text-xs mt-0.5 ${badgeClass} border-0`}>{member.role}</Badge>
          </div>
        </div>
        {member.user_id !== user?.id && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            onClick={() => handleRemoveStaff(member.user_id, member.full_name)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }
}
