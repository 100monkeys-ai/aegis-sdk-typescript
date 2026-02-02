import { readFileSync, writeFileSync } from 'fs';
import { parse, stringify } from 'yaml';

/**
 * An AEGIS agent manifest (agent.yaml).
 */
export interface AgentManifest {
  version: string;
  agent: AgentSpec;
  permissions: Permissions;
  tools: string[];
  env?: Record<string, string>;
}

export interface AgentSpec {
  name: string;
  runtime: string;
  memory?: boolean;
}

export interface Permissions {
  network: NetworkPermissions;
  fs: FilesystemPermissions;
}

export interface NetworkPermissions {
  allow: string[];
}

export interface FilesystemPermissions {
  read?: string[];
  write?: string[];
}

/**
 * Load a manifest from a YAML file.
 */
export function loadManifest(path: string): AgentManifest {
  const content = readFileSync(path, 'utf-8');
  return parse(content) as AgentManifest;
}

/**
 * Save a manifest to a YAML file.
 */
export function saveManifest(manifest: AgentManifest, path: string): void {
  const yaml = stringify(manifest);
  writeFileSync(path, yaml, 'utf-8');
}
