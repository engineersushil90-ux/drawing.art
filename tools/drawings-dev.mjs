import { existsSync, watch } from 'node:fs';
import { spawn } from 'node:child_process';
import { join } from 'node:path';

const root = join(process.cwd(), 'public', 'drawings');
const nodeCommand = process.execPath;
const npmCommand = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function runNodeScript(script) {
  return new Promise((resolve, reject) => {
    const child = spawn(nodeCommand, [script], { stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', code => {
      if (code === 0) resolve();
      else reject(new Error(`${script} exited with code ${code}`));
    });
  });
}

async function generate() {
  await runNodeScript('tools/generate-drawings-index.mjs');
  await runNodeScript('tools/generate-drawing-image-variants.mjs');
}

await generate();
const server = spawn(npmCommand, ['ng', 'serve'], { stdio: 'inherit', shell: process.platform === 'win32' });

if (existsSync(root)) {
  let timer;
  watch(root, { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      generate().catch(error => console.error('Failed to regenerate drawing assets:', error));
    }, 250);
  });
}

process.on('SIGINT', () => server.kill('SIGINT'));
process.on('SIGTERM', () => server.kill('SIGTERM'));
