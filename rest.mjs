// BrowserPair REST starter. Node.js 20+, no dependencies.

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const command = args.find((arg) => !arg.startsWith('--')) || 'list';
const origin = 'https://api.browserpair.com';
const token = process.env.BROWSERPAIR_AGENT_KEY;
const taskId = process.env.BROWSERPAIR_TASK_ID;
let path;
let method = 'GET';
let body;
const headers = { Accept: 'application/json' };

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('Set ' + name + ' before running this command.');
  return value;
}

try {
  if (command === 'list') {
    path = '/v1/browsers';
  } else if (command === 'create') {
    const browserId = required('BROWSERPAIR_BROWSER_ID');
    const idempotencyKey = required('BROWSERPAIR_IDEMPOTENCY_KEY');
    if (!/^[A-Za-z0-9._:-]{8,200}$/.test(idempotencyKey)) {
      throw new Error('Idempotency key must be 8-200 letters, digits, dots, underscores, colons or hyphens.');
    }
    path = '/v1/tasks';
    method = 'POST';
    headers['Idempotency-Key'] = idempotencyKey;
    body = {
      browserId,
      goal: 'Open https://example.com and report its visible page title. Do not submit forms or modify an account.',
      contract: {
        version: 1,
        domains: ['example.com'],
        capabilities: ['read', 'navigate'],
        confirmations: [],
        maxSideEffects: 0,
      },
    };
  } else if (command === 'state' || command === 'cancel') {
    if (!taskId?.trim()) throw new Error('Set BROWSERPAIR_TASK_ID.');
    path = '/v1/tasks/' + encodeURIComponent(taskId.trim());
    if (command === 'cancel') {
      path += '/cancel';
      method = 'POST';
      body = {};
    }
  } else {
    throw new Error('Use: node rest.mjs list|create|state|cancel [--dry-run]');
  }
  if (body) headers['Content-Type'] = 'application/json';

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, method, url: origin + path, headerNames: [...Object.keys(headers), 'Authorization'], body }, null, 2));
  } else {
    if (!token) throw new Error('Set BROWSERPAIR_AGENT_KEY to a scoped agent key.');
    headers.Authorization = 'Bearer ' + token;
    const response = await fetch(origin + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
      redirect: 'error',
    });
    if (!response.ok) {
      throw new Error('BrowserPair returned HTTP ' + response.status + '. Inspect permissions and task state; do not blindly retry.');
    }
    const text = await response.text();
    // Task state can include private page content. Inspect locally; redact before sharing.
    console.log(text || 'Request completed without a response body.');
  }
} catch (error) {
  // Do not print request headers, credentials or raw server error bodies.
  console.error(error instanceof Error ? error.message : 'Request failed.');
  if (command === 'create' && !dryRun) {
    console.error('If creation may have reached the server, keep the same idempotency key and identical request. Do not create another key to retry.');
  }
  process.exitCode = 1;
}
