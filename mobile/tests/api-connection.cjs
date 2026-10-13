const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { PUBLIC_API, releaseApi, checkApi } = require('../scripts/apk-api.cjs');

function client({ dev = false, url, fetchApi }) {
  const result = { exports: {} };
  let timeout;
  const compiled = ts.transpileModule(fs.readFileSync(require.resolve('../src/api.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(compiled, {
    exports: result.exports, process: { env: url ? { EXPO_PUBLIC_API_URL: url } : {} }, __DEV__: dev,
    URL, AbortController, setTimeout: fn => { timeout = fn; return 1; }, clearTimeout() {},
    fetch: (...args) => fetchApi(...args, () => timeout()),
    require(name) {
      if (name === 'react-native') return { Platform: { OS: 'android' } };
      if (name === 'expo-secure-store') return {};
      throw new Error('Unexpected dependency ' + name);
    },
  });
  return result.exports;
}

(async () => {
  assert.equal(releaseApi().toString(), PUBLIC_API);
  for (const url of ['http://example.com/api/index.php', 'https://localhost/api/index.php',
    'https://10.0.2.2/api/index.php', 'https://192.168.1.100/api/index.php', 'https://172.16.2.5/api/index.php',
    'https://user:pass@example.com/api/index.php', PUBLIC_API + '?route=/health', 'https://example.com/'])
    assert.throws(() => releaseApi(url));
  assert.equal(releaseApi('https://example.com/api/index.php').hostname, 'example.com');
  const health = releaseApi();
  await checkApi(health, async url => {
    assert.equal(url.searchParams.get('route'), '/health');
    return { ok: true, json: async () => ({ status: 'ok' }) };
  });
  await assert.rejects(checkApi(health, async () => { throw new Error('TLS'); }), /HTTPS/);
  await assert.rejects(checkApi(health, async () => ({ ok: false, status: 503 })), /HTTP 503/);
  await assert.rejects(checkApi(health, async () => ({ ok: true, json: async () => { throw new Error('HTML'); } })), /JSON/);
  await assert.rejects(checkApi(health, async () => ({ ok: true, json: async () => ({ status: 'failed' }) })), /status ok/);

  let app = client({ fetchApi: async () => ({ ok: true, status: 200, json: async () => ({ status: 'ok' }) }) });
  assert.equal(app.API_URL, PUBLIC_API, 'Release without environment must use hosted API');
  assert.equal((await app.api('/health')).status, 'ok');
  app = client({ dev: true, fetchApi: async () => {} });
  assert.equal(app.API_URL, 'http://10.0.2.2/app_mamografia/api/index.php', 'Emulator remains available in development');
  app = client({ fetchApi: async () => ({ ok: false, status: 403, json: async () => { throw new Error('HTML instead of JSON'); } }) });
  await assert.rejects(app.api('/health'), /resposta inválida \(HTTP 403\)/);
  app = client({ fetchApi: async () => ({ ok: false, status: 503, json: async () => ({ error: 'Manutenção' }) }) });
  await assert.rejects(app.api('/health'), /Manutenção/);
  app = client({ fetchApi: async () => { throw new Error('Network request failed'); } });
  await assert.rejects(app.api('/health'), /conectar ao servidor/);
  app = client({ fetchApi: async (_url, options, triggerTimeout) => {
    triggerTimeout(); options.signal.throwIfAborted();
  } });
  await assert.rejects(app.api('/health'), /demorou para responder/);
  const cancelled = new AbortController(); cancelled.abort();
  await assert.rejects(app.api('/health', { signal: cancelled.signal }), error => error.name === 'AbortError');
  console.log('PASS: release API, development override, public URL validation, health checks, invalid responses, HTTP failures, network failures, timeout and cancellation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
