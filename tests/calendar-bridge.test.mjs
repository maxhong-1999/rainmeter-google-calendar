import test from 'node:test';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
test('calendar bridge validates requests, encrypts tokens and checks write targets', async () => {
  await promisify(execFile)('powershell',['-NoProfile','-ExecutionPolicy','Bypass','-File',fileURLToPath(new URL('./calendar-bridge.test.ps1',import.meta.url))],{timeout:15000});
});
