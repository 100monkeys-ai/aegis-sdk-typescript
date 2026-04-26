import axios, { AxiosInstance } from "axios";
import {
  AddGrantRequest,
  AgentDetail,
  AgentListResponse,
  AgentVersionListResponse,
  ApiKey,
  ApiKeyWithValue,
  ApprovalRequest,
  ApprovalResponse,
  AttachmentRef,
  ClusterNodesResponse,
  ClusterStatus,
  ColonyMember,
  CortexMetrics,
  CortexPattern,
  CortexSkill,
  CredentialGrant,
  CredentialSummary,
  DashboardSummary,
  DeployAgentResponse,
  DevicePollResponse,
  ExecuteAgentResponse,
  ExecuteWorkflowResponse,
  ExecutionDetail,
  ExecutionListResponse,
  OAuthInitiateResponse,
  PendingApproval,
  RateLimitOverride,
  RegisterWorkflowResponse,
  RejectionRequest,
  RotateCredentialRequest,
  SamlConfigRequest,
  SamlIdpConfig,
  SealAttestationResponse,
  SealToolsResponse,
  SecretEntry,
  SecretValue,
  SecurityIncident,
  StartExecutionResponse,
  StimulusListResponse,
  StimulusSummary,
  StorageViolation,
  PricingResponse,
  Subscription,
  SwarmListResponse,
  SwarmSummary,
  Tenant,
  UploadFileResponse,
  UsageRecord,
  UserRateLimitUsage,
  Volume,
  VolumeFileEntry,
  VolumeListResponse,
  VolumeQuota,
  WorkflowExecutionListResponse,
  WorkflowExecutionLogs,
  WorkflowExecutionSummary,
  WorkflowListResponse,
  WorkflowSummary,
  WorkflowVersionListResponse,
} from "./types";
import {
  AttachToVolumeOptions,
  AttachmentSource,
  attachToVolume as attachToVolumeImpl,
} from "./uploads";

export interface AegisClientOptions {
  baseUrl: string;
  bearerToken?: string;
  keycloakUrl?: string;
  realm?: string;
  clientId?: string;
  clientSecret?: string;
  tokenRefreshBufferSecs?: number; // default: 30
}

/**
 * Client for interacting with the AEGIS orchestrator.
 */
export class AegisClient {
  private readonly client: AxiosInstance;
  private readonly tokenUrl: string | null;
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly refreshBufferMs: number;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0; // ms epoch

