// SEO e site para agentes de IA num site estático (Vite na Vercel).
// A partir de seo/site.mjs, este arquivo monta: os metadados e o JSON-LD do index.html, o texto que aparece
// sem JavaScript, as páginas Sobre, Contato e Privacidade, a 404, o Markdown de cada página, robots.txt,
// sitemap.xml e llms.txt. Tudo é gerado no build (nada disso fica salvo no repositório).

export const AUTHOR = {
  name: 'Miguel Angelo',
  role: 'Desenvolvedor full stack e designer',
  site: 'miguelrsant.com.br',
  url: 'https://miguelrsant.com.br',
  instagram: 'https://www.instagram.com/miguelrsant/',
  instagramHandle: '@miguelrsant',
  linkedin: 'https://www.linkedin.com/in/miguelrsant/',
  github: 'https://github.com/miguelrsant',
  email: 'miguelrsant01@gmail.com',
  city: 'Franca',
  region: 'SP',
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Links em Markdown simples dentro dos textos: [texto](https://...) vira <a>.
const rich = (s) =>
  esc(s).replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, t, h) => `<a href="${h}"${/^https?:/.test(h) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${t}</a>`);

/** As páginas internas, a partir dos dados do site. O HTML e o Markdown saem destes mesmos blocos. */
export function pagesOf(c) {
  const a = AUTHOR;
  const repoName = c.repo.replace('https://github.com/', '');
  return [
    {
      path: '/sobre',
      type: 'AboutPage',
      label: 'Sobre',
      h1: `Sobre ${c.article ?? ''}${c.name}`,
      title: `Sobre ${c.article ?? ''}${c.name}, ${c.kind}`,
      description: c.about.description,
      blocks: [
        { p: c.about.intro },
        { h: 'Um projeto de conceito', p: c.about.concept },
        {
          h: 'Quem fez',
          p: [`O site foi desenhado e desenvolvido por [${a.name}](${a.url}), desenvolvedor full stack e designer de Franca (SP), que cuida do código, da interface e do movimento dos projetos que faz.`],
          list: [`Site: [${a.site}](${a.url})`, `Instagram: [${a.instagramHandle}](${a.instagram})`, `Código deste projeto no GitHub: [${repoName}](${c.repo})`],
        },
        { h: 'Como foi feito', list: c.about.made },
      ],
    },
    {
      path: '/contato',
      type: 'ContactPage',
      label: 'Contato',
      h1: 'Contato',
      title: `Contato · ${c.name}`,
      description: `Fale com Miguel Angelo, que desenhou e desenvolveu ${c.article ?? ''}${c.name}: site, Instagram, LinkedIn, GitHub e e-mail para orçamentos e conversas sobre projetos.`,
      blocks: [
        { p: [`${c.name} é um projeto de conceito de ${a.name}. Não existe equipe de atendimento nem telefone: quem responde é o próprio Miguel, pelos canais abaixo.`] },
        {
          h: 'Canais',
          list: [
            `Site e portfólio: [${a.site}](${a.url})`,
            `Instagram: [${a.instagramHandle}](${a.instagram})`,
            `LinkedIn: [linkedin.com/in/miguelrsant](${a.linkedin})`,
            `GitHub: [github.com/miguelrsant](${a.github})`,
            `E-mail: [${a.email}](mailto:${a.email})`,
          ],
        },
        { h: 'Quando falar com ele', list: [...c.contact.when, 'Você achou um erro no funcionamento do site.', 'Você quer usar o código como referência: ele é aberto e está no GitHub.'] },
        {
          h: 'O que mandar na primeira mensagem',
          p: ['Conte o que você quer construir, para quem é e se já existe identidade visual ou conteúdo. Com isso ele responde com as perguntas que faltam, uma ideia de prazo e o orçamento.'],
        },
      ],
    },
    {
      path: '/privacidade',
      type: 'WebPage',
      label: 'Privacidade',
      h1: 'Privacidade',
      title: `Privacidade · ${c.name}`,
      description: c.privacy.description,
      blocks: [
        { p: [`${c.name} é um projeto de conceito e foi feito para coletar o mínimo possível de dados de quem visita.`] },
        ...(c.privacy.blocks ?? []),
        {
          h: 'O que o site não faz',
          list: ['Não tem cadastro, login, formulário nem área de cliente.', 'Não usa cookies de rastreamento nem ferramentas de análise de audiência.', 'Não exibe anúncios e não compartilha dados com anunciantes.'],
        },
        {
          h: 'Registros técnicos da hospedagem',
          p: ['O site é hospedado na Vercel. Como em qualquer hospedagem, o servidor registra dados técnicos de cada acesso, como endereço IP, data e hora, página pedida e tipo de navegador. Esses registros servem para manter o site no ar e seguro e seguem a política de privacidade da Vercel.'],
        },
        ...(c.privacy.thirdParty ? [{ h: 'Serviços de terceiros', p: c.privacy.thirdParty }] : []),
        {
          h: 'Links para outros sites',
          p: ['O GitHub, o Instagram, o LinkedIn e o site de quem fez o projeto abrem em outros endereços. Ao clicar, você sai deste site e passa a valer a política de privacidade de cada um.'],
        },
        {
          h: 'Dúvidas e direitos',
          p: [
            `Pela LGPD você pode perguntar se há dados seus e pedir a correção ou a exclusão. Como o site não guarda dados pessoais, a resposta costuma ser curta. Para qualquer dúvida, escreva para [${a.email}](mailto:${a.email}).`,
            `Última atualização: ${dataBR(c.updated)}.`,
          ],
        },
      ],
    },
  ];
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const dataBR = (iso) => { const [y, m, d] = iso.split('-').map(Number); return `${d} de ${MESES[m - 1]} de ${y}`; };

const abs = (c, path) => c.url + (path === '/' ? '/' : path);
const mdPath = (path) => (path === '/' ? '/index.md' : `${path}.md`);

// ---------- JSON-LD ----------
export function jsonLd(c, page) {
  const a = AUTHOR;
  const person = `${a.url}/#miguel`;
  const website = `${c.url}/#site`;
  const work = `${c.url}/#projeto`;
  const image = c.url + c.ogImage;
  const graph = [
    {
      '@type': 'Person',
      '@id': person,
      name: a.name,
      url: a.url,
      jobTitle: a.role,
      email: `mailto:${a.email}`,
      address: { '@type': 'PostalAddress', addressLocality: a.city, addressRegion: a.region, addressCountry: 'BR' },
      contactPoint: { '@type': 'ContactPoint', contactType: 'orçamentos e projetos', email: a.email, url: `${a.url}/contato`, availableLanguage: ['pt-BR', 'en'] },
      sameAs: [a.instagram, a.github, a.linkedin],
      knowsAbout: ['desenvolvimento web', 'React', 'WebGL', 'design de interface', 'motion design', ...(c.knowsAbout ?? [])],
    },
    { '@type': 'WebSite', '@id': website, name: c.name, url: `${c.url}/`, description: c.description, inLanguage: 'pt-BR', author: { '@id': person }, publisher: { '@id': person } },
    {
      '@type': 'CreativeWork',
      '@id': work,
      name: c.name,
      headline: c.headline,
      description: c.description,
      url: `${c.url}/`,
      image,
      inLanguage: 'pt-BR',
      genre: c.genre,
      keywords: c.keywords,
      isAccessibleForFree: true,
      creator: { '@id': person },
      author: { '@id': person },
      codeRepository: c.repo,
      sameAs: [c.repo],
    },
    {
      '@type': page.type,
      '@id': `${abs(c, page.path)}#pagina`,
      url: abs(c, page.path),
      name: page.title,
      description: page.description,
      inLanguage: 'pt-BR',
      isPartOf: { '@id': website },
      about: { '@id': work },
      mainEntity: { '@id': page.path === '/' ? work : person },
      dateModified: c.updated,
      primaryImageOfPage: image,
    },
  ];
  if (page.path !== '/')
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: c.name, item: `${c.url}/` },
        { '@type': 'ListItem', position: 2, name: page.label, item: abs(c, page.path) },
      ],
    });
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

