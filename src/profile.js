'use strict';

const fs = require('node:fs');
const path = require('node:path');

// Profiles are plain JSON under `<baseDir>/profile/<name>.json`, mapping each
// asset type to a list of selectors, e.g.:
//   { "repo": "author/repo", "skills": ["prompt/enhance-prompt"], "rules": ["workflow"] }
// `repo` is optional; the command-line source (when given) takes precedence.
function loadProfile(name, baseDir) {
  const file = path.join(baseDir || process.cwd(), 'profile', `${name}.json`);
  let cfg;
  try {
    cfg = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    throw new Error(`Profile not found or invalid JSON: ${file}`);
  }
  return { file, cfg };
}

module.exports = { loadProfile };
