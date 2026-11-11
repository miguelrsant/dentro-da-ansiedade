# SEO, agentes de IA e crédito

O que este site tem para ser bem indexado no Google e lido por agentes de IA. Tudo é gerado no build, a partir de `seo/site.mjs` (os dados deste site) e `seo/kit.mjs` (o gerador, igual em todos os concepts do Miguel).

## O que existe

- **Metadados e JSON-LD** no `index.html`: título, descrição, canonical, Open Graph, Twitter card e `Person` (o autor), `WebSite` e `CreativeWork`.
- **Texto sem JavaScript**: a home leva dentro dela o texto do site, para buscadores e agentes que não rodam o JavaScript. Com JavaScript, esse texto fica fora da tela e dá lugar ao site.
- **Markdown para agentes**: qualquer página pedida com `Accept: text/markdown`, ou com `.md` no fim (`/index.md`, `/sobre.md`), devolve Markdown, com `Vary: Accept`. Quem resolve é o `middleware.js` (Routing Middleware da Vercel).
- **404**: `404.html` no visual do site, com `noindex`, e `404.md` para agentes.
- **`/llms.txt`**, **`/robots.txt`** e **`/sitemap.xml`** (com a data de `updated` em `seo/site.mjs`).
- **Páginas de confiança**: `/sobre`, `/contato` e `/privacidade`. `/about`, `/contact` e `/privacy` redirecionam (308, em `vercel.json`).
- **Um domínio só**: os endereços extras da Vercel redirecionam para o oficial (`vercel.json`).
- **Crédito**: o site diz quem desenvolveu, com link para miguelrsant.com.br, o Instagram e o repositório.

## Como mudar

- Texto da home, das páginas internas, título, descrição e palavras: `seo/site.mjs`. Ao mudar o conteúdo, atualize `updated`.
- Imagem de compartilhamento: `public/og.jpg` (1200×630).

## Como testar

```bash
npm run build
npm run test:agents     # serve dist/ como a Vercel (seo/serve.mjs) e confere tudo
BASE_URL=https://<domínio> npm run test:agents   # confere o site publicado
```

## Pendente (depende do dono)

- Novo scan no https://is-agentic.com e PageSpeed no endereço publicado.
- Registrar o domínio no Google Search Console e no Bing Webmaster Tools e enviar o sitemap.
