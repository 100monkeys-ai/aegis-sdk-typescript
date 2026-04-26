// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026 100monkeys.ai

/**
 * Streaming attachment uploader for AEGIS user volumes.
 *
 * Implements the SDK side of the ADR-113 attachment flow: stream a file to
 * `POST /v1/volumes/{volumeId}/files/upload` and return a structured
 * `AttachmentRef` that callers can pass through `executeAgent`,
 * `startExecution`, or `executeWorkflow` via the `attachments` parameter.
 *
 * Lifetime is named explicitly by the volume the caller chooses. Passing
 * `volumeId="chat-attachments"` causes the orchestrator to lazy-provision
 * that reserved volume on first upload; any other name must already exist.
 */

import type { AxiosInstance } from "axios";
import * as fs from "node:fs";
import * as path from "node:path";
import type { AttachmentRef } from "./types";

/**
 * A file source accepted by {@link attachToVolume}.
 *
 * - `string` — a filesystem path (Node only).
 * - `Blob` / `File` — a browser- or Node-native blob.
 * - `Buffer` — raw bytes (Node only).
 * - `BlobLike` — `{ name?, type?, stream() | bytes }` for callers that want
 *   to wrap a custom source.
 */
export type AttachmentSource = string | Blob | Buffer | BlobLike;

/** Minimal blob-like shape that can be uploaded without depending on DOM types. */
export interface BlobLike {
  name?: string;
  type?: string;
  size?: number;
}

export interface AttachToVolumeOptions {
  /** Optional remote destination path within the volume. */
  path?: string;
  /** Override the filename sent to the orchestrator. */
  name?: string;
  /** Override the client-inferred MIME type. */
  mimeType?: string;
}

const KNOWN_MIME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  csv: "text/csv",
  json: "application/json",
  yaml: "application/yaml",
  yml: "application/yaml",
  html: "text/html",
  htm: "text/html",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  zip: "application/zip",
  tar: "application/x-tar",
  gz: "application/gzip",
  mp3: "audio/mpeg",
  mp4: "video/mp4",
  wav: "audio/wav",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

/**
 * Best-effort client-side MIME inference from a filename. The orchestrator
 * content-sniffs authoritatively and may correct this in the returned
 * `AttachmentRef`.
 */
export function inferMimeType(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext && KNOWN_MIME_TYPES[ext]) {
    return KNOWN_MIME_TYPES[ext];
  }
  return "application/octet-stream";
}

interface ResolvedSource {
  body: Blob | Buffer;
  name: string;
  mimeType: string;
}

function resolveSource(
  source: AttachmentSource,
  overrideName: string | undefined,
  overrideMime: string | undefined,
): ResolvedSource {
  // Filesystem path (Node only).
  if (typeof source === "string") {
    const filename = overrideName ?? path.basename(source);
    const buf = fs.readFileSync(source);
    return {
      body: buf,
      name: filename,
      mimeType: overrideMime ?? inferMimeType(filename),
    };
  }

  // Node Buffer.
  if (typeof Buffer !== "undefined" && source instanceof Buffer) {
    const filename = overrideName ?? "upload.bin";
    return {
      body: source,
      name: filename,
      mimeType: overrideMime ?? inferMimeType(filename),
    };
  }

  // Blob / File / BlobLike. We accept anything with a `name`/`type` shape.
  const blobLike = source as Blob & BlobLike;
  const filename = overrideName ?? blobLike.name ?? "upload.bin";
  const inferredFromBlob =
    blobLike.type && blobLike.type.length > 0 ? blobLike.type : undefined;
  const mimeType = overrideMime ?? inferredFromBlob ?? inferMimeType(filename);
  return {
    body: source as Blob,
    name: filename,
    mimeType,
  };
}

/**
 * Stream a file to a user volume and return a structured `AttachmentRef`.
 *
 * The internal SDK client passes its own `axios` instance and Bearer token
 * via the request interceptor — callers should use
 * {@link AegisClient.attachToVolume} rather than calling this directly.
 *
 * Per ADR-113 the orchestrator content-sniffs authoritatively, so the
 * returned `AttachmentRef.mime_type` may differ from the client-inferred
 * value passed in the multipart body.
 */
export async function attachToVolume(
  http: AxiosInstance,
  volumeId: string,
  source: AttachmentSource,
  options: AttachToVolumeOptions = {},
): Promise<AttachmentRef> {
  const resolved = resolveSource(source, options.name, options.mimeType);

  const form = new FormData();
  // FormData accepts Blob (browser/Node 20+) or string. Node Buffer needs to
  // be wrapped in a Blob first; we copy through a fresh Uint8Array to give
  // the Blob constructor an ArrayBuffer-backed view (Buffer's `.buffer` may
  // be a SharedArrayBuffer per TS lib types).
  let part: Blob;
  if (resolved.body instanceof Blob) {
    part = resolved.body;
  } else {
    // Copy into a fresh ArrayBuffer so the Blob constructor sees a non-shared
    // BlobPart (Buffer's `.buffer` is typed as ArrayBufferLike, which the
    // BlobPart type rejects).
    const ab = new ArrayBuffer(resolved.body.byteLength);
    new Uint8Array(ab).set(resolved.body);
    part = new Blob([ab], { type: resolved.mimeType });
  }
  form.append("file", part, resolved.name);

  const params: Record<string, string> = {};
  if (options.path !== undefined) {
    params["path"] = options.path;
  }

  const response = await http.post<Record<string, unknown>>(
    `/v1/volumes/${encodeURIComponent(volumeId)}/files/upload`,
    form,
    { params },
  );

  return attachmentRefFromUploadResponse(
    volumeId,
    resolved.name,
    resolved.mimeType,
    response.data,
  );
}

/**
 * Build an `AttachmentRef` from the orchestrator upload response.
 *
 * The upload endpoint returns at least `{name, size_bytes, uploaded_at}`
 * per `UploadFileResponse` and may include `path`, `mime_type`, and
 * `sha256` (the orchestrator content-sniffs authoritatively per ADR-113).
 */
export function attachmentRefFromUploadResponse(
  volumeId: string,
  fallbackName: string,
  fallbackMime: string,
  body: Record<string, unknown>,
): AttachmentRef {
  const respName = typeof body.name === "string" ? body.name : undefined;
  const respPath = typeof body.path === "string" ? body.path : undefined;
  const respMime =
    typeof body.mime_type === "string" ? body.mime_type : undefined;
  const respSize =
    typeof body.size_bytes === "number"
      ? body.size_bytes
      : typeof body.size === "number"
        ? body.size
        : 0;
  const respSha256 = typeof body.sha256 === "string" ? body.sha256 : undefined;

  const ref: AttachmentRef = {
    volume_id: volumeId,
    path: respPath ?? respName ?? fallbackName,
    name: respName ?? fallbackName,
    mime_type: respMime ?? fallbackMime,
    size: respSize,
  };
  if (respSha256 !== undefined) {
    ref.sha256 = respSha256;
  }
  return ref;
}
