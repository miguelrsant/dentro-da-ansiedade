// Serve dist/ como a Vercel serviria (endereços sem .html, 404.html, redirects e cabeçalhos do vercel.json)
// e passa cada pedido pelo middleware.js. Só para testar o build: node seo/serve.mjs [porta]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import middleware from '../middleware.js';

const port = Number(process.argv[2] || 4173);
const dist = join(import.meta.dirname, '..', 'dist');
const vercel = JSON.parse(await readFile(join(import.meta.dirname, '..', 'vercel.json'), 'utf8'));
const TYPES = { '.html': 'text/html; charset=utf-8', '.md': 'text/markdown; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const read = (p) => readFile(join(dist, normalize(p))).catch(() => null);

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);
  const path = url.pathname;
  const redirect = (vercel.redirects ?? []).find((r) => !r.has && r.source === path);
  if (redirect) return res.writeHead(308, { Location: redirect.destination }).end();

  const mw = await middleware(new Request(url, { method: req.method, headers: req.headers }));
  if (!mw.headers.get('x-middleware-next')) {
    res.writeHead(mw.status, Object.fromEntries(mw.headers));
    return res.end(Buffer.from(await mw.arrayBuffer()));
  }

  let file = path === '/' ? '/index.html' : path;
  let body = await read(file);
  if (!body && !extname(file)) body = await read((file += '.html'));
  const headers = {};
  if (path === '/') headers.Vary = 'Accept';
  for (const h of vercel.headers ?? []) if (new RegExp(`^${h.source.replace(/\(\.\*\)/g, '.*')}$`).test(path)) for (const { key, value } of h.headers) headers[key] = value;
  if (!body) return res.writeHead(404, { 'Content-Type': TYPES['.html'] }).end(await read('/404.html'));
  res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers }).end(body);
}).listen(port, () => console.log(`http://localhost:${port}`));
