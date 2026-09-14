import { existsSync, watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const root = join(process.cwd(), 'public', 'drawings');
const nodeCommand = process.execPath;
const npmCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function generate() {
  spawn(nodeCommand, ['tools/generate-drawings-index.mjs'], { stdio: 'inherit' });
}

generate();
const server = spawn(npmCommand, ['ng', 'serve'], { stdio: 'inherit', shell: process.platform === 'win32' });

if (existsSync(root)) {
  let timer;
  watch(root, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(generate, 250);
  });
}

process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
