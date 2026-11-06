import { audio } from '../audio/audio';
import type { App, Screen } from '../app';
import { input } from '../input/input';
import { Showroom } from '../render/showroom';
import { CLASSES } from '../rules/classes';
import { WEAPON_ICONS, WEAPON_NAMES } from '../rules/items';
import { TERRAIN } from '../rules/terrain';
import { backButton, h, uiRoot } from '../ui/dom';
import { goTitle } from './flow';

/** The rules, in short. */
export class HelpScreen implements Screen {
  private showroom = new Showroom();

  constructor(private app: App) {}

  enter() {
    const sec = (title: string, ...body: (HTMLElement | string)[]) => h('div', { class: 'panel help-sec' }, h('b', null, title), ...body);
    const p = (t: string) => h('p', null, t);
    const classes = Object.values(CLASSES)
      .filter((c) => c.tier === 1)
      .map((c) => h('div', { class: 'help-cls' }, h('b', null, c.name), h('small', null, `${c.weapons.map((w) => WEAPON_ICONS[w] + ' ' + WEAPON_NAMES[w]).join(', ')} · MVT ${c.mov} → ${c.promotesTo?.map((x) => CLASSES[x].name).join(' / ')}`), h('span', null, c.desc)));
    const terr = ['forest', 'hill', 'mountain', 'fort', 'village', 'river', 'throne', 'sand'] as const;
    uiRoot().append(
      h(
        'div',
        { class: 'screen dim help-screen scroll' },
        h('div', { class: 'h1' }, 'AIDE'),
        sec(
          'JOUER AU TOUCHER',
          p('Touche une de tes unités : ses cases de déplacement s’affichent en bleu, celles qu’elle peut attaquer en rouge (vert pour les bâtons). Touche une case bleue pour y aller, ou directement un ennemi en rouge : l’unité se place toute seule et la prévisualisation du combat s’ouvre.'),
          p('Glisse un doigt pour bouger la carte, pince pour zoomer, appui long sur une unité pour sa fiche. « Annuler le déplacement » remet l’unité à sa place tant qu’elle n’a pas agi.'),
          p('Clavier / manette : flèches ou croix pour le curseur, Entrée / A pour valider, Échap / B pour revenir, Q / E (L1 / R1) pour passer d’une unité à l’autre.'),
        ),
        sec(
          'LE TRIANGLE DES ARMES',
          p('🗡 Épée bat 🪓 Hache, 🪓 Hache bat 🔱 Lance, 🔱 Lance bat 🗡 Épée : +15 % de précision et +1 de dégâts pour l’avantage, l’inverse pour le désavantage.'),
          p('Magie : 🔥 Anima bat ✨ Lumière, ✨ Lumière bat 🌀 Ténèbres, 🌀 Ténèbres bat 🔥 Anima. La magie touche la RÉSISTANCE au lieu de la DÉFENSE.'),
          p('🏹 Les arcs sont hors triangle et font ×3 de puissance aux unités volantes. Certaines armes sont « efficaces » contre les armures ou les cavaliers.'),
        ),
        sec(
          'LES FORMULES',
          p('Dégâts = FOR (ou MAG) + puissance de l’arme − DÉF (ou RÉS) − bonus de terrain.'),
          p('Précision = précision de l’arme + TEC × 2 + CHA ÷ 2. Esquive = vitesse d’attaque × 2 + CHA + terrain. La chance affichée est tirée avec deux nombres aléatoires (leur moyenne) : 80 % affichés touchent en vrai ~92 %, 30 % affichés ~18 %.'),
          p('Critique = critique de l’arme + TEC ÷ 2 (+15 pour certaines classes) − CHA de la cible. Un critique fait ×3 dégâts.'),
          p('Vitesse d’attaque = VIT − (poids de l’arme − CON) si l’arme est trop lourde. 4 de plus que l’adversaire = on frappe deux fois (« ×2 »).'),
          p('L’attaqué riposte automatiquement s’il a une arme qui porte à cette distance (épée 1, lance / hache de jet 1–2, arc 2, magie 1–2).'),
        ),
        sec('LE TERRAIN', ...terr.map((t) => h('div', { class: 'help-row' }, h('b', null, TERRAIN[t].name), h('span', null, `ESQ +${TERRAIN[t].avoid} · DÉF +${TERRAIN[t].def}${TERRAIN[t].heal ? ` · soigne ${TERRAIN[t].heal} %/tour` : ''}`))), p('Cavaliers et armures sont lents en forêt et en colline ; les volants passent partout mais ne profitent pas du terrain.')),
        sec(
          'OBJETS, ÉCHANGES, SECOURS',
          p('5 objets par unité, les armes s’usent à chaque coup. ÉCHANGER avec un allié adjacent, BOIRE une canette pour se soigner, SECOURIR (porter) un allié léger pour le mettre à l’abri — attention, porter divise TEC et VIT par deux.'),
          p('Bâtons : Pansement (soin au contact), Soin Wi-Fi (à distance), Remède Miracle (soigne les états), Taxi de Secours (téléporte un allié à côté), Berceuse et Mode Avion (endort / coupe la magie d’un ennemi).'),
        ),
        sec(
          'NIVEAUX, PROMOTIONS, SOUTIENS',
          p('Chaque combat donne de l’expérience ; à 100, niveau supérieur : chaque stat a un % de chances de monter (les croissances, propres à chaque pote).'),
          p('Au niveau 10, un Diplôme BBL permet la promotion : tu choisis entre deux classes avancées (bonus de stats, nouvelles armes).'),
          p('Les potes qui finissent leur tour côte à côte ou se battent côte à côte gagnent des points de soutien. Quand c’est prêt, la commande SOUTIEN lance une petite conversation : rang C, B puis A, avec des bonus de précision, d’esquive et de critique quand ils sont à 3 cases ou moins. Les soutiens sont gardés d’une partie à l’autre.'),
        ),
        sec('LES CLASSES', ...classes),
        backButton(() => goTitle()),
      ),
    );
  }

  exit() {
    this.showroom.dispose();
  }

  frame(dt: number) {
    for (const e of input.menuEvents()) {
      if (e.action === 'back' || e.action === 'confirm') {
        audio.sfx('cancel');
        goTitle();
        return;
      }
    }
    this.showroom.render(this.app.pipeline, dt, this.app.aspect);
  }
}