// ---------- <head> ----------
export function headTags(c, page, { robots = 'index, follow, max-image-preview:large, max-snippet:-1' } = {}) {
  const url = abs(c, page.path);
  const img = c.url + c.ogImage;
  return [
    `<title>${esc(page.title)}</title>`,
    `<meta name="description" content="${esc(page.description)}">`,
    `<meta name="robots" content="${robots}">`,
    `<meta name="author" content="${AUTHOR.name}">`,
    `<meta name="keywords" content="${esc(c.keywords.join(', '))}">`,
    `<meta name="is-agentic-site-type" content="content">`,
    `<link rel="canonical" href="${url}">`,
    `<link rel="alternate" type="text/markdown" href="${abs(c, mdPath(page.path))}">`,
    `<link rel="author" href="${AUTHOR.url}">`,
    `<meta property="og:type" content="website">`,
    `<meta property="og:locale" content="pt_BR">`,
    `<meta property="og:site_name" content="${esc(c.name)}">`,
    `<meta property="og:title" content="${esc(page.title)}">`,
    `<meta property="og:description" content="${esc(page.description)}">`,
    `<meta property="og:url" content="${url}">`,
    `<meta property="og:image" content="${img}">`,
    `<meta property="og:image:width" content="1200">`,
    `<meta property="og:image:height" content="630">`,
    `<meta property="og:image:alt" content="${esc(c.ogAlt)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(page.title)}">`,
    `<meta name="twitter:description" content="${esc(page.description)}">`,
    `<meta name="twitter:image" content="${img}">`,
    `<script type="application/ld+json">${jsonLd(c, page)}</script>`,
  ].join('\n');
}

