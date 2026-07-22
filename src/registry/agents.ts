import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import type { AgentConfig } from '../core/types.js';

const home = homedir();
const configHome = process.env.XDG_CONFIG_HOME || join(home, '.config');

// Derive a provider's config dir from its skillsDir by stripping a trailing /skills segment.
function deriveConfigDir(dir: string): string {
  if (!dir) return dir;
  const p = dir.replace(/\\/g, '/');
  if (p === 'skills' || p.endsWith('/skills')) {
    const i = p.lastIndexOf('/skills');
    return i < 0 ? '' : p.slice(0, i);
  }
  return p;
}

// Build a provider entry (mirrors vercel-labs/skills agents.ts).
function make(
  name: string,
  displayName: string,
  skillsDir: string,
  globalSkillsDir: string | null,
  detect?: () => boolean,
): AgentConfig {
  return {
    name,
    displayName,
    skillsDir,
    globalSkillsDir,
    configDir: deriveConfigDir(skillsDir),
    globalConfigDir: deriveConfigDir(globalSkillsDir || skillsDir),
    detectInstalled: detect || (() => false),
  };
}

const exists = (p: string) => { try { return existsSync(p); } catch { return false; } };
const env = (k: string, dflt: string) => { const v = process.env[k]; return v && v.trim() ? v : dflt; };

