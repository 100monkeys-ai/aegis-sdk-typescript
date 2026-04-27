/**
 * Common types used across the SDK.
 */

// --- Execution ---

export interface StartExecutionRequest {
  agent_id: string;
  input: string;
  intent?: string;
  context_overrides?: any;
}

export interface StartExecutionResponse {
  execution_id: string;
}

export interface ExecutionEvent {
  event_type: string;
  data: any;
}

export interface ExecutionSummary {
  id: string;
  agent_id?: string;
  workflow_name?: string;
  status: string;
  started_at: string;
  ended_at?: string;
  summary?: string | null;
}

export interface ExecutionDetail extends ExecutionSummary {
  input?: unknown;
  output?: unknown;
  error?: unknown;
}

export interface ExecutionListResponse {
  items: ExecutionSummary[];
  count: number;
}

// --- Agent Lifecycle ---

export interface AgentSummary {
  id: string;
  name: string;
  version: string;
  description?: string;
  scope: string;
  status: string;
  agent_type?: string;
  capability_tags?: string[];
  execution_count?: number;
  created_at: string;
  updated_at?: string;
}

export interface AgentDetail extends AgentSummary {
  manifest?: unknown;
  labels?: Record<string, string>;
  annotations?: Record<string, string>;
}

export interface AgentVersion {
  id: string;
  agent_id: string;
  version: string;
  deployed_at: string;
}

export interface AgentListResponse {
  items: AgentSummary[];
  count: number;
}

export interface AgentVersionListResponse {
  versions: AgentVersion[];
  count: number;
}

export interface DeployAgentResponse {
  id: string;
  agent_id: string;
  version: string;
  deployed_at: string;
}

export interface ExecuteAgentResponse {
  execution_id: string;
  status: string;
  output?: unknown;
}

export interface UpdateAgentScopeRequest {
  scope: "user" | "tenant" | "global";
}

// --- Workflow Orchestration ---

export interface WorkflowSummary {
  id: string;
  name: string;
  version: string;
  description?: string;
  scope: string;
  status?: string;
  labels?: Record<string, string>;
  execution_count?: number;
  created_at: string;
  updated_at?: string;
  tenant_id?: string;
}

export interface WorkflowListResponse {
  items: WorkflowSummary[];
  count: number;
}

export interface WorkflowVersion {
  id: string;
  name: string;
  version: string;
  registered_at: string;
}

export interface WorkflowVersionListResponse {
  versions: WorkflowVersion[];
  count: number;
}

export type RegisterWorkflowResponse = WorkflowVersion;

export interface ExecuteWorkflowRequest {
  workflow_id: string;
  input?: unknown;
}

export interface ExecuteWorkflowResponse {
  execution_id: string;
  workflow_id?: string;
  temporal_run_id?: string;
}

export interface WorkflowExecutionSummary {
  id: string;
  workflow_name: string;
  status: string;
  started_at: string;
  ended_at?: string;
  current_state?: string;
  summary?: string | null;
}

export interface WorkflowExecutionListResponse {
  items: WorkflowExecutionSummary[];
  count: number;
}

export interface WorkflowSignalRequest {
  signal_name: string;
  payload?: unknown;
}

// --- Human Approvals ---

export interface PendingApproval {
  id: string;
  execution_id: string;
  prompt: string;
  created_at: string;
  timeout_seconds: number;
}

export interface ApprovalRequest {
  feedback?: string;
  approved_by?: string;
}

export interface RejectionRequest {
  reason: string;
  rejected_by?: string;
}

export interface ApprovalResponse {
  status: string;
}

// --- SEAL ---

export interface SealAttestationRequest {
  agent_public_key: string;
  container_id?: string;
  agent_id?: string;
  execution_id?: string;
  security_context?: string;
  principal_subject?: string;
  user_id?: string;
  workload_id?: string;
  zaru_tier?: string;
  tenant_id?: string;
}

