"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deletePhotoAction, makeCoverPhotoAction } from "@/lib/actions/items";
import { MAX_PHOTOS, uploadItemPhoto } from "@/lib/photos";
import { qk } from "@/lib/queries/keys";
import { usePhotoUrls } from "@/lib/queries/items";
import { cn } from "@/lib/utils";
import { useErrorToast, useInvalidateItems, unwrap } from "./use-item-mutations";

export interface ExistingPhoto {
  id: string;
  storage_path: string;
  thumb_path: string | null;
}

function PickButtons({ onFiles, disabled, compact }: { onFiles: (files: File[]) => void; disabled?: boolean; compact?: boolean }) {
  const t = useTranslations("item");
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (files.length) onFiles(files);
  };
  return (
    <div className={cn("grid gap-3", compact ? "grid-cols-2" : "grid-cols-[1.6fr_1fr]")}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => camera.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-primary bg-accent font-semibold text-accent-foreground disabled:opacity-50",
          compact ? "min-h-14 flex-row" : "min-h-28",
        )}
      >
        <Camera className="size-6" aria-hidden />
        {t("takePhoto")}
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => gallery.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-md border border-input bg-card font-medium disabled:opacity-50",
          compact ? "min-h-14 flex-row" : "min-h-28",
        )}
      >
        <ImageIcon className="size-6" aria-hidden />
        {t("gallery")}
      </button>
      <input ref={camera} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} onChange={handle} />
      <input ref={gallery} type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} onChange={handle} />
    </div>
  );
}

/** Photos chosen before the item exists (quick add). Uploaded after save. */
export function PendingPhotoField({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const t = useTranslations("item");
  const previews = useMemo(() => files.map((f) => URL.createObjectURL(f)), [files]);
  useEffect(() => () => previews.forEach((u) => URL.revokeObjectURL(u)), [previews]);

  return (
    <div className="flex flex-col gap-3">
      {files.length < MAX_PHOTOS && (
        <PickButtons compact={files.length > 0} onFiles={(more) => onChange([...files, ...more].slice(0, MAX_PHOTOS))} />
      )}
      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label={t("photoCount", { count: files.length })}>
          {previews.map((src, i) => (
            <li key={src} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt={t("photoN", { n: i + 1, name: "" })} className="size-20 rounded-md object-cover" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                aria-label={t("removePhoto")}
                className="absolute -top-2 -right-2 flex size-8 items-center justify-center rounded-full border border-border bg-card shadow"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Photos of an existing item: upload immediately, remove, choose cover. */
export function ItemPhotoManager({ itemId, name, photos }: { itemId: string; name: string; photos: ExistingPhoto[] }) {
  const t = useTranslations("item");
  const qc = useQueryClient();
  const invalidate = useInvalidateItems();
  const onError = useErrorToast();
  const [uploading, setUploading] = useState(0);
  const { data: urls = {} } = usePhotoUrls(photos.map((p) => p.thumb_path ?? p.storage_path));

  const refresh = async () => {
    await qc.invalidateQueries({ queryKey: qk.item(itemId) });
    await invalidate();
  };

  const upload = async (files: File[]) => {
    const room = MAX_PHOTOS - photos.length;
    const batch = files.slice(0, room);
    setUploading(batch.length);
    for (const file of batch) {
      try {
        await uploadItemPhoto(itemId, file);
      } catch {
        toast.error(t("photoFailed"));
      }
      setUploading((n) => n - 1);
    }
    await refresh();
  };

  const remove = async (id: string) => {
    try {
      unwrap(await deletePhotoAction(id));
      await refresh();
    } catch (e) {
      onError(e);
    }
  };

  const cover = async (id: string) => {
    try {
      unwrap(await makeCoverPhotoAction(id));
      await refresh();
    } catch (e) {
      onError(e);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-3" aria-label={t("photoCount", { count: photos.length })}>
        {photos.map((p, i) => (
          <li key={p.id} className="flex flex-col items-center gap-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={urls[p.thumb_path ?? p.storage_path]}
              alt={t("photoN", { n: i + 1, name })}
              className="size-24 rounded-md bg-muted object-cover"
            />
            <div className="flex">
              <button
                type="button"
                onClick={() => void cover(p.id)}
                disabled={i === 0}
                aria-label={t("makeCover")}
                className="flex size-11 items-center justify-center rounded-md hover:bg-muted disabled:text-primary"
              >
                <Star className={cn("size-4", i === 0 && "fill-current")} aria-hidden />
              </button>
              <button
                type="button"
                onClick={() => void remove(p.id)}
                aria-label={t("removePhoto")}
                className="flex size-11 items-center justify-center rounded-md hover:bg-muted"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </div>
          </li>
        ))}
        {uploading > 0 && (
          <li className="flex size-24 items-center justify-center rounded-md bg-muted" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden />
            <span className="sr-only">{t("uploading")}</span>
          </li>
        )}
      </ul>
      {photos.length + uploading < MAX_PHOTOS && <PickButtons compact onFiles={(f) => void upload(f)} disabled={uploading > 0} />}
    </div>
  );
}
