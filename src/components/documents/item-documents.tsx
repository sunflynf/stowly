"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useRef, useState } from "react";
import { Download, Eye, FileText, Image as ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { CanEdit } from "@/components/app-shell/can-edit";
import { unwrap, useErrorToast } from "@/components/items/use-item-mutations";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/input";
import { deleteDocumentAction } from "@/lib/actions/documents";
import { DocumentUploadError, uploadItemDocument } from "@/lib/documents";
import { documentUrl, useItemDocuments, type ItemDocument } from "@/lib/queries/documents";
import { qk } from "@/lib/queries/keys";
import { DOCUMENT_KINDS, DOCUMENT_TYPES, type DocumentKind } from "@/lib/validation/documents";

const ACCEPT = Object.keys(DOCUMENT_TYPES).join(",");

/** Opens a document in a dialog (PDF in a frame, images inline) with a download link. */
export function DocumentViewer({ doc, onClose }: { doc: (ItemDocument & { url: string; downloadUrl: string }) | null; onClose: () => void }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  return (
    <Dialog open={doc !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="break-all">{doc?.title}</DialogTitle>
          <DialogDescription>{doc ? t(`kinds.${doc.kind}`) : ""}</DialogDescription>
        </DialogHeader>
        {doc &&
          (doc.mime_type === "application/pdf" ? (
            <iframe src={doc.url} title={doc.title} className="h-[70dvh] w-full rounded-md border border-border bg-muted" />
          ) : (
            // Signed, short-lived URL from private storage; next/image would try to optimise and cache it.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={doc.url} alt={doc.title} className="max-h-[70dvh] w-full rounded-md bg-muted object-contain" />
          ))}
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {tc("close")}
          </Button>
          {doc && (
            <Button asChild>
              <a href={doc.downloadUrl} download={doc.title}>
                <Download />
                {t("download")}
              </a>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useOpenDocument() {
  const onError = useErrorToast();
  const [viewing, setViewing] = useState<(ItemDocument & { url: string; downloadUrl: string }) | null>(null);
  const open = async (doc: ItemDocument) => {
    try {
      const [url, downloadUrl] = await Promise.all([documentUrl(doc), documentUrl(doc, true)]);
      setViewing({ ...doc, url, downloadUrl });
    } catch (e) {
      onError(e);
    }
  };
  return { viewing, open, close: () => setViewing(null) };
}

export function DocumentList({ docs, onOpen, onDelete }: { docs: ItemDocument[]; onOpen: (d: ItemDocument) => void; onDelete?: (d: ItemDocument) => void }) {
  const t = useTranslations("documents");
  const format = useFormatter();
  return (
    <ul className="flex flex-col">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center gap-3 border-b border-border py-2.5 last:border-0">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            {d.mime_type === "application/pdf" ? <FileText className="size-5" aria-hidden /> : <ImageIcon className="size-5" aria-hidden />}
          </span>
          <button type="button" className="min-w-0 flex-1 text-left" onClick={() => onOpen(d)}>
            <span className="block truncate font-medium hover:underline">{d.title}</span>
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Badge tone="outline">{t(`kinds.${d.kind}`)}</Badge>
              {format.number(d.size_bytes / 1024 / 1024, { maximumFractionDigits: 1 })} MB
            </span>
          </button>
          <Button variant="ghost" size="icon" aria-label={t("viewNamed", { name: d.title })} onClick={() => onOpen(d)}>
            <Eye />
          </Button>
          {onDelete && (
            <CanEdit>
              <Button variant="ghost" size="icon" aria-label={t("deleteNamed", { name: d.title })} onClick={() => onDelete(d)}>
                <Trash2 />
              </Button>
            </CanEdit>
          )}
        </li>
      ))}
    </ul>
  );
}

/** Warranty card, invoice and manual files on the item detail page. */
export function ItemDocuments({ itemId }: { itemId: string }) {
  const t = useTranslations("documents");
  const tc = useTranslations("common");
  const qc = useQueryClient();
  const onError = useErrorToast();
  const { data: docs = [] } = useItemDocuments(itemId);
  const { viewing, open, close } = useOpenDocument();
  const [kind, setKind] = useState<DocumentKind>("warranty");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<ItemDocument | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const refresh = () => qc.invalidateQueries({ queryKey: qk.itemDocuments(itemId) });

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        try {
          await uploadItemDocument(itemId, file, kind);
        } catch (e) {
          if (e instanceof DocumentUploadError && e.code !== "unauthorized") toast.error(t(`errors.${e.code}`, { name: file.name }));
          else throw e;
        }
      }
      await refresh();
    } catch (e) {
      onError(e);
    } finally {
      setUploading(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <section className="rounded-md border border-border bg-card p-4 md:p-5" aria-labelledby="item-documents">
      <h2 id="item-documents" className="mb-2 font-semibold">
        {t("title")}
      </h2>
      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <DocumentList docs={docs} onOpen={(d) => void open(d)} onDelete={setDeleting} />
      )}
      <CanEdit>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <NativeSelect value={kind} onChange={(e) => setKind(e.target.value as DocumentKind)} aria-label={t("kind")} className="w-auto">
            {DOCUMENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`kinds.${k}`)}
              </option>
            ))}
          </NativeSelect>
          <Button variant="outline" disabled={uploading} onClick={() => input.current?.click()}>
            {uploading ? <Loader2 className="animate-spin" /> : <Upload />}
            {uploading ? t("uploading") : t("upload")}
          </Button>
          <input
            ref={input}
            type="file"
            accept={ACCEPT}
            multiple
            className="sr-only"
            aria-label={t("upload")}
            data-testid="document-input"
            onChange={(e) => void upload(e.target.files)}
          />
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("hint")}</p>
      </CanEdit>

      <DocumentViewer doc={viewing} onClose={close} />

      <Dialog open={deleting !== null} onOpenChange={(o) => !o && setDeleting(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("delete")}</DialogTitle>
            <DialogDescription>{t("deleteConfirm", { name: deleting?.title ?? "" })}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              {tc("cancel")}
            </Button>
            <Button
              variant="danger"
              onClick={async () => {
                if (!deleting) return;
                try {
                  unwrap(await deleteDocumentAction(deleting.id));
                  setDeleting(null);
                  toast.success(t("deleted"));
                  await refresh();
                } catch (e) {
                  onError(e);
                }
              }}
            >
              {tc("delete")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
