import "server-only";
import { randomUUID } from "crypto";
import { createAdminClient } from "@/lib/supabase/admin";

// Ported from Services/ImageService.cs. Supabase Storage buckets (products/categories, migration
// 0006) replace wwwroot/uploads/*; every original control is preserved:
//   - extension allow-list + 5 MB cap
//   - server-generated filenames (never trust the client's name)
//   - SVG sanitization (strip <script>, on*= handlers, javascript: URIs) before storing, since
//     SVG is XML and can carry live script that would run if opened directly
//   - delete only ever touches paths this service itself generated (bucket + prefix), the
//     Storage equivalent of the original's "must stay inside wwwroot/uploads" path check

const ALLOWED_EXTENSIONS = [".jpg", ".jpeg", ".png", ".webp", ".gif", ".svg"];
const MAX_BYTES = 5 * 1024 * 1024;

const SVG_SCRIPT_TAG = /<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi;
const SVG_EVENT_HANDLER_ATTR = /\s+on[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi;
const SVG_JAVASCRIPT_URI = /(href|xlink:href)\s*=\s*("javascript:[^"]*"|'javascript:[^']*')/gi;

export type ImageBucket = "products" | "categories";

export class ImageValidationError extends Error {}

function sanitizeSvg(content: string): string {
  return content
    .replace(SVG_SCRIPT_TAG, "")
    .replace(SVG_EVENT_HANDLER_ATTR, "")
    .replace(SVG_JAVASCRIPT_URI, "");
}

/** Saves an uploaded image to the given bucket, returning its public URL, or null if no file was given. */
export async function saveImage(file: File | null | undefined, bucket: ImageBucket = "products"): Promise<string | null> {
  if (!file || file.size === 0) return null;

  if (file.size > MAX_BYTES) {
    throw new ImageValidationError("Image must be smaller than 5 MB.");
  }

  const originalName = file.name || "";
  const ext = originalName.slice(originalName.lastIndexOf(".")).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    throw new ImageValidationError("Only JPG, PNG, WEBP, GIF or SVG images can be uploaded.");
  }

  // Never trust the client filename — generate our own and keep only the vetted extension.
  const fileName = `${randomUUID().replace(/-/g, "")}${ext}`;

  const admin = createAdminClient();
  let body: Blob;

  if (ext === ".svg") {
    const text = await file.text();
    body = new Blob([sanitizeSvg(text)], { type: "image/svg+xml" });
  } else {
    body = file;
  }

  const { error } = await admin.storage.from(bucket).upload(fileName, body, {
    contentType: file.type || undefined,
    upsert: false,
  });

  if (error) {
    throw new ImageValidationError(`Could not upload image: ${error.message}`);
  }

  const { data } = admin.storage.from(bucket).getPublicUrl(fileName);
  return data.publicUrl;
}

/** Deletes an image previously saved via saveImage(), given its public URL. Never throws. */
export async function deleteImage(publicUrl: string | null | undefined, bucket: ImageBucket = "products"): Promise<void> {
  if (!publicUrl) return;

  try {
    // Extract the storage object path from the public URL — only ever the filename this
    // service itself generated, never an arbitrary path from user input.
    const marker = `/storage/v1/object/public/${bucket}/`;
    const idx = publicUrl.indexOf(marker);
    if (idx === -1) return;

    const path = publicUrl.slice(idx + marker.length);
    if (!path || path.includes("/")) return; // defense in depth: filenames never contain a slash

    const admin = createAdminClient();
    await admin.storage.from(bucket).remove([path]);
  } catch (err) {
    console.warn(`Could not delete image: ${publicUrl}`, err);
  }
}

/** Seeded artwork ships with the app and is reused, so it must survive product/category deletes. */
export function isSeedImage(path: string | null | undefined): boolean {
  if (!path) return false;
  if (path.startsWith("/img/") || path.startsWith("/uploads/")) return true; // static seed assets under public/
  return false;
}
