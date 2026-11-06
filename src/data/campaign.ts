import type { ObjectiveKind, UnitSetup } from '../rules/battle';
import type { TalkLine } from './supportTalks';

/**
 * The campaign « LA PHOTOCOPIEUSE À POTES » (our own story):
 * the Doc (Alex's old mad-scientist buddy) wanted to make the BBL crew
 * immortal with a « photocopieuse à potes ». It went wrong: copies of the
 * friends in weird colours — the FAUX POTES — are wrecking the town.
 * Mihaï gathers the crew to stop them, up to the Doc's château.
 *
 * Talk lines: [speaker id, text]; speaker ids are roster / cast ids
 * ('doc' = LE DOC, 'faux:<id>' = the copy of a friend, 'narrateur' = caption).
 */

export interface CampaignEnemy extends Omit<UnitSetup, 'name' | 'items'> {
  /** shown name (default « FAUX <NAME> ») */
  name?: string;
  items: string[];
}

export interface Chapter {
  id: string;
  title: string;
  subtitle: string;
  mapId: string;
  objective: { kind: ObjectiveKind; turns: number; attacker: 0 | 1 };
  /** friends joining the crew at the start of this chapter (level, class from their profile) */
  recruits: { id: string; level: number }[];
  enemies: CampaignEnemy[];
  intro: TalkLine[];
  outro: TalkLine[];
  /** items given after the victory (to the units with room in their bag, best levels first) */
  rewards?: string[];
  music?: string;
}

const E = (defId: string, cls: UnitSetup['cls'], level: number, items: string[], extra: Partial<CampaignEnemy> = {}): CampaignEnemy => ({
  defId,
  cls,
  level,
  items,
  alt: true,
  ...extra,
});

