# Dentro da Ansiedade

Site narrativo em 3D sobre ansiedade. A história avança com a rolagem, em 16 cenas e quatro atos (A manhã, O dia, A noite, A saída): um dia de alguém com ansiedade, do despertador até o pedido de ajuda. O protagonista não tem nome. O visual segue o estilo de [synthetic-humans.ai](https://synthetic-humans.ai/): pessoas escaneadas em azul lavanda, sem luz real, com borda rosada, pele de vidro, títulos enormes e desfoque de profundidade.

Feito com React 18, Vite 5, three.js e as bibliotecas `postprocessing` e `n8ao`.

## Rodar

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # gera dist/, um site estático
npm run preview   # serve dist/ para conferir
```

O `vite.config.js` usa `base: './'`, então a pasta `dist/` funciona em qualquer subpasta ou hospedagem estática. Cada push na branch `main` publica o site na Vercel.

## Como funciona

- O React desenha só a camada de texto (`src/ui/`): títulos, conversas, notificações, números, a respiração guiada e os cartões de ajuda. A rolagem vira um número de cena (`store.progress`, de 0 a 15).
- O palco 3D (`src/v2/`) roda fora do React. `stage.js` monta cada cena uma vez, em segundo plano e na ordem da história, mostra a cena em que o leitor está, move a câmera dela conforme a rolagem e passa por uma cortina na cor da paleta entre uma cena e outra.
- Em telas largas a imagem desliza para a direita para abrir espaço para a coluna de texto; em telas em pé ela desce. O desfoque acompanha a câmera, e em máquinas lentas a resolução cai aos poucos.
- `window.__dda` expõe o estado e quantas cenas já estão prontas, para testes e para a gravação de vídeo.

## Onde mexer

| O que | Arquivo |
| --- | --- |
| Roteiro: lugar, hora, textos, conversas e movimento de câmera de cada cena | `src/v2/story.js` |
| Cenários: objetos, pessoas, poses, paleta, brilho e enquadramento de cada cena | `src/v2/scenes.js` |
| Movimentos de câmera, cortina entre cenas, coração e respiração no brilho do protagonista | `src/v2/stage.js` |
| Renderizador, efeitos (AO, desfoque, bloom, vinheta, granulado) e carregamento das pessoas | `src/v2/engine.js` |
| Paletas das cenas | `src/story.js` |
| Camada de texto | `src/ui/Overlay.jsx`, `src/ui/Chrome.jsx`, `src/styles.css` |
| Material das pessoas (AO, borda rosada, cetim, pele de vidro, dobras e cabelo do mapa de detalhe) | `src/three/personMaterial.js` |

## Pessoas, poses e objetos

- **Pessoas**: nove escaneamentos gratuitos da RenderPeople. Seis têm esqueleto (Claudia, Carla, Eric, Sophia, Nathan, Manuel) e três já vêm posados (Dennis de terno, Mei com uma pasta, Fabienne com o filho Percy). `scripts/bake/` calcula a oclusão ambiente e marca pele e cabelo nas cores de vértice; `npm run optimize` suaviza a pele e comprime (`public/models/`). `scripts/detail-maps.py` gera, a partir dos mapas 8K da RenderPeople, uma textura de detalhe por pessoa com o relevo das dobras e do cabelo (`public/detail/`, e `public/detail4k/` para o protagonista). As instruções para refazer estão no topo de cada script.
- **Poses**: vêm de capturas de movimento reais da CMU (sentar, deitar, andar, conversar), adaptadas ao esqueleto das pessoas e acertadas com cinemática inversa para cada cadeira, cama e mesa (`src/v2/posing.js` guarda as receitas). O resultado fica pronto em `public/v2/poses.json`, então o site não carrega capturas nem calcula nada: a primeira chamada `person()` de uma cena usa a primeira pose gravada daquela cena, a segunda usa a segunda, e assim por diante. Mudar a quantidade ou a ordem das pessoas de uma cena pede gravar as poses de novo.
- **Objetos**: modelos da Poly Haven. `scripts/get-props.py` baixa os originais em `assets-src/props/` e `scripts/pack-props.mjs` gera os `.glb` leves em `public/props/` (texturas WebP de 512 px, malhas simplificadas e comprimidas).

## Créditos e cuidados

- Pessoas 3D: [RenderPeople, pessoas gratuitas](https://renderpeople.com/free-3d-people/). Elas têm licença própria. Confira os termos antes de publicar, principalmente sobre redistribuir os arquivos dos modelos.
- Captura de movimento: [CMU Graphics Lab Motion Capture Database](http://mocap.cs.cmu.edu/), criada com apoio da NSF (EIA-0196217), na conversão para BVH de Bruce Hahne.
- Objetos: [Poly Haven](https://polyhaven.com/models), licença CC0.
- Fonte: Host Grotesk (Google Fonts, licença OFL).
- Dado da cena 4: Organização Mundial da Saúde, 2017 (9,3% da população brasileira com transtorno de ansiedade).
- Contatos de ajuda: CVV 188 (cvv.org.br), SAMU 192, CAPS e UBS pelo SUS.
- Licença: o código está sob a licença MIT (arquivo `LICENSE`). As pessoas em `public/models/`, `public/detail*/` e `assets-src/raw/` não entram nela, porque seguem a licença da RenderPeople.
- O site é informativo e não substitui acompanhamento profissional. Vale revisar os textos com alguém da área de saúde mental antes de divulgar.
