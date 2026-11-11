// Testes do site para agentes de IA e SEO (Markdown, 404, JSON-LD, sitemap, robots e llms.txt).
//   npm run build && npm run test:agents               (serve o build numa porta livre)
//   BASE_URL=https://dentro-da-ansiedade.vercel.app npm run test:agents   (testa o site publicado)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";

// ---------- Configuração do projeto ----------
const site = "https://dentro-da-ansiedade.vercel.app";
const homes = [["/", "pt-BR"]];                                    // [caminho, lang do <html>]
const pages = ["/", "/sobre", "/contato", "/privacidade"];
const trustPages = ["/sobre", "/contato", "/privacidade"];
const redirects = [["/about", "/sobre"], ["/contact", "/contato"], ["/privacy", "/privacidade"]];
const anyFile = "/favicon.svg";                                         // um arquivo publicado
const brand = "Dentro da Ansiedade";                                          // começo do <title>
const start = (port) => ["node", "seo/serve.mjs", String(port)];                                  // comando que serve o build
// ---------------------------------------------

let base = process.env.BASE_URL?.replace(/\/$/, "");
let server;

before(async () => {
  if (base) return;
  const port = 3200 + Math.floor(Math.random() * 500);
  base = `http://localhost:${port}`;
  const [cmd, ...args] = start(port);
  server = spawn(cmd, args, { stdio: "ignore", detached: true });
  for (let i = 0; i < 60; i++) {
    try {
      await fetch(base);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  throw new Error("o servidor não respondeu (rode npm run build antes)");
});

after(() => server && process.kill(-server.pid));

const get = (path, accept, opts = {}) => fetch(base + path, { headers: accept ? { Accept: accept } : {}, ...opts });
const mdOf = (path) => (path === "/" ? "/index.md" : `${path}.md`);
const textOf = (html) => html.replace(/<script.*?<\/script>|<style.*?<\/style>|<svg.*?<\/svg>/gs, "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

test("home em Markdown com Accept: text/markdown, com Vary: Accept", async () => {
  for (const [path] of homes) {
    const res = await get(path, "text/markdown");
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /^text\/markdown/);
    assert.match(res.headers.get("vary"), /\bAccept\b/);
    const body = await res.text();
    assert.match(body, /^(---\n[\s\S]*?\n---\n+)?# /, "Markdown começa com # (ou com o frontmatter ---)");
    assert.ok(body.length > 500, "corpo curto demais");
  }
});

test("navegadores continuam recebendo HTML", async () => {
  for (const accept of [undefined, "text/html", "*/*", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8", "text/markdown;q=0.5, text/html"]) {
    const res = await get("/", accept);
    assert.equal(res.status, 200);
    assert.match(res.headers.get("content-type"), /^text\/html/, `Accept: ${accept}`);
  }
});

test("Markdown vence quando tem peso maior ou igual ao HTML", async () => {
  for (const accept of ["text/markdown, text/html;q=0.9", "text/markdown, */*", "text/html;q=0.5, text/markdown", "text/plain, text/markdown"]) {
    const res = await get("/", accept);
    assert.match(res.headers.get("content-type"), /^text\/markdown/, `Accept: ${accept}`);
  }
});

test("endereços .md servem Markdown sem precisar do Accept", async () => {
  for (const path of pages.map(mdOf)) {
    const res = await get(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type"), /^text\/markdown/, path);
  }
});

test("404 em Markdown para agentes e em HTML para navegadores", async () => {
  for (const path of ["/__ora-404-probe", "/a/b/nao-existe", "/nada.md"]) {
    const res = await get(path, "text/markdown");
    assert.equal(res.status, 404, path);
    assert.match(res.headers.get("content-type"), /^text\/markdown/);
    assert.match(res.headers.get("vary"), /\bAccept\b/);
    const body = await res.text();
    assert.ok(body.length >= 20);
    assert.match(body, /\/llms\.txt/);
    assert.match(body, /\/sitemap\.xml/);
  }
  const html = await get("/__ora-404-probe", "text/html");
  assert.equal(html.status, 404);
  assert.match(html.headers.get("content-type"), /^text\/html/);
  assert.match(await html.text(), /<meta name="robots" content="noindex/i);
});

test("arquivos não passam pela negociação", async () => {
  const res = await get(anyFile, "text/markdown");
  assert.equal(res.status, 200);
  assert.doesNotMatch(res.headers.get("content-type"), /markdown/);
});

test("HTML das homes: h1, títulos em ordem, JSON-LD e metadados", async () => {
  for (const [path, lang] of homes) {
    const html = await (await get(path, "text/html")).text();
    assert.match(html, new RegExp(`<html lang="${lang}"`));
    const levels = [...html.matchAll(/<h([1-6])[\s>]/g)].map((m) => Number(m[1]));
    assert.equal(levels.filter((l) => l === 1).length, 1, "um h1 só");
    levels.reduce((prev, l) => (assert.ok(l <= prev + 1, `título pula de h${prev} para h${l}`), l));
    assert.match(html, new RegExp(`<link rel="canonical" href="${site.replace(/\./g, "\\.")}`));
    assert.match(html, new RegExp(`<title>${brand}`));
    assert.match(html, /<meta property="og:type" content="/);
    assert.match(html, /<meta property="og:image" content="https:\/\//);
    assert.match(html, /<link rel="alternate" type="text\/markdown"/);
    const ld = JSON.parse(html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1]);
    const id = ld["@graph"].find((n) => ["Person", "Organization", "LocalBusiness", "SoftwareApplication"].includes(n["@type"]));
    assert.ok(id?.name && id?.url, "identidade com name e url");
    assert.ok(id.sameAs?.length, "sameAs");
    const text = textOf(html);
    assert.ok(text.length >= 500, "pouco texto no HTML");
    // razão de conteúdo: texto ÷ HTML sem <script> e <style> (o CSS inline e o payload do React não contam)
    const markup = html.replace(/<script.*?<\/script>|<style.*?<\/style>/gs, "").length;
    assert.ok(text.length / markup >= 0.05, `razão de conteúdo ${((text.length / markup) * 100).toFixed(1)}%`);
  }
});

test("todas as páginas: legíveis sem JS, indexáveis, sem meta refresh e dentro do orçamento de tokens", async () => {
  for (const path of pages) {
    const res = await get(path, "text/html");
    assert.equal(res.status, 200, path);
    assert.doesNotMatch(res.headers.get("x-robots-tag") || "", /noindex/i, `${path}: X-Robots-Tag noindex no HTML`);
    const html = await res.text();
    assert.doesNotMatch(html, /<meta[^>]+name="(robots|googlebot|bingbot)"[^>]+content="[^"]*noindex/i, `${path}: noindex`);
    assert.doesNotMatch(html, /<meta[^>]+http-equiv="refresh"/i, `${path}: redirecionamento por meta refresh`);
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, `${path}: um h1 só`);
    const text = textOf(html);
    assert.ok(text.length >= 500, `${path}: ${text.length} caracteres sem JS`);
    assert.ok(text.length < 100_000, `${path}: ${text.length} caracteres passa do orçamento de tokens`);
  }
});

test("páginas de confiança com conteúdo real, h1 e redirects 308", async () => {
  for (const path of trustPages) {
    const res = await get(path, "text/html");
    assert.equal(res.status, 200, path);
    const html = await res.text();
    assert.equal((html.match(/<h1[\s>]/g) || []).length, 1, path);
    assert.ok(textOf(html).length >= 500, path);
    assert.match(html, /application\/ld\+json/);
  }
  for (const [from, to] of redirects) {
    const res = await get(from, undefined, { redirect: "manual" });
    assert.equal(res.status, 308);
    assert.equal(new URL(res.headers.get("location"), base).pathname, to);
  }
});

test("sitemap.xml lista as páginas com lastmod", async () => {
  const res = await get("/sitemap.xml");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /xml/);
  const xml = await res.text();
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs.sort(), pages.map((p) => site + p).sort());
  assert.equal((xml.match(/<lastmod>/g) || []).length, pages.length);
});

// Regras que valem para um robô: o grupo com o nome dele ou, se não houver, o grupo "*".
function regrasPara(robots, ua) {
  const grupos = [];
  let atual = null;
  let lendoNomes = false;
  for (const linha of robots.split(/\r?\n/)) {
    const l = linha.replace(/#.*/, "").trim();
    if (!l.includes(":")) continue;
    const chave = l.slice(0, l.indexOf(":")).trim().toLowerCase();
    const valor = l.slice(l.indexOf(":") + 1).trim();
    if (chave === "user-agent") {
      if (!lendoNomes) grupos.push((atual = { nomes: [], regras: [] }));
      atual.nomes.push(valor.toLowerCase());
      lendoNomes = true;
    } else {
      lendoNomes = false;
      if (atual && (chave === "allow" || chave === "disallow")) atual.regras.push([chave, valor]);
    }
  }
  const proprio = grupos.filter((g) => g.nomes.includes(ua.toLowerCase()));
  return (proprio.length ? proprio : grupos.filter((g) => g.nomes.includes("*"))).flatMap((g) => g.regras);
}

test("robots.txt em texto, com o sitemap, sem barrar os robôs de busca das IAs", async () => {
  const res = await get("/robots.txt");
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/plain/);
  const body = await res.text();
  assert.match(body, new RegExp(`Sitemap: ${site}/sitemap.xml`));
  for (const ua of ["Googlebot", "Bingbot", "OAI-SearchBot", "Claude-SearchBot", "PerplexityBot"]) {
    const bloqueado = regrasPara(body, ua).some(([k, v]) => k === "disallow" && v === "/");
    assert.ok(!bloqueado, `${ua} bloqueado no robots.txt`);
  }
});

test("llms.txt segue o formato do llmstxt.org e tem a seção When to use", async () => {
  const res = await get("/llms.txt");
  assert.equal(res.status, 200);
  const body = await res.text();
  assert.match(body.split("\n")[0], /^# .+$/);
  assert.match(body, /\n> .+/);
  assert.match(body, /\n## When to use\n\n- \[.+\]\(https:\/\/.+\): .+/);
  for (const section of body.split("\n## ").slice(1)) {
    const items = section.split("\n").slice(1).filter(Boolean);
    assert.ok(items.length > 0);
    for (const item of items) assert.match(item, /^- \[[^\]]+\]\([^)]+\)(: .+)?$/, item);
  }
  for (const [, url] of body.matchAll(new RegExp(`\\((${site.replace(/\./g, "\\.")}[^)]+\\.md)\\)`, "g"))) {
    const r = await get(new URL(url).pathname);
    assert.equal(r.status, 200, url);
  }
});
