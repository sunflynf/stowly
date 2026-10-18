"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { ScanLine } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

interface DetectedBarcode {
  rawValue: string;
}
interface BarcodeDetectorLike {
  detect(source: HTMLVideoElement): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

function getDetector(): BarcodeDetectorCtor | null {
  const ctor = (globalThis as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
  return ctor ?? null;
}

/**
 * Scans a QR code or barcode with the camera (BarcodeDetector API).
 * App links open directly; any other text is used as a search query.
 */
export function ScanButton() {
  const t = useTranslations("scan");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<"unsupported" | "denied" | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const Detector = getDetector();
    if (!open || error || !Detector) return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const detector = new Detector({ formats: ["qr_code", "ean_13", "ean_8", "code_128", "upc_a", "upc_e"] });

    const handle = (value: string) => {
      setOpen(false);
      try {
        const url = new URL(value);
        if (url.origin === window.location.origin) {
          router.push(url.pathname + url.search);
          return;
        }
      } catch {
        // Not a URL: search for it.
      }
      router.push(`/items?q=${encodeURIComponent(value.slice(0, 200))}`);
    };

    const loop = async () => {
      if (cancelled || !video.current) return;
      try {
        const codes = await detector.detect(video.current);
        if (codes[0]?.rawValue) return handle(codes[0].rawValue);
      } catch {
        // Frame not ready yet.
      }
      raf = requestAnimationFrame(() => void loop());
    };

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then(async (s) => {
        stream = s;
        if (cancelled || !video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        void loop();
      })
      .catch(() => setError("denied"));

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, error, router]);

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) setError(getDetector() && "mediaDevices" in navigator ? null : "unsupported");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={t("button")}
          className="flex size-[52px] shrink-0 items-center justify-center rounded-[var(--radius)] border border-input bg-card hover:bg-muted"
        >
          <ScanLine className="size-5" aria-hidden />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{error ? t(error) : t("hint")}</DialogDescription>
        </DialogHeader>
        {!error && <video ref={video} muted playsInline className="aspect-square w-full rounded-[var(--radius)] bg-foreground object-cover" />}
      </DialogContent>
    </Dialog>
  );
}
