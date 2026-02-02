import axios, { AxiosInstance } from 'axios';
import { AgentManifest, TaskInput, TaskOutput, AgentStatus, DeploymentResponse } from './types';

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

  /**
   * Deploy an agent to the AEGIS cloud.
   */
  async deployAgent(manifest: AgentManifest): Promise<DeploymentResponse> {
    const response = await this.client.post('/api/v1/agents', manifest);
    return response.data;
  }

  /**
   * Execute a task on a deployed agent.
   */
  async executeTask(agentId: string, input: TaskInput): Promise<TaskOutput> {
    const response = await this.client.post(`/api/v1/agents/${agentId}/execute`, input);
    return response.data;
  }

  /**
   * Get the status of an agent.
   */
  async getAgentStatus(agentId: string): Promise<AgentStatus> {
    const response = await this.client.get(`/api/v1/agents/${agentId}/status`);
    return response.data;
  }

  /**
   * Terminate an agent instance.
   */
  async terminateAgent(agentId: string): Promise<void> {
    await this.client.delete(`/api/v1/agents/${agentId}`);
  }
}
