import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listKind, listAll, select } from '../src/artifacts/discovery.js';
import { parseSource } from '../src/core/source_parser.js';
import { resolveSource } from '../src/core/git.js';
import { installOne, removeSelection, listInstalled } from '../src/core/lock.js';
import { getAgent, listAgents, resolveAgents } from '../src/registry/agents.js';
import { ProfileSchema } from '../src/artifacts/profiles.js';
import type { Artifact, InstallOpts, AgentConfig } from '../src/core/types.js';

// Build a throwaway "source repo" with the agentry asset layouts:
//   skills/<name>/SKILL.md  (folder per skill)
//   agents/<name>.mdc       (single .mdc file)
//   rules/<name>.mdc        (single .mdc file)
//   profiles/<name>.yaml   (single yaml file)
function makeFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'agentry-fix-'));
  const w = (rel: string, content: string) => {
    const p = join(root, rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, content);
  };
  w('skills/prompt/enhance-prompt/SKILL.md', '---\nname: enhance-prompt\ndescription: rewrite prompts\n---\n# enhance-prompt\n');
  w('skills/quick/SKILL.md', '---\nname: quick\ndescription: single skill, no category\n---\n# quick\n');
  w('agents/frontend-developer.mdc', '---\nname: frontend-developer\ndescription: fe agent\n---\n# fe\n');
  w('rules/ask-dont-guess.mdc', '---\nname: ask-dont-guess\ndescription: ask first\n---\n# ask\n');
  w('profiles/frontend.yaml', 'name: frontend\ndescription: fe bundle\nscope: project\ntargets:\n  agents: [cursor, claude-code]\nartifacts:\n  skills:\n    - id: prompt/enhance-prompt\n  agents:\n    - id: frontend-developer\n');
  return root;
}