export const CAMPAIGN: Chapter[] = [
  {
    id: 'ch1',
    title: 'CHAPITRE 1',
    subtitle: 'Barbecue au parc',
    mapId: 'parc',
    objective: { kind: 'rout', turns: 0, attacker: 0 },
    recruits: [
      { id: 'mihai', level: 1 },
      { id: 'rayan', level: 1 },
      { id: 'elies', level: 2 },
      { id: 'benji', level: 1 },
      { id: 'enola', level: 1 },
    ],
    enemies: [
      E('thomas', 'filou', 1, ['couteau_kebab'], { stats: { hp: 15, pow: 3, skl: 5, spd: 9, lck: 4, def: 2, res: 1, con: 6, mov: 6 } }),
      E('zia', 'lame', 1, ['couteau_kebab'], { stats: { hp: 15, pow: 4, skl: 6, spd: 8, lck: 2, def: 2, res: 0, con: 8, mov: 5 } }),
      E('dylan', 'cogneur', 2, ['hachette'], { leader: true, ai: 'hold', stats: { hp: 22, pow: 6, skl: 3, spd: 3, lck: 1, def: 4, res: 0, con: 12, mov: 5 } }),
      E('isis', 'cogneur', 1, ['hachette'], { stats: { hp: 19, pow: 5, skl: 3, spd: 4, lck: 2, def: 3, res: 0, con: 11, mov: 5 } }),
      E('aroa', 'bagarreur', 1, ['epee_rouillee'], { stats: { hp: 16, pow: 4, skl: 5, spd: 6, lck: 3, def: 3, res: 1, con: 7, mov: 5 } }),
    ],
    intro: [
      ['narrateur', 'Dimanche, midi. Le parc. Le barbecue de la bande.'],
      ['mihai', 'Merci à tous d’être venus ! Bonne journée !'],
      ['benji', 'C’est quoi la config du barbecue ? Charbon ou gaz ?'],
      ['elies', 'Charbon, frérot. La moustache n’accepte que le charbon.'],
      ['enola', '…Il y a quelqu’un de l’autre côté de la rivière.'],
      ['faux:dylan', 'JE VAIS VOUS TUER.'],
      ['rayan', 'Dylan ? Pourquoi t’as un débardeur… rose ?'],
      ['faux:thomas', 'Regarde derrière toi.'],
      ['mihai', 'Ce ne sont pas nos potes ! Tout le monde en place !'],
      ['rayan', 'Moi je suis pacifiste… mais là, non.'],
    ],
    outro: [
      ['dylan', 'Hé ! C’est moi qu’ils ont copié ? Avec CE débardeur ?'],
      ['mihai', 'Dylan ! Le vrai ?'],
      ['dylan', 'Le seul. Petit format, gros dégâts. Je viens avec vous.'],
      ['zia', 'Et moi aussi. Personne ne copie mes dreads.'],
      ['enola', 'Les faux sont partis vers le quartier. Vers… le kebab.'],
      ['benji', 'Pas le kebab. Tout sauf le kebab.'],
    ],
    rewards: ['canette', 'canette'],
  },
  {
    id: 'ch2',
    title: 'CHAPITRE 2',
    subtitle: 'Kebab en danger',
    mapId: 'quartier',
    objective: { kind: 'boss', turns: 0, attacker: 0 },
    recruits: [
      { id: 'dylan', level: 3 },
      { id: 'zia', level: 3 },
    ],
    enemies: [
      E('billel', 'gourou', 4, ['patch_notes', 'canette'], { leader: true, ai: 'hold', name: 'FAUX BILLEL' }),
      E('matteo', 'mur', 2, ['manche_balai'], { ai: 'guard' }),
      E('elies', 'mur', 2, ['manche_balai']),
      E('aroa', 'bagarreur', 2, ['epee_rouillee']),
      E('rayan', 'bagarreur', 2, ['epee_rouillee']),
      E('thomas', 'filou', 2, ['couteau_kebab']),
      E('enola', 'tireur', 2, ['arc_plastique']),
      E('isis', 'cogneur', 2, ['hachette']),
      E('alex', 'pilote', 2, ['manche_balai']),
    ],
    intro: [
      ['narrateur', 'Le quartier. Le kebab de la bande est encerclé.'],
      ['faux:billel', 'Écoutez-moi bien. La méta, c’est de prendre le kebab. GG ez.'],
      ['billel', 'Hé ! C’est mon visage ! Mais avec des couleurs nulles !'],
      ['mihai', 'Billel ! Tu es le vrai ?'],
      ['billel', 'Évidemment. Je ne dirais jamais « GG ez » à un kebab. Je viens vous aider… plus tard. Je lis les patch notes de leur clone.'],
      ['dylan', 'On tape le faux Billel, les autres fuiront. C’est le chef.'],
      ['zia', 'Je lui prépare une punchline.'],
    ],
    outro: [
      ['faux:billel', 'Impossible… ma tier list était parfaite…'],
      ['benji', 'Le kebab est sauvé. Sauce blanche pour tout le monde.'],
      ['alex', 'Les gars ! C’est le Doc ! C’est sa machine qui fait ça !'],
      ['doc', 'Je voulais juste rendre la bande immortelle… avec ma photocopieuse à potes. Elle a un peu… débordé.'],
      ['mihai', 'Un peu ?!'],
      ['doc', 'Ma soucoupe arrive à la plage. Tenez bon jusque-là, je vous emmène au château.'],
    ],
    rewards: ['kebab', 'proteine'],
  },
  {
    id: 'ch3',
    title: 'CHAPITRE 3',
    subtitle: 'Coup de soleil',
    mapId: 'plage',
    objective: { kind: 'defend', turns: 8, attacker: 1 },
    recruits: [
      { id: 'isis', level: 5 },
      { id: 'clement', level: 5 },
    ],
    enemies: [
      E('zia', 'lame', 4, ['epee_rouillee']),
      E('thomas', 'filou', 4, ['couteau_kebab', 'ouvre_boite']),
      E('dylan', 'cogneur', 4, ['hachette', 'hache_boomerang']),
      E('aroa', 'bagarreur', 4, ['epee_rouillee']),
      E('alex', 'pilote', 4, ['manche_balai', 'javelot_dimanche']),
      E('enola', 'tireur', 4, ['arc_plastique']),
      E('clement', 'pyromane', 4, ['briquet']),
      E('mihai', 'livreur', 5, ['epee_rouillee', 'manche_balai'], { leader: true }),
      E('matteo', 'mur', 4, ['manche_balai']),
      E('benji', 'infirmier', 4, ['pansement']),
    ],
    intro: [
      ['narrateur', 'La plage. La soucoupe du Doc doit arriver dans 8 tours.'],
      ['isis', 'Échauffement terminé. On tient la plage.'],
      ['clement', '…'],
      ['isis', 'Clément dit qu’il est content d’être là.'],
      ['faux:mihai', 'Merci… à tous… d’être venus… vous faire taper !'],
      ['mihai', 'Il a mon sourire. Mais en méchant. C’est horrible.'],
      ['benji', 'Restez groupés près des forts : ils soignent.'],
    ],
    outro: [
      ['narrateur', 'Un bourdonnement. « Wou-ou-ou-ou. » La soucoupe du Doc se pose sur le sable.'],
      ['alex', 'Viens là, mon mignon ! Tout le monde à bord !'],
      ['doc', 'Le château est au-delà du col enneigé. La machine est là-haut.'],
      ['thomas', 'Je viens. Ils ont copié mon bonnet. C’est personnel.'],
      ['aroa', 'Et moi ! Garde haute, sourire aux lèvres !'],
    ],
    rewards: ['diplome', 'diplome', 'kebab'],
  },
  {
    id: 'ch4',
    title: 'CHAPITRE 4',
    subtitle: 'Le col enneigé',
    mapId: 'neige',
    objective: { kind: 'escape', turns: 16, attacker: 0 },
    recruits: [
      { id: 'alex', level: 6 },
      { id: 'thomas', level: 6 },
      { id: 'aroa', level: 6 },
    ],
    enemies: [
      E('elies', 'mur', 5, ['brochette', 'javelot_dimanche'], { ai: 'guard' }),
      E('matteo', 'mur', 5, ['chasse_kebab', 'javelot_dimanche'], { ai: 'guard' }),
      E('isis', 'cogneur', 5, ['tronconneuse', 'hache_boomerang']),
      E('rayan', 'bagarreur', 5, ['epee_chromee']),
      E('zia', 'lame', 5, ['la_fourbe']),
      E('enola', 'tireur', 5, ['arc_compound']),
      E('billel', 'gourou', 5, ['tier_list']),
      E('dylan', 'cogneur', 7, ['marteau', 'hache_boomerang'], { leader: true }),
      E('benji', 'infirmier', 5, ['soin_wifi']),
      E('alex', 'pilote', 5, ['brochette']),
    ],
    intro: [
      ['narrateur', 'Le col. La neige. Le château du Doc est de l’autre côté.'],
      ['thomas', 'T’as froid ? Moi non.'],
      ['zia', 'Thomas, il fait −10.'],
      ['mihai', 'Pas besoin de tous les battre : il faut que je passe le col, de l’autre côté (en haut de la carte).'],
      ['faux:dylan', 'Mon genou va très bien, lui !'],
      ['dylan', 'Comment il sait pour mon genou ?!'],
    ],
    outro: [
      ['mihai', 'On est passés ! Merci, bonne soirée… enfin, pas encore.'],
      ['billel', 'Je vous ai rattrapés. J’ai lu les patch notes de la machine.'],
      ['matteo', 'Et moi je sors de la salle. Il paraît qu’on a besoin de muscles.'],
      ['billel', 'La méta, c’est de casser la machine. Sur le trône. Dans le château.'],
      ['doc', 'Attention… la dernière copie est la plus réussie. C’est un super sayan.'],
    ],
    rewards: ['diplome', 'diplome', 'energy_drink'],
  },
  {
    id: 'ch5',
    title: 'CHAPITRE 5',
    subtitle: 'Le château du Doc',
    mapId: 'chateau',
    objective: { kind: 'seize', turns: 0, attacker: 0 },
    recruits: [
      { id: 'billel', level: 8 },
      { id: 'matteo', level: 8 },
    ],
    enemies: [
      E('mihai_ssj', 'paladin', 8, ['lance_bling', 'epee_bling'], {
        leader: true,
        ai: 'hold',
        name: 'MIHAÏ ULTIME',
        alt: false,
        stats: { hp: 36, pow: 12, skl: 11, spd: 10, lck: 8, def: 9, res: 6, con: 11, mov: 8 },
        at: { x: 6, y: 1 },
      }),
      E('elies', 'mur', 6, ['brochette', 'javelot_dimanche'], { ai: 'guard' }),
      E('matteo', 'mur', 6, ['chasse_kebab', 'javelot_dimanche'], { ai: 'guard' }),
      E('isis', 'cogneur', 6, ['hache_bucheron', 'hache_boomerang']),
      E('zia', 'lame', 6, ['epee_chromee']),
      E('thomas', 'filou', 6, ['ouvre_boite']),
      E('clement', 'pyromane', 6, ['grenade_barbue']),
      E('billel', 'gourou', 6, ['tier_list']),
      E('enola', 'tireur', 6, ['arc_compound'], { ai: 'hold' }),
      E('benji', 'infirmier', 6, ['soin_wifi']),
    ],
    intro: [
      ['narrateur', 'Le château du Doc. Au sommet, sur le trône : la photocopieuse à potes… et sa dernière copie.'],
      ['faux:mihai_ssj', 'MERCI… À TOUS… D’ÊTRE VENUS !'],
      ['mihai', 'Des cheveux dorés ? Sérieux ?'],
      ['doc', 'Il a pris tout le toner jaune. Je suis désolé.'],
      ['rayan', 'Mihaï, monte sur le trône et débranche la machine. On te couvre.'],
      ['elies', 'Propre, net, sans bavure. Pour la bande.'],
      ['mihai', 'Pour la bande ! Et après… barbecue !'],
    ],
    outro: [
      ['narrateur', 'Mihaï débranche la photocopieuse. Pouf. Les Faux Potes disparaissent dans un nuage de toner.'],
      ['doc', 'Bon… elle faisait aussi des cafés. Tant pis.'],
      ['alex', 'Tope-là, Doc !'],
      ['benji', 'C’était quoi, au fond, la config de la machine ?'],
      ['billel', 'Une imprimante. La méta, c’est toujours une imprimante.'],
      ['matteo', 'Faut vraiment que je me rase.'],
      ['mihai', 'Merci à tous ! Et maintenant : le barbecue. Le vrai.'],
      ['narrateur', 'FIN. Merci d’avoir joué à BBL TACTICS !'],
    ],
  },
];
