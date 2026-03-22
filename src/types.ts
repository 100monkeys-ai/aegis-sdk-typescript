import { AgentManifest } from './manifest';

/**
 * Common types used across the SDK.
 */

export interface DeploymentResponse {
  agent_id: string;
}

export interface TaskInput {
  prompt: string;
  context?: any;
}

export interface TaskOutput {
  result: any;
  logs: string[];
}

export interface AgentInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  status: string;
}

export enum AgentState {
  Cold = 'cold',
  Warm = 'warm',
  Hot = 'hot',
  Failed = 'failed',
  Terminated = 'terminated',
}

export interface ExecutionInfo {
  id: string;
  agent_id: string;
  status: string;
  started_at?: string;
  ended_at?: string;
}

export interface ExecutionEvent {
  event_type: string;
  timestamp: string;
  execution_id?: string;
  agent_id?: string;
  iteration_number?: number;
  action?: string;
  data: any;
}

export interface WorkflowInfo {
  name: string;
  version: string;
  description: string;
  status: string;
}

export interface WorkflowExecutionInfo {
  execution_id: string;
  workflow_id: string;
  status: string;
  current_state: string;
  started_at: string;
  last_transition_at: string;
  event_count?: number;
}

export interface PendingApproval {
  id: string;
  execution_id: string;
  prompt: string;
  created_at: string;
  timeout_seconds: number;
}

export interface StartWorkflowExecutionRequest {
  workflow_id: string;
  input: any;
  blackboard?: any;
  tenant_id?: string;
}

export interface ApprovalRequest {
  feedback?: string;
  approved_by?: string;
}

export interface RejectionRequest {
  reason: string;
  rejected_by?: string;
}

export interface AttestationRequest {
  agent_id: string;
  execution_id?: string;
  container_id: string;
  public_key: string;
}

export interface SmcpEnvelope {
  security_token: string;
  signature: string;
  payload: any;
}

export type AgentId = string;
export type SwarmId = string;
