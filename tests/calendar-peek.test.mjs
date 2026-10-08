import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';

test('calendar peek: real state machine, settings and monitor geometry', { skip: process.platform !== 'win32' }, async () => {
  await promisify(execFile)('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', fileURLToPath(new URL('./calendar-peek.test.ps1', import.meta.url))], { timeout: 30000 });
});
