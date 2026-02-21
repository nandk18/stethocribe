import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import PatientRegistration from "@/components/receptionist/PatientRegistration";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Search, UserPlus, User, Phone, Mail, Loader2 } from "lucide-react";

type Patient = {
  id: string;
  name: string;
  gender: string | null;
  dob: string | null;
  phone: string | null;
  email: string | null;
  blood_group: string | null;
  allergies: any;
  chronic_conditions: any;
};

export default function PatientsPage() {
  const { profile } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchPatients = useCallback(async () => {
    if (!profile?.clinic_id) return;
    let query = supabase.from("patients").select("*").eq("clinic_id", profile.clinic_id).order("created_at", { ascending: false });
    if (search.trim()) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }
    const { data } = await query.limit(100);
    if (data) setPatients(data);
    setLoading(false);
  }, [profile?.clinic_id, search]);

  useEffect(() => { fetchPatients(); }, [fetchPatients]);

  const getAge = (dob: string | null) => {
    if (!dob) return null;
    return Math.floor((Date.now() - new Date(dob).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-foreground">Patients</h1>
          <p className="text-sm text-muted-foreground">{patients.length} patient{patients.length !== 1 ? "s" : ""} registered</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button><UserPlus className="mr-2 h-4 w-4" /> New Patient</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
            <DialogHeader><DialogTitle>Register New Patient</DialogTitle></DialogHeader>
            <PatientRegistration onSuccess={() => { setDialogOpen(false); fetchPatients(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search by name or phone..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : patients.length === 0 ? (
        <Card className="shadow-card">
          <CardContent className="flex flex-col items-center py-16">
            <User className="mb-4 h-16 w-16 text-muted-foreground/30" />
            <h3 className="font-display text-lg font-semibold">No patients found</h3>
            <p className="text-sm text-muted-foreground">Register your first patient to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {patients.map(p => (
            <Card key={p.id} className="shadow-card hover:shadow-elevated transition-shadow">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 font-display text-sm font-bold text-primary">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.gender}{p.dob && `, ${getAge(p.dob)}y`}{p.blood_group && ` · ${p.blood_group}`}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  {p.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span>}
                  {p.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{p.email}</span>}
                </div>
                {p.allergies && Array.isArray(p.allergies) && p.allergies.length > 0 && (
                  <Badge variant="outline" className="border-destructive/30 bg-destructive/10 text-destructive text-[10px]">Allergies</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </DashboardLayout>
  );
}
