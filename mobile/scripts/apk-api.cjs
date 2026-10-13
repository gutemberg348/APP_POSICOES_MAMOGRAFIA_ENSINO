const PUBLIC_API = "https://testes-techcode.shop/app_mamografia/api/index.php";

function releaseApi(value = PUBLIC_API) {
  let api;
  try { api = new URL(value.trim()); } catch { throw new Error("EXPO_PUBLIC_API_URL deve ser uma URL HTTPS válida."); }
  const host = api.hostname.toLowerCase();
  const ipv4 = /^\d+\.\d+\.\d+\.\d+$/.test(host) ? host.split('.').map(Number) : null;
  const privateHost = host === "localhost" || host.endsWith('.localhost') || host.endsWith('.local') || !host.includes('.')
    || (ipv4 && (ipv4[0] === 0 || ipv4[0] === 10 || ipv4[0] === 127 || ipv4[0] === 169 && ipv4[1] === 254
      || ipv4[0] === 172 && ipv4[1] >= 16 && ipv4[1] <= 31 || ipv4[0] === 192 && ipv4[1] === 168))
    || host.startsWith('['); // Release uses a public DNS name, including on IPv6 networks.
  if (api.protocol !== "https:" || api.username || api.password || api.search || api.hash || privateHost)
    throw new Error("Para distribuir o APK, EXPO_PUBLIC_API_URL precisa ser uma URL pública HTTPS, sem credenciais ou parâmetros. Não use localhost, 10.0.2.2 ou IP da rede local.");
  if (!api.pathname.endsWith('/api/index.php')) throw new Error("EXPO_PUBLIC_API_URL deve terminar em /api/index.php.");
  return api;
}

async function checkApi(api, fetchApi = fetch) {
  const url = new URL(api);
  url.searchParams.set('route', '/health');
  let response;
  try { response = await fetchApi(url, { signal: AbortSignal.timeout(20000), headers: { Accept: "application/json" } }); }
  catch { throw new Error("A API do APK não respondeu por HTTPS. Confira o endereço, o certificado e a conexão antes de compilar."); }
  if (!response.ok) throw new Error(`A API do APK respondeu HTTP ${response.status} no /health. Confira a hospedagem antes de compilar.`);
  let body;
  try { body = await response.json(); } catch { throw new Error("O /health da API retornou uma página em vez de JSON. Confira a URL e a hospedagem."); }
  if (body?.status !== "ok") throw new Error("O /health da API não confirmou status ok. Confira a configuração do servidor.");
}

module.exports = { PUBLIC_API, releaseApi, checkApi };
