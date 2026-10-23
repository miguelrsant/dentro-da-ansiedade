// The 16 scenes of the story, in order: where they happen, what the screen says and how the camera moves.
// `pal` is the stage palette the scene was drawn with (scenes.js), used for the fades and the text colour.
// Headline lines wrapped in *...* are the emphasised ones. The protagonist has no name in the story.

export const ACTS = [
  { name: 'A manhã', line: 'O peso começa antes de o dia começar.', from: 0, to: 3 },
  { name: 'O dia', line: 'Por fora, um dia normal. Por dentro, um alarme que não desliga.', from: 4, to: 8 },
  { name: 'A noite', line: 'Em casa, cercado de gente que o ama, ele ainda diz que está tudo bem.', from: 9, to: 11 },
  { name: 'A saída', line: 'Ansiedade tem nome, tem tratamento, e ninguém precisa passar por ela sozinho.', from: 12, to: 15 },
];

// move: how the camera travels across the scene's scroll (see stage.js). bpm: the heart in the corner.
export const SCENES = [
  {
    id: 's01', nav: '06h47', time: '06h47', place: 'Quarto', pal: 'dawn', move: 'descend', bpm: 96, side: 0.16,
    title: 'Ansiedade', bubble: 'Por que meu coração já acordou correndo?',
  },
  {
    id: 's02', nav: '23 notificações', time: '06h52', place: 'Beira da cama', pal: 'dawn', bpm: 101,
    headline: ['23 notificações.', 'Nenhuma urgente.', '*Todas parecem.*'],
    notifications: [
      ['Trabalho', '9 e-mails não lidos'],
      ['Família', '12 mensagens'],
      ['Lembrete', 'Apresentação às 10h'],
      ['Banco', 'Fatura vence hoje'],
    ],
  },
  {
    id: 's03', nav: 'O café esfria', time: '07h20', place: 'Cozinha', pal: 'lavender', bpm: 98,
    headline: ['O café esfria.', '*A lista não.*'],
    chips: ['Revisar os slides', 'Responder o e-mail', 'Ligar pra mãe', 'Pagar a fatura', 'Não esquecer nada'],
  },
  {
    id: 's04', nav: 'Multidão', time: '08h05', place: 'Faixa de pedestres', pal: 'dusk', move: 'crane', bpm: 104,
    headline: ['No meio de', 'tanta gente,', '*e ainda assim, só.*'],
    stat: { big: '9,3%', text: 'dos brasileiros vivem com algum transtorno de ansiedade. A maior taxa do mundo.', source: 'OMS, 2017 · cerca de 18,6 milhões de pessoas' },
  },
  {
    id: 's05', nav: 'O corpo dispara', time: '08h20', place: 'Metrô', pal: 'plum', bpm: 112, pulse: true,
    headline: ['O corpo acredita', 'em cada', '*pensamento.*'],
    vitals: true,
    chips: ['Coração acelerado', 'Falta de ar', 'Mãos frias', 'Aperto no peito', 'Ombros tensos'],
  },
  {
    id: 's06', nav: 'A mensagem', time: '09h12', place: 'Escritório', pal: 'lavender', bpm: 108, chatFirst: true,
    chat: [{ from: 'Chefe', text: 'Pode vir na minha sala às 15h?' }],
    status: 'Visualizado às 09:12',
    headline: ['Uma frase.', '*Mil interpretações.*'],
  },
  {
    id: 's07', nav: 'E se der errado?', time: '09h14', place: 'Escritório', pal: 'plum', move: 'push', bpm: 118,
    headline: ['A mente cria', 'perguntas que', '*não têm fim.*'],
    thoughts: ['E se eu for demitido?', 'O que eu fiz de errado?', 'Todo mundo vai perceber.', 'Eu não dou conta.'],
    status: 'Pensamento 1 de 37…',
  },
  {
    id: 's08', nav: 'A reunião', time: '10h00', place: 'Sala de reunião', pal: 'deep', bpm: 124,
    headline: ['Todo mundo', '*está olhando.*'],
    chat: [{ from: 'Chefe', text: 'Bom trabalho.' }],
    note: 'A ansiedade antecipa ameaças que, na maioria das vezes, não acontecem.',
  },
  {
    id: 's09', nav: 'Na escada', time: '10h40', place: 'Escada de emergência', pal: 'night', move: 'orbit', bpm: 138, pulse: true, dark: true,
    headline: ['Tudo parece urgente.', '*Nada parece seguro.*'],
    note: 'É a espiral da ansiedade: o medo de sentir medo alimenta o próprio medo.',
  },
  {
    id: 's10', nav: 'O jantar', time: '20h30', place: 'Casa dos pais', pal: 'rose', move: 'sweep', bpm: 100, chatFirst: true, side: 0.2,
    chat: [{ from: 'Mãe', text: 'Tá tudo bem, filho?' }, { from: '', text: 'Tá sim.' }],
    headline: ['"Tá sim."', 'A resposta mais', '*fácil de dar.*'],
  },
  {
    id: 's11', nav: '2h13', time: '02h13', place: 'Quarto, de madrugada', pal: 'night', move: 'push', bpm: 104, dark: true,
    headline: ['Às 2h13,', 'tudo parece', '*maior.*'],
    chat: [{ from: '', text: 'tá acordada?' }, { from: '', text: 'acho que preciso conversar' }],
    status: 'Carla está digitando…',
  },
  {
    id: 's12', nav: 'Você quer conversar?', time: 'No dia seguinte', place: 'Casa da Carla', pal: 'rose', move: 'push', bpm: 90,
    headline: ['Às vezes, a saída', 'começa com', '*uma pergunta.*'],
    chat: [{ from: 'Carla', text: 'Você quer conversar?' }],
    status: 'Alguém perto de você está ouvindo…',
  },
  {
    id: 's13', nav: 'Pedir ajuda', time: 'Uma semana depois', place: 'Consultório', pal: 'tide', bpm: 84, chatFirst: true,
    chat: [{ from: 'Psicóloga', text: 'Pedir ajuda não é fraqueza.' }],
    headline: ['Ansiedade', '*tem tratamento.*'],
    note: 'Psicoterapia, como a terapia cognitivo-comportamental, e, quando indicada, medicação ajudam. Pelo SUS, procure um CAPS ou uma UBS.',
  },
  {
    id: 's14', nav: 'Respire junto', time: 'Todos os dias', place: 'Em casa', pal: 'tide', move: 'push', bpm: 72, breath: true,
    headline: ['Respire', '*junto.*'],
    note: 'Puxe o ar por 4 segundos, segure por 4 e solte devagar por 6. Soltar o ar mais devagar do que puxa ajuda o corpo a desacelerar.',
  },
  {
    id: 's15', nav: 'Semanas depois', time: 'Domingo de manhã', place: 'Parque', pal: 'dawn', move: 'follow', bpm: 70,
    headline: ['Ainda tem dias difíceis.', 'Mas agora ele', '*sabe o caminho.*'],
  },
  {
    id: 's16', nav: 'Você não está só', time: '', place: '', pal: 'lavender', move: 'reveal', bpm: 68, final: true, lift: 0.35,
    title: 'Você não está só.',
  },
];
