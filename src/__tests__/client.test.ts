import axios from "axios";
import { AegisClient } from "../client";

// Mock axios
jest.mock("axios");
const mockedAxios = axios as jest.Mocked<typeof axios>;

const keycloakOptions = {
  baseUrl: "http://localhost:8080",
  keycloakUrl: "http://localhost:8081",
  realm: "aegis-system",
  clientId: "test-client",
  clientSecret: "test-secret",
};

const bearerOptions = {
  baseUrl: "http://localhost:8080",
  bearerToken: "my-static-token",
};

describe("AegisClient", () => {
  let client: AegisClient;
  let mockAxiosInstance: any;

  beforeEach(() => {
    mockAxiosInstance = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      patch: jest.fn(),
      delete: jest.fn(),
      defaults: { headers: { common: {} } },
      interceptors: {
        request: { use: jest.fn() },
      },
    };
    mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
    client = new AegisClient(keycloakOptions);
  });

  // ---------------------------------------------------------------------------
  // Constructor & Auth
  // ---------------------------------------------------------------------------

  describe("constructor", () => {
    it("creates axios instance with correct baseURL", () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "http://localhost:8080",
      });
    });

    it("registers a request interceptor for Keycloak auth", () => {
      expect(mockAxiosInstance.interceptors.request.use).toHaveBeenCalledTimes(
        1,
      );
    });

    it("strips trailing slash from keycloakUrl", () => {
      mockedAxios.create.mockReturnValue(mockAxiosInstance as any);
      new AegisClient({
        ...keycloakOptions,
        keycloakUrl: "http://localhost:8081/",
      });
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: "http://localhost:8080",
      });
    });
  });

  describe("bearer token auth", () => {
    it("sets Authorization header without Keycloak when bearerToken is provided", () => {
      const bearerInstance: any = {
        get: jest.fn(),
        post: jest.fn(),
        put: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        defaults: { headers: { common: {} } },
        interceptors: {
          request: { use: jest.fn() },
        },
      };
      mockedAxios.create.mockReturnValue(bearerInstance as any);
      new AegisClient(bearerOptions);

      expect(bearerInstance.defaults.headers.common["Authorization"]).toBe(
        "Bearer my-static-token",
      );
      // No interceptor should be registered for bearer token auth
      expect(bearerInstance.interceptors.request.use).not.toHaveBeenCalled();
    });

    it("uses bearer token for requests", async () => {
      const bearerInstance: any = {
        get: jest.fn().mockResolvedValue({ data: { status: "ok" } }),
        post: jest.fn(),
        put: jest.fn(),
        patch: jest.fn(),
        delete: jest.fn(),
        defaults: { headers: { common: {} } },
        interceptors: {
          request: { use: jest.fn() },
        },
      };
      mockedAxios.create.mockReturnValue(bearerInstance as any);
      const bearerClient = new AegisClient(bearerOptions);

      const result = await bearerClient.healthLive();
      expect(result.status).toBe("ok");
      expect(bearerInstance.defaults.headers.common["Authorization"]).toBe(
        "Bearer my-static-token",
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Agent Lifecycle
  // ---------------------------------------------------------------------------

  describe("Agent Lifecycle", () => {
    it("listAgents — GET /v1/agents with query params", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { items: [{ id: "a1", name: "bot" }], count: 1 },
      });

      const result = await client.listAgents({
        scope: "tenant",
        limit: 10,
        agent_type: "system",
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/agents", {
        params: { scope: "tenant", limit: 10, agent_type: "system" },
      });
      expect(result.count).toBe(1);
    });

    it("getAgent — GET /v1/agents/{id}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          id: "a1",
          name: "bot",
          version: "1.0",
          scope: "user",
          status: "active",
          created_at: "2026-01-01",
        },
      });

      const result = await client.getAgent("a1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/agents/a1");
      expect(result.id).toBe("a1");
    });

    it("deployAgent — POST /v1/agents with text/yaml Content-Type for YAML manifest", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "d1",
          agent_id: "a1",
          version: "1.0",
          deployed_at: "2026-01-01",
        },
      });

      const yamlManifest = "name: my-agent\nversion: 1.0";
      const result = await client.deployAgent(yamlManifest, { force: true });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/agents",
        yamlManifest,
        {
          params: { force: true },
          headers: { "Content-Type": "text/yaml" },
        },
      );
      expect(result.agent_id).toBe("a1");
    });

    it("deployAgent — POST /v1/agents with application/json Content-Type for JSON manifest", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "d1",
          agent_id: "a1",
          version: "1.0",
          deployed_at: "2026-01-01",
        },
      });

      const jsonManifest = '{"name": "my-agent"}';
      await client.deployAgent(jsonManifest);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/agents",
        jsonManifest,
        {
          params: undefined,
          headers: { "Content-Type": "application/json" },
        },
      );
    });

    it("updateAgent — PATCH /v1/agents/{id}", async () => {
      mockAxiosInstance.patch.mockResolvedValue({
        data: {
          id: "a1",
          name: "updated",
          version: "2.0",
          scope: "tenant",
          status: "active",
          created_at: "2026-01-01",
        },
      });

      const result = await client.updateAgent("a1", { name: "updated" });
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith("/v1/agents/a1", {
        name: "updated",
      });
      expect(result.name).toBe("updated");
    });

    it("deleteAgent — DELETE /v1/agents/{id}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "deleted" },
      });

      const result = await client.deleteAgent("a1");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/v1/agents/a1");
      expect(result.status).toBe("deleted");
    });

    it("lookupAgent — GET /v1/agents/lookup/{name}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          id: "a1",
          name: "bot",
          version: "1.0",
          scope: "user",
          status: "active",
          created_at: "2026-01-01",
        },
      });

      const result = await client.lookupAgent("bot");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/agents/lookup/bot",
      );
      expect(result.name).toBe("bot");
    });

    it("executeAgent — POST /v1/agents/{agentId}/execute", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { execution_id: "e1", status: "running" },
      });

      const result = await client.executeAgent("a1", "do stuff", "intent1", {
        key: "val",
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/agents/a1/execute",
        {
          input: "do stuff",
          intent: "intent1",
          context_overrides: { key: "val" },
        },
      );
      expect(result.execution_id).toBe("e1");
    });

    it("executeAgent — omits optional fields when not provided", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { execution_id: "e1", status: "running" },
      });

      await client.executeAgent("a1", "do stuff");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/agents/a1/execute",
        { input: "do stuff" },
      );
    });

    it("listAgentVersions — GET /v1/agents/{id}/versions", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          versions: [
            {
              id: "v1",
              agent_id: "a1",
              version: "1.0",
              deployed_at: "2026-01-01",
            },
          ],
          count: 1,
        },
      });

      const result = await client.listAgentVersions("a1", 5);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/agents/a1/versions",
        { params: { limit: 5 } },
      );
      expect(result.count).toBe(1);
    });

    it("updateAgentScope — POST /v1/agents/{id}/scope", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "a1",
          name: "bot",
          version: "1.0",
          scope: "global",
          status: "active",
          created_at: "2026-01-01",
        },
      });

      const result = await client.updateAgentScope("a1", "global");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/agents/a1/scope",
        { scope: "global" },
      );
      expect(result.scope).toBe("global");
    });

    it("streamAgentEvents — GET /v1/agents/{agentId}/events with stream responseType", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: "stream-data" });

      const result = await client.streamAgentEvents("a1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/agents/a1/events",
        { responseType: "stream" },
      );
      expect(result).toBe("stream-data");
    });
  });

  // ---------------------------------------------------------------------------
  // Execution Lifecycle
  // ---------------------------------------------------------------------------

  describe("Execution Lifecycle", () => {
    it("startExecution — POST /v1/executions", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { execution_id: "exec-123" },
      });

      const result = await client.startExecution("agent-1", "do something");
      expect(result.execution_id).toBe("exec-123");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/executions", {
        agent_id: "agent-1",
        input: "do something",
      });
    });

    it("startExecution — includes context_overrides and intent when provided", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { execution_id: "exec-456" },
      });

      await client.startExecution(
        "agent-1",
        "do something",
        { key: "val" },
        "my-intent",
      );
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/executions", {
        agent_id: "agent-1",
        input: "do something",
        context_overrides: { key: "val" },
        intent: "my-intent",
      });
    });

    it("streamExecution — GET /v1/executions/{id}/stream with stream responseType", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: "sse-stream" });

      const result = await client.streamExecution("e1", "tok123");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/executions/e1/stream",
        { params: { token: "tok123" }, responseType: "stream" },
      );
      expect(result).toBe("sse-stream");
    });

    it("listExecutions — GET /v1/executions with query params", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { items: [], count: 0 },
      });

      const result = await client.listExecutions({
        agent_id: "a1",
        limit: 20,
        offset: 5,
        status: "completed",
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/executions", {
        params: { agent_id: "a1", limit: 20, offset: 5, status: "completed" },
      });
      expect(result.count).toBe(0);
    });

    it("getExecution — GET /v1/executions/{executionId}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: "e1", status: "completed", started_at: "2026-01-01" },
      });

      const result = await client.getExecution("e1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/executions/e1");
      expect(result.status).toBe("completed");
    });

    it("cancelExecution — POST /v1/executions/{executionId}/cancel", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: "cancelled" },
      });

      const result = await client.cancelExecution("e1", "no longer needed");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/executions/e1/cancel",
        { reason: "no longer needed" },
      );
      expect(result.status).toBe("cancelled");
    });

    it("deleteExecution — DELETE /v1/executions/{executionId}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "deleted" },
      });

      const result = await client.deleteExecution("e1");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/executions/e1",
      );
      expect(result.status).toBe("deleted");
    });

    it("getExecutionFile — GET /v1/executions/{id}/files/{path} returns ArrayBuffer", async () => {
      const buffer = new ArrayBuffer(8);
      mockAxiosInstance.get.mockResolvedValue({ data: buffer });

      const result = await client.getExecutionFile("e1", "output/result.txt");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/executions/e1/files/output/result.txt",
        { responseType: "arraybuffer" },
      );
      expect(result).toBe(buffer);
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow Orchestration
  // ---------------------------------------------------------------------------

  describe("Workflow Orchestration", () => {
    it("listWorkflows — GET /v1/workflows with query params", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { items: [{ id: "w1", name: "deploy" }], count: 1 },
      });

      const result = await client.listWorkflows({
        scope: "tenant",
        limit: 5,
        visible: true,
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/workflows", {
        params: { scope: "tenant", limit: 5, visible: true },
      });
      expect(result.count).toBe(1);
    });

    it("getWorkflow — GET /v1/workflows/{name}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          id: "w1",
          name: "deploy",
          version: "1.0",
          scope: "tenant",
          created_at: "2026-01-01",
        },
      });

      const result = await client.getWorkflow("deploy");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/workflows/deploy",
      );
      expect(result.name).toBe("deploy");
    });

    it("getWorkflowYaml — GET /v1/workflows/{name} with Accept: text/plain", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: "name: deploy\nversion: 1.0",
      });

      const result = await client.getWorkflowYaml("deploy");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/workflows/deploy",
        {
          headers: { Accept: "text/plain" },
        },
      );
      expect(result).toBe("name: deploy\nversion: 1.0");
    });

    it("registerWorkflow — POST /v1/workflows with text/yaml Content-Type", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "wv1",
          name: "deploy",
          version: "1.0",
          registered_at: "2026-01-01",
        },
      });

      const yaml = "name: deploy\nversion: 1.0";
      const result = await client.registerWorkflow(yaml, {
        scope: "tenant",
        force: true,
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/workflows",
        yaml,
        {
          params: { scope: "tenant", force: true },
          headers: { "Content-Type": "text/yaml" },
        },
      );
      expect(result.name).toBe("deploy");
    });

    it("deleteWorkflow — DELETE /v1/workflows/{name}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "deleted" },
      });

      const result = await client.deleteWorkflow("deploy");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/workflows/deploy",
      );
      expect(result.status).toBe("deleted");
    });

    it("listWorkflowVersions — GET /v1/workflows/{name}/versions", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          versions: [
            {
              id: "wv1",
              name: "deploy",
              version: "1.0",
              registered_at: "2026-01-01",
            },
          ],
          count: 1,
        },
      });

      const result = await client.listWorkflowVersions("deploy", 3);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/workflows/deploy/versions",
        { params: { limit: 3 } },
      );
      expect(result.count).toBe(1);
    });

    it("updateWorkflowScope — POST /v1/workflows/{name}/scope", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "w1",
          name: "deploy",
          version: "1.0",
          scope: "global",
          created_at: "2026-01-01",
        },
      });

      const result = await client.updateWorkflowScope("deploy", "global");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/workflows/deploy/scope",
        { scope: "global" },
      );
      expect(result.scope).toBe("global");
    });

    it("runWorkflow — POST /v1/workflows/{name}/run", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { execution_id: "we1", status: "running" },
      });

      const result = await client.runWorkflow(
        "deploy",
        { env: "prod" },
        { override: true },
      );
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/workflows/deploy/run",
        { input: { env: "prod" }, context_overrides: { override: true } },
      );
      expect(result.execution_id).toBe("we1");
    });

    it("runWorkflow — sends empty payload when no input or overrides", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { execution_id: "we2", status: "running" },
      });

      await client.runWorkflow("deploy");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/workflows/deploy/run",
        {},
      );
    });

    it("executeWorkflow — POST /v1/workflows/temporal/execute", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          execution_id: "we1",
          workflow_id: "w1",
          temporal_run_id: "tr1",
        },
      });

      const result = await client.executeWorkflow(
        "deploy",
        { x: 1 },
        "2.0",
        60,
      );
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/workflows/temporal/execute",
        {
          workflow_name: "deploy",
          input: { x: 1 },
          version: "2.0",
          timeout: 60,
        },
      );
      expect(result.temporal_run_id).toBe("tr1");
    });
  });

  // ---------------------------------------------------------------------------
  // Workflow Execution Lifecycle
  // ---------------------------------------------------------------------------

  describe("Workflow Execution Lifecycle", () => {
    it("listWorkflowExecutions — GET /v1/workflows/executions", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { items: [], count: 0 },
      });

      const result = await client.listWorkflowExecutions({
        workflow_name: "deploy",
        limit: 10,
        status: "completed",
      });
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/workflows/executions",
        {
          params: { workflow_name: "deploy", limit: 10, status: "completed" },
        },
      );
      expect(result.count).toBe(0);
    });

    it("getWorkflowExecution — GET /v1/workflows/executions/{executionId}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          id: "we1",
          workflow_name: "deploy",
          status: "completed",
          started_at: "2026-01-01",
        },
      });

      const result = await client.getWorkflowExecution("we1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/workflows/executions/we1",
      );
      expect(result.workflow_name).toBe("deploy");
    });

    it("deleteWorkflowExecution — DELETE /v1/workflows/executions/{executionId}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "deleted" },
      });

      const result = await client.deleteWorkflowExecution("we1");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/workflows/executions/we1",
      );
      expect(result.status).toBe("deleted");
    });

    it("signalWorkflowExecution — POST /v1/workflows/executions/{id}/signal", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: "signaled" },
      });

      const result = await client.signalWorkflowExecution("we1", "approve", {
        ok: true,
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/workflows/executions/we1/signal",
        { signal_name: "approve", payload: { ok: true } },
      );
      expect(result.status).toBe("signaled");
    });

    it("cancelWorkflowExecution — POST /v1/workflows/executions/{id}/cancel", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: "cancelled" },
      });

      const result = await client.cancelWorkflowExecution("we1", "abort");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/workflows/executions/we1/cancel",
        { reason: "abort" },
      );
      expect(result.status).toBe("cancelled");
    });

    it("getWorkflowExecutionLogs — GET /v1/workflows/executions/{id}/logs", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          execution_id: "wf-1",
          events: [{ type: "started" }],
          count: 1,
          limit: 50,
          offset: 0,
        },
      });

      const result = await client.getWorkflowExecutionLogs("wf-1", 50, 0);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/workflows/executions/wf-1/logs",
        { params: { limit: 50, offset: 0 } },
      );
      expect(result.count).toBe(1);
    });

    it("streamWorkflowExecutionLogs — GET /v1/workflows/executions/{id}/logs/stream", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: "log-stream" });

      const result = await client.streamWorkflowExecutionLogs("we1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/workflows/executions/we1/logs/stream",
        { responseType: "stream" },
      );
      expect(result).toBe("log-stream");
    });
  });

  // ---------------------------------------------------------------------------
  // Volumes
  // ---------------------------------------------------------------------------

  describe("Volumes", () => {
    it("createVolume — POST /v1/volumes", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "v1",
          label: "data",
          size_limit_bytes: 1024,
          used_bytes: 0,
          created_at: "2026-01-01",
        },
      });

      const result = await client.createVolume("data", 1024);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/volumes", {
        label: "data",
        size_limit_bytes: 1024,
      });
      expect(result.label).toBe("data");
    });

    it("listVolumes — GET /v1/volumes", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { volumes: [], total_count: 0 },
      });

      const result = await client.listVolumes(10);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/volumes", {
        params: { limit: 10 },
      });
      expect(result.total_count).toBe(0);
    });

    it("getVolume — GET /v1/volumes/{id}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          id: "v1",
          label: "data",
          size_limit_bytes: 1024,
          used_bytes: 0,
          created_at: "2026-01-01",
        },
      });

      const result = await client.getVolume("v1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/volumes/v1");
      expect(result.id).toBe("v1");
    });

    it("renameVolume — PATCH /v1/volumes/{id}", async () => {
      mockAxiosInstance.patch.mockResolvedValue({
        data: {
          id: "v1",
          label: "renamed",
          size_limit_bytes: 1024,
          used_bytes: 0,
          created_at: "2026-01-01",
        },
      });

      const result = await client.renameVolume("v1", "renamed");
      expect(mockAxiosInstance.patch).toHaveBeenCalledWith("/v1/volumes/v1", {
        label: "renamed",
      });
      expect(result.label).toBe("renamed");
    });

    it("deleteVolume — DELETE /v1/volumes/{id}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "deleted" },
      });

      const result = await client.deleteVolume("v1");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/v1/volumes/v1");
      expect(result.status).toBe("deleted");
    });

    it("getQuota — GET /v1/volumes/quota", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          quota_bytes: 10240,
          used_bytes: 512,
          volume_count: 2,
          volume_limit: 10,
        },
      });

      const result = await client.getQuota();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/volumes/quota");
      expect(result.quota_bytes).toBe(10240);
    });

    it("listFiles — GET /v1/volumes/{id}/files with path param", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          entries: [{ name: "file.txt", type: "file", size_bytes: 100 }],
        },
      });

      const result = await client.listFiles("v1", "/data");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/volumes/v1/files",
        {
          params: { path: "/data" },
        },
      );
      expect(result.entries).toHaveLength(1);
    });

    it("downloadFile — GET /v1/volumes/{id}/files/download returns ArrayBuffer", async () => {
      const buffer = new ArrayBuffer(16);
      mockAxiosInstance.get.mockResolvedValue({ data: buffer });

      const result = await client.downloadFile("v1", "/data/file.bin");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/volumes/v1/files/download",
        { params: { path: "/data/file.bin" }, responseType: "arraybuffer" },
      );
      expect(result).toBe(buffer);
    });

    it("uploadFile — POST /v1/volumes/{id}/files/upload with multipart/form-data", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { name: "file.txt", size_bytes: 100, uploaded_at: "2026-01-01" },
      });

      const buf = Buffer.from("hello");
      const result = await client.uploadFile("v1", "/data/file.txt", buf);
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/volumes/v1/files/upload",
        expect.any(FormData),
        {
          params: { path: "/data/file.txt" },
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      expect(result.name).toBe("file.txt");
    });

    it("mkdir — POST /v1/volumes/{id}/files/mkdir", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { path: "/data/subdir", created_at: "2026-01-01" },
      });

      const result = await client.mkdir("v1", "/data/subdir");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/volumes/v1/files/mkdir",
        { path: "/data/subdir" },
      );
      expect(result.path).toBe("/data/subdir");
    });

    it("movePath — POST /v1/volumes/{id}/files/move", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { from: "/a", to: "/b", moved_at: "2026-01-01" },
      });

      const result = await client.movePath("v1", "/a", "/b");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/volumes/v1/files/move",
        { from: "/a", to: "/b" },
      );
      expect(result.to).toBe("/b");
    });

    it("deletePath — DELETE /v1/volumes/{id}/files with path param", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "deleted" },
      });

      const result = await client.deletePath("v1", "/data/file.txt");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/volumes/v1/files",
        {
          params: { path: "/data/file.txt" },
        },
      );
      expect(result.status).toBe("deleted");
    });
  });

  // ---------------------------------------------------------------------------
  // Credentials
  // ---------------------------------------------------------------------------

  describe("Credentials", () => {
    it("listCredentials — GET /v1/credentials", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          credentials: [
            { id: "c1", provider: "github", created_at: "2026-01-01" },
          ],
          count: 1,
        },
      });

      const result = await client.listCredentials();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/credentials");
      expect(result.count).toBe(1);
    });

    it("storeApiKeyCredential — POST /v1/credentials/api-keys", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { id: "c1", provider: "openai", created_at: "2026-01-01" },
      });

      const result = await client.storeApiKeyCredential("openai", "sk-xxx", {
        org: "mine",
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/credentials/api-keys",
        {
          provider: "openai",
          api_key_value: "sk-xxx",
          metadata: { org: "mine" },
        },
      );
      expect(result.provider).toBe("openai");
    });

    it("oauthInitiate — POST /v1/credentials/oauth/initiate", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          auth_url: "https://oauth.example.com",
          state_token: "st1",
          expires_at: "2026-01-01",
        },
      });

      const result = await client.oauthInitiate(
        "github",
        "https://callback.example.com",
        ["repo"],
      );
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/credentials/oauth/initiate",
        {
          provider: "github",
          redirect_uri: "https://callback.example.com",
          scopes: ["repo"],
        },
      );
      expect(result.auth_url).toBe("https://oauth.example.com");
    });

    it("oauthCallback — GET /v1/credentials/oauth/callback", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { credential_id: "c1", stored: true },
      });

      const result = await client.oauthCallback("code123", "state456");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/credentials/oauth/callback",
        {
          params: { code: "code123", state: "state456" },
        },
      );
      expect(result.stored).toBe(true);
    });

    it("devicePoll — POST /v1/credentials/oauth/device/poll", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: "approved", credential_id: "c1" },
      });

      const result = await client.devicePoll("dev-code", "github");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/credentials/oauth/device/poll",
        {
          device_code: "dev-code",
          provider: "github",
        },
      );
      expect(result.status).toBe("approved");
    });

    it("getCredential — GET /v1/credentials/{id}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: "c1", provider: "github", created_at: "2026-01-01" },
      });

      const result = await client.getCredential("c1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/credentials/c1");
      expect(result.id).toBe("c1");
    });

    it("revokeCredential — DELETE /v1/credentials/{id}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "revoked" },
      });

      const result = await client.revokeCredential("c1");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/credentials/c1",
      );
      expect(result.status).toBe("revoked");
    });

    it("rotateCredential — POST /v1/credentials/{id}/rotate", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { id: "c1", provider: "github", created_at: "2026-01-01" },
      });

      const result = await client.rotateCredential("c1", {
        new_value: "new-key",
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/credentials/c1/rotate",
        { new_value: "new-key" },
      );
      expect(result.id).toBe("c1");
    });

    it("listGrants — GET /v1/credentials/{id}/grants", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          grants: [
            {
              id: "g1",
              credential_id: "c1",
              permission_type: "read",
              created_at: "2026-01-01",
            },
          ],
          count: 1,
        },
      });

      const result = await client.listGrants("c1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/credentials/c1/grants",
      );
      expect(result.count).toBe(1);
    });

    it("addGrant — POST /v1/credentials/{id}/grants", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "g1",
          credential_id: "c1",
          agent_id: "a1",
          permission_type: "execute",
          created_at: "2026-01-01",
        },
      });

      const result = await client.addGrant("c1", {
        agent_id: "a1",
        permission_type: "execute",
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/credentials/c1/grants",
        {
          agent_id: "a1",
          permission_type: "execute",
        },
      );
      expect(result.permission_type).toBe("execute");
    });

    it("revokeGrant — DELETE /v1/credentials/{id}/grants/{grantId}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "revoked" },
      });

      const result = await client.revokeGrant("c1", "g1");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/credentials/c1/grants/g1",
      );
      expect(result.status).toBe("revoked");
    });
  });

  // ---------------------------------------------------------------------------
  // Secrets
  // ---------------------------------------------------------------------------

  describe("Secrets", () => {
    it("listSecrets — GET /v1/secrets with path_prefix param", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { secrets: [{ name: "db-pass", last_modified: "2026-01-01" }] },
      });

      const result = await client.listSecrets("app/");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/secrets", {
        params: { path_prefix: "app/" },
      });
      expect(result.secrets).toHaveLength(1);
    });

    it("getSecret — GET /v1/secrets/{path}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { value: "s3cr3t" },
      });

      const result = await client.getSecret("app/db-pass");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/secrets/app/db-pass",
      );
      expect(result.value).toBe("s3cr3t");
    });

    it("writeSecret — PUT /v1/secrets/{path}", async () => {
      mockAxiosInstance.put.mockResolvedValue({
        data: { path: "app/db-pass", created_at: "2026-01-01" },
      });

      const result = await client.writeSecret(
        "app/db-pass",
        "new-val",
        "plaintext",
      );
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/v1/secrets/app/db-pass",
        {
          value: "new-val",
          encoding: "plaintext",
        },
      );
      expect(result.path).toBe("app/db-pass");
    });

    it("deleteSecret — DELETE /v1/secrets/{path}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "deleted" },
      });

      const result = await client.deleteSecret("app/db-pass");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/secrets/app/db-pass",
      );
      expect(result.status).toBe("deleted");
    });
  });

  // ---------------------------------------------------------------------------
  // API Keys
  // ---------------------------------------------------------------------------

  describe("API Keys", () => {
    it("listApiKeys — GET /v1/api-keys", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          api_keys: [{ id: "k1", name: "dev-key", created_at: "2026-01-01" }],
        },
      });

      const result = await client.listApiKeys();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/api-keys");
      expect(result.api_keys).toHaveLength(1);
    });

    it("createApiKey — POST /v1/api-keys", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "k1",
          name: "dev-key",
          created_at: "2026-01-01",
          key_value: "ak_xxx",
          scopes: ["read"],
        },
      });

      const result = await client.createApiKey(
        "dev-key",
        ["read"],
        "2027-01-01",
      );
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/api-keys", {
        name: "dev-key",
        scopes: ["read"],
        expires_at: "2027-01-01",
      });
      expect(result.key_value).toBe("ak_xxx");
    });

    it("revokeApiKey — DELETE /v1/api-keys/{id}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "revoked" },
      });

      const result = await client.revokeApiKey("k1");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith("/v1/api-keys/k1");
      expect(result.status).toBe("revoked");
    });
  });

  // ---------------------------------------------------------------------------
  // Colony
  // ---------------------------------------------------------------------------

  describe("Colony", () => {
    it("listMembers — GET /v1/colony/members", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          members: [
            { id: "u1", email: "a@b.com", role: "admin", status: "active" },
          ],
          count: 1,
        },
      });

      const result = await client.listMembers(20);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/colony/members", {
        params: { limit: 20 },
      });
      expect(result.count).toBe(1);
    });

    it("inviteMember — POST /v1/colony/members", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "u2",
          email: "new@b.com",
          role: "member",
          status: "invited",
        },
      });

      const result = await client.inviteMember("new@b.com", "member");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/colony/members",
        {
          email: "new@b.com",
          role: "member",
        },
      );
      expect(result.status).toBe("invited");
    });

    it("removeMember — DELETE /v1/colony/members/{userId}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "removed" },
      });

      const result = await client.removeMember("u2");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/colony/members/u2",
      );
      expect(result.status).toBe("removed");
    });

    it("updateRole — PUT /v1/colony/roles", async () => {
      mockAxiosInstance.put.mockResolvedValue({
        data: { id: "u1", email: "a@b.com", role: "owner", status: "active" },
      });

      const result = await client.updateRole("u1", "owner");
      expect(mockAxiosInstance.put).toHaveBeenCalledWith("/v1/colony/roles", {
        user_id: "u1",
        role: "owner",
      });
      expect(result.role).toBe("owner");
    });

    it("getSamlConfig — GET /v1/colony/saml", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          entity_id: "ent1",
          sso_url: "https://sso.example.com",
          configured: true,
        },
      });

      const result = await client.getSamlConfig();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/colony/saml");
      expect(result.configured).toBe(true);
    });

    it("setSamlConfig — PUT /v1/colony/saml", async () => {
      const config = {
        entity_id: "ent1",
        sso_url: "https://sso.example.com",
        certificate: "cert-data",
      };
      mockAxiosInstance.put.mockResolvedValue({
        data: { ...config, configured: true },
      });

      const result = await client.setSamlConfig(config);
      expect(mockAxiosInstance.put).toHaveBeenCalledWith(
        "/v1/colony/saml",
        config,
      );
      expect(result.configured).toBe(true);
    });

    it("getSubscription — GET /v1/colony/subscription", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { tier: "pro", features: ["volumes", "swarms"] },
      });

      const result = await client.getSubscription();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/colony/subscription",
      );
      expect(result.tier).toBe("pro");
    });
  });

  // ---------------------------------------------------------------------------
  // Cluster
  // ---------------------------------------------------------------------------

  describe("Cluster", () => {
    it("getClusterStatus — GET /v1/cluster/status", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          nodes: [{ id: "n1", status: "healthy" }],
          overall_status: "healthy",
        },
      });

      const result = await client.getClusterStatus();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/cluster/status");
      expect(result.overall_status).toBe("healthy");
    });

    it("listClusterNodes — GET /v1/cluster/nodes with limit", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          source: "kubernetes",
          items: [{ id: "n1", status: "healthy" }],
        },
      });

      const result = await client.listClusterNodes(5);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/cluster/nodes", {
        params: { limit: 5 },
      });
      expect(result.source).toBe("kubernetes");
    });
  });

  // ---------------------------------------------------------------------------
  // Swarms
  // ---------------------------------------------------------------------------

  describe("Swarms", () => {
    it("listSwarms — GET /v1/swarms with limit", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          items: [{ swarm_id: "s1", member_ids: ["m1"], status: "active" }],
          count: 1,
        },
      });

      const result = await client.listSwarms(10);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/swarms", {
        params: { limit: 10 },
      });
      expect(result.count).toBe(1);
    });

    it("getSwarm — GET /v1/swarms/{swarmId}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { swarm_id: "s1", member_ids: ["m1", "m2"], status: "active" },
      });

      const result = await client.getSwarm("s1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/swarms/s1");
      expect(result.member_ids).toHaveLength(2);
    });
  });

  // ---------------------------------------------------------------------------
  // Stimuli
  // ---------------------------------------------------------------------------

  describe("Stimuli", () => {
    it("ingestStimulus — POST /v1/stimuli", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { accepted: true },
      });

      const result = await client.ingestStimulus({ event: "test" });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/stimuli", {
        event: "test",
      });
      expect(result.accepted).toBe(true);
    });

    it("listStimuli — GET /v1/stimuli with limit", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { items: [{ id: "st1", created_at: "2026-01-01" }], count: 1 },
      });

      const result = await client.listStimuli(10);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/stimuli", {
        params: { limit: 10 },
      });
      expect(result.count).toBe(1);
    });

    it("getStimulus — GET /v1/stimuli/{stimulusId}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { id: "st1", source: "webhook", created_at: "2026-01-01" },
      });

      const result = await client.getStimulus("st1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/stimuli/st1");
      expect(result.source).toBe("webhook");
    });

    it("sendWebhook — POST /v1/webhooks/{source}", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { ok: true } });

      const result = await client.sendWebhook("github", { action: "push" });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/webhooks/github",
        { action: "push" },
      );
      expect(result.ok).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // Observability
  // ---------------------------------------------------------------------------

  describe("Observability", () => {
    it("listSecurityIncidents — GET /v1/security/incidents", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          items: [
            { id: "si1", type: "unauthorized", created_at: "2026-01-01" },
          ],
          count: 1,
        },
      });

      const result = await client.listSecurityIncidents(5);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/security/incidents",
        {
          params: { limit: 5 },
        },
      );
      expect(result.count).toBe(1);
    });

    it("listStorageViolations — GET /v1/storage/violations", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          items: [
            { id: "sv1", type: "quota_exceeded", created_at: "2026-01-01" },
          ],
          count: 1,
        },
      });

      const result = await client.listStorageViolations(5);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/storage/violations",
        {
          params: { limit: 5 },
        },
      );
      expect(result.count).toBe(1);
    });

    it("getDashboardSummary — GET /v1/dashboard/summary", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          swarm_count: 3,
          stimulus_count: 10,
          security_incident_count: 0,
          storage_violation_count: 1,
          execution_count: 50,
          workflow_execution_count: 20,
        },
      });

      const result = await client.getDashboardSummary();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/dashboard/summary",
      );
      expect(result.execution_count).toBe(50);
    });
  });

  // ---------------------------------------------------------------------------
  // Cortex
  // ---------------------------------------------------------------------------

  describe("Cortex", () => {
    it("listCortexPatterns — GET /v1/cortex/patterns with query and limit", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          patterns: [
            { id: "p1", error_signature: "timeout", created_at: "2026-01-01" },
          ],
        },
      });

      const result = await client.listCortexPatterns("timeout", 10);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/cortex/patterns",
        {
          params: { q: "timeout", limit: 10 },
        },
      );
      expect(result.patterns).toHaveLength(1);
    });

    it("getCortexSkills — GET /v1/cortex/skills", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { skills: [{ id: "sk1", description: "code review" }] },
      });

      const result = await client.getCortexSkills(5);
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/cortex/skills", {
        params: { limit: 5 },
      });
      expect(result.skills).toHaveLength(1);
    });

    it("getCortexMetrics — GET /v1/cortex/metrics with metric_type param", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          pattern_count: 100,
          solution_count: 80,
          avg_success_rate: 0.85,
        },
      });

      const result = await client.getCortexMetrics("summary");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/cortex/metrics", {
        params: { metric_type: "summary" },
      });
      expect(result.pattern_count).toBe(100);
    });
  });

  // ---------------------------------------------------------------------------
  // User
  // ---------------------------------------------------------------------------

  describe("User", () => {
    it("getUserRateLimitUsage — GET /v1/user/rate-limits/usage", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          user_id: "u1",
          buckets: [{ bucket_name: "executions", usage_pct: 0.5 }],
        },
      });

      const result = await client.getUserRateLimitUsage();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/user/rate-limits/usage",
      );
      expect(result.user_id).toBe("u1");
      expect(result.buckets).toHaveLength(1);
    });
  });

  // ---------------------------------------------------------------------------
  // Human Approvals
  // ---------------------------------------------------------------------------

  describe("Human Approvals", () => {
    it("listPendingApprovals — GET /v1/human-approvals", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          pending_requests: [
            {
              id: "a-1",
              execution_id: "e-1",
              prompt: "approve?",
              created_at: "2026-01-01",
              timeout_seconds: 300,
            },
          ],
          count: 1,
        },
      });

      const result = await client.listPendingApprovals();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/human-approvals");
      expect(result.pending_requests).toHaveLength(1);
    });

    it("getPendingApproval — GET /v1/human-approvals/{id}", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          request: {
            id: "a-1",
            execution_id: "e-1",
            prompt: "approve?",
            created_at: "2026-01-01",
            timeout_seconds: 300,
          },
        },
      });

      const result = await client.getPendingApproval("a-1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/human-approvals/a-1",
      );
      expect(result.request.id).toBe("a-1");
    });

    it("approveRequest — POST /v1/human-approvals/{id}/approve", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: "approved" },
      });

      const result = await client.approveRequest("a-1", {
        feedback: "looks good",
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/human-approvals/a-1/approve",
        { feedback: "looks good" },
      );
      expect(result.status).toBe("approved");
    });

    it("rejectRequest — POST /v1/human-approvals/{id}/reject", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: "rejected" },
      });

      const result = await client.rejectRequest("a-1", { reason: "not ready" });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/human-approvals/a-1/reject",
        { reason: "not ready" },
      );
      expect(result.status).toBe("rejected");
    });
  });

  // ---------------------------------------------------------------------------
  // SEAL
  // ---------------------------------------------------------------------------

  describe("SEAL", () => {
    it("attestSeal — POST /v1/seal/attest", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          status: "success",
          security_token: "jwt",
          expires_at: "2026-04-01T12:00:00Z",
          session_id: "sess-1",
        },
      });

      const result = await client.attestSeal({ agent_public_key: "key123" });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/seal/attest", {
        agent_public_key: "key123",
      });
      expect(result.security_token).toBe("jwt");
    });

    it("invokeSeal — POST /v1/seal/invoke", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { result: "tool-output" },
      });

      const result = await client.invokeSeal({ tool: "search", args: {} });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/seal/invoke", {
        tool: "search",
        args: {},
      });
      expect(result.result).toBe("tool-output");
    });

    it("listSealTools — GET /v1/seal/tools", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          protocol: "seal/v1",
          attestation_endpoint: "/v1/seal/attest",
          invoke_endpoint: "/v1/seal/invoke",
          tools: [{ name: "tool1" }],
        },
      });

      const result = await client.listSealTools();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/seal/tools", {
        params: {},
        headers: {},
      });
      expect(result.tools).toHaveLength(1);
    });

    it("listSealTools — passes security context as param and header", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          protocol: "seal/v1",
          attestation_endpoint: "/v1/seal/attest",
          invoke_endpoint: "/v1/seal/invoke",
          tools: [],
        },
      });

      await client.listSealTools("exec-context");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/seal/tools", {
        params: { security_context: "exec-context" },
        headers: { "X-Zaru-Security-Context": "exec-context" },
      });
    });
  });

  // ---------------------------------------------------------------------------
  // Dispatch Gateway
  // ---------------------------------------------------------------------------

  describe("Dispatch Gateway", () => {
    it("dispatchGateway — POST /v1/dispatch-gateway", async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { result: "ok" } });

      const result = await client.dispatchGateway({ type: "generate" });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/dispatch-gateway",
        { type: "generate" },
      );
      expect(result.result).toBe("ok");
    });
  });

  // ---------------------------------------------------------------------------
  // Admin: Tenant Management
  // ---------------------------------------------------------------------------

  describe("Admin: Tenant Management", () => {
    it("createTenant — POST /v1/admin/tenants", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          slug: "acme",
          display_name: "Acme Corp",
          status: "Active",
          tier: "Enterprise",
          keycloak_realm: "acme",
          openbao_namespace: "acme",
          quotas: {
            max_concurrent_executions: 10,
            max_agents: 50,
            max_storage_gb: 100,
          },
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
      });

      const result = await client.createTenant("acme", "Acme Corp");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith("/v1/admin/tenants", {
        slug: "acme",
        display_name: "Acme Corp",
        tier: "enterprise",
      });
      expect(result.quotas.max_agents).toBe(50);
    });

    it("listTenants — GET /v1/admin/tenants", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { tenants: [{ slug: "acme" }], count: 1 },
      });

      const result = await client.listTenants();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/v1/admin/tenants");
      expect(result.count).toBe(1);
    });

    it("suspendTenant — POST /v1/admin/tenants/{slug}/suspend", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { status: "suspended", slug: "acme" },
      });

      const result = await client.suspendTenant("acme");
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/admin/tenants/acme/suspend",
      );
      expect(result.status).toBe("suspended");
    });

    it("deleteTenant — DELETE /v1/admin/tenants/{slug}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "deleted", slug: "acme" },
      });

      const result = await client.deleteTenant("acme");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/admin/tenants/acme",
      );
      expect(result.status).toBe("deleted");
    });
  });

  // ---------------------------------------------------------------------------
  // Admin: Rate Limits
  // ---------------------------------------------------------------------------

  describe("Admin: Rate Limits", () => {
    it("listRateLimitOverrides — GET /v1/admin/rate-limits/overrides with filters", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { overrides: [], count: 0 },
      });

      const result = await client.listRateLimitOverrides("t1", "u1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/admin/rate-limits/overrides",
        {
          params: { tenant_id: "t1", user_id: "u1" },
        },
      );
      expect(result.count).toBe(0);
    });

    it("createRateLimitOverride — POST /v1/admin/rate-limits/overrides", async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          id: "rl1",
          resource_type: "execution",
          bucket: "hourly",
          limit_value: 100,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
        },
      });

      const result = await client.createRateLimitOverride({
        resource_type: "execution",
        bucket: "hourly",
        limit_value: 100,
      });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        "/v1/admin/rate-limits/overrides",
        {
          resource_type: "execution",
          bucket: "hourly",
          limit_value: 100,
        },
      );
      expect(result.limit_value).toBe(100);
    });

    it("deleteRateLimitOverride — DELETE /v1/admin/rate-limits/overrides/{id}", async () => {
      mockAxiosInstance.delete.mockResolvedValue({
        data: { status: "deleted", id: "rl1" },
      });

      const result = await client.deleteRateLimitOverride("rl1");
      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(
        "/v1/admin/rate-limits/overrides/rl1",
      );
      expect(result.status).toBe("deleted");
    });

    it("getRateLimitUsage — GET /v1/admin/rate-limits/usage with scope params", async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          usage: [
            {
              scope_type: "tenant",
              scope_id: "t1",
              resource_type: "execution",
              bucket: "hourly",
              window_start: "2026-01-01",
              counter: 42,
            },
          ],
          count: 1,
        },
      });

      const result = await client.getRateLimitUsage("tenant", "t1");
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(
        "/v1/admin/rate-limits/usage",
        {
          params: { scope_type: "tenant", scope_id: "t1" },
        },
      );
      expect(result.usage[0].counter).toBe(42);
    });
  });

  // ---------------------------------------------------------------------------
  // Health
  // ---------------------------------------------------------------------------

  describe("Health", () => {
    it("healthLive — GET /health/live", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: "ok" } });

      const result = await client.healthLive();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/health/live");
      expect(result.status).toBe("ok");
    });

    it("healthReady — GET /health/ready", async () => {
      mockAxiosInstance.get.mockResolvedValue({ data: { status: "ready" } });

      const result = await client.healthReady();
      expect(mockAxiosInstance.get).toHaveBeenCalledWith("/health/ready");
      expect(result.status).toBe("ready");
    });
  });
});
