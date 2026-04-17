import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FlaskConical, Plus, Mail, Phone, MapPin, Trash2, Pencil, Send, Loader2 } from "lucide-react";

type Lab = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

export default function LabsManagement() {
  const { profile } = useAuth();
  const [labs, setLabs] = useState<Lab[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Lab | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [inviteToApp, setInviteToApp] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Lab | null>(null);
  const [removing, setRemoving] = useState(false);

  const fetchLabs = async () => {
    if (!profile?.clinic_id) return;
    setLoading(true);
    const { data } = await supabase
      .from("labs")
      .select("*")
      .eq("clinic_id", profile.clinic_id)
      .order("name");
    setLabs(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchLabs(); }, [profile]);

  const openAdd = () => {
    setEditing(null);
    setName(""); setEmail(""); setPhone(""); setAddress(""); setInviteToApp(false);
    setDialogOpen(true);
  };

  const openEdit = (lab: Lab) => {
    setEditing(lab);
    setName(lab.name); setEmail(lab.email || ""); setPhone(lab.phone || ""); setAddress(lab.address || "");
    setInviteToApp(false);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim() || !profile?.clinic_id) { toast.error("Lab name is required"); return; }
    if (inviteToApp && !email.trim()) { toast.error("Email required to invite the lab"); return; }
    setSaving(true);
    try {
      let labId: string;
      if (editing) {
        const { error } = await supabase.from("labs").update({
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
        }).eq("id", editing.id);
        if (error) throw error;
        labId = editing.id;
        toast.success("Lab updated");
      } else {
        const { data, error } = await supabase.from("labs").insert({
          clinic_id: profile.clinic_id,
          name: name.trim(),
          email: email.trim() || null,
          phone: phone.trim() || null,
          address: address.trim() || null,
        }).select().single();
        if (error) throw error;
        labId = data.id;
        toast.success("Lab added");
      }

      if (inviteToApp && email.trim()) {
        const { error: inviteErr } = await supabase.functions.invoke("invite-staff", {
          body: { email: email.trim(), role: "lab", lab_id: labId },
        });
        if (inviteErr) {
          toast.error("Lab saved but invite failed: " + (inviteErr.message || "Unknown error"));
        } else {
          toast.success(`Invitation sent to ${email}`);
        }
      }

      setDialogOpen(false);
      fetchLabs();
    } catch (err: any) {
      toast.error(err.message || "Failed to save lab");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setRemoving(true);
    try {
      const { error } = await supabase.from("labs").delete().eq("id", confirmDelete.id);
      if (error) throw error;
      toast.success("Lab removed");
      setConfirmDelete(null);
      fetchLabs();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRemoving(false);
    }
  };

  const handleSendInvite = async (lab: Lab) => {
    if (!lab.email) { toast.error("This lab has no email on file. Edit and add an email first."); return; }
    try {
      const { error } = await supabase.functions.invoke("invite-staff", {
        body: { email: lab.email, role: "lab", lab_id: lab.id },
      });
      if (error) throw error;
      toast.success(`Invitation sent to ${lab.email}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite");
    }
  };

  if (profile?.role !== "admin") return null;

  return (
    <Card className="rounded-2xl border-0 shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 font-display">
          <FlaskConical className="h-5 w-5 text-primary" /> Labs
        </CardTitle>
        <Button size="sm" onClick={openAdd} className="rounded-lg">
          <Plus className="mr-1 h-4 w-4" /> Add Lab
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : labs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            No labs registered. Add diagnostic labs to send investigation orders.
          </p>
        ) : (
          labs.map(lab => (
            <div key={lab.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-semibold text-foreground">{lab.name}</p>
                </div>
                <div className="space-y-0.5 text-xs text-muted-foreground">
                  {lab.email && <p className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {lab.email}</p>}
                  {lab.phone && <p className="flex items-center gap-1.5"><Phone className="h-3 w-3" /> {lab.phone}</p>}
                  {lab.address && <p className="flex items-center gap-1.5"><MapPin className="h-3 w-3" /> {lab.address}</p>}
                </div>
              </div>
              <div className="flex gap-1">
                {lab.email && (
                  <Button size="sm" variant="ghost" onClick={() => handleSendInvite(lab)} title="Send portal invitation">
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => openEdit(lab)} title="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(lab)} title="Delete" className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">{editing ? "Edit Lab" : "Add Lab"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-2"><Label>Lab Name *</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sunrise Diagnostics" className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="orders@lab.com" className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Phone</Label><Input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91..." className="rounded-lg" /></div>
            <div className="space-y-2"><Label>Address</Label><Input value={address} onChange={e => setAddress(e.target.value)} placeholder="Lab address" className="rounded-lg" /></div>
            {!editing && email && (
              <div className="flex items-center justify-between rounded-lg bg-muted/50 p-3">
                <div>
                  <Label className="text-sm">Invite Lab to App</Label>
                  <p className="text-xs text-muted-foreground">Send portal access to {email}</p>
                </div>
                <Switch checked={inviteToApp} onCheckedChange={setInviteToApp} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving || !name.trim()}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : (editing ? "Save Changes" : "Add Lab")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!confirmDelete} onOpenChange={o => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Remove Lab?</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Remove <strong>{confirmDelete?.name}</strong>? Past orders and results will remain but won't be linked to this lab.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)} disabled={removing}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={removing}>
              {removing ? "Removing..." : "Remove"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
