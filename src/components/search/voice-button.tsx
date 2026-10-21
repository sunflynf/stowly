"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Mic, MicOff } from "lucide-react";
import { toast } from "sonner";
import { speechLang, speechRecognitionCtor, voiceToQuery, type SpeechRecognitionLike } from "@/lib/voice";
import { cn } from "@/lib/utils";

const subscribe = () => () => {};

/** Microphone button: listens once and returns the item name from what was said. */
export function VoiceButton({ onResult, className }: { onResult: (query: string) => void; className?: string }) {
  const t = useTranslations("voice");
  const locale = useLocale();
  // Unknown during server rendering; the button only appears where the browser supports it.
  const supported = useSyncExternalStore(subscribe, () => speechRecognitionCtor() !== null, () => false);
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recognition.current?.abort(), []);

  if (!supported) return null;

  const start = () => {
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const r = new Ctor();
    r.lang = speechLang(locale);
    r.interimResults = false;
    r.maxAlternatives = 1;
    r.continuous = false;
    r.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript.trim()) onResult(voiceToQuery(transcript, locale));
    };
    r.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") toast.error(t("denied"));
      else if (event.error === "no-speech") toast.info(t("noSpeech"));
      else if (event.error !== "aborted") toast.error(t("failed"));
    };
    r.onend = () => setListening(false);
    recognition.current = r;
    setListening(true);
    r.start();
  };

  return (
    <>
      <button
        type="button"
        onClick={start}
        aria-label={listening ? t("stop") : t("start")}
        aria-pressed={listening}
        className={cn(
          "flex size-10 items-center justify-center rounded-full",
          listening ? "bg-danger-solid text-white" : "text-muted-foreground hover:bg-muted",
          className,
        )}
      >
        {listening ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
      </button>
      <span role="status" aria-live="polite" className="sr-only">
        {listening ? t("listening") : ""}
      </span>
    </>
  );
}
