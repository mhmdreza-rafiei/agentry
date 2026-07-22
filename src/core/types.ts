// Shared types for agentry.
export type ArtifactKind = 'skill' | 'rule' | 'agent' | 'profile';
export type Scope = 'global' | 'project';

export const ARTIFACT_KINDS: ArtifactKind[] = ['skill', 'rule', 'agent', 'profile'];

// A discovered artifact in a source root.
export interface Artifact {
  kind: ArtifactKind;
  category: string | null;
  name: string;
  id: string; // category/name or name
  dir: string; // source path (file for .mdc, folder for skill/script)
  isFile: boolean; // true for .mdc agents/rules, false for skill folders
  description: string;
}

// A target agent provider (cursor, claude-code, ...).
export interface AgentConfig {
  name: string;
  displayName: string;
  skillsDir: string; // project skills install dir
  globalSkillsDir: string | null; // global skills install dir
  configDir: string; // project config root (derived from skillsDir minus /skills)
  globalConfigDir: string; // global config root
  detectInstalled: () => boolean;
}

// Install options.
export interface InstallOpts {
  scope: Scope;
  dir?: string; // explicit project dir (project scope only)
  agents: string[]; // target agent names
  copy: boolean; // copy vs symlink
  dryRun: boolean;
}

// Lockfile entry per installed artifact.
export interface LockEntry {
  source: string | null;
  installedAt: string;
  agents: string[];
  kind: ArtifactKind;
}

export interface LockFile {
  version: number;
  items: Record<string, LockEntry>;
}
