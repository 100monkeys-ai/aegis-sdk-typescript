import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';

/**
 * AEGIS agent manifest (K8s-style format, v1.0).
 */
export interface AgentManifest {
  apiVersion: string;
  kind: string;
  metadata: ManifestMetadata;
  spec: AgentSpec;
}

/**
 * Kubernetes-style metadata.
 */
export interface ManifestMetadata {
  /** Unique agent name (DNS label format) */
  name: string;
  /** Manifest schema version (semantic versioning) */
  version: string;
  /** Human-readable description */
  description?: string;
  /** Key-value labels for categorization */
  labels?: Record<string, string>;
  /** Non-identifying metadata */
  annotations?: Record<string, string>;
}

/**
 * Agent specification.
 */
export interface AgentSpec {
  runtime: RuntimeConfig;
  task?: TaskConfig;
  execution?: ExecutionStrategy;
  security?: SecurityConfig;
  tools?: string[];
  env?: Record<string, string>;
}

/**
 * Runtime configuration.
 */
export interface RuntimeConfig {
  /** Programming language (python, javascript, typescript, rust, go) */
  language: string;
  /** Language version */
  version: string;
  /** Isolation mode (inherit, firecracker, docker, process) */
  isolation?: string;
  /** Automatically pull runtime image */
  autopull?: boolean;
}

/**
 * Task definition.
 */
export interface TaskConfig {
  /** Pre-built instruction packages from agentskills.io */
  agentskills?: string[];
  /** Steering instructions */
  instruction?: string;
  /** Custom LLM prompt template */
  prompt_template?: string;
  /** Structured input parameters */
  input_data?: Record<string, any>;
}

/**
 * Execution strategy.
 */
export interface ExecutionStrategy {
  /** Execution mode: one-shot | iterative */
  mode?: string;
  /** Maximum refinement loops (for iterative mode) */
  max_iterations?: number;
  /** Acceptance criteria */
  validation?: ValidationConfig;
}

/**
 * Validation configuration.
 */
export interface ValidationConfig {
  // Add validation fields as needed
}

/**
 * Security configuration.
 */
export interface SecurityConfig {
  network?: NetworkPolicy;
  filesystem?: FilesystemPolicy;
  resources?: ResourceLimits;
}

/**
 * Network access policy.
 */
export interface NetworkPolicy {
  /** Policy mode: allow (allowlist) | deny (denylist) | none */
  mode?: string;
  /** Allowed domains/IPs */
  allowlist?: string[];
  /** Denied domains/IPs */
  denylist?: string[];
}

/**
 * Filesystem access policy.
 */
export interface FilesystemPolicy {
  /** Readable paths */
  read?: string[];
  /** Writable paths */
  write?: string[];
  /** Read-only mode */
  read_only?: boolean;
}

/**
 * Resource limits.
 */
export interface ResourceLimits {
  /** CPU quota in millicores (1000 = 1 CPU core) */
  cpu?: number;
  /** Memory limit (human-readable: "512Mi", "1Gi", "2G") */
  memory?: string;
  /** Disk space limit */
  disk?: string;
  /** Execution timeout (human-readable duration) */
  timeout?: string;
}

/**
 * Load a manifest from a YAML file.
 */
export function loadManifest(path: string): AgentManifest {
  const content = readFileSync(path, 'utf-8');
  const manifest = parse(content) as AgentManifest;
  validateManifest(manifest);
  return manifest;
}

/**
 * Save a manifest to a YAML file.
 */
export function saveManifest(manifest: AgentManifest, path: string): void {
  validateManifest(manifest);
  const yaml = stringify(manifest);
  writeFileSync(path, yaml, 'utf-8');
}

/**
 * Validate manifest structure and constraints.
 */
export function validateManifest(manifest: AgentManifest): void {
  // Validate API version
  if (manifest.apiVersion !== '100monkeys.ai/v1') {
    throw new Error(`Invalid apiVersion: expected '100monkeys.ai/v1', got '${manifest.apiVersion}'`);
  }
  
  // Validate kind
  if (manifest.kind !== 'AgentManifest') {
    throw new Error(`Invalid kind: expected 'AgentManifest', got '${manifest.kind}'`);
  }
  
  // Validate name format (DNS label)
  const name = manifest.metadata.name;
  const dnsLabelRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  if (!dnsLabelRegex.test(name)) {
    throw new Error(`Invalid metadata.name: '${name}' must be lowercase alphanumeric with hyphens`);
  }
}

/**
 * Fluent builder for AgentManifest.
 */
export class AgentManifestBuilder {
  private manifest: AgentManifest;
  
  constructor(name: string, language: string, version: string) {
    this.manifest = {
      apiVersion: '100monkeys.ai/v1',
      kind: 'AgentManifest',
      metadata: {
        name,
        version: '1.0.0',
      },
      spec: {
        runtime: {
          language,
          version,
          isolation: 'inherit',
          autopull: true,
        },
      },
    };
  }
  
  withDescription(description: string): this {
    this.manifest.metadata.description = description;
    return this;
  }
  
  withLabel(key: string, value: string): this {
    if (!this.manifest.metadata.labels) {
      this.manifest.metadata.labels = {};
    }
    this.manifest.metadata.labels[key] = value;
    return this;
  }
  
  withInstruction(instruction: string): this {
    if (!this.manifest.spec.task) {
      this.manifest.spec.task = {};
    }
    this.manifest.spec.task.instruction = instruction;
    return this;
  }
  
  withAgentSkill(skill: string): this {
    if (!this.manifest.spec.task) {
      this.manifest.spec.task = {};
    }
    if (!this.manifest.spec.task.agentskills) {
      this.manifest.spec.task.agentskills = [];
    }
    this.manifest.spec.task.agentskills.push(skill);
    return this;
  }
  
  withExecutionMode(mode: string, maxIterations: number = 10): this {
    if (!this.manifest.spec.execution) {
      this.manifest.spec.execution = {};
    }
    this.manifest.spec.execution.mode = mode;
    this.manifest.spec.execution.max_iterations = maxIterations;
    return this;
  }
  
  withNetworkAllow(domains: string[]): this {
    if (!this.manifest.spec.security) {
      this.manifest.spec.security = {};
    }
    if (!this.manifest.spec.security.network) {
      this.manifest.spec.security.network = {};
    }
    this.manifest.spec.security.network.mode = 'allow';
    this.manifest.spec.security.network.allowlist = domains;
    return this;
  }
  
  withTool(tool: string): this {
    if (!this.manifest.spec.tools) {
      this.manifest.spec.tools = [];
    }
    this.manifest.spec.tools.push(tool);
    return this;
  }
  
  withEnv(key: string, value: string): this {
    if (!this.manifest.spec.env) {
      this.manifest.spec.env = {};
    }
    this.manifest.spec.env[key] = value;
    return this;
  }
  
  build(): AgentManifest {
    validateManifest(this.manifest);
    return this.manifest;
  }
}
