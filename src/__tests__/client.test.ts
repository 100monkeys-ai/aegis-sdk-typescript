import axios from 'axios';
import { AegisClient } from '../client';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('AegisClient', () => {
  let client: AegisClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      delete: jest.fn(),
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    client = new AegisClient('http://localhost:8088', 'test-key');
  });

  describe('constructor', () => {
    it('creates axios instance with auth header', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8088',
        headers: { Authorization: 'Bearer test-key' },
      });
    });

    it('creates axios instance without auth header when no key', () => {
      new AegisClient('http://localhost:8088');
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:8088',
        headers: {},
      });
    });
  });

  describe('startExecution', () => {
    it('posts to /v1/executions with correct payload', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { execution_id: 'exec-123' },
      });

      const result = await client.startExecution('agent-1', 'do something');
      expect(result.execution_id).toBe('exec-123');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/executions', {
        agent_id: 'agent-1',
        input: 'do something',
      });
    });

    it('includes context_overrides when provided', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { execution_id: 'exec-456' },
      });

      await client.startExecution('agent-1', 'do something', { key: 'val' });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/v1/executions', {
        agent_id: 'agent-1',
        input: 'do something',
        context_overrides: { key: 'val' },
      });
    });
  });

  describe('listPendingApprovals', () => {
    it('gets /v1/human-approvals', async () => {
      const mockData = {
        pending_requests: [
          {
            id: 'a-1',
            execution_id: 'e-1',
            prompt: 'approve?',
            created_at: '2026-01-01T00:00:00Z',
            timeout_seconds: 300,
          },
        ],
        count: 1,
      };
      mockAxiosInstance.get.mockResolvedValue({ data: mockData });

      const result = await client.listPendingApprovals();
      expect(result.pending_requests).toHaveLength(1);
      expect(result.pending_requests[0].id).toBe('a-1');
    });
  });

  describe('approveRequest', () => {
    it('posts to /v1/human-approvals/{id}/approve', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'approved' },
      });

      const result = await client.approveRequest('a-1', {
        feedback: 'looks good',
      });
      expect(result.status).toBe('approved');
    });
  });

  describe('rejectRequest', () => {
    it('posts to /v1/human-approvals/{id}/reject', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: 'rejected' },
      });

      const result = await client.rejectRequest('a-1', { reason: 'not ready' });
      expect(result.status).toBe('rejected');
    });
  });

  describe('attestSeal', () => {
    it('posts to /v1/seal/attest', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          status: 'success',
          security_token: 'jwt-token',
          expires_at: '2026-04-01T12:00:00Z',
          session_id: 'sess-abc',
        },
      });

      const result = await client.attestSeal({ agent_public_key: 'key123' });
      expect(result.status).toBe('success');
      expect(result.security_token).toBe('jwt-token');
      expect(result.expires_at).toBe('2026-04-01T12:00:00Z');
      expect(result.session_id).toBe('sess-abc');
    });
  });

  describe('listSealTools', () => {
    it('gets /v1/seal/tools', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          protocol: 'seal/v1',
          attestation_endpoint: '/v1/seal/attest',
          invoke_endpoint: '/v1/seal/invoke',
          tools: [{ name: 'tool1' }],
        },
      });

      const result = await client.listSealTools();
      expect(result.protocol).toBe('seal/v1');
      expect(result.tools).toHaveLength(1);
    });
  });

  describe('dispatchGateway', () => {
    it('posts to /v1/dispatch-gateway', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { result: 'ok' },
      });

      const result = await client.dispatchGateway({ type: 'generate' });
      expect(result.result).toBe('ok');
    });
  });

  describe('ingestStimulus', () => {
    it('posts to /v1/stimuli', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { accepted: true },
      });

      const result = await client.ingestStimulus({ event: 'test' });
      expect(result.accepted).toBe(true);
    });
  });

  describe('sendWebhook', () => {
    it('posts to /v1/webhooks/{source}', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { ok: true } });

      const result = await client.sendWebhook('github', { action: 'push' });
      expect(result.ok).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/webhooks/github',
        { action: 'push' },
      );
    });
  });

  describe('getWorkflowExecutionLogs', () => {
    it('gets /v1/workflows/executions/{id}/logs', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          execution_id: 'wf-1',
          events: [{ type: 'started' }],
          count: 1,
          limit: 50,
          offset: 0,
        },
      });

      const result = await client.getWorkflowExecutionLogs('wf-1');
      expect(result.execution_id).toBe('wf-1');
      expect(result.count).toBe(1);
    });
  });

  describe('createTenant', () => {
    it('posts to /v1/admin/tenants', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          slug: 'acme',
          display_name: 'Acme Corp',
          status: 'Active',
          tier: 'Enterprise',
          keycloak_realm: 'acme',
          openbao_namespace: 'acme',
          quotas: {
            max_concurrent_executions: 10,
            max_agents: 50,
            max_storage_gb: 100.0,
          },
          created_at: '2026-01-01T00:00:00Z',
          updated_at: '2026-01-01T00:00:00Z',
        },
      });

      const result = await client.createTenant('acme', 'Acme Corp');
      expect(result.slug).toBe('acme');
      expect(result.quotas.max_agents).toBe(50);
    });
  });

  describe('healthLive', () => {
    it('gets /health/live', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { status: 'ok' },
      });

      const result = await client.healthLive();
      expect(result.status).toBe('ok');
    });
  });

  describe('healthReady', () => {
    it('gets /health/ready', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { status: 'ready' },
      });

      const result = await client.healthReady();
      expect(result.status).toBe('ready');
    });
  });
});
