import { existsSync } from 'node:fs';
import path from 'node:path';

const roots = [process.env.ProgramFiles, process.env['ProgramFiles(x86)'], process.env.LOCALAPPDATA]
  .filter((root) => typeof root === 'string' && root.length > 0);

const candidates = roots.map((root) => path.join(root, 'Google', 'Chrome', 'Application', 'chrome.exe'));

export function resolveChromeExecutable(explicitPath) {
  if (explicitPath) {
    const resolved = path.resolve(explicitPath);
    if (existsSync(resolved)) return resolved;
    throw new Error(`Chrome executable not found at ${resolved}.`);
  }
  const resolved = candidates.find((candidate) => existsSync(candidate));
  if (!resolved) throw new Error('Google Chrome was not found in standard Windows install paths; pass its executable path explicitly.');
  return resolved;
}
