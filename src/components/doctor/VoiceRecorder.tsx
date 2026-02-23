import { useState, useRef, useEffect, useCallback } from "react";
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [manualMode, setManualMode] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live timer
  useEffect(() => {
    if (isRecording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isRecording]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  const handleTranscription = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);
    try {
      const formData = new FormData();
      formData.append("audio", audioBlob, "recording.webm");

      const { data, error } = await supabase.functions.invoke("transcribe-audio", {
        body: formData,
      });

      if (error) {
        // Try to parse the error body for specific messages
        let msg = "Transcription failed. Please try again.";
        try {
          const parsed = typeof error === "string" ? JSON.parse(error) : error;
          if (parsed?.context?.body) {
            const body = JSON.parse(parsed.context.body);
            msg = body.error || msg;
          }
        } catch {
          // Use default message
        }
        toast.error(msg);
        setManualMode(true);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        setManualMode(true);
        return;
      }

      if (data?.transcript) {
        setTranscript(data.transcript);
        toast.success("Transcription complete! Processing SOAP notes...");
        // Auto-process through Claude
        try {
          const { data: soapData, error: soapError } = await supabase.functions.invoke("format-soap-notes", {
            body: { transcript: data.transcript },
          });

          if (soapError) {
            let soapMsg = "Failed to generate SOAP notes.";
            try {
              const parsed = typeof soapError === "string" ? JSON.parse(soapError) : soapError;
              if (parsed?.context?.body) {
                const body = JSON.parse(parsed.context.body);
                soapMsg = body.error || soapMsg;
              }
            } catch {
              // Use default
            }
            toast.error(soapMsg);
            setManualMode(true);
            return;
          }

          if (soapData?.error) {
            toast.error(soapData.error);
            setManualMode(true);
            return;
          }

          onTranscriptProcessed(soapData);
          toast.success("SOAP notes generated!");
        } catch (err: any) {
          toast.error(err.message || "Failed to process SOAP notes");
          setManualMode(true);
        }
      } else {
        toast.error("No transcript received. Please type your notes manually.");
        setManualMode(true);
      }
    } catch (err: any) {
      toast.error(err.message || "Transcription failed. Type your notes manually.");
      setManualMode(true);
    } finally {
      setIsTranscribing(false);
    }
  }, [onTranscriptProcessed]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        await handleTranscription(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      toast.info("Recording started...");
    } catch {
      toast.error("Microphone access denied. You can type your notes manually instead.");
      setManualMode(true);
    }
  };

  const stopRecording = () => {
    console.log('stopRecording called', mediaRecorderRef.current?.state);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
      }
      setIsRecording(false);
    }
  };

  const processManualTranscript = async () => {
    if (!transcript.trim()) { toast.error("Please enter some notes"); return; }
    setIsTranscribing(true);
    try {
      const { data, error } = await supabase.functions.invoke("format-soap-notes", {
        body: { transcript: transcript.trim() },
      });

      if (error) {
        let msg = "Failed to generate SOAP notes.";
        try {
          const parsed = typeof error === "string" ? JSON.parse(error) : error;
          if (parsed?.context?.body) {
            const body = JSON.parse(parsed.context.body);
            msg = body.error || msg;
          }
        } catch {
          // Use default
        }
        toast.error(msg);
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      onTranscriptProcessed(data);
      toast.success("SOAP notes generated!");
    } catch (err: any) {
      toast.error(err.message || "Failed to process notes");
    } finally {
      setIsTranscribing(false);
    }
  };

  if (isTranscribing) {
    return (
      <Card className="shadow-card">
        <CardContent className="flex flex-col items-center justify-center gap-4 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-display text-lg font-semibold text-foreground">Transcribing your notes...</p>
          <p className="text-sm text-muted-foreground">AI is converting your recording into structured SOAP notes</p>
        </CardContent>
      </Card>
    );
  }

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
              {isRecording ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    stopRecording();
                  }}
                  style={{ pointerEvents: 'all', zIndex: 9999, cursor: 'pointer' }}
                  className="flex h-20 w-20 items-center justify-center rounded-full bg-destructive hover:bg-destructive/90 transition-all shadow-lg"
                >
                  <Square className="h-8 w-8 text-destructive-foreground" fill="currentColor" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  className="flex h-24 w-24 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-elevated hover:scale-105 transition-all"
                >
                  <Mic className="h-10 w-10" />
                </button>
              )}
              {isRecording && (
                <span className="absolute inset-0 animate-pulse-ring rounded-full border-2 border-destructive pointer-events-none" />
              )}
            </div>
            {isRecording && (
              <p className="font-mono text-2xl font-bold text-destructive">{formatTime(elapsed)}</p>
            )}
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
              <Button onClick={processManualTranscript} disabled={isTranscribing || !transcript.trim()} className="flex-1">
                Generate SOAP Notes with AI
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
