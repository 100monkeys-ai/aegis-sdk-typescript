import axios, { AxiosInstance } from "axios";
import {
  ApprovalRequest,
  ApprovalResponse,
  PendingApproval,
  RateLimitOverride,
  RejectionRequest,
  SealAttestationResponse,
  SealToolsResponse,
  StartExecutionResponse,
  Tenant,
  UsageRecord,
  WorkflowExecutionLogs,
} from "./types";

export interface AegisClientOptions {
  baseUrl: string;
  keycloakUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  tokenRefreshBufferSecs?: number; // default: 30
}

/**
 * Client for interacting with the AEGIS orchestrator.
 */
export class AegisClient {
  private readonly client: AxiosInstance;
  private readonly tokenUrl: string;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshBufferMs: number;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0; // ms epoch

  constructor(options: AegisClientOptions) {
    this.tokenUrl = `${options.keycloakUrl.replace(/\/$/, "")}/realms/${options.realm}/protocol/openid-connect/token`;
    this.clientId = options.clientId;
    this.clientSecret = options.clientSecret;
    this.refreshBufferMs = (options.tokenRefreshBufferSecs ?? 30) * 1000;
    this.client = axios.create({ baseURL: options.baseUrl });
    this.client.interceptors.request.use(async (config) => {
      await this.ensureToken();
      config.headers.Authorization = `Bearer ${this.accessToken}`;
      return config;
    });
  }