const homePage = (c) => ({ path: '/', type: 'WebPage', label: 'Início', title: c.title, description: c.description });

// ---------- blocos em HTML e em Markdown ----------
const blocksHtml = (blocks, h = 'h2') =>
  blocks
    .map((b) =>
      [
        '<section>',
        b.h ? `<${b.sub ? 'h3' : h}>${esc(b.h)}</${b.sub ? 'h3' : h}>` : '',
        ...(b.p ?? []).map((t) => `<p>${rich(t)}</p>`),
        ...(b.quote ?? []).map((q) => `<blockquote><p>${esc(q.text)}</p>${q.cite ? `<cite>${esc(q.cite)}</cite>` : ''}</blockquote>`),
        b.list ? `<ul>${b.list.map((t) => `<li>${rich(t)}</li>`).join('')}</ul>` : '',
        '</section>',
      ]
        .filter(Boolean)
        .join(''),
    )
    .join('\n');

const blocksMd = (blocks) => {
  const out = [];
  for (const b of blocks) {
    if (b.h) out.push(`${b.sub ? '###' : '##'} ${b.h}`, '');
    for (const t of b.p ?? []) out.push(t, '');
    for (const q of b.quote ?? []) out.push(`> ${q.text}${q.cite ? ` (${q.cite})` : ''}`, '');
    if (b.list) out.push(...b.list.map((l) => `- ${l}`), '');
  }
  return out;
};

const creditBlock = (c) => ({
  h: 'Quem fez',
  p: [`Site desenhado e desenvolvido por [${AUTHOR.name}](${AUTHOR.url}), desenvolvedor full stack e designer.`],
  list: [`Site: [${AUTHOR.site}](${AUTHOR.url})`, `Instagram: [${AUTHOR.instagramHandle}](${AUTHOR.instagram})`, `Código deste projeto: [GitHub](${c.repo})`],
});

const front = (c, page) =>
  ['---', `title: "${page.title.replace(/"/g, "'")}"`, `description: "${page.description.replace(/"/g, "'")}"`, `canonical: ${abs(c, page.path)}`, `last-updated: ${c.updated}`, '---', ''].join('\n');

const linksMd = (c) =>
  ['## Páginas', '', `- [Início](${c.url}/index.md)`, ...pagesOf(c).map((p) => `- [${p.label}](${c.url}${p.path}.md)`), `- [llms.txt](${c.url}/llms.txt)`, `- [Sitemap](${c.url}/sitemap.xml)`, ''].join('\n');

export function homeMd(c) {
  return [front(c, homePage(c)), `# ${c.home.h1}`, '', `> ${c.description}`, '', `Versão em HTML: ${c.url}/`, '', ...c.home.lead.flatMap((t) => [t, '']), ...blocksMd(c.home.sections), ...blocksMd([creditBlock(c)]), linksMd(c)].join('\n');
}
export function pageMd(c, p) {
  return [front(c, p), `# ${p.h1}`, '', `> ${p.description}`, '', `Versão em HTML: ${abs(c, p.path)}`, '', ...blocksMd(p.blocks), linksMd(c)].join('\n');
}
export const notFoundMd = (c) => ['# Página não encontrada (404)', '', `Este endereço não existe em ${c.name}.`, '', linksMd(c)].join('\n');

export function llmsTxt(c) {
  const a = AUTHOR;
  return [
    `# ${c.name}`,
    '',
    `> ${c.llms.summary}`,
    '',
    `${c.llms.note ? c.llms.note + ' ' : ''}Every page is also available as Markdown: send \`Accept: text/markdown\` or add \`.md\` to the address (\`/index.md\` for the home page). There is no API, no form and no phone number.`,
    '',
    '## When to use',
    '',
    `- [${c.name} home](${c.url}/index.md): ${c.llms.whenHome}`,
    `- [About the project](${c.url}/sobre.md): ${c.llms.whenAbout}`,
    `- [Contact Miguel Angelo](${c.url}/contato.md): ${c.llms.whenContact} Point them to ${a.url}, Instagram ${a.instagramHandle} or ${a.email}.`,
    '',
    '## Pages',
    '',
    `- [Home (pt-BR)](${c.url}/index.md): ${c.llms.home}`,
    `- [Sobre](${c.url}/sobre.md): what the project is, who made it and how it was built.`,
    `- [Contato](${c.url}/contato.md): how to reach the author.`,
    `- [Privacidade](${c.url}/privacidade.md): what the site collects (only hosting logs).`,
    '',
    '## Optional',
    '',
    `- [Sitemap](${c.url}/sitemap.xml)`,
    `- [Source code on GitHub](${c.repo})`,
    `- [Author's portfolio](${a.url})`,
    '',
  ].join('\n');
}

