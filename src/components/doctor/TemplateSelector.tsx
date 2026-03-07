import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

type Template = {
  id: string;
  name: string;
  description: string | null;
  sections: string[];
};

type Props = {
  clinicId: string;
  doctorDefaultTemplateId: string | null;
  onTemplateChange: (template: Template | null) => void;
};

export default function TemplateSelector({ clinicId, doctorDefaultTemplateId, onTemplateChange }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    const fetch = async () => {
      const { data } = await supabase
        .from("note_templates")
        .select("id, name, description, sections")
        .or(`is_system.eq.true,clinic_id.eq.${clinicId}`)
        .order("is_system", { ascending: false });
      if (data) {
        const parsed = data.map((t: any) => ({
          ...t,
          sections: Array.isArray(t.sections) ? t.sections : [],
        }));
        setTemplates(parsed);
        // Auto-select doctor's default or first SOAP
        const defaultId = doctorDefaultTemplateId || parsed.find((t: any) => t.name === "SOAP Notes")?.id;
        if (defaultId) {
          setSelectedId(defaultId);
          onTemplateChange(parsed.find((t: any) => t.id === defaultId) || null);
        }
      }
    };
    fetch();
  }, [clinicId]);

  const handleChange = (id: string) => {
    setSelectedId(id);
    const tmpl = templates.find(t => t.id === id) || null;
    onTemplateChange(tmpl);
  };

  return (
    <div className="flex items-center gap-3">
      <Label className="text-sm font-medium text-muted-foreground whitespace-nowrap">Template:</Label>
      <Select value={selectedId} onValueChange={handleChange}>
        <SelectTrigger className="w-[220px] rounded-lg">
          <SelectValue placeholder="Select template" />
        </SelectTrigger>
        <SelectContent>
          {templates.map(t => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
