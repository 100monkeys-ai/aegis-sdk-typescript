/**
 * Common types used across the SDK.
 */

export interface DeploymentResponse {
  agent_id: string;
  status: string;
}

export interface TaskInput {
  prompt: string;
  context?: any;
}

export interface TaskOutput {
  result: any;
  logs: string[];
}

export interface AgentStatus {
  agent_id: string;
  state: AgentState;
  uptime_seconds: number;
}

export enum AgentState {
  Cold = 'cold',
  Warm = 'warm',
  Hot = 'hot',
  Failed = 'failed',
  Terminated = 'terminated',
}

export type AgentId = string;
export type SwarmId = string;
