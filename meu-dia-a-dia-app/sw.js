// Meu Dia: guarda o app no aparelho para abrir sem internet.
// Os dados não passam por aqui (ficam no aparelho e na planilha); só as telas, o ícone e a fonte.
const VERSAO = 'mdd-v4';
const ARQUIVOS = ['./', 'index.html', 'manifest.webmanifest', 'icone-192.png', 'icone-512.png', 'icone-maskable.png', 'icone-180.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSAO).then(c => c.addAll(ARQUIVOS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(nomes => Promise.all(nomes.filter(n => n !== VERSAO).map(n => caches.delete(n))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET') return; // chamadas à planilha (POST) vão direto para a internet
  const fonte = /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if (url.origin !== location.origin && !fonte) return;
  // Abre na hora com o que está guardado e, em paralelo, busca a versão nova para a próxima abertura
  const chave = req.mode === 'navigate' ? 'index.html' : req;
  e.respondWith(caches.open(VERSAO).then(async cache => {
    const guardado = await cache.match(chave, { ignoreSearch: req.mode === 'navigate' });
    const paraComparar = guardado && req.mode === 'navigate' ? guardado.clone() : null; // a original vai para a página
    // no-cache: confere com o servidor (resposta curta "não mudou" quando está igual), sem usar a cópia do navegador
    const daRede = fetch(fonte ? req : new Request(req.url, { cache: 'no-cache', credentials: 'same-origin' })).then(async r => {
      if (r && (r.ok || r.type === 'opaque')) {
        // Tela do app mudou desde a última vez? Avisa a página para oferecer "Atualizar"
        if (paraComparar && r.ok) {
          const [antes, agora] = await Promise.all([paraComparar.text(), r.clone().text()]);
          if (antes !== agora) self.clients.matchAll({ type: 'window' }).then(cs => cs.forEach(c => c.postMessage({ tipo: 'nova-versao' })));
        }
        await cache.put(chave, r.clone());
      }
      return r;
    }).catch(() => guardado);
    if (guardado) { e.waitUntil(daRede); return guardado; }
    return daRede;
  }));
});
