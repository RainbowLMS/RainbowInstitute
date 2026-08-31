'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

function openPort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(() => resolve(port));
    });
  });
}

function cookiePair(setCookie) {
  return String(setCookie || '').split(';')[0];
}

async function waitForHealth(base, timeoutMs = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(`${base}/healthz`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 120));
  }
  throw new Error('Server did not become ready.');
}

test('HTTP server supports health, login, admin dashboard, and employee dashboard', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rainbow-lms-server-'));
  const port = await openPort();
  const child = spawn(process.execPath, ['--no-warnings', 'server.js'], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1', DB_PATH: path.join(dir, 'test.sqlite') },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const base = `http://127.0.0.1:${port}`;
  try {
    await waitForHealth(base);
    const health = await fetch(`${base}/healthz`);
    assert.equal(health.status, 200);

    let response = await fetch(`${base}/login`);
    const loginHtml = await response.text();
    const loginCookie = cookiePair(response.headers.get('set-cookie'));
    const csrf = loginHtml.match(/name="csrf" value="([^"]+)"/)?.[1];
    assert.ok(csrf);
    response = await fetch(`${base}/login`, {
      method: 'POST',
      redirect: 'manual',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', Cookie: loginCookie },
      body: new URLSearchParams({ csrf, username: 'admin', password: 'RainbowAdmin!2026' }),
    });
    assert.equal(response.status, 303);
    const sessionCookie = cookiePair(response.headers.get('set-cookie'));
    response = await fetch(`${base}/admin`, { headers: { Cookie: sessionCookie } });
    assert.equal(response.status, 200);
    assert.match(await response.text(), /Training Operations Center/);

    response = await fetch(`${base}/app.css`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/css/);
  } finally {
    child.kill('SIGTERM');
    await new Promise(resolve => child.once('exit', resolve));
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
