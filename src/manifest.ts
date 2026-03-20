// Declare require for dynamic imports
declare const require: (module: string) => any;

// Node.js file I/O - dynamically imported in Node.js environments
let readFileSync: (path: string, encoding: string) => string;
let writeFileSync: (path: string, content: string, encoding: string) => void;

// YAML parser - lazy loaded
let parse: (content: string) => any;
let stringify: (obj: any) => string;

// Initialize Node.js modules if available
try {
  const fs = require('fs');
  readFileSync = fs.readFileSync;
  writeFileSync = fs.writeFileSync;
} catch (_e) {
  // Running in browser or Deno; file I/O functions will be unavailable
}

try {
  const yaml = require('yaml');
  parse = yaml.parse;
  stringify = yaml.stringify;
} catch (_e) {
  // Fallback if yaml module is not available
}

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
 * Image pull policy strategy.
 */
export enum ImagePullPolicy {
  /** Always pull from registry, even if cached locally. */
  Always = 'Always',
  /** Use local cache if available; pull only if missing (default). */
  IfNotPresent = 'IfNotPresent',
  /** Never pull; use only cached images (fail if missing). */
  Never = 'Never',
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
  advanced?: AdvancedConfig;
}

/**
 * Runtime configuration.
 *
 * Supports two mutually exclusive modes:
 * - StandardRuntime: language + version (resolved to official Docker image)
 * - CustomRuntime: image (user-supplied fully-qualified container image)
 *
 * Validation ensures exactly one mode is specified (not both).
 */
export interface RuntimeConfig {
  /** Programming language (python, javascript, typescript, rust, go) - StandardRuntime */
  language?: string;
  /** Language version - StandardRuntime */
  version?: string;
  /** Custom Docker image (fully-qualified: registry/repo:tag) - CustomRuntime */
  image?: string;
  /** Image pull policy (for custom runtimes) */
  image_pull_policy?: ImagePullPolicy;
  /** Isolation mode (inherit, firecracker, docker, process) */
  isolation?: string;
  /** LLM model alias */
  model?: string;
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
  /** LLM timeout in seconds (default: 300) */
  llm_timeout_seconds?: number;
  /** Acceptance criteria */
  validation?: ValidationConfig;
}

/**
 * Advanced configuration options.
 */
export interface AdvancedConfig {
  /** Number of pre-warmed container instances */
  warm_pool_size?: number;
  /** Enable multi-agent coordination */
  swarm_enabled?: boolean;
  /** Custom startup script */
  startup_script?: string;
  /** Custom bootstrap script path (for CustomRuntime only) */
  bootstrap_path?: string;
}

/**
 * Validation configuration.
 */
export type ValidationConfig = Record<string, never>;

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
  if (manifest.kind !== 'Agent') {
    throw new Error(`Invalid kind: expected 'Agent', got '${manifest.kind}'`);
  }
  
  // Validate name format (DNS label)
  const name = manifest.metadata.name;
  const dnsLabelRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  if (!dnsLabelRegex.test(name)) {
    throw new Error(`Invalid metadata.name: '${name}' must be lowercase alphanumeric with hyphens`);
  }
  
  // Validate runtime configuration (mutual exclusion)
  validateRuntimeConfig(manifest.spec.runtime);
}

/**
 * Validate runtime configuration (mutual exclusion).
 */
export function validateRuntimeConfig(runtime: RuntimeConfig): void {
  const hasStandard = runtime.language && runtime.version;
  const hasLanguageOnly = runtime.language && !runtime.version;
  const hasVersionOnly = runtime.version && !runtime.language;
  const hasCustom = runtime.image;
  
  if (hasLanguageOnly) {
    throw new Error('language requires version to be specified');
  }
  if (hasVersionOnly) {
    throw new Error('version requires language to be specified');
  }
  if (hasStandard && hasCustom) {
    throw new Error('cannot specify both image and language+version (mutually exclusive)');
  }
  if (!hasStandard && !hasCustom) {
    throw new Error('must specify either standard runtime (language+version) or custom runtime (image)');
  }
  
  if (hasCustom && runtime.image && !runtime.image.includes('/')) {
    throw new Error('image must be fully-qualified: registry/repo:tag (e.g., ghcr.io/org/image:v1.0)');
  }
}

/**
 * Fluent builder for AgentManifest.
 *
 * Supports both standard and custom runtimes:
 * - Standard: new AgentManifestBuilder("name", "python", "3.11")
 * - Custom: new AgentManifestBuilder("name").withImage("ghcr.io/org/agent:v1.0")
 */
export class AgentManifestBuilder {
  private manifest: AgentManifest;
  
  constructor(name: string, language?: string, version?: string) {
    this.manifest = {
      apiVersion: '100monkeys.ai/v1',
      kind: 'Agent',
      metadata: {
        name,
        version: '1.0.0',
      },
      spec: {
        runtime: {
          language,
          version,
          isolation: 'inherit',
          image_pull_policy: ImagePullPolicy.IfNotPresent,
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
  
  withImage(image: string): this {
    this.manifest.spec.runtime.image = image;
    return this;
  }
  
  withImagePullPolicy(policy: ImagePullPolicy): this {
    this.manifest.spec.runtime.image_pull_policy = policy;
    return this;
  }
  
  withBootstrapPath(path: string): this {
    if (!this.manifest.spec.advanced) {
      this.manifest.spec.advanced = {};
    }
    this.manifest.spec.advanced.bootstrap_path = path;
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
