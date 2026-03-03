# AEGIS TypeScript SDK

Official TypeScript/JavaScript SDK for building secure, autonomous agents with the AEGIS runtime.

[![License: AGPL-3.0](https://img.shields.io/badge/license-AGPL%203.0-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/typescript-5.3%2B-blue.svg)](https://www.typescriptlang.org/)
[![npm](https://img.shields.io/npm/v/@aegis/sdk)](https://www.npmjs.com/package/@aegis/sdk)

## Installation

```bash
npm install @aegis/sdk
# or
yarn add @aegis/sdk
# or
pnpm add @aegis/sdk
```

## Quick Start

```typescript
import { AegisClient, loadManifest } from '@aegis/sdk';

async function main() {
  // Create a client
  const client = new AegisClient('https://api.100monkeys.ai', 'your-api-key');

  // Load agent manifest
  const manifest = loadManifest('agent.yaml');

  // Deploy the agent
  const deployment = await client.deployAgent(manifest);
  console.log(`Agent deployed: ${deployment.agent_id}`);

  // Execute a task
  const output = await client.executeTask(deployment.agent_id, {
    prompt: 'Summarize my emails from today',
    context: {},
  });
  console.log('Result:', output.result);
}

main();
```

## Features

- **Type-safe API**: Full TypeScript type definitions
- **Promise-based**: Modern async/await interface
- **Manifest validation**: Runtime validation of agent configurations
- **Zero dependencies**: Lightweight and fast

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

### AegisClient

```typescript
class AegisClient {
  constructor(baseUrl: string, apiKey?: string)
  deployAgent(manifest: AgentManifest): Promise<DeploymentResponse>
  executeTask(agentId: string, input: TaskInput): Promise<TaskOutput>
  getAgentStatus(agentId: string): Promise<AgentStatus>
  terminateAgent(agentId: string): Promise<void>
}
```

### Types

```typescript
interface AgentManifest {
  version: string;
  agent: AgentSpec;
  permissions: Permissions;
  tools: string[];
  env?: Record<string, string>;
}

interface TaskInput {
  prompt: string;
  context?: any;
}

interface TaskOutput {
  result: any;
  logs: string[];
}
```

## Examples

See the [examples repository](https://github.com/100monkeys-ai/aegis-examples) for complete examples:

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

```markdown
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

- [API Documentation](https://docs.100monkeys.ai/sdk/typescript)

## 📜 License

GNU Affero General Public License v3.0 - See [LICENSE](LICENSE) for details.

## Related Repositories

- [aegis-orchestrator](https://github.com/100monkeys-ai/aegis-orchestrator) - Core runtime
- [aegis-sdk-python](https://github.com/100monkeys-ai/aegis-sdk-python) - Python SDK
- [aegis-examples](https://github.com/100monkeys-ai/aegis-examples) - Example agents

---

**Build secure AI agents with TypeScript.**
