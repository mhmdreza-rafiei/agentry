import http from 'node:http';
import https from 'node:https';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveSource, type ResolvedSource, type ResolveSourceOpts } from './git.js';
import { frontmatterName } from '../artifacts/discovery.js';

export interface FetchedWeb {
  body: string;
  status: number;
  contentType: string;
  finalUrl: string;
}

export function fetchUrl(url: string, maxRedirects = 5): Promise<FetchedWeb> {
  return new Promise((resolve, reject) => {
    const isHttps = url.startsWith('https://');
    const client = isHttps ? https : http;
    const req = client.get(
      url,
      {
        headers: {
          'User-Agent': 'agentry/0.3.1 (+https://github.com/mhmdreza-rafiei/agentry)',
          Accept: 'text/html,application/xhtml+xml,text/plain,text/markdown,application/json,*/*',
        },
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (maxRedirects <= 0) {
            return reject(new Error(`Too many redirects while fetching ${url}`));
          }
          const nextUrl = new URL(res.headers.location, url).toString();
          return resolve(fetchUrl(nextUrl, maxRedirects - 1));
        }

        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`HTTP ${res.statusCode} when fetching ${url}`));
        }

        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({
            body,
            status: res.statusCode || 200,
            contentType: res.headers['content-type'] || '',
            finalUrl: url,
          });
        });
      },
    );
    req.on('error', reject);
    req.setTimeout(20000, () => {
      req.destroy();
      reject(new Error(`Request timed out while fetching ${url}`));
    });
  });
}

function cleanHtml(raw: string): string {
  return raw.replace(/\\/g, '');
}

/**
 * Resolve an arbitrary website/hub URL (such as awesomeskill.ai/skill/...).
 * Inspects the page for GitHub links (tree URLs, repos, or gists) or raw skill content.
 */
export async function resolveWebSource(
  url: string,
  opts: ResolveSourceOpts = {},
  fetcher: (u: string) => Promise<FetchedWeb> = fetchUrl,
  sourceResolver: (src: any, opts: any) => Promise<ResolvedSource> = resolveSource,
): Promise<ResolvedSource> {
  // 1. Direct GitHub Gist URL
  const gistMatch = url.match(/^https?:\/\/gist\.github\.com\/([a-zA-Z0-9_.-]+)\/([a-f0-9]+)/i);
  if (gistMatch) {
    const gitUrl = `https://gist.github.com/${gistMatch[2]}.git`;
    return sourceResolver({ kind: 'git-url', raw: url, url: gitUrl, subpath: '', local: null }, opts);
  }

  // 2. Fetch page content
  const { body, contentType } = await fetcher(url);
  const clean = cleanHtml(body);

  // 3. Search for GitHub Tree URL (e.g. from awesomeskill.ai or skill hubs)
  const treeMatch = clean.match(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/tree\/([^/\s"'>]+)\/([^\s"'>]+)/i);
  if (treeMatch) {
    const ownerRepo = treeMatch[1]!;
    const ref = treeMatch[2]!;
    const subpath = treeMatch[3]!.replace(/\/+$/, '');
    return sourceResolver(
      {
        kind: 'github-url',
        raw: url,
        url: `https://github.com/${ownerRepo}.git`,
        ref,
        subpath,
        local: null,
      },
      opts,
    );
  }

  // 4. Search for canonical GitHub repository URL
  const repoMatches = clean.match(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)(?:\.git)?\b/gi);
  if (repoMatches) {
    const ignoredPaths = new Set(['features', 'pricing', 'about', 'topics', 'trending', 'collections', 'site', 'security']);
    for (const match of repoMatches) {
      const m = match.match(/https:\/\/github\.com\/([\w.-]+\/[\w.-]+)/i);
      if (m) {
        const ownerRepo = m[1]!;
        const [owner, repo] = ownerRepo.split('/');
        if (owner && repo && !ignoredPaths.has(owner.toLowerCase()) && !ignoredPaths.has(repo.toLowerCase())) {
          return sourceResolver(`https://github.com/${ownerRepo}`, opts);
        }
      }
    }
  }

  // 5. Raw Markdown / Plaintext response or embedded SKILL.md
  const isHtml = contentType.includes('html');
  let content = body;

  if (isHtml) {
    // Try extracting code blocks with frontmatter or instructions
    const codeBlockMatch = body.match(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/i);
    if (codeBlockMatch && codeBlockMatch[1]) {
      content = codeBlockMatch[1].replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
    }
  }

  const hasSkillFrontmatter = /^---\r?\n[\s\S]*?name:[\s\S]*?\r?\n---/m.test(content);
  if (hasSkillFrontmatter || content.includes('# ') || !isHtml) {
    const tmp = mkdtempSync(join(tmpdir(), 'agentry-web-'));
    const isMdc = url.endsWith('.mdc');
    const isYaml = url.endsWith('.yaml') || url.endsWith('.yml');

    let filename = 'SKILL.md';
    if (isMdc) {
      const name = frontmatterName(content) || 'agent';
      filename = `${name}.mdc`;
    } else if (isYaml) {
      filename = 'profile.yaml';
    }

    writeFileSync(join(tmp, filename), content);
    return {
      root: tmp,
      cleanup: () => rmSync(tmp, { recursive: true, force: true }),
    };
  }

  throw new Error(`Could not find a skill or git repository at ${url}`);
}
