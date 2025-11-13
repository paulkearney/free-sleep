#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const serverRoot = path.resolve(currentDir, '..');
const DAC_HOME = '/home/dac';

function resolveEnvPath(envFile) {
  const dacPath = path.join(DAC_HOME, envFile);
  if (fs.existsSync(dacPath)) {
    return dacPath;
  }

  const localPath = path.join(serverRoot, envFile);
  if (fs.existsSync(localPath)) {
    return localPath;
  }

  throw new Error(`Unable to find ${envFile} in ${DAC_HOME} or ${serverRoot}`);
}

function parseValue(rawValue) {
  if (rawValue === undefined) return '';
  let trimmed = rawValue.trim();

  // Strip inline comments when the value is not quoted
  if (!trimmed.startsWith('"') && !trimmed.startsWith("'")) {
    const hashIndex = trimmed.search(/\s#/);
    if (hashIndex >= 0) {
      trimmed = trimmed.slice(0, hashIndex).trim();
    }
  }

  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) ||
      (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }

  return trimmed
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t');
}

function applyEnvFromFile(filePath) {
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
    if (!match) continue;

    const [, key, valueRaw] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = parseValue(valueRaw);
  }
}

function run() {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('Usage: node ./scripts/with-env.mjs <env-file> <command> [args...]');
    process.exit(1);
  }

  const [envFile, command, ...commandArgs] = args;

  try {
    const envPath = resolveEnvPath(envFile);
    applyEnvFromFile(envPath);
    process.env.ENV_FILE = envFile;
    process.env.RESOLVED_ENV_PATH = envPath;

    const child = spawn(command, commandArgs, {
      stdio: 'inherit',
      env: process.env,
    });

    child.on('exit', (code, signal) => {
      if (signal) {
        process.kill(process.pid, signal);
      } else {
        process.exit(code ?? 0);
      }
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

run();
