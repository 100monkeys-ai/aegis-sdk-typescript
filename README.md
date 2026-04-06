# AEGIS TypeScript SDK

Official TypeScript/JavaScript SDK for building secure, autonomous agents with the
AEGIS runtime.

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL%203.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![GitHub Packages](https://img.shields.io/badge/packages-%40100monkeys--ai%2Faegis--sdk-blue)](https://github.com/orgs/100monkeys-ai/packages)

## Installation

```bash
npm config set @100monkeys-ai:registry https://npm.pkg.github.com
npm install @100monkeys-ai/aegis-sdk
```

## Quick Start

```typescript
import { AegisClient } from '@100monkeys-ai/aegis-sdk';

async function main() {
  // Create a client — token acquisition and refresh are handled automatically
  const client = new AegisClient({
    baseUrl: 'https://your-orchestrator.example.com',
    keycloakUrl: 'https://auth.example.com',
    realm: 'aegis-system',
    clientId: 'your-client-id',
    clientSecret: 'your-client-secret',
  });

  // Start an execution
  const { execution_id } = await client.startExecution(
    'my-agent',
    'Summarize my emails from today',
  );
  console.log(`Execution started: ${execution_id}`);

  // Stream execution events
  const stream = await client.streamExecution(execution_id);
  // Handle SSE events from the stream...
}

main();
```

## Features

- **Type-safe API**: Full TypeScript type definitions
- **Promise-based**: Modern async/await interface
- **OAuth2 Client Credentials**: Automatic token acquisition and refresh via
  axios interceptor
- **Manifest validation**: Runtime validation of agent configurations
- **Minimal dependencies**: Lightweight footprint with only essential packages

## Agent Manifest

Create an `agent.yaml` file:

```yaml
version: "1.0"
agent:
  name: "my-agent"
  runtime: "node:20"
  memory: true

permissions:
  network:
    allow:
      - "api.openai.com"
  fs:
    read: ["/data/inputs"]
    write: ["/data/outputs"]

tools:
  - "mcp:gmail"

env:
  OPENAI_API_KEY: "secret:openai-key"
```

## API Reference

### AegisClientOptions

```typescript
interface AegisClientOptions {
  baseUrl: string;
  keycloakUrl: string;
  realm: string;
  clientId: string;
  clientSecret: string;
  tokenRefreshBufferSecs?: number; // default: 30
}
```

### AegisClient

The client authenticates using OAuth2 Client Credentials. On each request, an axios
interceptor calls Keycloak to obtain a bearer token (or reuses a cached one) and
attaches it as an `Authorization: Bearer <token>` header. Tokens are proactively
refreshed `tokenRefreshBufferSecs` before expiry.

```typescript
class AegisClient {
  constructor(options: AegisClientOptions)

  // Execution
  startExecution(agentId: string, input: string, contextOverrides?: any, intent?: string): Promise<StartExecutionResponse>
  streamExecution(executionId: string, token?: string): Promise<any>

  // Human Approvals
  listPendingApprovals(): Promise<{ pending_requests: PendingApproval[]; count: number }>
  getPendingApproval(id: string): Promise<{ request: PendingApproval }>
  approveRequest(id: string, request?: ApprovalRequest): Promise<ApprovalResponse>
  rejectRequest(id: string, request: RejectionRequest): Promise<ApprovalResponse>

  // SEAL
  attestSeal(payload: any): Promise<SealAttestationResponse>
  invokeSeal(payload: any): Promise<any>
  listSealTools(securityContext?: string): Promise<SealToolsResponse>

  // Dispatch Gateway
  dispatchGateway(payload: any): Promise<any>

  // Stimulus
  ingestStimulus(payload: any): Promise<any>
  sendWebhook(source: string, payload: any): Promise<any>

  // Workflow Logs
  getWorkflowExecutionLogs(executionId: string, limit?: number, offset?: number): Promise<WorkflowExecutionLogs>
  streamWorkflowExecutionLogs(executionId: string): Promise<any>

  // Admin: Tenant Management
  createTenant(slug: string, displayName: string, tier?: string): Promise<Tenant>
  listTenants(): Promise<{ tenants: Tenant[]; count: number }>
  suspendTenant(slug: string): Promise<{ status: string; slug: string }>
  deleteTenant(slug: string): Promise<{ status: string; slug: string }>

  // Admin: Rate Limits
  listRateLimitOverrides(tenantId?: string, userId?: string): Promise<{ overrides: RateLimitOverride[]; count: number }>
  createRateLimitOverride(payload: any): Promise<RateLimitOverride>
  deleteRateLimitOverride(overrideId: string): Promise<{ status: string; id: string }>
  getRateLimitUsage(scopeType: string, scopeId: string): Promise<{ usage: UsageRecord[]; count: number }>

  // Health
  healthLive(): Promise<{ status: string }>
  healthReady(): Promise<{ status: string }>
}
```

### Types

```typescript
interface StartExecutionResponse {
  execution_id: string;
}

interface PendingApproval {
  id: string;
  execution_id: string;
  prompt: string;
  created_at: string;
  timeout_seconds: number;
}

interface ApprovalRequest {
  feedback?: string;
  approved_by?: string;
}

interface RejectionRequest {
  reason: string;
  rejected_by?: string;
}

interface ApprovalResponse {
  status: string;
}

interface SealAttestationResponse {
  security_token: string;
}

interface SealToolsResponse {
  protocol: string;
  attestation_endpoint: string;
  invoke_endpoint: string;
  security_context?: string;
  tools: any[];
}

interface WorkflowExecutionLogs {
  execution_id: string;
  events: any[];
  count: number;
  limit: number;
  offset: number;
}

interface Tenant {
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

interface RateLimitOverride {
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

interface UsageRecord {
  scope_type: string;
  scope_id: string;
  resource_type: string;
  bucket: string;
  window_start: string;
  counter: number;
}
```

## Examples

See the [examples repository](https://github.com/100monkeys-ai/aegis-examples) for
complete examples:

- Email Summarizer
- Web Researcher
- Code Reviewer

## Development

### Setup

```bash
# Clone the repository
git clone https://github.com/100monkeys-ai/aegis-sdk-typescript
cd aegis-sdk-typescript

# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Lint
npm run lint
```

### Project Structure

```text
aegis-sdk-typescript/
├── src/
│   ├── client.ts      # Main client
│   ├── manifest.ts    # Manifest types
│   ├── types.ts       # Common types
│   └── index.ts       # Exports
├── dist/              # Build output
├── package.json
└── tsconfig.json
```

## Documentation

- [API Documentation](https://docs.100monkeys.ai/docs/reference/sdk-typescript)

## License

GNU Affero General Public License v3.0 - See [LICENSE](LICENSE) for details.

## Related Repositories

- [aegis-orchestrator](https://github.com/100monkeys-ai/aegis-orchestrator) -
  Core runtime
- [aegis-sdk-python](https://github.com/100monkeys-ai/aegis-sdk-python) -
  Python SDK
- [aegis-examples](https://github.com/100monkeys-ai/aegis-examples) - Example agents

---

**Build secure AI agents with TypeScript.**
