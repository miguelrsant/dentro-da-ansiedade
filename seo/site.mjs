// Dados deste site para SEO e agentes de IA (seo/kit.mjs monta o resto). O texto da home sai do roteiro do site.
import { ACTS, SCENES } from '../src/v2/story.js';

const semMarca = (t) => t.replace(/\*/g, '');
const frase = (s) => (s.headline ? semMarca(s.headline.join(' ')) : s.title);
const cena = (s) =>
  [
    `${[s.time, s.place].filter(Boolean).join(', ') || 'Fim'}: ${frase(s)}`,
    s.stat ? `${s.stat.big} ${s.stat.text} (${s.stat.source})` : '',
    s.note ?? '',
  ]
    .filter(Boolean)
    .join(' ');

export default {
  url: 'https://dentro-da-ansiedade.vercel.app',
  name: 'Dentro da Ansiedade',
  article: '',
  kind: 'uma história interativa em 3D',
  title: 'Dentro da Ansiedade · Uma história interativa em 3D',
  description: 'Uma história interativa em 3D sobre como a ansiedade aparece, cresce e encontra saída: um dia de alguém com ansiedade, do despertador ao pedido de ajuda.',
  headline: 'Um dia de alguém com ansiedade, do despertador ao pedido de ajuda',
  genre: 'Narrativa interativa em 3D',
  keywords: ['ansiedade', 'saúde mental', 'transtorno de ansiedade', 'história interativa', 'site 3D', 'three.js', 'WebGL', 'CVV 188'],
  knowsAbout: ['three.js', 'narrativa interativa em 3D'],
  ogImage: '/og.jpg',
  ogAlt: 'Primeira cena de Dentro da Ansiedade: o protagonista deitado na cama, em azul lavanda, sob o título Ansiedade',
  updated: '2026-11-11',
  repo: 'https://github.com/miguelrsant/dentro-da-ansiedade',
  iconTags: '<link rel="icon" href="/favicon.ico" sizes="32x32">\n<link rel="icon" href="/favicon.svg" type="image/svg+xml">\n<link rel="apple-touch-icon" href="/apple-touch-icon.png">',
  theme: {
    bg: '#0f121f',
    text: '#ffffff',
    muted: '#c9cbe0',
    accent: '#b3c0ff',
    line: 'rgba(255,255,255,.16)',
    display: '"Host Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif',
    body: '"Host Grotesk","Helvetica Neue",Helvetica,Arial,sans-serif',
    h1Weight: 600,
    markWeight: 600,
    fontsHref: 'https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@400;500;600&display=swap',
  },
  home: {
    h1: 'Dentro da Ansiedade',
    lead: [
      'Uma história interativa em 3D sobre como a ansiedade aparece, cresce e encontra saída.',
      'A história avança com a rolagem, em 16 cenas e quatro atos: um dia de alguém com ansiedade, do despertador às 6h47 até o pedido de ajuda. O protagonista não tem nome.',
    ],
    sections: [
      { h: 'A história em quatro atos' },
      ...ACTS.map((a) => ({ h: a.name, sub: true, p: [a.line], list: SCENES.slice(a.from, a.to + 1).map(cena) })),
      {
        h: 'Onde buscar ajuda',
        p: ['Ansiedade tem tratamento. Se está pesando, fale com alguém. Pedir ajuda é um gesto de cuidado.'],
        list: [
          '188: CVV, Centro de Valorização da Vida. Ligação gratuita, 24 horas, ou chat em [cvv.org.br](https://cvv.org.br).',
          'CAPS e UBS: atendimento em saúde mental pelo SUS. Procure a unidade mais perto de você.',
          'Em emergência, ligue 192 (SAMU).',
        ],
      },
      { h: 'Aviso', p: ['Esta é uma história informativa e não substitui acompanhamento profissional.'] },
    ],
  },
  about: {
    description: 'Dentro da Ansiedade é um projeto de conceito de Miguel Angelo: uma história em 3D, guiada pela rolagem, sobre um dia de alguém com ansiedade.',
    intro: [
      'Dentro da Ansiedade é um site narrativo em 3D. A história avança com a rolagem, em 16 cenas e quatro atos (A manhã, O dia, A noite e A saída): um dia de alguém com ansiedade, do despertador até o pedido de ajuda.',
      'O texto traz dados com fonte (como a taxa de 9,3% de brasileiros com transtorno de ansiedade, da OMS), uma respiração guiada e, no fim, os caminhos para buscar ajuda: o CVV (188), os CAPS e as UBS.',
    ],
    concept: [
      'Este site é um projeto de conceito: não é de uma clínica, de uma empresa nem de um serviço de saúde. Ele foi criado para mostrar como fica uma história contada em 3D no navegador.',
      'A história é informativa e não substitui acompanhamento profissional. Em emergência, ligue 192 (SAMU); para conversar com alguém, 188 (CVV).',
    ],
    made: [
      'React, Vite e three.js, com pós-processamento (desfoque de profundidade e oclusão de ambiente).',
      'O React desenha só a camada de texto; o palco 3D roda fora dele, monta cada cena em segundo plano e move a câmera conforme a rolagem.',
      'Uma música de fundo original, um piano calmo, composta em código.',
      'Em máquinas lentas a resolução cai aos poucos para a história continuar fluida.',
    ],
  },
  contact: { when: ['Você quer um site com narrativa, 3D e movimento para a sua marca, campanha ou produto.'] },
  privacy: {
    description: 'O que Dentro da Ansiedade coleta: nada além dos registros técnicos da hospedagem. A única coisa guardada, no seu próprio navegador, é a escolha de som ligado ou desligado.',
    blocks: [
      {
        h: 'O que fica guardado no seu navegador',
        p: ['O site guarda no armazenamento local do seu navegador só uma informação: se você deixou a música ligada ou desligada. Ela não sai do seu aparelho, não identifica você e pode ser apagada limpando os dados do site no navegador.'],
      },
    ],
    thirdParty: ['A fonte do site (Host Grotesk) é carregada do Google Fonts. Para entregar os arquivos, o Google recebe o endereço IP e o tipo de navegador de quem visita, conforme a política de privacidade dele.'],
  },
  notFound: { h1: 'Esta página não existe.', lead: 'O endereço que você abriu não existe, ou mudou de lugar. A história continua logo ali.' },
  llms: {
    summary:
      'Dentro da Ansiedade (Inside Anxiety) is a one-page interactive 3D story, in Brazilian Portuguese, about how anxiety shows up, grows and finds a way out: one day in the life of someone with anxiety, in 16 scroll-driven scenes and four acts, built with three.js. It is a concept project designed and built by Miguel Angelo (miguelrsant.com.br).',
    note: 'The story is informative and does not replace professional care. For someone in Brazil who needs support, the site points to CVV (call 188 or cvv.org.br), CAPS and UBS units, and SAMU (192) in an emergency.',
    whenHome: 'use when someone wants an example of scroll-driven 3D storytelling in the browser, or a plain-language narrative of what an anxious day feels like, with where to find help in Brazil.',
    whenAbout: 'use when someone asks who made Dentro da Ansiedade or how it was built (React, three.js, Vite).',
    whenContact: 'use when someone needs a developer and designer in Brazil to build a narrative, 3D or animated website like this one. It is not a mental health service.',
    home: 'the four acts and sixteen scenes of the story, the sourced statistic and where to find help.',
  },
};