export interface SealAttestationResponse {
  status: string;
  security_token: string;
  expires_at: string;
  session_id?: string;
}

export interface SealToolInvokeRequest {
  security_token: string;
  signature: string;
  payload: any;
  protocol: string;
  timestamp: string;
}

export interface SealToolsResponse {
  protocol: string;
  attestation_endpoint: string;
  invoke_endpoint: string;
  security_context?: string;
  tools: any[];
}

// --- Workflow Logs ---

export interface WorkflowExecutionLogs {
  execution_id: string;
  events: any[];
  count: number;
  limit: number;
  offset: number;
}

// --- Admin: Tenants ---

export interface CreateTenantRequest {
  slug: string;
  display_name: string;
  tier?: string;
}

export interface TenantQuotas {
  max_concurrent_executions: number;
  max_agents: number;
  max_storage_gb: number;
}

export interface Tenant {
  slug: string;
  display_name: string;
  status: string;
  tier: string;
  keycloak_realm: string;
  openbao_namespace: string;
  quotas: TenantQuotas;
  created_at: string;
  updated_at: string;
  deleted_at?: string;
}

// --- Admin: Rate Limits ---

export interface CreateRateLimitOverrideRequest {
  resource_type: string;
  bucket: string;
  limit_value: number;
  tenant_id?: string;
  user_id?: string;
  burst_value?: number;
}

export interface RateLimitOverride {
  id: string;
  resource_type: string;
  bucket: string;
  limit_value: number;
  tenant_id?: string;
  user_id?: string;
  burst_value?: number;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  scope_type: string;
  scope_id: string;
  resource_type: string;
  bucket: string;
  window_start: string;
  counter: number;
}

// --- Volumes ---

export interface Volume {
  id: string;
  label: string;
  size_limit_bytes: number;
  used_bytes: number;
  created_at: string;
}

export interface VolumeListResponse {
  volumes: Volume[];
  total_count: number;
  total_quota_bytes?: number;
}

export interface VolumeQuota {
  quota_bytes: number;
  used_bytes: number;
  volume_count: number;
  volume_limit: number;
}

export interface VolumeFileEntry {
  name: string;
  type: "file" | "dir";
  size_bytes?: number;
  modified_at?: string;
}

export interface CreateVolumeRequest {
  label: string;
  size_limit_bytes?: number;
}

export interface RenameVolumeRequest {
  label: string;
}

export interface MovePathRequest {
  from: string;
  to: string;
}

export interface UploadFileResponse {
  name: string;
  size_bytes: number;
  uploaded_at: string;
}

/**
 * A structured reference to a file attached to an execution.
 *
 * Mirrors the `AttachmentRef` proto message carried on
 * `ExecuteAgentRequest.attachments`. Returned by
 * {@link AegisClient.attachToVolume} and accepted by `executeAgent`,
 * `startExecution`, and `executeWorkflow` via their `attachments`
 * parameter.
 */
export interface AttachmentRef {
  volume_id: string;
  path: string;
  name: string;
  mime_type: string;
  size: number;
  sha256?: string;
}

// --- Credentials ---

export interface CredentialSummary {
  id: string;
  provider: string;
  created_at: string;
  last_used?: string;
  scopes?: string[];
}

export interface CredentialGrant {
  id: string;
  credential_id: string;
  agent_id?: string;
  workflow_name?: string;
  permission_type: string;
  created_at: string;
}

export interface StoreApiKeyRequest {
  provider: string;
  api_key_value: string;
  metadata?: Record<string, unknown>;
}

export interface OAuthInitiateRequest {
  provider: string;
  redirect_uri?: string;
  scopes?: string[];
}

export interface OAuthInitiateResponse {
  auth_url: string;
  state_token: string;
  expires_at: string;
}

export interface DevicePollRequest {
  device_code: string;
  provider: string;
}

export interface DevicePollResponse {
  status: "pending" | "approved" | "denied";
  credential_id?: string;
}