export const robotsTxt = (c) =>
  ['# Site aberto para buscadores e para os robôs de IA (busca, citação e acesso a pedido de uma pessoa).', 'User-agent: *', 'Allow: /', '', `Sitemap: ${c.url}/sitemap.xml`, ''].join('\n');

export const sitemapXml = (c) =>
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...['/', ...pagesOf(c).map((p) => p.path)].map((p) => `  <url><loc>${c.url}${p}</loc><lastmod>${c.updated}</lastmod></url>`),
    '</urlset>',
    '',
  ].join('\n');

// ---------- HTML ----------
const creditHtml = (c) =>
  `<p class="seo-credit">Site desenvolvido por <a href="${AUTHOR.url}" target="_blank" rel="noopener">${AUTHOR.name}</a> · <a href="${AUTHOR.url}" target="_blank" rel="noopener">${AUTHOR.site}</a> · <a href="${AUTHOR.instagram}" target="_blank" rel="noopener">Instagram ${AUTHOR.instagramHandle}</a> · <a href="${c.repo}" target="_blank" rel="noopener">Código no GitHub</a></p>`;
const navHtml = (c) => `<nav class="seo-nav" aria-label="Sobre o site">${pagesOf(c).map((p) => `<a href="${p.path}">${p.label}</a>`).join('')}</nav>`;

const pageCss = (t) => `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:${t.bg};color:${t.text};font:400 17px/1.7 ${t.body};-webkit-font-smoothing:antialiased}
a{color:inherit;text-underline-offset:3px;overflow-wrap:anywhere}
a:focus-visible{outline:2px solid ${t.accent};outline-offset:3px}
.bar{display:flex;align-items:center;justify-content:space-between;gap:24px;padding:20px clamp(20px,5vw,64px);border-bottom:1px solid ${t.line}}
.bar a{text-decoration:none}
.mark{font:${t.markWeight ?? 500} 22px/1 ${t.display};letter-spacing:${t.markSpacing ?? '0'}}
.back{font:500 12px/1 ${t.mono ?? t.body};letter-spacing:.16em;text-transform:uppercase;color:${t.muted}}
.back:hover{color:${t.text}}
main{max-width:720px;margin:0 auto;padding:clamp(48px,9vw,96px) 20px clamp(64px,10vw,112px)}
.eyebrow{margin:0 0 16px;font:500 12px/1.3 ${t.mono ?? t.body};letter-spacing:.2em;text-transform:uppercase;color:${t.accent}}
h1{margin:0;font:${t.h1Weight ?? 400} clamp(2.2rem,6vw,3.4rem)/1.08 ${t.display};text-wrap:balance}
.lead{margin:24px 0 0;font-size:1.2rem;line-height:1.6;color:${t.text}}
section{margin-top:44px}
h2{margin:0 0 14px;font:${t.h1Weight ?? 400} 1.7rem/1.2 ${t.display}}
h3{margin:28px 0 10px;font:${t.h1Weight ?? 400} 1.3rem/1.25 ${t.display}}
p,li{color:${t.muted}}
p{margin:0 0 16px}
ul{margin:0;padding-left:20px;display:grid;gap:10px}
blockquote{margin:0 0 16px;padding-left:16px;border-left:2px solid ${t.accent}}
blockquote p{margin:0;color:${t.text};font-style:italic}
cite{display:block;margin-top:4px;font-size:.85rem;font-style:normal;color:${t.muted}}
main a{color:${t.text}}
.cta{display:inline-block;margin-top:48px;padding:14px 24px;border:1px solid ${t.accent};color:${t.text};text-decoration:none;font:500 12px/1 ${t.mono ?? t.body};letter-spacing:.16em;text-transform:uppercase}
.cta:hover{background:${t.accent};color:${t.bg}}
footer{border-top:1px solid ${t.line};padding:28px clamp(20px,5vw,64px) 40px;font-size:.85rem;color:${t.muted};display:flex;flex-wrap:wrap;gap:12px 32px;justify-content:space-between}
footer a{text-decoration:none}
footer a:hover{color:${t.text};text-decoration:underline}
.seo-credit{margin:0}
.seo-nav{display:flex;flex-wrap:wrap;gap:8px 20px}
`.trim();