  constructor(options: AegisClientOptions) {
    this.client = axios.create({ baseURL: options.baseUrl });

    if (options.bearerToken) {
      this.tokenUrl = null;
      this.clientId = "";
      this.clientSecret = "";
      this.refreshBufferMs = 0;
      this.client.defaults.headers.common["Authorization"] =
        `Bearer ${options.bearerToken}`;
    } else {
      this.tokenUrl = `${options.keycloakUrl!.replace(/\/$/, "")}/realms/${options.realm!}/protocol/openid-connect/token`;
      this.clientId = options.clientId!;
      this.clientSecret = options.clientSecret!;
      this.refreshBufferMs = (options.tokenRefreshBufferSecs ?? 30) * 1000;
      this.client.interceptors.request.use(async (config) => {
        await this.ensureToken();
        config.headers.Authorization = `Bearer ${this.accessToken}`;
        return config;
      });
    }
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
    }>(this.tokenUrl!, params, {
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

  // ---------------------------------------------------------------------------
  // Agent Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * List agents. GET /v1/agents
   */
  async listAgents(options?: {
    scope?: string;
    limit?: number;
    agent_type?: string;
  }): Promise<AgentListResponse> {
    const response = await this.client.get("/v1/agents", {
      params: options,
    });
    return response.data;
  }

  /**
   * Get agent details. GET /v1/agents/{id}
   */
  async getAgent(id: string): Promise<AgentDetail> {
    const response = await this.client.get(`/v1/agents/${id}`);
    return response.data;
  }

  /**
   * Deploy an agent from a manifest. POST /v1/agents
   */
  async deployAgent(
    manifest: string,
    options?: { force?: boolean; scope?: string },
  ): Promise<DeployAgentResponse> {
    const isJson =
      manifest.trimStart().startsWith("{") ||
      manifest.trimStart().startsWith("[");
    const response = await this.client.post("/v1/agents", manifest, {
      params: options,
      headers: {
        "Content-Type": isJson ? "application/json" : "text/yaml",
      },
    });
    return response.data;
  }

  /**
   * Update an agent. PATCH /v1/agents/{id}
   */
  async updateAgent(
    id: string,
    update: Record<string, unknown>,
  ): Promise<AgentDetail> {
    const response = await this.client.patch(`/v1/agents/${id}`, update);
    return response.data;
  }

  /**
   * Delete an agent. DELETE /v1/agents/{id}
   */
  async deleteAgent(id: string): Promise<{ status: string }> {
    const response = await this.client.delete(`/v1/agents/${id}`);
    return response.data;
  }

  /**
   * Look up an agent by name. GET /v1/agents/lookup/{name}
   */
  async lookupAgent(name: string): Promise<AgentDetail> {
    const response = await this.client.get(`/v1/agents/lookup/${name}`);
    return response.data;
  }

  /**
   * Execute an agent. POST /v1/agents/{agentId}/execute
   *
   * `attachments` is wired through to `ExecuteAgentRequest.attachments` on
   * the proto (per ADR-113). Each ref is typically obtained from
   * {@link attachToVolume}.
   */
  async executeAgent(
    agentId: string,
    input: string,
    intent?: string,
    contextOverrides?: unknown,
    attachments?: AttachmentRef[],
  ): Promise<ExecuteAgentResponse> {
    const payload: any = { input };
    if (intent !== undefined) payload.intent = intent;
    if (contextOverrides !== undefined)
      payload.context_overrides = contextOverrides;
    if (attachments && attachments.length > 0)
      payload.attachments = attachments;
    const response = await this.client.post(
      `/v1/agents/${agentId}/execute`,
      payload,
    );
    return response.data;
  }

  /**
   * List agent versions. GET /v1/agents/{id}/versions
   */
  async listAgentVersions(
    id: string,
    limit?: number,
  ): Promise<AgentVersionListResponse> {
    const response = await this.client.get(`/v1/agents/${id}/versions`, {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Update agent scope. POST /v1/agents/{id}/scope
   */
  async updateAgentScope(id: string, scope: string): Promise<AgentDetail> {
    const response = await this.client.post(`/v1/agents/${id}/scope`, {
      scope,
    });
    return response.data;
  }

  /**
   * Stream agent events via SSE. GET /v1/agents/{agentId}/events
   */
  async streamAgentEvents(agentId: string): Promise<any> {
    const response = await this.client.get(`/v1/agents/${agentId}/events`, {
      responseType: "stream",
    });
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Execution Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * Start a new execution. POST /v1/executions
   *
   * `attachments` is wired through to `ExecuteAgentRequest.attachments` on
   * the proto (per ADR-113). Each ref is typically obtained from
   * {@link attachToVolume}.
   */
  async startExecution(
    agentId: string,
    input: string,
    contextOverrides?: any,
    intent?: string,
    attachments?: AttachmentRef[],
  ): Promise<StartExecutionResponse> {
    const payload: any = { agent_id: agentId, input };
    if (contextOverrides !== undefined)
      payload.context_overrides = contextOverrides;
    if (intent !== undefined) payload.intent = intent;
    if (attachments && attachments.length > 0)
      payload.attachments = attachments;
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

  /**
   * List executions. GET /v1/executions
   */
  async listExecutions(options?: {
    agent_id?: string;
    workflow_name?: string;
    limit?: number;
    offset?: number;
    status?: string;
  }): Promise<ExecutionListResponse> {
    const response = await this.client.get("/v1/executions", {
      params: options,
    });
    return response.data;
  }

  /**
   * Get execution details. GET /v1/executions/{executionId}
   */
  async getExecution(executionId: string): Promise<ExecutionDetail> {
    const response = await this.client.get(`/v1/executions/${executionId}`);
    return response.data;
  }

  /**
   * Cancel an execution. POST /v1/executions/{executionId}/cancel
   */
  async cancelExecution(
    executionId: string,
    reason?: string,
  ): Promise<{ status: string }> {
    const response = await this.client.post(
      `/v1/executions/${executionId}/cancel`,
      { reason },
    );
    return response.data;
  }

  /**
   * Delete an execution. DELETE /v1/executions/{executionId}
   */
  async deleteExecution(executionId: string): Promise<{ status: string }> {
    const response = await this.client.delete(`/v1/executions/${executionId}`);
    return response.data;
  }

  /**
   * Download a file from an execution. GET /v1/executions/{executionId}/files/{path}
   */
  async getExecutionFile(
    executionId: string,
    path: string,
  ): Promise<ArrayBuffer> {
    const response = await this.client.get(
      `/v1/executions/${executionId}/files/${path}`,
      { responseType: "arraybuffer" },
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Workflow Orchestration
  // ---------------------------------------------------------------------------

  /**
   * List workflows. GET /v1/workflows
   */
  async listWorkflows(options?: {
    scope?: string;
    limit?: number;
    visible?: boolean;
  }): Promise<WorkflowListResponse> {
    const response = await this.client.get("/v1/workflows", {
      params: options,
    });
    return response.data;
  }

  /**
   * Get workflow details. GET /v1/workflows/{name}
   */
  async getWorkflow(name: string): Promise<WorkflowSummary> {
    const response = await this.client.get(`/v1/workflows/${name}`);
    return response.data;
  }

  /**
   * Get workflow definition as YAML. GET /v1/workflows/{name} with Accept: text/plain
   */
  async getWorkflowYaml(name: string): Promise<string> {
    const response = await this.client.get(`/v1/workflows/${name}`, {
      headers: { Accept: "text/plain" },
    });
    return response.data;
  }

  /**
   * Register a workflow from YAML. POST /v1/workflows
   */
  async registerWorkflow(
    yaml: string,
    options?: { scope?: string; force?: boolean },
  ): Promise<RegisterWorkflowResponse> {
    const response = await this.client.post("/v1/workflows", yaml, {
      params: options,
      headers: { "Content-Type": "text/yaml" },
    });
    return response.data;
  }

  /**
   * Delete a workflow. DELETE /v1/workflows/{name}
   */
  async deleteWorkflow(name: string): Promise<{ status: string }> {
    const response = await this.client.delete(`/v1/workflows/${name}`);
    return response.data;
  }

  /**
   * List workflow versions. GET /v1/workflows/{name}/versions
   */
  async listWorkflowVersions(
    name: string,
    limit?: number,
  ): Promise<WorkflowVersionListResponse> {
    const response = await this.client.get(`/v1/workflows/${name}/versions`, {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Update workflow scope. POST /v1/workflows/{name}/scope
   */
  async updateWorkflowScope(
    name: string,
    scope: string,
  ): Promise<WorkflowSummary> {
    const response = await this.client.post(`/v1/workflows/${name}/scope`, {
      scope,
    });
    return response.data;
  }

  /**
   * Run a workflow. POST /v1/workflows/{name}/run
   */
  async runWorkflow(
    name: string,
    input?: unknown,
    contextOverrides?: unknown,
  ): Promise<{ execution_id: string; status: string }> {
    const payload: any = {};
    if (input !== undefined) payload.input = input;
    if (contextOverrides !== undefined)
      payload.context_overrides = contextOverrides;
    const response = await this.client.post(
      `/v1/workflows/${name}/run`,
      payload,
    );
    return response.data;
  }

  /**
   * Execute a workflow via Temporal. POST /v1/workflows/temporal/execute
   *
   * `attachments` is wired through to the workflow execution input per
   * ADR-113. Each ref is typically obtained from {@link attachToVolume}.
   */
  async executeWorkflow(
    workflowName: string,
    input?: unknown,
    version?: string,
    timeout?: number,
    attachments?: AttachmentRef[],
  ): Promise<ExecuteWorkflowResponse> {
    const payload: any = { workflow_name: workflowName };
    if (input !== undefined) payload.input = input;
    if (version !== undefined) payload.version = version;
    if (timeout !== undefined) payload.timeout = timeout;
    if (attachments && attachments.length > 0)
      payload.attachments = attachments;
    const response = await this.client.post(
      "/v1/workflows/temporal/execute",
      payload,
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Workflow Execution Lifecycle
  // ---------------------------------------------------------------------------

  /**
   * List workflow executions. GET /v1/workflows/executions
   */
  async listWorkflowExecutions(options?: {
    workflow_name?: string;
    limit?: number;
    status?: string;
  }): Promise<WorkflowExecutionListResponse> {
    const response = await this.client.get("/v1/workflows/executions", {
      params: options,
    });
    return response.data;
  }

  /**
   * Get a workflow execution. GET /v1/workflows/executions/{executionId}
   */
  async getWorkflowExecution(
    executionId: string,
  ): Promise<WorkflowExecutionSummary> {
    const response = await this.client.get(
      `/v1/workflows/executions/${executionId}`,
    );
    return response.data;
  }

  /**
   * Delete a workflow execution. DELETE /v1/workflows/executions/{executionId}
   */
  async deleteWorkflowExecution(
    executionId: string,
  ): Promise<{ status: string }> {
    const response = await this.client.delete(
      `/v1/workflows/executions/${executionId}`,
    );
    return response.data;
  }

  /**
   * Signal a workflow execution. POST /v1/workflows/executions/{executionId}/signal
   */
  async signalWorkflowExecution(
    executionId: string,
    signalName: string,
    payload?: unknown,
  ): Promise<{ status: string }> {
    const response = await this.client.post(
      `/v1/workflows/executions/${executionId}/signal`,
      { signal_name: signalName, payload },
    );
    return response.data;
  }

  /**
   * Cancel a workflow execution. POST /v1/workflows/executions/{executionId}/cancel
   */
  async cancelWorkflowExecution(
    executionId: string,
    reason?: string,
  ): Promise<{ status: string }> {
    const response = await this.client.post(
      `/v1/workflows/executions/${executionId}/cancel`,
      { reason },
    );
    return response.data;
  }

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

  // ---------------------------------------------------------------------------
  // Volumes
  // ---------------------------------------------------------------------------

  /**
   * Create a volume. POST /v1/volumes
   */
  async createVolume(label: string, sizeLimitBytes?: number): Promise<Volume> {
    const response = await this.client.post("/v1/volumes", {
      label,
      size_limit_bytes: sizeLimitBytes,
    });
    return response.data;
  }

  /**
   * List volumes. GET /v1/volumes
   */
  async listVolumes(limit?: number): Promise<VolumeListResponse> {
    const response = await this.client.get("/v1/volumes", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get a volume. GET /v1/volumes/{id}
   */
  async getVolume(id: string): Promise<Volume> {
    const response = await this.client.get(`/v1/volumes/${id}`);
    return response.data;
  }

  /**
   * Rename a volume. PATCH /v1/volumes/{id}
   */
  async renameVolume(id: string, label: string): Promise<Volume> {
    const response = await this.client.patch(`/v1/volumes/${id}`, { label });
    return response.data;
  }

  /**
   * Delete a volume. DELETE /v1/volumes/{id}
   */
  async deleteVolume(id: string): Promise<{ status: string }> {
    const response = await this.client.delete(`/v1/volumes/${id}`);
    return response.data;
  }

  /**
   * Get volume quota. GET /v1/volumes/quota
   */
  async getQuota(): Promise<VolumeQuota> {
    const response = await this.client.get("/v1/volumes/quota");
    return response.data;
  }

  /**
   * List files in a volume. GET /v1/volumes/{id}/files
   */
  async listFiles(
    volumeId: string,
    path?: string,
  ): Promise<{ entries: VolumeFileEntry[] }> {
    const response = await this.client.get(`/v1/volumes/${volumeId}/files`, {
      params: { path },
    });
    return response.data;
  }

  /**
   * Download a file from a volume. GET /v1/volumes/{id}/files/download
   */
  async downloadFile(volumeId: string, path: string): Promise<ArrayBuffer> {
    const response = await this.client.get(
      `/v1/volumes/${volumeId}/files/download`,
      {
        params: { path },
        responseType: "arraybuffer",
      },
    );
    return response.data;
  }

  /**
   * Stream a file to a user volume and return a structured `AttachmentRef`.
   *
   * Per ADR-113, lifetime is named explicitly by the volume the caller
   * chooses — there is no implicit default. Pass
   * `volumeId="chat-attachments"` to use the reserved per-user volume
   * (lazy-provisioned by the orchestrator on first upload). Any other
   * name must already exist.
   *
   * The returned `AttachmentRef` carries the orchestrator's authoritative
   * `mime_type` (it content-sniffs server-side and may correct the
   * client-inferred value), `size`, and (when available) `sha256`. Pass
   * it through `executeAgent`, `startExecution`, or `executeWorkflow`
   * via the `attachments` parameter.
   */
  async attachToVolume(
    volumeId: string,
    source: AttachmentSource,
    options?: AttachToVolumeOptions,
  ): Promise<AttachmentRef> {
    return attachToVolumeImpl(this.client, volumeId, source, options);
  }

  /**
   * Upload a file to a volume. POST /v1/volumes/{id}/files/upload
   */
  async uploadFile(
    volumeId: string,
    path: string,
    file: Buffer | Blob,
  ): Promise<UploadFileResponse> {
    const formData = new FormData();
    formData.append("file", file as any);
    const response = await this.client.post(
      `/v1/volumes/${volumeId}/files/upload`,
      formData,
      {
        params: { path },
        headers: { "Content-Type": "multipart/form-data" },
      },
    );
    return response.data;
  }

  /**
   * Create a directory in a volume. POST /v1/volumes/{id}/files/mkdir
   */
  async mkdir(
    volumeId: string,
    path: string,
  ): Promise<{ path: string; created_at: string }> {
    const response = await this.client.post(
      `/v1/volumes/${volumeId}/files/mkdir`,
      { path },
    );
    return response.data;
  }

  /**
   * Move a path within a volume. POST /v1/volumes/{id}/files/move
   */
  async movePath(
    volumeId: string,
    from: string,
    to: string,
  ): Promise<{ from: string; to: string; moved_at: string }> {
    const response = await this.client.post(
      `/v1/volumes/${volumeId}/files/move`,
      { from, to },
    );
    return response.data;
  }

  /**
   * Delete a path in a volume. DELETE /v1/volumes/{id}/files
   */
  async deletePath(
    volumeId: string,
    path: string,
  ): Promise<{ status: string }> {
    const response = await this.client.delete(`/v1/volumes/${volumeId}/files`, {
      params: { path },
    });
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Credentials
  // ---------------------------------------------------------------------------

  /**
   * List credentials. GET /v1/credentials
   */
  async listCredentials(): Promise<{
    credentials: CredentialSummary[];
    count: number;
  }> {
    const response = await this.client.get("/v1/credentials");
    return response.data;
  }

  /**
   * Store an API key credential. POST /v1/credentials/api-keys
   */
  async storeApiKeyCredential(
    provider: string,
    apiKeyValue: string,
    metadata?: Record<string, unknown>,
  ): Promise<CredentialSummary> {
    const response = await this.client.post("/v1/credentials/api-keys", {
      provider,
      api_key_value: apiKeyValue,
      metadata,
    });
    return response.data;
  }

  /**
   * Initiate OAuth flow. POST /v1/credentials/oauth/initiate
   */
  async oauthInitiate(
    provider: string,
    redirectUri?: string,
    scopes?: string[],
  ): Promise<OAuthInitiateResponse> {
    const response = await this.client.post("/v1/credentials/oauth/initiate", {
      provider,
      redirect_uri: redirectUri,
      scopes,
    });
    return response.data;
  }

  /**
   * Handle OAuth callback. GET /v1/credentials/oauth/callback
   */
  async oauthCallback(
    code: string,
    state: string,
  ): Promise<{ credential_id: string; stored: boolean }> {
    const response = await this.client.get("/v1/credentials/oauth/callback", {
      params: { code, state },
    });
    return response.data;
  }

  /**
   * Poll device authorization. POST /v1/credentials/oauth/device/poll
   */
  async devicePoll(
    deviceCode: string,
    provider: string,
  ): Promise<DevicePollResponse> {
    const response = await this.client.post(
      "/v1/credentials/oauth/device/poll",
      {
        device_code: deviceCode,
        provider,
      },
    );
    return response.data;
  }

  /**
   * Get a credential. GET /v1/credentials/{id}
   */
  async getCredential(id: string): Promise<CredentialSummary> {
    const response = await this.client.get(`/v1/credentials/${id}`);
    return response.data;
  }

  /**
   * Revoke a credential. DELETE /v1/credentials/{id}
   */
  async revokeCredential(id: string): Promise<{ status: string }> {
    const response = await this.client.delete(`/v1/credentials/${id}`);
    return response.data;
  }

  /**
   * Rotate a credential. POST /v1/credentials/{id}/rotate
   */
  async rotateCredential(
    id: string,
    request?: RotateCredentialRequest,
  ): Promise<CredentialSummary> {
    const response = await this.client.post(
      `/v1/credentials/${id}/rotate`,
      request,
    );
    return response.data;
  }

  /**
   * List grants for a credential. GET /v1/credentials/{id}/grants
   */
  async listGrants(
    credentialId: string,
  ): Promise<{ grants: CredentialGrant[]; count: number }> {
    const response = await this.client.get(
      `/v1/credentials/${credentialId}/grants`,
    );
    return response.data;
  }

  /**
   * Add a grant to a credential. POST /v1/credentials/{id}/grants
   */
  async addGrant(
    credentialId: string,
    grant: AddGrantRequest,
  ): Promise<CredentialGrant> {
    const response = await this.client.post(
      `/v1/credentials/${credentialId}/grants`,
      grant,
    );
    return response.data;
  }

  /**
   * Revoke a grant. DELETE /v1/credentials/{id}/grants/{grantId}
   */
  async revokeGrant(
    credentialId: string,
    grantId: string,
  ): Promise<{ status: string }> {
    const response = await this.client.delete(
      `/v1/credentials/${credentialId}/grants/${grantId}`,
    );
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Secrets
  // ---------------------------------------------------------------------------

  /**
   * List secrets. GET /v1/secrets
   */
  async listSecrets(pathPrefix?: string): Promise<{ secrets: SecretEntry[] }> {
    const response = await this.client.get("/v1/secrets", {
      params: { path_prefix: pathPrefix },
    });
    return response.data;
  }

  /**
   * Get a secret value. GET /v1/secrets/{path}
   */
  async getSecret(path: string): Promise<SecretValue> {
    const response = await this.client.get(`/v1/secrets/${path}`);
    return response.data;
  }

  /**
   * Write a secret. PUT /v1/secrets/{path}
   */
  async writeSecret(
    path: string,
    value: string,
    encoding?: "base64" | "plaintext",
  ): Promise<{ path: string; created_at?: string; updated_at?: string }> {
    const response = await this.client.put(`/v1/secrets/${path}`, {
      value,
      encoding,
    });
    return response.data;
  }

  /**
   * Delete a secret. DELETE /v1/secrets/{path}
   */
  async deleteSecret(path: string): Promise<{ status: string }> {
    const response = await this.client.delete(`/v1/secrets/${path}`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // API Keys
  // ---------------------------------------------------------------------------

  /**
   * List API keys. GET /v1/api-keys
   */
  async listApiKeys(): Promise<{ api_keys: ApiKey[] }> {
    const response = await this.client.get("/v1/api-keys");
    return response.data;
  }

  /**
   * Create an API key. POST /v1/api-keys
   */
  async createApiKey(
    name: string,
    scopes: string[],
    expiresAt?: string,
  ): Promise<ApiKeyWithValue> {
    const response = await this.client.post("/v1/api-keys", {
      name,
      scopes,
      expires_at: expiresAt,
    });
    return response.data;
  }

  /**
   * Revoke an API key. DELETE /v1/api-keys/{id}
   */
  async revokeApiKey(id: string): Promise<{ status: string }> {
    const response = await this.client.delete(`/v1/api-keys/${id}`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Colony
  // ---------------------------------------------------------------------------

  /**
   * List colony members. GET /v1/colony/members
   */
  async listMembers(
    limit?: number,
  ): Promise<{ members: ColonyMember[]; count: number }> {
    const response = await this.client.get("/v1/colony/members", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Invite a colony member. POST /v1/colony/members
   */
  async inviteMember(email: string, role: string): Promise<ColonyMember> {
    const response = await this.client.post("/v1/colony/members", {
      email,
      role,
    });
    return response.data;
  }

  /**
   * Remove a colony member. DELETE /v1/colony/members/{userId}
   */
  async removeMember(userId: string): Promise<{ status: string }> {
    const response = await this.client.delete(`/v1/colony/members/${userId}`);
    return response.data;
  }

  /**
   * Update a member's role. PUT /v1/colony/roles
   */
  async updateRole(userId: string, role: string): Promise<ColonyMember> {
    const response = await this.client.put("/v1/colony/roles", {
      user_id: userId,
      role,
    });
    return response.data;
  }

  /**
   * Get SAML IdP configuration. GET /v1/colony/saml
   */
  async getSamlConfig(): Promise<SamlIdpConfig> {
    const response = await this.client.get("/v1/colony/saml");
    return response.data;
  }

  /**
   * Set SAML IdP configuration. PUT /v1/colony/saml
   */
  async setSamlConfig(config: SamlConfigRequest): Promise<SamlIdpConfig> {
    const response = await this.client.put("/v1/colony/saml", config);
    return response.data;
  }

  /**
   * Get subscription details. GET /v1/colony/subscription
   */
  async getSubscription(): Promise<Subscription> {
    const response = await this.client.get("/v1/colony/subscription");
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Billing
  // ---------------------------------------------------------------------------

  /**
   * List available pricing tiers. GET /v1/billing/prices
   */
  async listPrices(): Promise<PricingResponse> {
    const response = await this.client.get("/v1/billing/prices");
    return response.data;
  }

  /**
   * Create a Stripe Checkout Session. POST /v1/billing/checkout
   */
  async createCheckoutSession(options: {
    price_id: string;
    seat_price_id?: string;
    seats?: number;
  }): Promise<{ url: string }> {
    const response = await this.client.post("/v1/billing/checkout", options);
    return response.data;
  }

  /**
   * Create a Stripe Customer Portal session. POST /v1/billing/portal
   */
  async createPortalSession(): Promise<{ url: string }> {
    const response = await this.client.post("/v1/billing/portal");
    return response.data;
  }

  /**
   * Get subscription billing details. GET /v1/billing/subscription
   */
  async getSubscriptionBilling(): Promise<{
    tier: string;
    status: string;
    current_period_end: string;
    cancel_at_period_end: boolean;
    stripe_customer_id: string;
  }> {
    const response = await this.client.get("/v1/billing/subscription");
    return response.data;
  }

  /**
   * List invoices. GET /v1/billing/invoices
   */
  async getInvoices(): Promise<{
    invoices: Array<{
      id: string;
      amount: number;
      currency: string;
      status: string;
      created: string;
      pdf_url: string;
    }>;
  }> {
    const response = await this.client.get("/v1/billing/invoices");
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Cluster
  // ---------------------------------------------------------------------------

  /**
   * Get cluster status. GET /v1/cluster/status
   */
  async getClusterStatus(): Promise<ClusterStatus> {
    const response = await this.client.get("/v1/cluster/status");
    return response.data;
  }

  /**
   * List cluster nodes. GET /v1/cluster/nodes
   */
  async listClusterNodes(limit?: number): Promise<ClusterNodesResponse> {
    const response = await this.client.get("/v1/cluster/nodes", {
      params: { limit },
    });
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Swarms
  // ---------------------------------------------------------------------------

  /**
   * List swarms. GET /v1/swarms
   */
  async listSwarms(limit?: number): Promise<SwarmListResponse> {
    const response = await this.client.get("/v1/swarms", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get a swarm. GET /v1/swarms/{swarmId}
   */
  async getSwarm(swarmId: string): Promise<SwarmSummary> {
    const response = await this.client.get(`/v1/swarms/${swarmId}`);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Stimuli
  // ---------------------------------------------------------------------------

  /**
   * Ingest an external stimulus. POST /v1/stimuli
   */
  async ingestStimulus(payload: any): Promise<any> {
    const response = await this.client.post("/v1/stimuli", payload);
    return response.data;
  }

  /**
   * List stimuli. GET /v1/stimuli
   */
  async listStimuli(limit?: number): Promise<StimulusListResponse> {
    const response = await this.client.get("/v1/stimuli", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get a stimulus. GET /v1/stimuli/{stimulusId}
   */
  async getStimulus(stimulusId: string): Promise<StimulusSummary> {
    const response = await this.client.get(`/v1/stimuli/${stimulusId}`);
    return response.data;
  }

  /**
   * Send a webhook event. POST /v1/webhooks/{source}
   */
  async sendWebhook(source: string, payload: any): Promise<any> {
    const response = await this.client.post(`/v1/webhooks/${source}`, payload);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Observability
  // ---------------------------------------------------------------------------

  /**
   * List security incidents. GET /v1/security/incidents
   */
  async listSecurityIncidents(
    limit?: number,
  ): Promise<{ items: SecurityIncident[]; count: number }> {
    const response = await this.client.get("/v1/security/incidents", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * List storage violations. GET /v1/storage/violations
   */
  async listStorageViolations(
    limit?: number,
  ): Promise<{ items: StorageViolation[]; count: number }> {
    const response = await this.client.get("/v1/storage/violations", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get dashboard summary. GET /v1/dashboard/summary
   */
  async getDashboardSummary(): Promise<DashboardSummary> {
    const response = await this.client.get("/v1/dashboard/summary");
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Cortex
  // ---------------------------------------------------------------------------

  /**
   * List Cortex patterns. GET /v1/cortex/patterns
   */
  async listCortexPatterns(
    query?: string,
    limit?: number,
  ): Promise<{ patterns: CortexPattern[] }> {
    const response = await this.client.get("/v1/cortex/patterns", {
      params: { q: query, limit },
    });
    return response.data;
  }

  /**
   * Get Cortex skills. GET /v1/cortex/skills
   */
  async getCortexSkills(limit?: number): Promise<{ skills: CortexSkill[] }> {
    const response = await this.client.get("/v1/cortex/skills", {
      params: { limit },
    });
    return response.data;
  }

  /**
   * Get Cortex metrics. GET /v1/cortex/metrics
   */
  async getCortexMetrics(metricType?: string): Promise<CortexMetrics> {
    const response = await this.client.get("/v1/cortex/metrics", {
      params: { metric_type: metricType },
    });
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // User
  // ---------------------------------------------------------------------------

  /**
   * Get user rate limit usage. GET /v1/user/rate-limits/usage
   */
  async getUserRateLimitUsage(): Promise<UserRateLimitUsage> {
    const response = await this.client.get("/v1/user/rate-limits/usage");
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Human Approvals
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // SEAL
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Dispatch Gateway
  // ---------------------------------------------------------------------------

  /**
   * Dispatch a message to the inner loop gateway. POST /v1/dispatch-gateway
   */
  async dispatchGateway(payload: any): Promise<any> {
    const response = await this.client.post("/v1/dispatch-gateway", payload);
    return response.data;
  }

  // ---------------------------------------------------------------------------
  // Admin: Tenant Management
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Admin: Rate Limits
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

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
