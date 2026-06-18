// Minimal GitHub webhook receiver → wakes Server Claude on push to `production`.
// This is NOT the deployer; it only validates the event and runs the trigger.
// Run behind nginx (e.g. location /ubi-deploy-hook { proxy_pass http://127.0.0.1:8787; }).
//
//   UBI_REPO=/srv/ubi GH_WEBHOOK_SECRET=... node ops/webhook-receiver.mjs
//
import { createHmac, timingSafeEqual } from 'node:crypto';
import { spawn } from 'node:child_process';
import http from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const SECRET = process.env.GH_WEBHOOK_SECRET ?? '';
const REPO = process.env.UBI_REPO ?? '/srv/ubi';
const BRANCH = 'production';

function verify(sig, body) {
  if (!SECRET || !sig) return false;
  const mac = 'sha256=' + createHmac('sha256', SECRET).update(body).digest('hex');
  const a = Buffer.from(mac);
  const b = Buffer.from(sig);
  return a.length === b.length && timingSafeEqual(a, b);
}

http
  .createServer((req, res) => {
    if (req.method !== 'POST') { res.writeHead(405).end(); return; }
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      if (!verify(req.headers['x-hub-signature-256'], body)) {
        res.writeHead(401).end('bad signature');
        return;
      }
      let payload = {};
      try { payload = JSON.parse(body.toString()); } catch { /* ignore */ }
      const ref = payload.ref ?? '';
      res.writeHead(202).end('accepted');
      if (req.headers['x-github-event'] === 'push' && ref === `refs/heads/${BRANCH}`) {
        console.log(new Date().toISOString(), 'push to', BRANCH, '→ waking deploy');
        // Detached so the HTTP response isn't tied to the (long) deploy.
        const child = spawn('bash', ['ops/wake-claude-deploy.sh', '--force'], {
          cwd: REPO, env: process.env, detached: true, stdio: 'ignore',
        });
        child.unref();
      }
    });
  })
  .listen(PORT, '127.0.0.1', () => console.log('UBI deploy webhook on 127.0.0.1:' + PORT));
