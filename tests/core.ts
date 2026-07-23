import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync, existsSync, readFileSync, symlinkSync, lstatSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listKind, listAll, select } from '../src/artifacts/discovery.js';
import { parseSource, sourcesEqual, sourceIdentity, isExplicitSource, redactUrl } from '../src/core/source_parser.js';
import { resolveSource, assertInsideRoot } from '../src/core/git.js';
import { installOne, removeSelection, listInstalled, readLock, writeLock } from '../src/core/lock.js';
import { getAgent, listAgents, resolveAgents } from '../src/registry/agents.js';
import { ProfileSchema } from '../src/artifacts/profiles.js';
import { scaffoldSkill, scaffoldMdc, scaffoldProfile, scaffoldScript } from '../src/artifacts/scaffold.js';
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

  it('resolves local paths', async () => {
    const root = makeFixture();
    expect((await resolveSource(root)).root).toBe(root);
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
    // cursor is universal (.agents/skills) -> canonical install there.
    expect(existsSync(join(target, '.agents', 'skills', 'prompt', 'enhance-prompt', 'SKILL.md'))).toBe(true);
    // claude-code is non-universal -> copy of canonical into .claude/skills (opts.copy).
    expect(existsSync(join(target, '.claude', 'skills', 'prompt', 'enhance-prompt', 'SKILL.md'))).toBe(true);

    const agentAsset = select(root, 'agent', 'frontend-developer')[0]!;
    const agentDests = installOne(agentAsset, opts, agentList, root);
    expect(agentDests).toHaveLength(2);
    // cursor configDir is .agents (derived from .agents/skills) -> .agents/agents/<name>.mdc
    expect(existsSync(join(target, '.agents', 'agents', 'frontend-developer.mdc'))).toBe(true);
    expect(existsSync(join(target, '.claude', 'agents', 'frontend-developer.mdc'))).toBe(true);

    const lock = JSON.parse(require('node:fs').readFileSync(join(target, '.agentry', 'lock.json'), 'utf8'));
    expect(lock.items['skill/prompt/enhance-prompt']).toBeTruthy();
    expect(lock.items['agent/frontend-developer']).toBeTruthy();
    expect(lock.items['agent/frontend-developer'].source).toBe(root);

    const r = removeSelection('agent', 'frontend-developer', opts, agentList);
    expect(r.existed).toBe(true);
    expect(existsSync(join(target, '.agents', 'agents', 'frontend-developer.mdc'))).toBe(false);
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

  it('reads legacy lock and migrates to .agentry/lock.json on write', () => {
    const target = mkdtempSync(join(tmpdir(), 'agentry-tgt-'));
    const legacy = join(target, '.cursor', 'agentry.lock.json');
    mkdirSync(join(target, '.cursor'), { recursive: true });
    const legacyLock = {
      version: 1,
      items: {
        'skill/foo': { source: '/x', installedAt: '2020-01-01T00:00:00.000Z', agents: ['cursor'], kind: 'skill' },
      },
    };
    writeFileSync(legacy, JSON.stringify(legacyLock));
    const opts: InstallOpts = { scope: 'project', dir: target, agents: [], copy: true, dryRun: false };
    expect(readLock(opts).items['skill/foo']).toBeTruthy();
    writeLock(opts, readLock(opts));
    expect(existsSync(join(target, '.agentry', 'lock.json'))).toBe(true);
    expect(existsSync(legacy)).toBe(false);
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

  it('remove deletes canonical .agents/skills folders not only the lock', () => {
    const root = makeFixture();
    const target = mkdtempSync(join(tmpdir(), 'agentry-tgt-'));
    const opts: InstallOpts = { scope: 'project', dir: target, agents: [], copy: true, dryRun: false };
    const agents: AgentConfig[] = [getAgent('cursor')!, getAgent('claude-code')!];
    installOne(select(root, 'skill', 'prompt/enhance-prompt')[0]!, opts, agents, root);
    const skillPath = join(target, '.agents', 'skills', 'prompt', 'enhance-prompt');
    const claudePath = join(target, '.claude', 'skills', 'prompt', 'enhance-prompt');
    expect(existsSync(skillPath)).toBe(true);
    expect(existsSync(claudePath)).toBe(true);

    const r = removeSelection('skill', 'prompt/enhance-prompt', opts, agents);
    expect(r.existed).toBe(true);
    expect(existsSync(skillPath)).toBe(false);
    expect(existsSync(claudePath)).toBe(false);
    // Last skill gone → empty skills/.agents/.agentry pruned.
    expect(existsSync(join(target, '.agents', 'skills'))).toBe(false);
    expect(existsSync(join(target, '.agents'))).toBe(false);
    expect(existsSync(join(target, '.agentry'))).toBe(false);
    expect(readLock(opts).items['skill/prompt/enhance-prompt']).toBeUndefined();
    expect(r.removedPaths.length).toBeGreaterThan(0);

    rmSync(root, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });

  it('prunes empty kind folders but keeps siblings', () => {
    const root = makeFixture();
    const target = mkdtempSync(join(tmpdir(), 'agentry-tgt-'));
    const opts: InstallOpts = { scope: 'project', dir: target, agents: [], copy: true, dryRun: false };
    const agents: AgentConfig[] = [getAgent('cursor')!];
    installOne(select(root, 'skill', 'prompt/enhance-prompt')[0]!, opts, agents, root);
    installOne(select(root, 'skill', 'quick')[0]!, opts, agents, root);

    removeSelection('skill', 'prompt/enhance-prompt', opts, agents);
    expect(existsSync(join(target, '.agents', 'skills', 'prompt'))).toBe(false);
    expect(existsSync(join(target, '.agents', 'skills', 'quick'))).toBe(true);
    expect(existsSync(join(target, '.agents', 'skills'))).toBe(true);
    expect(existsSync(join(target, '.agentry', 'lock.json'))).toBe(true);

    removeSelection('skill', 'quick', opts, agents);
    expect(existsSync(join(target, '.agents'))).toBe(false);
    expect(existsSync(join(target, '.agentry'))).toBe(false);

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

describe('source identity', () => {
  it('equates github shorthand with github URL', () => {
    expect(sourcesEqual('vercel-labs/agent-skills', 'https://github.com/vercel-labs/agent-skills')).toBe(true);
    expect(sourcesEqual('vercel-labs/agent-skills', 'https://github.com/vercel-labs/agent-skills.git')).toBe(true);
    expect(sourceIdentity('owner/repo')).toContain('github.com/owner/repo');
    expect(isExplicitSource('./local-skills')).toBe(true);
    expect(isExplicitSource('https://github.com/a/b')).toBe(true);
    expect(isExplicitSource('prompt/enhance-prompt')).toBe(false);
  });
});

describe('remove by source', () => {
  it('removes only lock entries matching the install source', () => {
    const rootA = makeFixture();
    const rootB = mkdtempSync(join(tmpdir(), 'agentry-src-b-'));
    mkdirSync(join(rootB, 'skills', 'other'), { recursive: true });
    writeFileSync(join(rootB, 'skills', 'other', 'SKILL.md'), '---\nname: other\ndescription: b\n---\n# other\n');
    const target = mkdtempSync(join(tmpdir(), 'agentry-tgt-'));
    const opts: InstallOpts = { scope: 'project', dir: target, agents: [], copy: true, dryRun: false };
    const agents: AgentConfig[] = [getAgent('cursor')!];

    installOne(select(rootA, 'skill', 'prompt/enhance-prompt')[0]!, opts, agents, 'author/repo-a');
    installOne(select(rootB, 'skill', 'other')[0]!, opts, agents, 'author/repo-b');

    const r = removeSelection('skill', undefined, opts, agents, 'author/repo-a');
    expect(r.removedKeys).toEqual(['skill/prompt/enhance-prompt']);
    expect(existsSync(join(target, '.agents', 'skills', 'prompt', 'enhance-prompt'))).toBe(false);
    expect(existsSync(join(target, '.agents', 'skills', 'other', 'SKILL.md'))).toBe(true);

    rmSync(rootA, { recursive: true, force: true });
    rmSync(rootB, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });
});

describe('scaffold / init', () => {
  it('scaffolds skill with references, rule with alwaysApply, profile yaml, script folder', () => {
    const base = mkdtempSync(join(tmpdir(), 'agentry-init-'));
    const skill = scaffoldSkill({ name: 'enhance-prompt', category: 'prompt', description: 'rewrite', baseDir: base });
    expect(existsSync(join(base, 'skills', 'prompt', 'enhance-prompt', 'SKILL.md'))).toBe(true);
    expect(existsSync(join(base, 'skills', 'prompt', 'enhance-prompt', 'references', 'TEMPLATE.md'))).toBe(true);
    expect(skill.id).toBe('prompt/enhance-prompt');

    const rule = scaffoldMdc({
      kind: 'rule',
      name: 'ask-dont-guess',
      description: "Don't guess",
      alwaysApply: true,
      baseDir: base,
    });
    const ruleBody = readFileSync(rule.paths[0]!, 'utf8');
    expect(ruleBody).toContain('alwaysApply: true');

    const profile = scaffoldProfile({
      name: 'frontend',
      description: 'fe',
      agents: ['cursor'],
      skills: [{ id: 'prompt/enhance-prompt', source: 'author/repo' }],
      baseDir: base,
    });
    expect(existsSync(join(base, 'profiles', 'frontend.yaml'))).toBe(true);
    const { parse } = require('yaml');
    const parsed = parse(readFileSync(profile.paths[0]!, 'utf8'));
    expect(parsed.artifacts.skills[0].id).toBe('prompt/enhance-prompt');

    const script = scaffoldScript({ name: 'deploy', category: 'ci', baseDir: base });
    expect(existsSync(join(base, 'scripts', 'ci', 'deploy', 'README.md'))).toBe(true);
    expect(script.id).toBe('ci/deploy');

    rmSync(base, { recursive: true, force: true });
  });
});

describe('parseSource', () => {
  it('parses local, shorthand, and github url', () => {
    const local = parseSource('.');
    expect(local.kind).toBe('local');
    const gh = parseSource('vercel-labs/skills');
    expect(gh.kind).toBe('github-shorthand');
    expect(gh.url).toContain('github.com/vercel-labs/skills');
  });

  it('rejects unsafe git refs in tree URLs', () => {
    expect(() => parseSource('https://github.com/a/b/tree/--upload-pack/skills')).toThrow(/Invalid git ref/);
  });

  it('redacts credentials in URLs', () => {
    expect(redactUrl('https://user:token@github.com/a/b.git')).toBe('https://***@github.com/a/b.git');
  });
});

describe('security hardening', () => {
  it('assertInsideRoot blocks path escape via ..', () => {
    const root = mkdtempSync(join(tmpdir(), 'agentry-root-'));
    expect(() => assertInsideRoot(root, join(root, '..', '..', 'etc'))).toThrow(/escapes/);
    expect(assertInsideRoot(root, join(root, 'skills', 'x'))).toContain('skills');
    rmSync(root, { recursive: true, force: true });
  });

  it('install dereferences symlinks from source trees', () => {
    const root = mkdtempSync(join(tmpdir(), 'agentry-sym-'));
    const outside = join(root, 'outside-secret.txt');
    writeFileSync(outside, 'SECRET');
    const skillDir = join(root, 'skills', 'linky');
    mkdirSync(skillDir, { recursive: true });
    writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: linky\ndescription: x\n---\n# linky\n');
    try {
      symlinkSync(outside, join(skillDir, 'leaked.txt'));
    } catch {
      // Windows without symlink privilege — skip
      rmSync(root, { recursive: true, force: true });
      return;
    }

    const target = mkdtempSync(join(tmpdir(), 'agentry-tgt-'));
    const opts: InstallOpts = { scope: 'project', dir: target, agents: [], copy: true, dryRun: false };
    const skill = select(root, 'skill', 'linky')[0]!;
    installOne(skill, opts, [getAgent('cursor')!], root);

    const installed = join(target, '.agents', 'skills', 'linky', 'leaked.txt');
    expect(existsSync(installed)).toBe(true);
    expect(lstatSync(installed).isSymbolicLink()).toBe(false);
    expect(readFileSync(installed, 'utf8')).toBe('SECRET');

    rmSync(root, { recursive: true, force: true });
    rmSync(target, { recursive: true, force: true });
  });
});
