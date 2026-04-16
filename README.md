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
import { AegisClient } from "@100monkeys-ai/aegis-sdk";

async function main() {
  // Option 1: OAuth2 Client Credentials (service-to-service)
  const client = new AegisClient({
    baseUrl: "https://your-orchestrator.example.com",
    keycloakUrl: "https://auth.example.com",
    realm: "aegis-system",
    clientId: "your-client-id",
    clientSecret: "your-client-secret",
  });

  // Option 2: Static bearer token (API keys, testing)
  const client2 = new AegisClient({
    baseUrl: "https://your-orchestrator.example.com",
    bearerToken: "your-api-key-or-jwt",
  });

  // Start an execution
  const { execution_id } = await client.startExecution(
    "my-agent",
    "Summarize my emails from today",
  );
  console.log(`Execution started: ${execution_id}`);
}

main();
```

## Features

- **Type-safe API**: Full TypeScript type definitions for all endpoints
- **Promise-based**: Modern async/await interface
- **OAuth2 Client Credentials**: Automatic token acquisition and refresh via
  axios interceptor
- **Bearer Token Auth**: Static token support for API keys and testing
- **Manifest validation**: Runtime validation of agent configurations
- **Minimal dependencies**: Lightweight footprint with only essential packages

## API Reference

### Authentication

```typescript
interface AegisClientOptions {
  baseUrl: string;
  bearerToken?: string; // Static bearer token (skips Keycloak)
  keycloakUrl?: string; // Required if bearerToken not set
  realm?: string; // Required if bearerToken not set
  clientId?: string; // Required if bearerToken not set
  clientSecret?: string; // Required if bearerToken not set
  tokenRefreshBufferSecs?: number; // default: 30
}
```

### Agent Lifecycle

```typescript
client.listAgents({ scope?, limit?, agent_type? })
client.getAgent(id)
client.deployAgent(manifest, { force?, scope? })
client.updateAgent(id, update)
client.deleteAgent(id)
client.lookupAgent(name)
client.executeAgent(agentId, input, intent?, contextOverrides?)
client.listAgentVersions(id, limit?)
client.updateAgentScope(id, scope)
client.streamAgentEvents(agentId)
```

### Execution Lifecycle

```typescript
client.startExecution(agentId, input, contextOverrides?, intent?)
client.streamExecution(executionId, token?)
client.listExecutions({ agent_id?, workflow_name?, limit?, offset?, status? })
client.getExecution(executionId)
client.cancelExecution(executionId, reason?)
client.deleteExecution(executionId)
client.getExecutionFile(executionId, path)
```

### Workflow Orchestration

```typescript
client.listWorkflows({ scope?, limit?, visible? })
client.getWorkflow(name)
client.getWorkflowYaml(name)
client.registerWorkflow(yaml, { scope?, force? })
client.deleteWorkflow(name)
client.listWorkflowVersions(name, limit?)
client.updateWorkflowScope(name, scope)
client.runWorkflow(name, input?, contextOverrides?)
client.executeWorkflow(workflowName, input?, version?, timeout?)
```

### Workflow Execution Lifecycle

```typescript
client.listWorkflowExecutions({ workflow_name?, limit?, status? })
client.getWorkflowExecution(executionId)
client.deleteWorkflowExecution(executionId)
client.signalWorkflowExecution(executionId, signalName, payload?)
client.cancelWorkflowExecution(executionId, reason?)
client.getWorkflowExecutionLogs(executionId, limit?, offset?)
client.streamWorkflowExecutionLogs(executionId)
```

### Volumes

```typescript
client.createVolume(label, sizeLimitBytes?)
client.listVolumes(limit?)
client.getVolume(id)
client.renameVolume(id, label)
client.deleteVolume(id)
client.getQuota()
client.listFiles(volumeId, path?)
client.downloadFile(volumeId, path)
client.uploadFile(volumeId, path, file)
client.mkdir(volumeId, path)
client.movePath(volumeId, from, to)
client.deletePath(volumeId, path)
```

### Credentials

```typescript
client.listCredentials()
client.storeApiKeyCredential(provider, apiKeyValue, metadata?)
client.oauthInitiate(provider, redirectUri?, scopes?)
client.oauthCallback(code, state)
client.devicePoll(deviceCode, provider)
client.getCredential(id)
client.revokeCredential(id)
client.rotateCredential(id, request?)
client.listGrants(credentialId)
client.addGrant(credentialId, grant)
client.revokeGrant(credentialId, grantId)
```

### Secrets

```typescript
client.listSecrets(pathPrefix?)
client.getSecret(path)
client.writeSecret(path, value, encoding?)
client.deleteSecret(path)
```

### API Keys

```typescript
client.listApiKeys()
client.createApiKey(name, scopes, expiresAt?)
client.revokeApiKey(id)
```

### Colony

```typescript
client.listMembers(limit?)
client.inviteMember(email, role)
client.removeMember(userId)
client.updateRole(userId, role)
client.getSamlConfig()
client.setSamlConfig(config)
client.getSubscription()
```

### Cluster

```typescript
client.getClusterStatus()
client.listClusterNodes(limit?)
```

### Swarms

```typescript
client.listSwarms(limit?)
client.getSwarm(swarmId)
```

### Stimuli

```typescript
client.ingestStimulus(payload)
client.listStimuli(limit?)
client.getStimulus(stimulusId)
client.sendWebhook(source, payload)
```

### Observability

```typescript
client.listSecurityIncidents(limit?)
client.listStorageViolations(limit?)
client.getDashboardSummary()
```

### Cortex

```typescript
client.listCortexPatterns(query?, limit?)
client.getCortexSkills(limit?)
client.getCortexMetrics(metricType?)
```

### User

```typescript
client.getUserRateLimitUsage();
```

### Human Approvals

```typescript
client.listPendingApprovals()
client.getPendingApproval(id)
client.approveRequest(id, request?)
client.rejectRequest(id, request)
```

### SEAL

```typescript
client.attestSeal(payload)
client.invokeSeal(payload)
client.listSealTools(securityContext?)
```

### Dispatch Gateway

```typescript
client.dispatchGateway(payload);
```

### Admin: Tenant Management

```typescript
client.createTenant(slug, displayName, tier?)
client.listTenants()
client.suspendTenant(slug)
client.deleteTenant(slug)
```

### Admin: Rate Limits

```typescript
client.listRateLimitOverrides(tenantId?, userId?)
client.createRateLimitOverride(payload)
client.deleteRateLimitOverride(overrideId)
client.getRateLimitUsage(scopeType, scopeId)
```

### Health

```typescript
client.healthLive();
client.healthReady();
```

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
