// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026 100monkeys.ai
import { Ed25519Key } from "./crypto";

/**
 * Standard MCP JSON-RPC payload definition.
 */
export interface McpPayload {
  jsonrpc: string;
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * SEAL Security Envelope wrapping an MCP payload.
 */
export interface SealEnvelope {
  protocol: string;
  security_token: string;
  signature: string;
  payload: McpPayload;
  timestamp: string;
}

/**
 * Construct a deterministic byte sequence for signing/verification.
 * Produces stable JSON with sorted keys and no whitespace.
 */
export function createCanonicalMessage(
  securityToken: string,
  payload: McpPayload,
  timestampUnix: number,
): Uint8Array {
  const message = {
    security_token: securityToken,
    payload,
    timestamp: timestampUnix,
  };
  const canonicalJson = stableStringify(message);
  return new TextEncoder().encode(canonicalJson);
}

/**
 * Recursively stringify an object with sorted keys and no whitespace.
 */
export function stableStringify(obj: unknown): string {
  if (obj === null || typeof obj !== "object") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    const items = (obj as unknown[]).map(stableStringify);
    return `[${items.join(",")}]`;
  }
  const record = obj as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  const pairs = keys
    .filter((k) => record[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${stableStringify(record[k])}`);
  return `{${pairs.join(",")}}`;
}

/**
 * Wrap an MCP JSON-RPC payload in a SEAL Security Envelope v1.
 */
export function createSealEnvelope(
  securityToken: string,
  mcpPayload: McpPayload,
  privateKey: Ed25519Key,
): SealEnvelope {
  const now = new Date();
  const timestampIso = now.toISOString();
  const timestampUnix = Math.floor(now.getTime() / 1000);

  const canonicalBytes = createCanonicalMessage(
    securityToken,
    mcpPayload,
    timestampUnix,
  );
  const signatureB64 = privateKey.signBase64(canonicalBytes);

  return {
    protocol: "seal/v1",
    security_token: securityToken,
    signature: signatureB64,
    payload: mcpPayload,
    timestamp: timestampIso,
  };
}
