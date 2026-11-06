/**
 * Support conversations (C, B, A) between friends who fight side by side.
 * A line = [speaker id, text]. Keys: the two ids sorted alphabetically, "a|b".
 */
export type TalkLine = [string, string];
export type SupportTalk = [TalkLine[], TalkLine[], TalkLine[]];

export const SUPPORT_TALKS: Record<string, SupportTalk> = {
  'elies|rayan': [
    [
      ['rayan', 'Elies, frérot. Tu sais que je suis pacifiste ?'],
      ['elies', 'Tu as une épée dans chaque main, Rayan.'],
      ['rayan', 'Pacifiste… mais organisé.'],
      ['elies', 'Reste derrière la moustache. Elle protège.'],
    ],
    [
      ['elies', 'Tu as encore fait un enchaînement de douze coups.'],
      ['rayan', 'Ils m’ont regardé de travers. Pour la paix.'],
      ['elies', 'Propre, net, sans bavure. Je valide.'],
    ],
    [
      ['rayan', 'Si un jour je tombe, tu diras à tout le monde que j’étais pacifiste ?'],
      ['elies', 'Je dirai que tu étais pacifiste… jusqu’au premier round.'],
      ['rayan', 'C’est beau. C’est tellement vrai.'],
      ['elies', 'Et personne ne tombe tant que la moustache est debout.'],
    ],
  ],
};
