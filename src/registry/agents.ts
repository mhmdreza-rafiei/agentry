import { homedir } from 'node:os';
import { join } from 'node:path';
import { existsSync, readFileSync } from 'node:fs';
import { xdgConfig } from 'xdg-basedir';
import type { AgentConfig, ArtifactKind } from '../core/types.js';

const home = homedir();
const configHome = xdgConfig ?? join(home, '.config');
const codexHome = process.env.CODEX_HOME?.trim() || join(home, '.codex');
const claudeHome = process.env.CLAUDE_CONFIG_DIR?.trim() || join(home, '.claude');
const vibeHome = process.env.VIBE_HOME?.trim() || join(home, '.vibe');
const hermesHome = process.env.HERMES_HOME?.trim() || join(home, '.hermes');
const autohandHome = process.env.AUTOHAND_HOME?.trim() || join(home, '.autohand');
const grokHome = process.env.GROK_HOME?.trim() || join(home, '.grok');
const zedAppDataHome = process.env.APPDATA?.trim();
const zedFlatpakConfigHome = process.env.FLATPAK_XDG_CONFIG_HOME?.trim();

function packageJsonHasDependency(packageJsonPath: string, dependencyName: string): boolean {
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8')) as {
      dependencies?: Record<string, unknown>;
      devDependencies?: Record<string, unknown>;
    };
    return !!(pkg.dependencies?.[dependencyName] || pkg.devDependencies?.[dependencyName]);
  } catch { return false; }
}

export function getOpenClawGlobalSkillsDir(homeDir = home): string {
  if (existsSync(join(homeDir, '.openclaw'))) return join(homeDir, '.openclaw/skills');
  if (existsSync(join(homeDir, '.clawdbot'))) return join(homeDir, '.clawdbot/skills');
  if (existsSync(join(homeDir, '.moltbot'))) return join(homeDir, '.moltbot/skills');
  return join(homeDir, '.openclaw/skills');
}

export function isZCodeInstalled(homeDir = home): boolean {
  return existsSync(join(homeDir, '.zcode')) || existsSync('/Applications/ZCode.app');
}

export function isKimchiInstalled(homeDir = home): boolean {
  return existsSync(join(homeDir, '.config', 'kimchi'));
}

// Build an agent entry. detectInstalled is sync (existsSync is sync).
function make(
  name: string,
  displayName: string,
  skillsDir: string,
  globalSkillsDir: string | null,
  detect: () => boolean,
  flags: { showInUniversalList?: boolean; showInUniversalPrompt?: boolean } = {},
): AgentConfig {
  return {
    name, displayName, skillsDir,
    globalSkillsDir,
    configDir: deriveConfigDir(skillsDir),
    globalConfigDir: deriveConfigDir(globalSkillsDir || skillsDir),
    detectInstalled: detect,
    showInUniversalList: flags.showInUniversalList ?? true,
    showInUniversalPrompt: flags.showInUniversalPrompt ?? true,
  };
}

function deriveConfigDir(dir: string): string {
  if (!dir) return dir;
  const p = dir.replace(/\\/g, '/');
  if (p === 'skills' || p.endsWith('/skills')) {
    const i = p.lastIndexOf('/skills');
    return i < 0 ? '' : p.slice(0, i);
  }
  return p;
}

const ex = (p: string) => { try { return existsSync(p); } catch { return false; } };

