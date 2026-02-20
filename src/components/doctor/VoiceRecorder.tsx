import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Mic, Square, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  visitId: string;
  onTranscriptProcessed: (soapData: any) => void;
};

export default function VoiceRecorder({ visitId, onTranscriptProcessed }: Props) {
  const [isRecording, setIsRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        await processAudio(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started...");
    } catch (err) {
      toast.error("Microphone access denied. You can type your notes manually instead.");
      setManualMode(true);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const processAudio = async (audioBlob: Blob) => {
    setProcessing(true);
    toast.info("Processing audio with AI...");

    try {
      // For now, use manual transcript since Whisper API needs API key
      // The audio is captured and ready to be sent to edge function
      toast.info("Voice-to-text requires API key setup. Please type your notes manually for now.");
      setManualMode(true);
    } catch (err: any) {
      toast.error("Processing failed. Type your notes manually.");
      setManualMode(true);
    } finally {
      setProcessing(false);
    }
  };

  const processManualTranscript = async () => {
    if (!transcript.trim()) { toast.error("Please enter some notes"); return; }
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("format-soap-notes", {
        body: { transcript: transcript.trim() },
      });
      if (error) throw error;
      onTranscriptProcessed(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to process notes");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <Card className="shadow-card">
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <Mic className="h-5 w-5 text-primary" /> Voice Recording & AI Scribe
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!manualMode ? (
          <div className="flex flex-col items-center gap-6 py-8">
            <div className="relative">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex h-24 w-24 items-center justify-center rounded-full transition-all ${
                  isRecording
                    ? "bg-destructive text-destructive-foreground shadow-lg"
                    : "bg-primary text-primary-foreground shadow-elevated hover:scale-105"
                }`}
              >
                {isRecording ? <Square className="h-8 w-8" /> : <Mic className="h-10 w-10" />}
              </button>
              {isRecording && (
                <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-destructive" />
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {isRecording ? "Recording... Click to stop" : "Click to start recording"}
            </p>
            <Button variant="link" size="sm" onClick={() => setManualMode(true)} className="text-muted-foreground">
              Or type notes manually
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Textarea
              rows={6}
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              placeholder="Type or paste your clinical notes here. The AI will convert them into structured SOAP notes and extract prescriptions..."
              className="resize-none"
            />
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setManualMode(false)}>
                <Mic className="mr-2 h-4 w-4" /> Use Microphone
              </Button>
              <Button onClick={processManualTranscript} disabled={processing || !transcript.trim()} className="flex-1">
                {processing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "Generate SOAP Notes with AI"}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
