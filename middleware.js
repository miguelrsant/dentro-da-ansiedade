// Vercel Routing Middleware: quem pede Accept: text/markdown recebe a página em Markdown (os arquivos .md
// gerados no build), com Vary: Accept; endereço que não existe recebe o 404 em Markdown. O resto segue normal.
import { next } from '@vercel/functions';

const PAGES = { '/': '/index.md', '/sobre': '/sobre.md', '/contato': '/contato.md', '/privacidade': '/privacidade.md' };
const MDS = new Set([...Object.values(PAGES), '/404.md']);

// O Markdown só vence quando text/markdown aparece pelo nome com peso (q) maior ou igual ao do HTML;
// */* e text/* continuam recebendo HTML, como os navegadores.
function prefersMarkdown(accept) {
  if (!accept) return false;
  let md = 0;
  const html = {};
  for (const part of accept.toLowerCase().split(',')) {
    const [type, ...params] = part.split(';').map((s) => s.trim());
    const qParam = params.find((p) => p.startsWith('q='));
    const parsed = qParam ? Number(qParam.slice(2)) : 1;
    const q = Number.isFinite(parsed) ? Math.min(Math.max(parsed, 0), 1) : 0;
    if (type === 'text/markdown' || type === 'text/x-markdown') md = Math.max(md, q);
    else if (type === 'text/html' || type === 'application/xhtml+xml') html.exact = Math.max(html.exact ?? 0, q);
    else if (type === 'text/*') html.text = Math.max(html.text ?? 0, q);
    else if (type === '*/*') html.any = Math.max(html.any ?? 0, q);
  }
  return md > 0 && md >= (html.exact ?? html.text ?? html.any ?? 0);
}

export const config = { matcher: '/((?!assets/).*)' };

export default async function middleware(request) {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) return next();
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const isMd = path.endsWith('.md');
    if (/\.[a-z0-9]+$/i.test(path) && !isMd) return next();
    if (isMd && MDS.has(path)) return next();
    if (!isMd && !prefersMarkdown(request.headers.get('accept'))) return next();

    const file = isMd ? null : PAGES[path];
    const res = await fetch(new URL(file ?? '/404.md', url.origin));
    if (!res.ok) return next();
    const body = await res.text();
    return new Response(request.method === 'HEAD' ? null : body, {
      status: file ? 200 : 404,
      headers: {
        'Content-Type': 'text/markdown; charset=utf-8',
        Vary: 'Accept',
        'x-markdown-tokens': String(Math.ceil(body.length / 4)),
        'Cache-Control': 'public, max-age=300',
        'X-Robots-Tag': 'noindex',
      },
    });
  } catch {
    return next();
  }
}