export const AGENTS: Record<string, AgentConfig> = {};
AGENTS['aider-desk'] = make('aider-desk', 'AiderDesk', '.aider-desk/skills', join(home, '.aider-desk/skills'), () => ex(join(home, '.aider-desk')));
AGENTS['amp'] = make('amp', 'Amp', '.agents/skills', join(configHome, 'agents/skills'), () => ex(join(configHome, 'amp')));
AGENTS['antigravity'] = make('antigravity', 'Antigravity', '.agents/skills', join(home, '.gemini/antigravity/skills'), () => ex(join(home, '.gemini/antigravity')));
AGENTS['antigravity-cli'] = make('antigravity-cli', 'Antigravity CLI', '.agents/skills', join(home, '.gemini/antigravity-cli/skills'), () => ex(join(home, '.gemini/antigravity-cli')));
AGENTS['astrbot'] = make('astrbot', 'AstrBot', 'data/skills', join(home, '.astrbot/data/skills'), () => ex(join(process.cwd(), 'data/skills')) || ex(join(home, '.astrbot')));
AGENTS['autohand-code'] = make('autohand-code', 'Autohand Code CLI', '.autohand/skills', join(autohandHome, 'skills'), () => ex(autohandHome));
AGENTS['augment'] = make('augment', 'Augment', '.augment/skills', join(home, '.augment/skills'), () => ex(join(home, '.augment')));
AGENTS['bob'] = make('bob', 'IBM Bob', '.bob/skills', join(home, '.bob/skills'), () => ex(join(home, '.bob')));
AGENTS['claude-code'] = make('claude-code', 'Claude Code', '.claude/skills', join(claudeHome, 'skills'), () => ex(claudeHome));
AGENTS['openclaw'] = make('openclaw', 'OpenClaw', 'skills', getOpenClawGlobalSkillsDir(), () => ex(join(home, '.openclaw')) || ex(join(home, '.clawdbot')) || ex(join(home, '.moltbot')));
AGENTS['cline'] = make('cline', 'Cline', '.agents/skills', join(home, '.agents', 'skills'), () => ex(join(home, '.cline')));
AGENTS['codearts-agent'] = make('codearts-agent', 'CodeArts Agent', '.codeartsdoer/skills', join(home, '.codeartsdoer/skills'), () => ex(join(home, '.codeartsdoer')));
AGENTS['codebuddy'] = make('codebuddy', 'CodeBuddy', '.codebuddy/skills', join(home, '.codebuddy/skills'), () => ex(join(process.cwd(), '.codebuddy')) || ex(join(home, '.codebuddy')));
AGENTS['codemaker'] = make('codemaker', 'Codemaker', '.codemaker/skills', join(home, '.codemaker/skills'), () => ex(join(home, '.codemaker')));
AGENTS['codestudio'] = make('codestudio', 'Code Studio', '.codestudio/skills', join(home, '.codestudio/skills'), () => ex(join(home, '.codestudio')));
AGENTS['codex'] = make('codex', 'Codex', '.agents/skills', join(codexHome, 'skills'), () => ex(codexHome) || ex('/etc/codex'));
AGENTS['command-code'] = make('command-code', 'Command Code', '.commandcode/skills', join(home, '.commandcode/skills'), () => ex(join(home, '.commandcode')));
AGENTS['continue'] = make('continue', 'Continue', '.continue/skills', join(home, '.continue/skills'), () => ex(join(process.cwd(), '.continue')) || ex(join(home, '.continue')));
AGENTS['cortex'] = make('cortex', 'Cortex Code', '.cortex/skills', join(home, '.snowflake/cortex/skills'), () => ex(join(home, '.snowflake/cortex')));
AGENTS['crush'] = make('crush', 'Crush', '.crush/skills', join(home, '.config/crush/skills'), () => ex(join(home, '.config/crush')));
AGENTS['cursor'] = make('cursor', 'Cursor', '.agents/skills', join(home, '.cursor/skills'), () => ex(join(home, '.cursor')));
AGENTS['deepagents'] = make('deepagents', 'Deep Agents', '.agents/skills', join(home, '.deepagents/agent/skills'), () => ex(join(home, '.deepagents')));
AGENTS['devin'] = make('devin', 'Devin for Terminal', '.devin/skills', join(configHome, 'devin/skills'), () => ex(join(configHome, 'devin')));
AGENTS['dexto'] = make('dexto', 'Dexto', '.agents/skills', join(home, '.agents/skills'), () => ex(join(home, '.dexto')), { showInUniversalPrompt: false });
AGENTS['droid'] = make('droid', 'Droid', '.factory/skills', join(home, '.factory/skills'), () => ex(join(home, '.factory')));
AGENTS['eve'] = make('eve', 'Eve', 'agent/skills', null, () => ex(join(process.cwd(), 'agent')) && packageJsonHasDependency(join(process.cwd(), 'package.json'), 'eve'));
AGENTS['firebender'] = make('firebender', 'Firebender', '.agents/skills', join(home, '.firebender/skills'), () => ex(join(home, '.firebender')), { showInUniversalPrompt: false });
AGENTS['forgecode'] = make('forgecode', 'ForgeCode', '.forge/skills', join(home, '.forge/skills'), () => ex(join(home, '.forge')));
AGENTS['gemini-cli'] = make('gemini-cli', 'Gemini CLI', '.agents/skills', join(home, '.gemini/skills'), () => ex(join(home, '.gemini')));
AGENTS['github-copilot'] = make('github-copilot', 'GitHub Copilot', '.agents/skills', join(home, '.copilot/skills'), () => ex(join(home, '.copilot')));
AGENTS['goose'] = make('goose', 'Goose', '.goose/skills', join(configHome, 'goose/skills'), () => ex(join(configHome, 'goose')));
AGENTS['grok'] = make('grok', 'Grok Build', '.grok/skills', join(grokHome, 'skills'), () => ex(grokHome));
AGENTS['hermes-agent'] = make('hermes-agent', 'Hermes Agent', '.hermes/skills', join(hermesHome, 'skills'), () => ex(hermesHome));
AGENTS['inference-sh'] = make('inference-sh', 'inference.sh', '.inferencesh/skills', join(home, '.inferencesh/skills'), () => ex(join(home, '.inferencesh')));
AGENTS['jazz'] = make('jazz', 'Jazz', '.jazz/skills', join(home, '.jazz/skills'), () => ex(join(home, '.jazz')) || ex(join(process.cwd(), '.jazz')));
AGENTS['junie'] = make('junie', 'Junie', '.junie/skills', join(home, '.junie/skills'), () => ex(join(home, '.junie')));
AGENTS['iflow-cli'] = make('iflow-cli', 'iFlow CLI', '.iflow/skills', join(home, '.iflow/skills'), () => ex(join(home, '.iflow')));
AGENTS['kilo'] = make('kilo', 'Kilo Code', '.kilocode/skills', join(home, '.kilocode/skills'), () => ex(join(home, '.kilocode')));
AGENTS['kimchi'] = make('kimchi', 'Kimchi', '.kimchi/skills', join(home, '.config', 'kimchi', 'harness', 'skills'), () => isKimchiInstalled());
AGENTS['kimi-code-cli'] = make('kimi-code-cli', 'Kimi Code CLI', '.agents/skills', join(home, '.agents/skills'), () => ex(join(home, '.kimi-code')) || ex(join(home, '.kimi')));
AGENTS['kiro-cli'] = make('kiro-cli', 'Kiro CLI', '.kiro/skills', join(home, '.kiro/skills'), () => ex(join(home, '.kiro')));
AGENTS['kode'] = make('kode', 'Kode', '.kode/skills', join(home, '.kode/skills'), () => ex(join(home, '.kode')));
AGENTS['lingma'] = make('lingma', 'Lingma', '.lingma/skills', join(home, '.lingma/skills'), () => ex(join(home, '.lingma')));
AGENTS['loaf'] = make('loaf', 'Loaf', '.agents/skills', join(home, '.agents/skills'), () => ex(join(home, '.loaf')), { showInUniversalPrompt: false });
AGENTS['mcpjam'] = make('mcpjam', 'MCPJam', '.mcpjam/skills', join(home, '.mcpjam/skills'), () => ex(join(home, '.mcpjam')));
AGENTS['mistral-vibe'] = make('mistral-vibe', 'Mistral Vibe', '.vibe/skills', join(vibeHome, 'skills'), () => ex(vibeHome));
AGENTS['moxby'] = make('moxby', 'Moxby', '.moxby/skills', join(home, '.moxby/skills'), () => ex(join(home, '.moxby')));
AGENTS['mux'] = make('mux', 'Mux', '.mux/skills', join(home, '.mux/skills'), () => ex(join(home, '.mux')));
AGENTS['opencode'] = make('opencode', 'OpenCode', '.agents/skills', join(configHome, 'opencode/skills'), () => ex(join(configHome, 'opencode')));
AGENTS['openhands'] = make('openhands', 'OpenHands', '.openhands/skills', join(home, '.openhands/skills'), () => ex(join(home, '.openhands')));
AGENTS['ona'] = make('ona', 'Ona', '.ona/skills', join(home, '.ona/skills'), () => ex(join(home, '.ona')));
AGENTS['pi'] = make('pi', 'Pi', '.pi/skills', join(home, '.pi/agent/skills'), () => ex(join(home, '.pi/agent')));
AGENTS['qoder'] = make('qoder', 'Qoder', '.qoder/skills', join(home, '.qoder/skills'), () => ex(join(home, '.qoder')));
AGENTS['qoder-cn'] = make('qoder-cn', 'Qoder CN', '.qoder/skills', join(home, '.qoder-cn/skills'), () => ex(join(home, '.qoder-cn')));
AGENTS['qwen-code'] = make('qwen-code', 'Qwen Code', '.qwen/skills', join(home, '.qwen/skills'), () => ex(join(home, '.qwen')));
AGENTS['replit'] = make('replit', 'Replit', '.agents/skills', join(configHome, 'agents/skills'), () => ex(join(process.cwd(), '.replit')), { showInUniversalList: false });
AGENTS['reasonix'] = make('reasonix', 'Reasonix', '.reasonix/skills', join(home, '.reasonix/skills'), () => ex(join(home, '.reasonix')));
AGENTS['rovodev'] = make('rovodev', 'Rovo Dev', '.rovodev/skills', join(home, '.rovodev/skills'), () => ex(join(home, '.rovodev')));
AGENTS['roo'] = make('roo', 'Roo Code', '.roo/skills', join(home, '.roo/skills'), () => ex(join(home, '.roo')));
AGENTS['tabnine-cli'] = make('tabnine-cli', 'Tabnine CLI', '.tabnine/agent/skills', join(home, '.tabnine/agent/skills'), () => ex(join(home, '.tabnine')));
AGENTS['terramind'] = make('terramind', 'Terramind', '.terramind/skills', join(home, '.terramind/skills'), () => ex(join(home, '.terramind')));
AGENTS['tinycloud'] = make('tinycloud', 'Tinycloud', '.tinycloud/skills', join(home, '.tinycloud/skills'), () => ex(join(home, '.tinycloud')));
AGENTS['trae'] = make('trae', 'Trae', '.trae/skills', join(home, '.trae/skills'), () => ex(join(home, '.trae')));
AGENTS['trae-cn'] = make('trae-cn', 'Trae CN', '.trae/skills', join(home, '.trae-cn/skills'), () => ex(join(home, '.trae-cn')));
AGENTS['warp'] = make('warp', 'Warp', '.agents/skills', join(home, '.agents/skills'), () => ex(join(home, '.warp')));
AGENTS['windsurf'] = make('windsurf', 'Windsurf', '.windsurf/skills', join(home, '.codeium/windsurf/skills'), () => ex(join(home, '.codeium/windsurf')));
AGENTS['zed'] = make('zed', 'Zed', '.agents/skills', join(home, '.agents/skills'), () => ex(join(configHome, 'zed')) || (!!zedAppDataHome && ex(join(zedAppDataHome, 'Zed'))) || (!!zedFlatpakConfigHome && ex(join(zedFlatpakConfigHome, 'zed'))));
AGENTS['zcode'] = make('zcode', 'ZCode', '.zcode/skills', join(home, '.zcode/skills'), () => isZCodeInstalled());
AGENTS['zencoder'] = make('zencoder', 'Zencoder', '.zencoder/skills', join(home, '.zencoder/skills'), () => ex(join(home, '.zencoder')));
AGENTS['zenflow'] = make('zenflow', 'Zenflow', '.zencoder/skills', join(home, '.zencoder/skills'), () => ex(join(home, '.zencoder')));
AGENTS['neovate'] = make('neovate', 'Neovate', '.neovate/skills', join(home, '.neovate/skills'), () => ex(join(home, '.neovate')));
AGENTS['pochi'] = make('pochi', 'Pochi', '.pochi/skills', join(home, '.pochi/skills'), () => ex(join(home, '.pochi')));
AGENTS['promptscript'] = make('promptscript', 'PromptScript', '.agents/skills', null, () => ex(join(process.cwd(), '.promptscript')) || ex(join(process.cwd(), 'promptscript.yaml')), { showInUniversalPrompt: false });
AGENTS['adal'] = make('adal', 'AdaL', '.adal/skills', join(home, '.adal/skills'), () => ex(join(home, '.adal')));
AGENTS['universal'] = make('universal', 'Universal', '.agents/skills', join(configHome, 'agents/skills'), () => false, { showInUniversalList: false });

