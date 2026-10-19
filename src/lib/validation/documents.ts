import { z } from "zod";
import { uuid } from "./common";

export const DOCUMENT_BUCKET = "item-documents";
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
/** Accepted MIME types and the extension stored for each. */
export const DOCUMENT_TYPES = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
export const DOCUMENT_KINDS = ["warranty", "invoice", "manual", "other"] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

export const addDocumentSchema = z.object({
  itemId: uuid,
  storagePath: z.string().max(300),
  kind: z.enum(DOCUMENT_KINDS),
  title: z
    .string()
    .trim()
    .min(1, "required")
    .transform((s) => s.slice(0, 200)),
});
