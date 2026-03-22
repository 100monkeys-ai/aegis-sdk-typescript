import axios, { AxiosInstance } from 'axios';
import {
  TaskInput,
  AgentInfo,
  DeploymentResponse,
  ExecutionInfo,
  WorkflowInfo,
  WorkflowExecutionInfo,
  PendingApproval,
  StartWorkflowExecutionRequest,
  ApprovalRequest,
  RejectionRequest,
  AttestationRequest,
  SmcpEnvelope,
} from './types';
import { AgentManifest } from './manifest';

/**
 * Client for interacting with the AEGIS orchestrator.
 */
export class AegisClient {
  private client: AxiosInstance;

  constructor(baseUrl: string, apiKey?: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
    });
  }

  // --- Agent Management ---

  /**
   * Deploy an agent to the AEGIS cloud.
   */
  async deployAgent(manifest: AgentManifest, force: boolean = false): Promise<DeploymentResponse> {
    const response = await this.client.post('/v1/agents', manifest, {
      params: { force },
    });
    return response.data;
  }

  /**
   * List all deployed agents.
   */
  async listAgents(): Promise<AgentInfo[]> {
    const response = await this.client.get('/v1/agents');
    return response.data;
  }

  /**
   * Get an agent's manifest by ID.
   */
  async getAgent(agentId: string): Promise<AgentManifest> {
    const response = await this.client.get(`/v1/agents/${agentId}`);
    return response.data;
  }

  /**
   * Lookup an agent ID by name.
   */
  async lookupAgent(name: string): Promise<string | null> {
    try {
      const response = await this.client.get(`/v1/agents/lookup/${name}`);
      return response.data.id;
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Terminate an agent instance.
   */
  async terminateAgent(agentId: string): Promise<void> {
    await this.client.delete(`/v1/agents/${agentId}`);
  }

  /**
   * Stream events for an agent.
   */
  async streamAgentEvents(agentId: string, follow: boolean = true): Promise<any> {
    const response = await this.client.get(`/v1/agents/${agentId}/events`, {
      params: { follow },
      responseType: 'stream',
    });
    return response.data;
  }

  // --- Execution Management ---

  /**
   * Execute a task on a deployed agent.
   */
  async executeTask(agentId: string, input: TaskInput): Promise<{ execution_id: string }> {
    const response = await this.client.post(`/v1/agents/${agentId}/execute`, input);
    return response.data;
  }

  /**
   * Get details of an execution.
   */
  async getExecution(executionId: string): Promise<ExecutionInfo> {
    const response = await this.client.get(`/v1/executions/${executionId}`);
    return response.data;
  }

  /**
   * Cancel a running execution.
   */
  async cancelExecution(executionId: string): Promise<{ success: boolean }> {
    const response = await this.client.post(`/v1/executions/${executionId}/cancel`);
    return response.data;
  }

  /**
   * List executions.
   */
  async listExecutions(agentId?: string, limit?: number): Promise<ExecutionInfo[]> {
    const response = await this.client.get('/v1/executions', {
      params: { agent_id: agentId, limit },
    });
    return response.data;
  }

  /**
   * Delete an execution record.
   */
  async deleteExecution(executionId: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/v1/executions/${executionId}`);
    return response.data;
  }

  /**
   * Stream events for an execution.
   */
  async streamExecutionEvents(executionId: string, follow: boolean = true): Promise<any> {
    const response = await this.client.get(`/v1/executions/${executionId}/events`, {
      params: { follow },
      responseType: 'stream',
    });
    return response.data;
  }

  // --- Workflow Management ---

  /**
   * Register a new workflow.
   */
  async registerWorkflow(manifest: string | any, force: boolean = false): Promise<any> {
    const response = await this.client.post('/v1/workflows', manifest, {
      params: { force },
    });
    return response.data;
  }

  /**
   * List all workflows.
   */
  async listWorkflows(): Promise<WorkflowInfo[]> {
    const response = await this.client.get('/v1/workflows');
    return response.data;
  }

  /**
   * Get workflow manifest (YAML).
   */
  async getWorkflow(name: string): Promise<string> {
    const response = await this.client.get(`/v1/workflows/${name}`);
    return response.data;
  }

  /**
   * Delete a workflow.
   */
  async deleteWorkflow(name: string): Promise<{ success: boolean }> {
    const response = await this.client.delete(`/v1/workflows/${name}`);
    return response.data;
  }

  /**
   * Run a workflow.
   */
  async runWorkflow(name: string, input: any): Promise<WorkflowExecutionInfo> {
    const response = await this.client.post(`/v1/workflows/${name}/run`, { input });
    return response.data;
  }

  /**
   * Execute a Temporal workflow.
   */
  async executeTemporalWorkflow(request: StartWorkflowExecutionRequest): Promise<WorkflowExecutionInfo> {
    const response = await this.client.post('/v1/workflows/temporal/execute', request);
    return response.data;
  }

  /**
   * List workflow executions.
   */
  async listWorkflowExecutions(limit?: number, offset?: number): Promise<WorkflowExecutionInfo[]> {
    const response = await this.client.get('/v1/workflows/executions', {
      params: { limit, offset },
    });
    return response.data;
  }

  /**
   * Get workflow execution details.
   */
  async getWorkflowExecution(executionId: string): Promise<WorkflowExecutionInfo> {
    const response = await this.client.get(`/v1/workflows/executions/${executionId}`);
    return response.data;
  }

  /**
   * Stream workflow logs.
   */
  async streamWorkflowLogs(executionId: string): Promise<any> {
    const response = await this.client.get(`/v1/workflows/executions/${executionId}/logs`, {
      responseType: 'stream',
    });
    return response.data;
  }

  /**
   * Signal a workflow execution.
   */
  async signalWorkflowExecution(executionId: string, responseText: string): Promise<{ status: string; execution_id: string }> {
    const response = await this.client.post(`/v1/workflows/executions/${executionId}/signal`, {
      response: responseText,
    });
    return response.data;
  }

  // --- Platform Services ---

  /**
   * List pending human approval requests.
   */
  async listPendingApprovals(): Promise<{ pending_requests: PendingApproval[]; count: number }> {
    const response = await this.client.get('/v1/human-approvals');
    return response.data;
  }

  /**
   * Get a specific pending approval request.
   */
  async getPendingApproval(id: string): Promise<{ request: PendingApproval }> {
    const response = await this.client.get(`/v1/human-approvals/${id}`);
    return response.data;
  }

  /**
   * Approve a request.
   */
  async approveRequest(id: string, request: ApprovalRequest = {}): Promise<{ status: string; request_id: string }> {
    const response = await this.client.post(`/v1/human-approvals/${id}/approve`, request);
    return response.data;
  }

  /**
   * Reject a request.
   */
  async rejectRequest(id: string, request: RejectionRequest): Promise<{ status: string; request_id: string }> {
    const response = await this.client.post(`/v1/human-approvals/${id}/reject`, request);
    return response.data;
  }

  /**
   * Dispatch a message to the gateway.
   */
  async dispatchGateway(payload: any): Promise<any> {
    const response = await this.client.post('/v1/dispatch-gateway', payload);
    return response.data;
  }

  /**
   * Attest SMCP.
   */
  async attestSmcp(request: AttestationRequest): Promise<{ security_token: string }> {
    const response = await this.client.post('/v1/smcp/attest', request);
    return response.data;
  }

  /**
   * Invoke SMCP.
   */
  async invokeSmcp(envelope: SmcpEnvelope): Promise<any> {
    const response = await this.client.post('/v1/smcp/invoke', envelope);
    return response.data;
  }
}