export interface RotateCredentialRequest {
  new_value?: string;
  provider_params?: Record<string, unknown>;
}

export interface AddGrantRequest {
  agent_id?: string;
  workflow_name?: string;
  permission_type: string;
}

// --- Secrets ---

export interface SecretEntry {
  name: string;
  last_modified?: string;
  size_bytes?: number;
}

export interface SecretValue {
  value: string;
}

export interface WriteSecretRequest {
  value: string;
  encoding?: "base64" | "plaintext";
}

// --- API Keys ---

export interface ApiKey {
  id: string;
  name: string;
  created_at: string;
  expires_at?: string;
  last_used?: string;
}

export interface ApiKeyWithValue extends ApiKey {
  key_value: string;
}

export interface CreateApiKeyRequest {
  name: string;
  scopes: string[];
  expires_at?: string;
}

// --- Colony ---

export interface ColonyMember {
  id: string;
  email: string;
  role: string;
  invited_at?: string;
  status: string;
}

export interface InviteMemberRequest {
  email: string;
  role: string;
}

export interface UpdateRoleRequest {
  user_id: string;
  role: string;
}

export interface SamlIdpConfig {
  entity_id: string;
  sso_url: string;
  certificate?: string;
  configured: boolean;
}

export interface SamlConfigRequest {
  entity_id: string;
  sso_url: string;
  certificate: string;
}

export interface Subscription {
  tier: "free" | "pro" | "enterprise";
  features: string[];
  quota_usage?: unknown;
}

// --- Cluster ---

export interface ClusterNode {
  id: string;
  hostname?: string;
  status: string;
  last_heartbeat?: string;
  capacity?: unknown;
}

export interface ClusterStatus {
  nodes: ClusterNode[];
  overall_status: string;
  uptime?: number;
}

export interface ClusterNodesResponse {
  source: string;
  items: ClusterNode[];
}

// --- Swarms ---

export interface SwarmSummary {
  swarm_id: string;
  parent_execution_id?: string;
  member_ids: string[];
  status: string;
  lock_count?: number;
  recent_message_count?: number;
}

export interface SwarmListResponse {
  items: SwarmSummary[];
  count: number;
}

// --- Stimuli ---

export interface StimulusSummary {
  id: string;
  source?: string;
  content?: string;
  classification?: string;
  created_at: string;
  workflow_execution_id?: string;
}

export interface StimulusListResponse {
  items: StimulusSummary[];
  count: number;
}

// --- Observability ---

export interface SecurityIncident {
  id: string;
  type: string;
  severity?: string;
  details?: unknown;
  created_at: string;
}

export interface StorageViolation {
  id: string;
  volume_id?: string;
  type: string;
  details?: unknown;
  created_at: string;
}

export interface DashboardSummary {
  cluster?: unknown;
  swarm_count: number;
  stimulus_count: number;
  security_incident_count: number;
  storage_violation_count: number;
  execution_count: number;
  workflow_execution_count: number;
}

// --- Cortex ---

export interface CortexPattern {
  id: string;
  error_signature?: string;
  solution?: string;
  success_rate?: number;
  created_at: string;
}

export interface CortexSkill {
  id: string;
  description?: string;
  capability_tags?: string[];
}

export interface CortexMetrics {
  pattern_count: number;
  solution_count: number;
  avg_success_rate?: number;
}

// --- Billing ---

export interface TierPrice {
  price_id: string;
  amount: number;
  currency: string;
}

export interface TierPricing {
  tier: string;
  product_id: string;
  name: string;
  description: string;
  included_seats: number;
  monthly: TierPrice | null;
  annual: TierPrice | null;
  seat_monthly: TierPrice | null;
  seat_annual: TierPrice | null;
}

export interface PricingResponse {
  tiers: TierPricing[];
}

// --- User ---

export interface UserRateLimitUsage {
  user_id: string;
  buckets: { bucket_name: string; usage_pct: number }[];
}
