// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026 100monkeys.ai
import { ed25519 } from "@noble/curves/ed25519";
import { createCanonicalMessage, McpPayload } from "./envelope";
import { SEALError } from "./client";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isMcpPayload(value: unknown): value is McpPayload {
  if (!isRecord(value)) return false;
  const { jsonrpc, id, method, params } = value;
  return (
    typeof jsonrpc === "string" &&
    (typeof id === "string" || typeof id === "number") &&
    typeof method === "string" &&
    (params === undefined || isRecord(params))
  );
}

/**
 * Server-side primitive to verify an incoming SealEnvelope.
 *
 * 1. Validates envelope structure.
 * 2. Checks timestamp freshness (±maxAgeSeconds).
 * 3. Reconstructs the canonical message.
 * 4. Cryptographically verifies the Ed25519 signature.
 *
 * @throws SEALError if any step fails.
 */
export function verifySealEnvelope(
  envelope: unknown,
  publicKeyBytes: Uint8Array,
  maxAgeSeconds = 30,
): McpPayload {
  if (!isRecord(envelope)) {
    throw new SEALError("Missing or invalid envelope object.");
  }

  if (envelope["protocol"] !== "seal/v1") {
    throw new SEALError(
      "Missing or invalid 'protocol' field. Expected 'seal/v1'.",
    );
  }

  const securityToken = envelope["security_token"];
  if (!securityToken || typeof securityToken !== "string") {
    throw new SEALError("Missing or invalid 'security_token' field.");
  }

  const signatureB64 = envelope["signature"];
  if (!signatureB64 || typeof signatureB64 !== "string") {
    throw new SEALError("Missing or invalid 'signature' field.");
  }

  const payload = envelope["payload"];
  if (!isMcpPayload(payload)) {
    throw new SEALError("Missing or invalid 'payload' field.");
  }

  const timestampIso = envelope["timestamp"];
  if (!timestampIso || typeof timestampIso !== "string") {
    throw new SEALError("Missing or invalid 'timestamp' field.");
  }

  const timestampMs = Date.parse(timestampIso);
  if (isNaN(timestampMs)) {
    throw new SEALError("Invalid 'timestamp' format. Expected ISO 8601.");
  }

  const timestampUnix = Math.floor(timestampMs / 1000);
  const currentUnix = Math.floor(Date.now() / 1000);
  if (Math.abs(currentUnix - timestampUnix) > maxAgeSeconds) {
    throw new SEALError(
      `Envelope timestamp is outside the allowed ±${maxAgeSeconds}s window.`,
    );
  }

  let canonicalMsg: Uint8Array;
  try {
    canonicalMsg = createCanonicalMessage(
      securityToken,
      payload,
      timestampUnix,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    throw new SEALError(`Failed to construct canonical message: ${msg}`);
  }

  let signatureBytes: Uint8Array;
  try {
    signatureBytes = Buffer.from(signatureB64, "base64");
  } catch (_err) {
    throw new SEALError("Invalid base64 encoding for 'signature'.");
  }

  let valid: boolean;
  try {
    valid = ed25519.verify(signatureBytes, canonicalMsg, publicKeyBytes);
  } catch (_err) {
    throw new SEALError("Ed25519 signature verification failed.");
  }

  if (!valid) {
    throw new SEALError("Ed25519 signature verification failed.");
  }

  return payload;
}
