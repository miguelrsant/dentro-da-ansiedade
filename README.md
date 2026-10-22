# Dentro da Ansiedade

Site narrativo em 3D sobre ansiedade. A história avança com a rolagem, em nove capítulos e três atos (O peso, Por dentro, A saída). O visual segue o estilo de [synthetic-humans.ai](https://synthetic-humans.ai/): pessoas escaneadas em azul lavanda, sem luz real, com borda rosada, pele de vidro, títulos enormes que ficam atrás das pessoas e desfoque de profundidade.

Feito com React 18, Vite 5, three.js, React Three Fiber e a biblioteca `postprocessing`.

## Rodar

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/, um site estático
npm run preview   # serve dist/ para conferir
```

O `vite.config.js` usa `base: './'`, então a pasta `dist/` funciona em qualquer subpasta ou hospedagem estática (Vercel, Netlify, GitHub Pages).

`npm run build:inline` gera `dist-inline/` com os modelos 3D dentro do JavaScript, para hospedagens que não servem arquivos `.glb`. Nessa versão os modelos vão sem a compressão meshopt, porque algumas hospedagens bloqueiam WebAssembly, então o arquivo fica maior (cerca de 5 MB, 2 MB com gzip).

Abrindo com `?capture` na URL, o site expõe `window.__advance(segundos)` e `window.__director`, que servem para tirar capturas de cada capítulo sem esperar a animação em tempo real.

## Onde mexer

| O que | Arquivo |
| --- | --- |
| Roteiro: paleta, câmera, foco, comportamento da multidão e títulos de cada capítulo | `src/story.js` |
| Textos, chats, bolhas de pensamento e cartões de ajuda | `src/ui/Overlay.jsx` |
| Menu, pílulas (CVV e Respirar agora), indicador de atos | `src/ui/Chrome.jsx` |
| Estilos da interface | `src/styles.css` |
| O "diretor" da cena: interpola câmera, paleta e foco pela rolagem, move a multidão, brilho, sombras e posição das bolhas | `src/three/director.js` |
| Pessoas: poses, caminhada, desvio da câmera e camada procedural (olhar, respiração, postura ansiosa, tremor) | `src/three/people.js` |
| Material dos personagens (AO, borda rosada, brilho acetinado, pele de vidro) | `src/three/personMaterial.js` |
| Título desenhado atrás das pessoas usando a profundidade | `src/three/TitleEffect.js` |
| Fundo em degradê, sombras de contato, brilho interno e granulado | `src/three/backdrop.js`, `shadows.js`, `glow.js`, `GrainEffect.js` |

Os uniforms em `createSharedUniforms()` (`personMaterial.js`) controlam o visual geral: `uAoPow` (contraste), `uRim` (borda rosada), `uSatin` (brilho do tecido), `uSkinBase` e `uSkinAo` (transparência da pele).

## Personagens

São seis pessoas escaneadas gratuitas da RenderPeople (Claudia, Carla, Eric, Sophia, Nathan e Manuel). Todas usam o mesmo esqueleto, então a animação parada da Sophia (recortada em várias poses) e a caminhada do Nathan servem para todo mundo.

O processo, já feito, foi este:

1. `scripts/bake/` abre cada FBX num Chromium sem tela, calcula a oclusão ambiente em dois raios e marca pele e cabelo a partir das texturas. Tudo vai para as cores de vértice (r e g = AO, b = pele, a = cabelo). Resultado em `assets-src/raw/`.
2. `npm run optimize` (`scripts/optimize.mjs`) suaviza as normais da pele e do cabelo para o rosto parecer vidro polido, tira o granulado do escaneamento das roupas, suaviza a AO e comprime com meshopt. Resultado em `public/models/` (cerca de 1,4 MB para as seis pessoas).

Para trocar ou acrescentar pessoas, as instruções estão no topo de `scripts/bake/run-bake.cjs`.

## Créditos e cuidados

- Modelos 3D: [RenderPeople, pessoas gratuitas](https://renderpeople.com/free-3d-people/). Eles têm licença própria. Confira os termos antes de publicar, principalmente sobre redistribuir os arquivos dos modelos.
- Licença: o código está sob a licença MIT (arquivo `LICENSE`). Os modelos em `public/models/` e `assets-src/raw/` não entram nela, porque seguem a licença da RenderPeople.
- Fonte: Host Grotesk (Google Fonts, licença OFL).
- Dado do capítulo 2: Organização Mundial da Saúde, 2017 (9,3% da população brasileira com transtorno de ansiedade).
- Contatos de ajuda: CVV 188 (cvv.org.br), SAMU 192, CAPS e UBS pelo SUS.
- O site é informativo e não substitui acompanhamento profissional. Vale revisar os textos com alguém da área de saúde mental antes de publicar.
