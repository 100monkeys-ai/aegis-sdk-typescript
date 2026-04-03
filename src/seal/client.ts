// SPDX-License-Identifier: AGPL-3.0-only
// Copyright 2026 100monkeys.ai
import crypto from 'crypto';
import { Ed25519Key } from './crypto';
import { createSealEnvelope, McpPayload } from './envelope';

export type AttestationResult = {
  security_token: string;
  expires_at: string;
  session_id?: string;
};

type AttestationResponse = {
  status?: string;
  message?: string;
  security_token?: string;
  expires_at?: string;
  session_id?: string;
  error?: { message?: string };
};

type InvokeResponse = {
  status?: string;
  error?: { message?: string };
  payload?: { error?: unknown; result?: unknown };
};

export class SEALError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SEALError';
  }
}

/**
 * TypeScript client for the SEAL protocol.
 * Manages ephemeral keypair lifecycle, attestation handshake, and signed
 * tool calls against any SEAL-compliant gateway.
 */
export class SEALClient {
  private readonly gatewayUrl: string;
  private readonly workloadId: string;
  private readonly securityScope: string;

  private key: Ed25519Key | null = null;
  private securityToken: string | null = null;
  private expiresAt: string | null = null;
  private sessionId: string | null = null;

  constructor(gatewayUrl: string, workloadId: string, securityScope: string) {
    this.gatewayUrl = gatewayUrl.replace(/\/$/, '');
    this.workloadId = workloadId;
    this.securityScope = securityScope;
  }

  /**
   * Perform the attestation handshake with the SEAL Gateway.
   */
  public async attest(): Promise<AttestationResult> {
    this.key = Ed25519Key.generate();

    const response = await fetch(`${this.gatewayUrl}/v1/seal/attest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        public_key: this.key.getPublicKeyBase64(),
        workload_id: this.workloadId,
        security_context: this.securityScope,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null) as AttestationResponse | null;
      if (errorData?.error) {
        throw new SEALError(`Attestation failed: ${errorData.error.message ?? 'Unknown error'}`);
      }
      throw new SEALError(`Attestation failed: HTTP ${response.status}`);
    }

    const data = (await response.json()) as AttestationResponse;
    if (data.status === 'error') {
      throw new SEALError(`Attestation failed: ${data.message ?? 'Unknown error'}`);
    }

    this.securityToken = data.security_token ?? null;
    this.expiresAt = data.expires_at ?? null;
    this.sessionId = data.session_id ?? null;

    return {
      security_token: this.securityToken as string,
      expires_at: this.expiresAt as string,
      session_id: this.sessionId ?? undefined,
    };
  }

  /**
   * Make a SEAL-wrapped JSON-RPC tool call through the Gateway.
   */
  public async callTool(
    toolName: string,
    argumentsObj: Record<string, unknown>,
  ): Promise<unknown> {
    if (!this.securityToken || !this.key) {
      throw new SEALError('No security token available. Must call attest() first.');
    }

    const reqId = `req-${crypto.randomBytes(4).toString('hex')}`;
    const mcpPayload: McpPayload = {
      jsonrpc: '2.0',
      id: reqId,
      method: 'tools/call',
      params: { name: toolName, arguments: argumentsObj },
    };

    const envelope = createSealEnvelope(this.securityToken, mcpPayload, this.key);

    const response = await fetch(`${this.gatewayUrl}/v1/seal/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(envelope),
    });

    const responseData = await response.json().catch(() => null) as InvokeResponse | null;

    if (!response.ok) {
      if (responseData?.error?.message) {
        throw new SEALError(`SEAL Gateway Rejected: ${responseData.error.message}`);
      }
      throw new SEALError(`SEAL Gateway error: HTTP ${response.status}`);
    }

    if (responseData?.status === 'error') {
      throw new SEALError(`SEAL Gateway Error: ${responseData.error?.message ?? 'Unknown error'}`);
    }

    if (responseData?.payload && 'error' in responseData.payload) {
      throw new SEALError(`MCP Tool Error: ${String(responseData.payload.error)}`);
    }

    return responseData?.payload?.result ?? {};
  }

  /**
   * Zero out the ephemeral private key bytes.
   */
  public dispose(): void {
    if (this.key) {
      this.key.erase();
      this.key = null;
    }
  }
}
