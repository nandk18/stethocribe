import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { Stethoscope, Loader2, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function AcceptInvite() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteInfo, setInviteInfo] = useState<{
    role?: string;
    clinic_name?: string;
    invited_by?: string;
    email?: string;
  }>({});

  useEffect(() => {
    // Supabase auto-exchanges the token from the URL hash
    const handleSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const meta = session.user.user_metadata || {};
        setInviteInfo({
          role: meta.invited_role || meta.role || "staff",
          clinic_name: meta.clinic_name || "your clinic",
          invited_by: meta.invited_by || "an admin",
          email: session.user.email,
        });
        setFullName(meta.full_name || "");
        setLoading(false);
      } else {
        // Listen for auth state change (token exchange)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
          async (_event, session) => {
            if (session?.user) {
              const meta = session.user.user_metadata || {};
              setInviteInfo({
                role: meta.invited_role || meta.role || "staff",
                clinic_name: meta.clinic_name || "your clinic",
                invited_by: meta.invited_by || "an admin",
                email: session.user.email,
              });
              setFullName(meta.full_name || "");
              setLoading(false);
              subscription.unsubscribe();
            }
          }
        );
        // Wait a bit, if still no session, show error
        setTimeout(() => setLoading(false), 5000);
      }
    };
    handleSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) throw new Error("No active session");

      // Update password and name
      const { error: updateErr } = await supabase.auth.updateUser({
        password,
        data: { full_name: fullName },
      });
      if (updateErr) throw updateErr;

      const userId = session.user.id;
      const meta = session.user.user_metadata || {};
      const role = meta.invited_role || meta.role || "admin";
      const clinicId = meta.invited_clinic_id || meta.clinic_id;
      const labId = meta.invited_lab_id || null;

      // Update profile
      const profileUpdate: any = {
        full_name: fullName,
        role,
        clinic_id: clinicId,
      };
      if (role === "lab") profileUpdate.lab_id = labId;

      await supabase.from("profiles").update(profileUpdate).eq("user_id", userId);

      setSuccess(true);
      toast.success("Account activated!");

      // Sign out and redirect to login
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate("/auth");
      }, 2000);
    } catch (err: any) {
      toast.error(err.message || "Failed to activate account");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center shadow-elevated">
          <CardContent className="py-10 space-y-4">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
            <h2 className="text-xl font-bold text-foreground">Account Activated!</h2>
            <p className="text-muted-foreground">
              You can now login as <Badge variant="secondary" className="capitalize">{inviteInfo.role}</Badge>
            </p>
            <p className="text-sm text-muted-foreground">Redirecting to login...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!inviteInfo.email) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center shadow-elevated">
          <CardContent className="py-10 space-y-4">
            <h2 className="text-xl font-bold text-foreground">Invalid or Expired Link</h2>
            <p className="text-muted-foreground">This invitation link may have expired or already been used.</p>
            <Button onClick={() => navigate("/auth")}>Go to Login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-elevated">
            <Stethoscope className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="font-display text-3xl font-bold text-foreground">Welcome to StethoScribe</h1>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Activate Your Account</CardTitle>
            <CardDescription className="space-y-1">
              <span className="block">
                You've been invited to join <strong>{inviteInfo.clinic_name}</strong> as a{" "}
                <Badge variant="secondary" className="capitalize">{inviteInfo.role}</Badge>
              </span>
              {inviteInfo.invited_by && (
                <span className="block text-xs">Invited by: {inviteInfo.invited_by}</span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={inviteInfo.email} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="full-name">Full Name</Label>
                <Input
                  id="full-name"
                  placeholder="Dr. John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm Password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Activating..." : "Activate Account"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
