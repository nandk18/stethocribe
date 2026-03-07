import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle, MessageCircle, Mail, Copy, Download, Printer, Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import EMRExportButtons from "@/components/doctor/EMRExportButtons";

type Props = {
  open: boolean;
  onClose: () => void;
  prescriptionPdfUrl: string | null;
  patient: { name: string; phone: string | null; email: string | null; healthcare_id: string | null } | null;
  clinicName: string;
  doctorName: string;
  emrExportProps?: {
    patient: any;
    visit: any;
    doctor: any;
    soap: any;
    medications: any[];
    investigations: string[];
    followUpDate?: string | null;
  };
};

export default function PrescriptionShareModal({ open, onClose, prescriptionPdfUrl, patient, clinicName, doctorName, emrExportProps }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (open && prescriptionPdfUrl) {
      setLoading(true);
      supabase.storage.from("prescriptions").createSignedUrl(prescriptionPdfUrl, 604800)
        .then(({ data }) => { setSignedUrl(data?.signedUrl || null); setLoading(false); })
        .catch(() => setLoading(false));
    } else {
      setSignedUrl(null);
    }
  }, [open, prescriptionPdfUrl]);

  const handleWhatsApp = () => {
    if (!patient?.phone || !signedUrl) return;
    const phone = patient.phone.replace(/\D/g, "");
    const message = encodeURIComponent(
      `Dear ${patient.name}, your prescription from ${clinicName} is ready.\n\nView & Download: ${signedUrl}\n\nValid for 7 days.`
    );
    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
  };

  const handleEmail = () => {
    if (!patient?.email || !signedUrl) return;
    const subject = encodeURIComponent(`Prescription - ${clinicName}`);
    const body = encodeURIComponent(
      `Dear ${patient.name},\n\nYour prescription is ready.\nView and download here: ${signedUrl}\n\nThis link is valid for 7 days.\n\nRegards,\n${doctorName}\n${clinicName}`
    );
    window.open(`mailto:${patient.email}?subject=${subject}&body=${body}`);
  };

  const handleCopy = async () => {
    if (!signedUrl) return;
    try {
      await navigator.clipboard.writeText(`Prescription for ${patient?.name}: ${signedUrl}`);
      toast.success("Link copied — paste in any SMS or messaging app");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleDownload = () => {
    if (!signedUrl) return;
    const a = document.createElement("a");
    a.href = signedUrl;
    a.download = `prescription-${patient?.name}-${new Date().toLocaleDateString("en-IN").replace(/\//g, "-")}.pdf`;
    a.target = "_blank";
    a.click();
  };

  const handlePrint = () => {
    if (!signedUrl) return;
    window.open(signedUrl, "_blank");
  };

  const content = (
    <div className="space-y-5 py-2">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
          <CheckCircle className="h-5 w-5 text-emerald-600" />
        </div>
        <div>
          <p className="font-semibold text-foreground">Prescription Ready</p>
          <p className="text-sm text-muted-foreground">{patient?.name} · {patient?.healthcare_id || ""}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      ) : !signedUrl ? (
        <p className="text-sm text-muted-foreground text-center py-4">Prescription URL not available yet. Try again in a moment.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="outline" className="h-12 gap-2 rounded-xl" onClick={handleWhatsApp} disabled={!patient?.phone}>
              <MessageCircle className="h-4 w-4 text-green-600" /> WhatsApp
            </Button>
            <Button variant="outline" className="h-12 gap-2 rounded-xl" onClick={handleEmail} disabled={!patient?.email}>
              <Mail className="h-4 w-4 text-blue-600" /> Email
            </Button>
            <Button variant="outline" className="h-12 gap-2 rounded-xl" onClick={handleCopy}>
              <Copy className="h-4 w-4" /> Copy Link
            </Button>
            <Button variant="outline" className="h-12 gap-2 rounded-xl" onClick={handleDownload}>
              <Download className="h-4 w-4" /> Download
            </Button>
          </div>
          <Button variant="outline" className="w-full h-12 gap-2 rounded-xl" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print
          </Button>
          <p className="text-xs text-muted-foreground text-center">Link valid for 7 days</p>
        </>
      )}

      {/* EMR Export */}
      {emrExportProps && (
        <div className="border-t border-border pt-4">
          <p className="text-sm font-medium text-foreground mb-2">Export to EMR</p>
          <EMRExportButtons {...emrExportProps} />
        </div>
      )}

      <Button className="w-full rounded-xl" onClick={onClose}>Done</Button>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={v => !v && onClose()}>
        <DrawerContent className="px-4 pb-6">
          <DrawerHeader><DrawerTitle>Share Prescription</DrawerTitle></DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Share Prescription</DialogTitle></DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
