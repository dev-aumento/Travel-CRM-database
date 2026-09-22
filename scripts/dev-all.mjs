import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const root = path.dirname(fileURLToPath(import.meta.url));
const cwd = path.join(root, '..');

const children = [];

const run = (command, args, label) => {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[${label}] stopped (${signal})`);
    } else if (code !== 0 && code !== null) {
      console.error(`[${label}] exited with code ${code}`);
      shutdown(code);
    }
  });

  children.push(child);
  return child;
};

const shutdown = (code = 0) => {
  for (const child of children) {
    if (!child.killed) {
      child.kill();
    }
  }
  process.exit(code);
};

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

run('node', ['server/index.js'], 'api');
run('npx', ['vite'], 'vite');
