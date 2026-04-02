/**
 * Common types used across the SDK.
 */

// --- Execution ---

export interface StartExecutionRequest {
  agent_id: string;
  input: string;
  context_overrides?: any;
}

export interface StartExecutionResponse {
  execution_id: string;
}

export interface ExecutionEvent {
  event_type: string;
  data: any;
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
  protocol?: string;
  timestamp?: string;
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
