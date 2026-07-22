import * as clack from '@clack/prompts';
import { theme, symbol } from './theme.js';
import { isCI } from './detect.js';

// Quiet when running inside an agent or in CI (no ANSI, no logo, no spinners).
export function isQuiet(): boolean {
  return isCI() || !process.stdout.isTTY;
}

export function intro(): void {
  if (isQuiet()) return;
  clack.intro(theme.bold('agentry'));
  process.stdout.write(theme.primary('\n') + '\n');
}

export function outro(message: string): void {
  if (isQuiet()) { process.stdout.write(message + '\n'); return; }
  clack.outro(message);
}

export async function confirm(message: string): Promise<boolean> {
  if (isQuiet()) return true;
  const res = await clack.confirm({ message, initialValue: true });
  if (clack.isCancel(res)) return false;
  return res as boolean;
}

export async function multiselect<T extends string>(message: string, options: { value: T; label: string; hint?: string }[]): Promise<T[]> {
  if (isQuiet() || !options.length) return options.map((o) => o.value);
  const res = await clack.multiselect({ message, options: options as any, required: false });
  if (clack.isCancel(res)) return [];
  return res as T[];
}

export async function select<T extends string>(message: string, options: { value: T; label: string }[]): Promise<T | symbol> {
  if (isQuiet() && options.length) return options[0]!.value;
  return await clack.select({ message, options: options as any });
}

export async function spinner<T>(message: string, fn: () => T | Promise<T>): Promise<T> {
  if (isQuiet()) {
    process.stdout.write(theme.dim(`${symbol.bullet} ${message}...`) + '\n');
    return await fn();
  }
  const s = clack.spinner();
  s.start(message);
  try {
    const result = await fn();
    s.stop(theme.success(`${symbol.ok} ${message}`));
    return result;
  } catch (e) {
    s.stop(theme.error(`${symbol.fail} ${message}`));
    throw e;
  }
}

export function log(message: string): void {
  process.stdout.write(message + '\n');
}

export function step(message: string): void {
  process.stdout.write(`  ${theme.dim(symbol.arrow)} ${message}\n`);
}

export function ok(message: string): void {
  process.stdout.write(`${theme.success(symbol.ok + ' ' + message)}\n`);
}

export function err(message: string): void {
  process.stdout.write(`${theme.error(symbol.fail + ' ' + message)}\n`);
}

export function warn(message: string): void {
  process.stdout.write(`${theme.warn(symbol.warn + ' ' + message)}\n`);
}

export function info(message: string): void {
  process.stdout.write(`${theme.info(symbol.info + ' ' + message)}\n`);
}

// Preview what would be installed (dry-run output).
export function preview(artifacts: { kind: string; id: string; description?: string }[], agents: { name: string; displayName: string }[]): void {
  log(theme.bold('Preview') + theme.dim(' (no files will be written)'));
  if (agents.length) {
    log(theme.info('Targets:'));
    for (const a of agents) step(`${a.name} (${a.displayName})`);
  }
  if (artifacts.length) {
    log(theme.info('Artifacts:'));
    for (const a of artifacts) {
      const desc = (a.description || '').replace(/\s+/g, ' ').slice(0, 60);
      step(`${a.kind}/${a.id}${desc ? theme.dim(' - ' + desc) : ''}`);
    }
  } else {
    log(theme.dim('  (no artifacts matched)'));
  }
}
