import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { seoPlugin } from './seo/kit.mjs';
import site from './seo/site.mjs';

export default defineConfig({
  // seoPlugin: metadados, JSON-LD, texto sem JavaScript, páginas internas, Markdown, robots, sitemap e llms.txt (seo/)
  plugins: [react(), seoPlugin(site)],
  base: './',
  build: { assetsInlineLimit: 0, chunkSizeWarningLimit: 1500 },
});
