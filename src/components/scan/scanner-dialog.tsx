"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cameraAvailable, createDetector, type BarcodeFormat, type Detector } from "@/lib/barcode-detector";

const ALL_FORMATS: BarcodeFormat[] = ["qr_code", "ean_13", "ean_8", "upc_a", "upc_e", "code_128", "code_39", "itf"];

type Status = "starting" | "scanning" | "unsupported" | "denied" | "no-camera";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onResult: (value: string) => void;
  title?: string;
  hint?: string;
  formats?: BarcodeFormat[];
}

/** Camera scanner for QR codes and barcodes, with manual entry as a fallback. */
export function ScannerDialog({ open, onOpenChange, onResult, title, hint, formats = ALL_FORMATS }: Props) {
  const t = useTranslations("scan");
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<Status>("starting");
  const [manual, setManual] = useState("");
  const formatsKey = formats.join(",");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    let timer = 0;

    const finish = (value: string) => {
      cancelled = true;
      onResult(value);
      onOpenChange(false);
    };

    void (async () => {
      if (!cameraAvailable()) {
        setStatus("no-camera");
        return;
      }
      let detector: Detector;
      try {
        detector = await createDetector(formatsKey.split(",") as BarcodeFormat[]);
      } catch {
        if (!cancelled) setStatus("unsupported");
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      } catch {
        if (!cancelled) setStatus("denied");
        return;
      }
      if (cancelled || !video.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      video.current.srcObject = stream;
      await video.current.play().catch(() => undefined);
      setStatus("scanning");

      // ~6 scans per second is plenty and keeps phones cool.
      const tick = async () => {
        if (cancelled || !video.current) return;
        try {
          if (video.current.readyState >= 2) {
            const codes = await detector.detect(video.current);
            const value = codes.find((c) => c.rawValue)?.rawValue;
            if (value) return finish(value);
          }
        } catch {
          // Frame not ready; keep going.
        }
        timer = window.setTimeout(() => void tick(), 160);
      };
      void tick();
    })();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [open, formatsKey, onOpenChange, onResult]);

  const handleOpenChange = (next: boolean) => {
    if (next) setStatus("starting");
    onOpenChange(next);
  };

  const message =
    status === "unsupported"
      ? t("unsupported")
      : status === "denied"
        ? t("denied")
        : status === "no-camera"
          ? t("noCamera")
          : (hint ?? t("hint"));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title ?? t("title")}</DialogTitle>
          <DialogDescription>{message}</DialogDescription>
        </DialogHeader>
        {(status === "starting" || status === "scanning") && (
          <div className="relative aspect-square w-full overflow-hidden rounded-md bg-foreground">
            <video ref={video} muted playsInline className="size-full object-cover" aria-label={title ?? t("title")} />
            {status === "starting" ? (
              <span className="absolute inset-0 flex items-center justify-center gap-2 text-sm text-white" role="status">
                <Loader2 className="size-5 animate-spin" aria-hidden />
                {t("starting")}
              </span>
            ) : (
              <span className="pointer-events-none absolute inset-[18%] rounded-md border-2 border-white/80" aria-hidden />
            )}
          </div>
        )}
        <form
          className="mt-4 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const value = manual.trim();
            if (!value) return;
            setManual("");
            onResult(value);
            onOpenChange(false);
          }}
        >
          <label htmlFor="scan-manual" className="text-sm font-semibold">
            {t("manual")}
          </label>
          <div className="flex gap-2">
            <Input
              id="scan-manual"
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder={t("manualPlaceholder")}
              autoComplete="off"
              maxLength={200}
            />
            <Button type="submit" variant="secondary" disabled={!manual.trim()}>
              {t("manualSubmit")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
