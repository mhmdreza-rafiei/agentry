// Detect whether we're running inside an agent or in CI (to suppress interactive UI).
import { determineAgent } from '@vercel/detect-agent';

// determineAgent() is async; cache the result once at module load (top-level await, ESM).
let runningInsideAgent = false;
try {
  const result = await determineAgent();
  runningInsideAgent = !!(result && (result as any).isAgent);
} catch { /* ignore */ }

export function isCI(): boolean {
  if (process.env.CI === 'true' || process.env.CI === '1') return true;
  if (!process.stdout.isTTY) return true;
  return runningInsideAgent;
}