export function getAgent(name: string): AgentConfig | null { return AGENTS[name] ?? null; }
export function listAgents(): AgentConfig[] { return Object.values(AGENTS); }

export function detectInstalledAgents(): AgentConfig[] {
  return listAgents().filter((a) => { try { return a.detectInstalled(); } catch { return false; } });
}

export function resolveAgents(names: string[]): { agents: AgentConfig[]; unknown: string[] } {
  if (!names || names.length === 0) return { agents: [], unknown: [] };
  if (names.includes('*')) return { agents: listAgents(), unknown: [] };
  const agents: AgentConfig[] = [];
  const unknown: string[] = [];
  for (const n of names) { const a = getAgent(n); if (a) agents.push(a); else unknown.push(n); }
  return { agents, unknown };
}

// --- Universal / symlink system (mirrors vercel-labs/skills) ---
export function getUniversalAgents(): AgentConfig[] {
  return listAgents().filter((a) => a.skillsDir === '.agents/skills' && a.showInUniversalList !== false);
}
export function getVisibleUniversalAgents(): AgentConfig[] {
  return listAgents().filter((a) => a.skillsDir === '.agents/skills' && a.showInUniversalList !== false && a.showInUniversalPrompt !== false);
}
export function getNonUniversalAgents(): AgentConfig[] {
  return listAgents().filter((a) => a.skillsDir !== '.agents/skills');
}
export function isUniversalAgent(name: string): boolean {
  const a = getAgent(name); return !!a && a.skillsDir === '.agents/skills';
}