  private async fetchToken(): Promise<void> {
    const params = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: this.clientId,
      client_secret: this.clientSecret,
    });
    const response = await axios.post<{
      access_token: string;
      expires_in: number;
    }>(this.tokenUrl, params, {
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
    this.accessToken = response.data.access_token;
    this.tokenExpiresAt =
      Date.now() + response.data.expires_in * 1000 - this.refreshBufferMs;
  }

  private async ensureToken(): Promise<void> {
    if (!this.accessToken || Date.now() >= this.tokenExpiresAt) {
      await this.fetchToken();
    }
  }

  // --- Execution ---

  /**
   * Start a new execution. POST /v1/executions
   */
  async startExecution(
    agentId: string,
    input: string,
    contextOverrides?: any,
    intent?: string,
  ): Promise<StartExecutionResponse> {
    const payload: any = { agent_id: agentId, input };
    if (contextOverrides !== undefined)
      payload.context_overrides = contextOverrides;
    if (intent !== undefined) payload.intent = intent;
    const response = await this.client.post("/v1/executions", payload);
    return response.data;
  }

  /**
   * Stream SSE events for an execution. GET /v1/executions/{id}/stream
   */
  async streamExecution(executionId: string, token?: string): Promise<any> {
    const response = await this.client.get(
      `/v1/executions/${executionId}/stream`,
      {
        params: token ? { token } : {},
        responseType: "stream",
      },
    );
    return response.data;
  }

  // --- Human Approvals ---

  /**
   * List pending approval requests. GET /v1/human-approvals
   */
  async listPendingApprovals(): Promise<{
    pending_requests: PendingApproval[];
    count: number;
  }> {
    const response = await this.client.get("/v1/human-approvals");
    return response.data;
  }

  /**
   * Get a specific pending approval. GET /v1/human-approvals/{id}
   */
  async getPendingApproval(id: string): Promise<{ request: PendingApproval }> {
    const response = await this.client.get(`/v1/human-approvals/${id}`);
    return response.data;
  }

  /**
   * Approve a pending request. POST /v1/human-approvals/{id}/approve
   */
  async approveRequest(
    id: string,
    request: ApprovalRequest = {},
  ): Promise<ApprovalResponse> {
    const response = await this.client.post(
      `/v1/human-approvals/${id}/approve`,
      request,
    );
    return response.data;
  }

  /**
   * Reject a pending request. POST /v1/human-approvals/{id}/reject
   */
  async rejectRequest(
    id: string,
    request: RejectionRequest,
  ): Promise<ApprovalResponse> {
    const response = await this.client.post(
      `/v1/human-approvals/${id}/reject`,
      request,
    );
    return response.data;
  }

  // --- SEAL ---

  /**
   * Attest a SEAL security token. POST /v1/seal/attest
   */
  async attestSeal(payload: any): Promise<SealAttestationResponse> {
    const response = await this.client.post("/v1/seal/attest", payload);
    return response.data;
  }

  /**
   * Invoke a SEAL tool. POST /v1/seal/invoke
   */
  async invokeSeal(payload: any): Promise<any> {
    const response = await this.client.post("/v1/seal/invoke", payload);
    return response.data;
  }

  /**
   * List available SEAL tools. GET /v1/seal/tools
   */
  async listSealTools(securityContext?: string): Promise<SealToolsResponse> {
    const params: any = {};
    const headers: any = {};
    if (securityContext) {
      params.security_context = securityContext;
      headers["X-Zaru-Security-Context"] = securityContext;
    }
    const response = await this.client.get("/v1/seal/tools", {
      params,
      headers,
    });
    return response.data;
  }

  // --- Dispatch Gateway ---

  /**
   * Dispatch a message to the inner loop gateway. POST /v1/dispatch-gateway
   */
  async dispatchGateway(payload: any): Promise<any> {
    const response = await this.client.post("/v1/dispatch-gateway", payload);
    return response.data;
  }

  // --- Stimulus ---

  /**
   * Ingest an external stimulus. POST /v1/stimuli
   */
  async ingestStimulus(payload: any): Promise<any> {
    const response = await this.client.post("/v1/stimuli", payload);
    return response.data;
  }

  /**
   * Send a webhook event. POST /v1/webhooks/{source}
   */
  async sendWebhook(source: string, payload: any): Promise<any> {
    const response = await this.client.post(`/v1/webhooks/${source}`, payload);
    return response.data;
  }

  // --- Workflow Logs ---

  /**
   * Get workflow execution logs. GET /v1/workflows/executions/{id}/logs
   */
  async getWorkflowExecutionLogs(
    executionId: string,
    limit?: number,
    offset?: number,
  ): Promise<WorkflowExecutionLogs> {
    const response = await this.client.get(
      `/v1/workflows/executions/${executionId}/logs`,
      {
        params: { limit, offset },
      },
    );
    return response.data;
  }

  /**
   * Stream workflow execution logs via SSE. GET /v1/workflows/executions/{id}/logs/stream
   */
  async streamWorkflowExecutionLogs(executionId: string): Promise<any> {
    const response = await this.client.get(
      `/v1/workflows/executions/${executionId}/logs/stream`,
      { responseType: "stream" },
    );
    return response.data;
  }

  // --- Admin: Tenant Management ---

  /**
   * Create a new tenant. POST /v1/admin/tenants
   */
  async createTenant(
    slug: string,
    displayName: string,
    tier: string = "enterprise",
  ): Promise<Tenant> {
    const response = await this.client.post("/v1/admin/tenants", {
      slug,
      display_name: displayName,
      tier,
    });
    return response.data;
  }

  /**
   * List all tenants. GET /v1/admin/tenants
   */
  async listTenants(): Promise<{ tenants: Tenant[]; count: number }> {
    const response = await this.client.get("/v1/admin/tenants");
    return response.data;
  }

  /**
   * Suspend a tenant. POST /v1/admin/tenants/{slug}/suspend
   */
  async suspendTenant(slug: string): Promise<{ status: string; slug: string }> {
    const response = await this.client.post(
      `/v1/admin/tenants/${slug}/suspend`,
    );
    return response.data;
  }

  /**
   * Soft-delete a tenant. DELETE /v1/admin/tenants/{slug}
   */
  async deleteTenant(slug: string): Promise<{ status: string; slug: string }> {
    const response = await this.client.delete(`/v1/admin/tenants/${slug}`);
    return response.data;
  }

  // --- Admin: Rate Limits ---

  /**
   * List rate limit overrides. GET /v1/admin/rate-limits/overrides
   */
  async listRateLimitOverrides(
    tenantId?: string,
    userId?: string,
  ): Promise<{ overrides: RateLimitOverride[]; count: number }> {
    const response = await this.client.get("/v1/admin/rate-limits/overrides", {
      params: { tenant_id: tenantId, user_id: userId },
    });
    return response.data;
  }

  /**
   * Create or update a rate limit override. POST /v1/admin/rate-limits/overrides
   */
  async createRateLimitOverride(payload: any): Promise<RateLimitOverride> {
    const response = await this.client.post(
      "/v1/admin/rate-limits/overrides",
      payload,
    );
    return response.data;
  }

  /**
   * Delete a rate limit override. DELETE /v1/admin/rate-limits/overrides/{id}
   */
  async deleteRateLimitOverride(
    overrideId: string,
  ): Promise<{ status: string; id: string }> {
    const response = await this.client.delete(
      `/v1/admin/rate-limits/overrides/${overrideId}`,
    );
    return response.data;
  }

  /**
   * Get rate limit usage. GET /v1/admin/rate-limits/usage
   */
  async getRateLimitUsage(
    scopeType: string,
    scopeId: string,
  ): Promise<{ usage: UsageRecord[]; count: number }> {
    const response = await this.client.get("/v1/admin/rate-limits/usage", {
      params: { scope_type: scopeType, scope_id: scopeId },
    });
    return response.data;
  }

  // --- Health ---

  /**
   * Liveness check. GET /health/live
   */
  async healthLive(): Promise<{ status: string }> {
    const response = await this.client.get("/health/live");
    return response.data;
  }

  /**
   * Readiness check. GET /health/ready
   */
  async healthReady(): Promise<{ status: string }> {
    const response = await this.client.get("/health/ready");
    return response.data;
  }
}