const fontLinks = (t) =>
  t.fontsHref ? `<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="${esc(t.fontsHref)}">` : '';

function shell(c, page, body, opts) {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="theme-color" content="${c.theme.bg}">
${c.iconTags ?? ''}
${headTags(c, page, opts)}
${fontLinks(c.theme)}
<style>${pageCss(c.theme)}</style>
</head>
<body>
<header class="bar"><a class="mark" href="/" aria-label="${esc(c.name)}, voltar ao início">${esc(c.name)}</a><a class="back" href="/">Início</a></header>
<main>
${body}
</main>
<footer>${creditHtml(c)}${navHtml(c)}</footer>
</body>
</html>
`;
}

export const pageHtml = (c, p) =>
  shell(c, p, `<p class="eyebrow">${esc(p.label)}</p>\n<h1>${esc(p.h1)}</h1>\n<p class="lead">${esc(p.description)}</p>\n${blocksHtml(p.blocks)}\n<a class="cta" href="/">Voltar ao início</a>`);

export const notFoundHtml = (c) =>
  shell(
    c,
    { path: '/404', type: 'WebPage', label: '404', title: `Página não encontrada · ${c.name}`, description: `Este endereço não existe em ${c.name}.` },
    `<p class="eyebrow">Erro 404</p>\n<h1>${esc(c.notFound.h1)}</h1>\n<p class="lead">${esc(c.notFound.lead)}</p>\n<a class="cta" href="/">Voltar ao início</a>`,
    { robots: 'noindex, follow' },
  ).replace(/<link rel="(canonical|alternate)"[^>]*>\n/g, '');

/** O texto da home para quem chega sem JavaScript (buscadores e agentes). Com JavaScript, ele sai de cena antes de aparecer. */
export function fallbackHtml(c) {
  return `<div class="seo-fallback"><header><p>${esc(c.name)}</p></header><h1>${esc(c.home.h1)}</h1>${c.home.lead.map((t) => `<p>${rich(t)}</p>`).join('')}
${blocksHtml(c.home.sections)}
<footer>${creditHtml(c)}${navHtml(c)}</footer></div>`;
}

const fallbackCss = (t) =>
  `.seo-fallback{max-width:720px;margin:0 auto;padding:48px 20px;background:${t.bg};color:${t.text};font:400 17px/1.7 ${t.body}}.seo-fallback h1{font:400 2.4rem/1.1 ${t.display};margin:0 0 20px}.seo-fallback h2{font:400 1.6rem/1.2 ${t.display};margin:40px 0 12px}.seo-fallback h3{font:400 1.25rem/1.25 ${t.display};margin:24px 0 8px}.seo-fallback a{color:inherit}.seo-fallback footer{margin-top:48px;font-size:.9rem}.seo-fallback .seo-nav{display:flex;gap:16px;margin-top:8px}.js .seo-fallback{position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap;border:0}`;

/** Todos os arquivos gerados: { 'robots.txt': '...', 'sobre.html': '...' }. */
export function filesOf(c) {
  const out = { 'robots.txt': robotsTxt(c), 'sitemap.xml': sitemapXml(c), 'llms.txt': llmsTxt(c), 'index.md': homeMd(c), '404.md': notFoundMd(c), '404.html': notFoundHtml(c) };
  for (const p of pagesOf(c)) {
    out[`${p.path.slice(1)}.html`] = pageHtml(c, p);
    out[`${p.path.slice(1)}.md`] = pageMd(c, p);
  }
  return out;
}

/** Plugin do Vite: completa o index.html e publica os arquivos gerados junto com o build. */
export function seoPlugin(c) {
  return {
    name: 'seo-e-agentes',
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        const home = homePage(c);
        let out = html
          .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
          .replace(/<meta\s+name="description"[^>]*>\s*/i, '')
          .replace('</head>', `${headTags(c, home)}\n<style>${fallbackCss(c.theme)}</style>\n<script>document.documentElement.classList.add('js')</script>\n</head>`);
        const alvo = c.fallbackInto ?? '<div id="root">';
        if (!out.includes(alvo)) throw new Error(`seo: não achei ${alvo} no index.html`);
        return out.replace(alvo, `${alvo}${fallbackHtml(c)}`);
      },
    },
    generateBundle() {
      for (const [fileName, source] of Object.entries(filesOf(c))) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
