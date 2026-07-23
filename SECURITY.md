# Security Policy

## Supported Versions

Security updates are provided for the latest release line of `@mhmdreza-rafiei/agentry` only.

| Version | Supported          |
| ------- | ------------------ |
| 0.2.x   | :white_check_mark: |
| < 0.2   | :x:                |

Upgrade to the latest `0.2.x` release before reporting issues that may already be fixed.

## Scope

Agentry is a CLI that fetches artifacts from Git sources (or local paths) and installs them into agent directories. Security-relevant areas include:

- Remote source resolution and `git` clone / cache handling
- Path traversal or unexpected writes outside intended install targets
- Lockfile / install-state integrity
- Supply-chain issues in published npm packages or CI publish workflow
- Credential or token leakage via logs, errors, or cloned content handling

Reports about third-party **skills, agents, rules, scripts, or profiles** you install with Agentry belong with those authors, unless Agentry itself mishandles untrusted content (e.g. unsafe paths).

## Reporting a Vulnerability

**Do not** open a public GitHub issue or discussion for security vulnerabilities.

### Preferred: GitHub private reporting

1. Go to the repository **Security** tab → **Advisories** → **Report a vulnerability**  
   (or use: https://github.com/mhmdreza-rafiei/agentry/security/advisories/new)
2. Include:
   - Affected package version (`agentry --version` / `package.json`)
   - Description of the issue and impact
   - Steps to reproduce (commands, OS, Node version)
   - Proof of concept if available (no public exploit dumps)
   - Whether you are available for coordinated disclosure

### What to expect

| Stage | Typical timing |
| ----- | -------------- |
| Acknowledgement | Within **7 days** |
| Status update | At least every **14 days** while open |
| Fix / advisory (if accepted) | As soon as practical; timing depends on severity and complexity |

**If accepted:** we will work on a fix, credit you if you want (unless you prefer anonymity), and may publish a GitHub Security Advisory and/or patched release.

**If declined:** we will explain why (e.g. not reproducible, out of scope, or accepted risk) and may still suggest hardening if useful.

We ask that you give us a reasonable window to ship a fix before public disclosure (commonly **90 days** from acknowledgement, or sooner if we agree).

## Safe Harbor

We will not pursue legal action against researchers who:

- Act in good faith to improve security
- Avoid privacy violations, destruction of data, and disruption of services
- Do not exploit the issue beyond what is needed to demonstrate it
- Report findings privately as described above

## Non-security bugs

Bugs that are not security vulnerabilities (UX, incorrect install paths that stay inside documented targets, docs, feature requests) should use normal GitHub Issues.
