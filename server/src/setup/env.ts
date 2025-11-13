import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DAC_HOME = '/home/dac';
const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(currentDir, '..', '..');

function parseValue(rawValue: string | undefined): string {
  if (rawValue === undefined) {
    return '';
  }

  let trimmed = rawValue.trim();

  if (!trimmed.startsWith('"') && !trimmed.startsWith("'")) {
    const hashIndex = trimmed.search(/\s#/);
    if (hashIndex >= 0) {
      trimmed = trimmed.slice(0, hashIndex).trim();
    }
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    trimmed = trimmed.slice(1, -1);
  }

  return trimmed
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function applyEnvFromFile(filePath: string) {
  const contents = fs.readFileSync(filePath, 'utf8');
  const lines = contents.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const normalized = trimmed.startsWith('export ')
      ? trimmed.slice(7).trim()
      : trimmed;

    const match = normalized.match(/^([\w.-]+)\s*=\s*(.*)$/);
    if (!match) {
      continue;
    }

    const [, key, valueRaw] = match;
    if (process.env[key] !== undefined) {
      continue;
    }

    process.env[key] = parseValue(valueRaw);
  }
}

function resolveEnvPath(envFileName: string): string | undefined {
  const dacPath = path.join(DAC_HOME, envFileName);
  if (fs.existsSync(dacPath)) {
    return dacPath;
  }

  const localPath = path.join(serverRoot, envFileName);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  return undefined;
}

const envFile = process.env.ENV_FILE ?? '.env.pod';
const envPath = resolveEnvPath(envFile);

if (!envPath) {
  throw new Error(`Unable to locate ${envFile} in ${DAC_HOME} or ${serverRoot}`);
}

applyEnvFromFile(envPath);
process.env.ENV_FILE = envFile;
process.env.RESOLVED_ENV_PATH ??= envPath;