export const AGENTS: Record<string, AgentConfig> = {
  'aider-desk': make('aider-desk', 'AiderDesk', '.aider-desk/skills', join(home, '.aider-desk/skills'), () => exists(join(home, '.aider-desk'))),
  amp: make('amp', 'Amp', '.agents/skills', join(configHome, 'agents/skills'), () => exists(join(configHome, 'amp'))),
  replit: make('replit', 'Replit', '.agents/skills', join(configHome, 'agents/skills'), () => exists(join(home, '.replit'))),
  universal: make('universal', 'Universal', '.agents/skills', join(configHome, 'agents/skills'), () => true),
  antigravity: make('antigravity', 'Antigravity', '.agents/skills', join(home, '.gemini/antigravity/skills'), () => exists(join(home, '.gemini/antigravity'))),
  'antigravity-cli': make('antigravity-cli', 'Antigravity CLI', '.agents/skills', join(home, '.gemini/antigravity-cli/skills'), () => exists(join(home, '.gemini/antigravity-cli'))),
  astrbot: make('astrbot', 'AstrBot', 'data/skills', join(home, '.astrbot/data/skills'), () => exists(join(home, '.astrbot'))),
  'autohand-code': make('autohand-code', 'Autohand Code CLI', '.autohand/skills', join(env('AUTOHAND_HOME', join(home, '.autohand')), 'skills'), () => exists(env('AUTOHAND_HOME', join(home, '.autohand')))),
  augment: make('augment', 'Augment', '.augment/skills', join(home, '.augment/skills'), () => exists(join(home, '.augment'))),
  bob: make('bob', 'IBM Bob', '.bob/skills', join(home, '.bob/skills'), () => exists(join(home, '.bob'))),
  'claude-code': make('claude-code', 'Claude Code', '.claude/skills', join(env('CLAUDE_CONFIG_DIR', join(home, '.claude')), 'skills'), () => exists(env('CLAUDE_CONFIG_DIR', join(home, '.claude')))),
  openclaw: make('openclaw', 'OpenClaw', 'skills', join(home, '.openclaw/skills'), () => exists(join(home, '.openclaw')) || exists(join(home, '.clawdbot')) || exists(join(home, '.moltbot'))),
  cline: make('cline', 'Cline', '.agents/skills', join(home, '.agents/skills'), () => exists(join(home, '.cline'))),
  dexto: make('dexto', 'Dexto', '.agents/skills', join(home, '.agents/skills'), () => exists(join(home, '.dexto'))),
  'kimi-code-cli': make('kimi-code-cli', 'Kimi Code CLI', '.agents/skills', join(home, '.agents/skills'), () => exists(join(home, '.kimi'))),
  loaf: make('loaf', 'Loaf', '.agents/skills', join(home, '.agents/skills'), () => exists(join(home, '.loaf'))),
  warp: make('warp', 'Warp', '.agents/skills', join(home, '.agents/skills'), () => exists(join(home, '.warp'))),
  zed: make('zed', 'Zed', '.agents/skills', join(home, '.agents/skills'), () => exists(join(home, '.zed')) || exists(join(home, 'Library/Application Support/Zed'))),
  'codearts-agent': make('codearts-agent', 'CodeArts Agent', '.codeartsdoer/skills', join(home, '.codeartsdoer/skills'), () => exists(join(home, '.codeartsdoer'))),
  codebuddy: make('codebuddy', 'CodeBuddy', '.codebuddy/skills', join(home, '.codebuddy/skills'), () => exists(join(home, '.codebuddy'))),
  codemaker: make('codemaker', 'Codemaker', '.codemaker/skills', join(home, '.codemaker/skills'), () => exists(join(home, '.codemaker'))),
  codestudio: make('codestudio', 'Code Studio', '.codestudio/skills', join(home, '.codestudio/skills'), () => exists(join(home, '.codestudio'))),
  codex: make('codex', 'Codex', '.agents/skills', join(env('CODEX_HOME', join(home, '.codex')), 'skills'), () => exists(env('CODEX_HOME', join(home, '.codex')))),
  'command-code': make('command-code', 'Command Code', '.commandcode/skills', join(home, '.commandcode/skills'), () => exists(join(home, '.commandcode'))),
  continue: make('continue', 'Continue', '.continue/skills', join(home, '.continue/skills'), () => exists(join(home, '.continue'))),
  cortex: make('cortex', 'Cortex Code', '.cortex/skills', join(home, '.snowflake/cortex/skills'), () => exists(join(home, '.cortex')) || exists(join(home, '.snowflake'))),
  crush: make('crush', 'Crush', '.crush/skills', join(home, '.config/crush/skills'), () => exists(join(home, '.crush')) || exists(join(home, '.config/crush'))),
  cursor: make('cursor', 'Cursor', '.cursor/skills', join(home, '.cursor/skills'), () => exists(join(home, '.cursor'))),
  deepagents: make('deepagents', 'Deep Agents', '.agents/skills', join(home, '.deepagents/agent/skills'), () => exists(join(home, '.deepagents'))),
  devin: make('devin', 'Devin for Terminal', '.devin/skills', join(home, '.config/devin/skills'), () => exists(join(home, '.devin')) || exists(join(home, '.config/devin'))),
  droid: make('droid', 'Droid', '.factory/skills', join(home, '.factory/skills'), () => exists(join(home, '.factory'))),
  eve: make('eve', 'Eve', 'agent/skills', null, () => false),
  firebender: make('firebender', 'Firebender', '.agents/skills', join(home, '.firebender/skills'), () => exists(join(home, '.firebender'))),
  forgecode: make('forgecode', 'ForgeCode', '.forge/skills', join(home, '.forge/skills'), () => exists(join(home, '.forge'))),
  'gemini-cli': make('gemini-cli', 'Gemini CLI', '.agents/skills', join(home, '.gemini/skills'), () => exists(join(home, '.gemini'))),
  'github-copilot': make('github-copilot', 'GitHub Copilot', '.agents/skills', join(home, '.copilot/skills'), () => exists(join(home, '.copilot'))),
  goose: make('goose', 'Goose', '.goose/skills', join(home, '.config/goose/skills'), () => exists(join(home, '.goose')) || exists(join(home, '.config/goose'))),
  grok: make('grok', 'Grok Build', '.grok/skills', join(env('GROK_HOME', join(home, '.grok')), 'skills'), () => exists(env('GROK_HOME', join(home, '.grok')))),
  'hermes-agent': make('hermes-agent', 'Hermes Agent', '.hermes/skills', join(env('HERMES_HOME', join(home, '.hermes')), 'skills'), () => exists(env('HERMES_HOME', join(home, '.hermes')))),
  'inference-sh': make('inference-sh', 'inference.sh', '.inferencesh/skills', join(home, '.inferencesh/skills'), () => exists(join(home, '.inferencesh'))),
  jazz: make('jazz', 'Jazz', '.jazz/skills', join(home, '.jazz/skills'), () => exists(join(home, '.jazz'))),
  junie: make('junie', 'Junie', '.junie/skills', join(home, '.junie/skills'), () => exists(join(home, '.junie'))),
  'iflow-cli': make('iflow-cli', 'iFlow CLI', '.iflow/skills', join(home, '.iflow/skills'), () => exists(join(home, '.iflow'))),
  kilo: make('kilo', 'Kilo Code', '.kilocode/skills', join(home, '.kilocode/skills'), () => exists(join(home, '.kilocode'))),
  kimchi: make('kimchi', 'Kimchi', '.kimchi/skills', join(home, '.config/kimchi/harness/skills'), () => exists(join(home, '.config/kimchi'))),
  'kiro-cli': make('kiro-cli', 'Kiro CLI', '.kiro/skills', join(home, '.kiro/skills'), () => exists(join(home, '.kiro'))),
  kode: make('kode', 'Kode', '.kode/skills', join(home, '.kode/skills'), () => exists(join(home, '.kode'))),
  lingma: make('lingma', 'Lingma', '.lingma/skills', join(home, '.lingma/skills'), () => exists(join(home, '.lingma'))),
  mcpjam: make('mcpjam', 'MCPJam', '.mcpjam/skills', join(home, '.mcpjam/skills'), () => exists(join(home, '.mcpjam'))),
  'mistral-vibe': make('mistral-vibe', 'Mistral Vibe', '.vibe/skills', join(env('VIBE_HOME', join(home, '.vibe')), 'skills'), () => exists(env('VIBE_HOME', join(home, '.vibe')))),
  moxby: make('moxby', 'Moxby', '.moxby/skills', join(home, '.moxby/skills'), () => exists(join(home, '.moxby'))),
  mux: make('mux', 'Mux', '.mux/skills', join(home, '.mux/skills'), () => exists(join(home, '.mux'))),
  opencode: make('opencode', 'OpenCode', '.agents/skills', join(configHome, 'opencode/skills'), () => exists(join(configHome, 'opencode'))),
  openhands: make('openhands', 'OpenHands', '.openhands/skills', join(home, '.openhands/skills'), () => exists(join(home, '.openhands'))),
  ona: make('ona', 'Ona', '.ona/skills', join(home, '.ona/skills'), () => exists(join(home, '.ona'))),
  pi: make('pi', 'Pi', '.pi/skills', join(home, '.pi/agent/skills'), () => exists(join(home, '.pi'))),
  qoder: make('qoder', 'Qoder', '.qoder/skills', join(home, '.qoder/skills'), () => exists(join(home, '.qoder'))),
  'qoder-cn': make('qoder-cn', 'Qoder CN', '.qoder/skills', join(home, '.qoder-cn/skills'), () => exists(join(home, '.qoder-cn'))),
  'qwen-code': make('qwen-code', 'Qwen Code', '.qwen/skills', join(home, '.qwen/skills'), () => exists(join(home, '.qwen'))),
  reasonix: make('reasonix', 'Reasonix', '.reasonix/skills', join(home, '.reasonix/skills'), () => exists(join(home, '.reasonix'))),
  rovodev: make('rovodev', 'Rovo Dev', '.rovodev/skills', join(home, '.rovodev/skills'), () => exists(join(home, '.rovodev'))),
  roo: make('roo', 'Roo Code', '.roo/skills', join(home, '.roo/skills'), () => exists(join(home, '.roo'))),
  'tabnine-cli': make('tabnine-cli', 'Tabnine CLI', '.tabnine/agent/skills', join(home, '.tabnine/agent/skills'), () => exists(join(home, '.tabnine'))),
  terramind: make('terramind', 'Terramind', '.terramind/skills', join(home, '.terramind/skills'), () => exists(join(home, '.terramind'))),
  tinycloud: make('tinycloud', 'Tinycloud', '.tinycloud/skills', join(home, '.tinycloud/skills'), () => exists(join(home, '.tinycloud'))),
  trae: make('trae', 'Trae', '.trae/skills', join(home, '.trae/skills'), () => exists(join(home, '.trae'))),
  'trae-cn': make('trae-cn', 'Trae CN', '.trae/skills', join(home, '.trae-cn/skills'), () => exists(join(home, '.trae-cn'))),
  windsurf: make('windsurf', 'Windsurf', '.windsurf/skills', join(home, '.codeium/windsurf/skills'), () => exists(join(home, '.codeium')) || exists(join(home, '.windsurf'))),
  zcode: make('zcode', 'ZCode', '.zcode/skills', join(home, '.zcode/skills'), () => exists(join(home, '.zcode')) || exists('/Applications/ZCode.app')),
  zencoder: make('zencoder', 'Zencoder', '.zencoder/skills', join(home, '.zencoder/skills'), () => exists(join(home, '.zencoder'))),
  zenflow: make('zenflow', 'Zenflow', '.zencoder/skills', join(home, '.zencoder/skills'), () => exists(join(home, '.zencoder'))),
  neovate: make('neovate', 'Neovate', '.neovate/skills', join(home, '.neovate/skills'), () => exists(join(home, '.neovate'))),
  pochi: make('pochi', 'Pochi', '.pochi/skills', join(home, '.pochi/skills'), () => exists(join(home, '.pochi'))),
  promptscript: make('promptscript', 'PromptScript', '.agents/skills', null, () => false),
  adal: make('adal', 'AdaL', '.adal/skills', join(home, '.adal/skills'), () => exists(join(home, '.adal'))),
};

export function getAgent(name: string): AgentConfig | null {
  return AGENTS[name] ?? null;
}

export function listAgents(): AgentConfig[] {
  return Object.values(AGENTS);
}

export function detectInstalledAgents(): AgentConfig[] {
  return listAgents().filter((a) => { try { return a.detectInstalled(); } catch { return false; } });
}

export function resolveAgents(names: string[]): { agents: AgentConfig[]; unknown: string[] } {
  if (!names || names.length === 0) return { agents: [], unknown: [] };
  if (names.includes('*')) return { agents: listAgents(), unknown: [] };
  const agents: AgentConfig[] = [];
  const unknown: string[] = [];
  for (const n of names) {
    const a = getAgent(n);
    if (a) agents.push(a); else unknown.push(n);
  }
  return { agents, unknown };
}