describe('discovery', () => {
  it('discovers skills (folder), agents/rules (.mdc), profiles (yaml)', () => {
    const root = makeFixture();
    expect(listKind(root, 'skill').map((a) => a.id)).toEqual(['prompt/enhance-prompt', 'quick']);
    expect(listKind(root, 'agent').map((a) => a.id)).toEqual(['frontend-developer']);
    expect(listKind(root, 'rule').map((a) => a.id)).toEqual(['ask-dont-guess']);
    expect(listKind(root, 'profile').map((a) => a.id)).toEqual(['frontend']);
    const agent = listKind(root, 'agent')[0]!;
    expect(agent.isFile).toBe(true);
    expect(agent.dir).toBe(join(root, 'agents', 'frontend-developer.mdc'));
    rmSync(root, { recursive: true, force: true });
  });

  it('select handles category/name, bare name, and category', () => {
    const root = makeFixture();
    expect(select(root, 'skill', 'prompt/enhance-prompt')).toHaveLength(1);
    expect(select(root, 'skill', 'quick')).toHaveLength(1);
    expect(select(root, 'agent', 'frontend-developer')).toHaveLength(1);
    expect(select(root, 'rule', 'ask-dont-guess')).toHaveLength(1);
    rmSync(root, { recursive: true, force: true });
  });

  it('listAll returns every kind', () => {
    const root = makeFixture();
    expect(listAll(root).length).toBeGreaterThanOrEqual(4);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('source parser', () => {
  it('handles all 6 formats', () => {
    expect(parseSource('Prat011/awesome-llm-skills').kind).toBe('github-shorthand');
    expect(parseSource('Prat011/awesome-llm-skills').url).toBe('https://github.com/Prat011/awesome-llm-skills.git');
    expect(parseSource('https://github.com/vercel-labs/agent-skills').kind).toBe('github-url');
    const tree = parseSource('https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design');
    expect(tree.kind).toBe('github-url');
    expect(tree.subpath).toBe('skills/web-design');
    expect(tree.ref).toBe('main');
    expect(parseSource('https://gitlab.com/org/repo').kind).toBe('gitlab-url');
    expect(parseSource('git@github.com:owner/repo.git').kind).toBe('git-url');
    expect(parseSource('https://example.com/x.git').kind).toBe('git-url');
  });

  it('resolves local paths', () => {
    const root = makeFixture();
    expect(resolveSource(root).root).toBe(root);
    rmSync(root, { recursive: true, force: true });
  });
});

describe('agents registry', () => {
  it('looks up and detects 70+ agents', () => {
    expect(getAgent('cursor')).toBeTruthy();
    expect(getAgent('claude-code')).toBeTruthy();
    expect(getAgent('nope')).toBeNull();
    expect(listAgents().length).toBeGreaterThanOrEqual(70);
    const r = resolveAgents(['cursor', 'claude-code']);
    expect(r.agents).toHaveLength(2);
    expect(r.unknown).toHaveLength(0);
    const r2 = resolveAgents(['cursor', 'nope']);
    expect(r2.unknown).toEqual(['nope']);
    const r3 = resolveAgents(['*']);
    expect(r3.agents.length).toBeGreaterThanOrEqual(70);
  });
});

describe('install / remove', () => {
  it('installs skill (folder) + agent (.mdc) into multiple providers, records lock', () => {
    const root = makeFixture();
    const target = mkdtempSync(join(tmpdir(), 'agentry-tgt-'));
    const opts: InstallOpts = { scope: 'project', dir: target, agents: [], copy: true, dryRun: false };
    const agentList: AgentConfig[] = [getAgent('cursor')!, getAgent('claude-code')!];

    const skill = select(root, 'skill', 'prompt/enhance-prompt')[0]!;
    const skillDests = installOne(skill, opts, agentList, root);
    expect(skillDests).toHaveLength(2);
    expect(existsSync(join(target, '.cursor', 'skills', 'prompt', 'enhance-prompt', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'skills', 'prompt', 'enhance-prompt', 'SKILL.md'))).toBe(true);

    const agentAsset = select(root, 'agent', 'frontend-developer')[0]!;
    const agentDests = installOne(agentAsset, opts, agentList, root);
    expect(agentDests).toHaveLength(2);
    expect(existsSync(join(target, '.cursor', 'agents', 'frontend-developer.mdc'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'agents', 'frontend-developer.mdc'))).toBe(true);

    const lock = JSON.parse(require('node:fs').readFileSync(join(target, '.cursor', 'agentry.lock.json'), 'utf8'));
    expect(lock.items['skill/prompt/enhance-prompt']).toBeTruthy();
    expect(lock.items['agent/frontend-developer']).toBeTruthy();
    expect(lock.items['agent/frontend-developer'].source).toBe(root);

    const r = removeSelection('agent', 'frontend-developer', opts, agentList);
    expect(r.existed).toBe(true);
    expect(existsSync(join(target, '.cursor', 'agents', 'frontend-developer.mdc'))).toBe(false);
    removeSelection('skill', 'prompt/enhance-prompt', opts, agentList);

    rmSync(root, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });

  it('dryRun writes nothing but reports targets', () => {
    const root = makeFixture();
    const target = mkdtempSync(join(tmpdir(), 'agentry-tgt-'));
    const opts: InstallOpts = { scope: 'project', dir: target, agents: [], copy: true, dryRun: true };
    const agentList: AgentConfig[] = [getAgent('cursor')!];
    const skill = select(root, 'skill', 'prompt/enhance-prompt')[0]!;
    const dests = installOne(skill, opts, agentList, root);
    expect(dests).toHaveLength(1);
    expect(existsSync(join(target, '.cursor'))).toBe(false); // nothing written
    rmSync(root, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });

  it('listInstalled reads lockfile entries', () => {
    const root = makeFixture();
    const target = mkdtempSync(join(tmpdir(), 'agentry-tgt-'));
    const opts: InstallOpts = { scope: 'project', dir: target, agents: [], copy: true, dryRun: false };
    const skill = select(root, 'skill', 'prompt/enhance-prompt')[0]!;
    installOne(skill, opts, [getAgent('cursor')!], root);
    const installed = listInstalled(opts);
    expect(installed).toHaveLength(1);
    expect(installed[0]!.id).toBe('skill/prompt/enhance-prompt');
    expect(installed[0]!.source).toBe(root);
    rmSync(root, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });
});

describe('profiles', () => {
  it('parses a valid profile yaml', () => {
    const root = makeFixture();
    const yaml = require('node:fs').readFileSync(join(root, 'profiles', 'frontend.yaml'), 'utf8');
    const { parse } = require('yaml');
    const result = ProfileSchema.safeParse(parse(yaml));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.scope).toBe('project');
      expect(result.data.targets.agents).toEqual(['cursor', 'claude-code']);
      expect(result.data.artifacts.skills[0]!.id).toBe('prompt/enhance-prompt');
    }
    rmSync(root, { recursive: true, force: true });
  });
});
