# BBL TACTICS 🛡️

Tactical RPG au tour par tour en 3D rétro (style PS1), **conçu d'abord pour le téléphone tenu en
hauteur et joué d'une main**, avec les potes de [BBL FIGHTERZ](https://github.com/Callme-Roby/BBL-Fighterz) :
mêmes persos 3D low-poly avec leurs photos de visage, mêmes coups, mêmes musiques et bruitages,
même rendu basse résolution (fluide sur un téléphone moyen). Interface en français.

- **ESCARMOUCHE** : 10 contre 10 contre l'ordinateur (facile / normal / difficile), 6 cartes,
  5 objectifs, brouillard de guerre en option, 3 niveaux d'équipes (Recrues, Confirmés, Élite)
- **À DEUX** : sur le même téléphone, on se le passe ; l'écran « Au tour de… » cache la carte
- **EN LIGNE** : tu crées une partie, tu envoies le lien, ton pote l'ouvre (chacun sur son téléphone)
- **CAMPAGNE** : « La photocopieuse à potes », 5 chapitres avec dialogues, modes Classique /
  Décontracté
- **LABO** (repris de BBL FIGHTERZ) : crée un perso avec une photo et choisis sa classe

## Lancer en local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # 49 tests : formules, moteur, cartes, IA, soutiens, données
npm run build      # build de prod dans dist/
npm run balance    # rapport d'équilibrage (BALANCE.md)
```

## Mettre en ligne (GitHub + Vercel)

Comme BBL FIGHTERZ : sur [vercel.com](https://vercel.com) → **Add New… → Project** → importe ce dépôt.
Vercel détecte Vite (`npm run build`, dossier `dist`, déjà dans `vercel.json`). Chaque `git push`
redéploie. three.js est dans un fichier à part (`vite.config.ts`) : il reste en cache entre deux mises à jour.

## Jouer au toucher

| Geste | Effet |
|---|---|
| Toucher une de tes unités | ses cases de déplacement en **bleu**, d'attaque en **rouge** (vert : bâtons) |
| Toucher une case bleue | l'unité y va, puis le menu d'action s'ouvre (gros boutons en bas) |
| Toucher directement un ennemi en rouge | l'unité choisit la meilleure case, la **prévisualisation du combat** s'ouvre |
| Glisser un doigt / pincer | déplacer la caméra / zoomer |
| Appui long sur une unité | sa fiche (stats, objets, croissances, soutiens) |
| « Annuler le déplacement » | remet l'unité à sa place tant qu'elle n'a pas agi |
| ⚠ (en haut) | zone de danger : où les ennemis peuvent frapper au prochain tour |
| Toucher l'écran pendant le tour adverse | avance rapide |

Téléphone en hauteur : panneau en bas. En paysage, sur tablette ou PC : panneau à droite.
**Clavier / manette** : flèches ou croix = curseur, Entrée / A = valider, Échap / B = retour,
Q / E (L1 / R1) = unité suivante, Échap / Start = pause. Manettes et sticks configurables dans
OPTIONS → MANETTES & STICKS (repris de BBL FIGHTERZ).

Commandes d'une unité : **ATTAQUER, BÂTON, OBJETS** (boire, équiper, promouvoir), **ÉCHANGER**
(allié adjacent), **SECOURIR / DÉPOSER** (porter un allié), **VOLER** (voleurs), **CAPTURER**,
**S'ENFUIR**, **SOUTIEN**, **ATTENDRE**.

## Les règles (mécaniques des tactical RPG GBA, noms et chiffres maison)

- **Triangle des armes** : 🗡 Épée > 🪓 Hache > 🔱 Lance > 🗡 Épée (+15 précision, +1 dégât ; l'inverse
  en désavantage). **Magie** : 🔥 Anima > ✨ Lumière > 🌀 Ténèbres > 🔥 Anima. 🏹 Arcs hors triangle,
  ×3 contre les volants ; armes « efficaces » contre les armures (Ouvre-Boîte, Marteau-Piqueur) ou les
  cavaliers (Pique Anti-Cheval).
- **Stats** : PV, FOR/MAG, TEC, VIT, CHA, DÉF, RÉS, CON, MVT.
- **Vitesse d'attaque** = VIT − (poids − CON) si l'arme est trop lourde ; **doublé** à +4.
- **Précision** = arme + TEC×2 + CHA/2 (+ triangle, soutiens) − esquive (VA×2 + CHA + terrain),
  tirée avec **deux nombres aléatoires** (leur moyenne) comme sur GBA ; la prévisualisation affiche
  aussi la vraie chance.
- **Critique** = arme + TEC/2 (+15 Sabreur, Démolisseur, Sniper, Ombre) − CHA de la cible ; ×3 dégâts.
  Les critiques déclenchent un **BBL MAX court** propre à chaque pote (nom de son ultime, accessoire,
  effet, réplique) — désactivable.
- **Dégâts** = FOR (ou MAG) + puissance − DÉF (ou RÉS) − terrain. Riposte automatique si l'arme porte :
  épée 1, lance / hache de jet 1–2, arc 2 (2–3 pour l'arc longue portée), magie 1–2.
- **Terrain** : forêt, colline, montagne, fort, trône, village, sable, rivière… bonus d'esquive / de
  défense, soin sur fort / trône / village, coûts de déplacement par type (cavaliers gênés en forêt,
  armures lentes, volants partout mais sans bonus).
- **Objets** : 5 par unité, armes usées à chaque coup, canettes / kebabs, bâtons (Pansement, Trousse,
  Soin Wi-Fi à distance, Remède Miracle, Taxi de Secours, Berceuse, Mode Avion), Diplôme BBL, boosts.
- **Niveaux** : expérience type GBA, croissances en % propres à chaque pote, **promotion au niveau 10**
  avec le Diplôme BBL et **choix entre deux classes avancées**.
- **Soutiens** : 22 paires de potes, points en finissant le tour côte à côte ou en se battant côte à
  côte, conversations C / B / A écrites pour la bande, bonus de précision / esquive / critique à 3
  cases ; gardés d'une partie à l'autre.
- **Objectifs** : déroute, vaincre le chef (★), capturer le trône, tenir N tours, s'enfuir ;
  brouillard de guerre en option.

### Les classes et les potes

12 classes de base → 24 classes avancées (OPTIONS → AIDE pour la liste complète).

| Pote | Classe | Promotions |
|---|---|---|
| Dylan, Isis | Cogneur (hache) | Démolisseur / Gros Bras |
| Elies, Matteo | Mur Porteur (armure, lance) | Forteresse / Chevalier Tank |
| Rayan, Aroa | Bagarreur (épée) | Champion de Quartier / Gladiateur |
| Zia | Lame Express (épée rapide) | Sabreur Zen / Ninja du Bled |
| Thomas | Filou (voleur) | Ombre / Arnaqueur |
| Mihaï | Livreur à Cheval (épée, lance) | Paladin du Kebab / Ranger |
| Clément | Pyromane (anima : Grenade Barbue…) | Archimage / Mage Motard |
| Billel | Gourou (ténèbres : Patch Notes…) | Grand Gourou / Influenceur |
| Enola | Tireur (arc) | Sniper / Archer Monté |
| Alex | Pilote de Soucoupe (volant, lance) | As du Ciel / Pilote de Combat |
| Benji | Infirmier (bâtons) | Chef des Urgences / Ambulancier |

## Équilibrage

`npm run balance` (`scripts/balance.ts`, `src/sim/balance.ts`) fait jouer des milliers de duels
« à triangle neutre » et des centaines de matchs 10 contre 10 entre IA ; `scripts/tune.ts` a ajusté
les stats, les croissances et les armes de chaque pote (dans des bornes qui gardent leur
personnalité) jusqu'à ce que **personne ne dépasse ~55 % de victoires en duel**, dans les trois
formats. Le tableau complet est dans [BALANCE.md](BALANCE.md). Autres vérifications :
`scripts/aivs.ts` (niveaux d'IA), `scripts/aicheck.ts` (toutes cartes / objectifs),
`scripts/campaigncheck.ts` (campagne gagnable).

## En ligne

Mise en relation par le serveur public gratuit de [PeerJS](https://peerjs.com), puis connexion
directe entre les deux navigateurs (WebRTC). Le jeu est au tour par tour : seules les **actions**
voyagent (le moteur est déterministe, les deux téléphones calculent les mêmes résultats), avec
reconnexion automatique après une coupure (l'hôte garde la salle ouverte) et contrôle de
cohérence à chaque fin de tour. Variables Vercel optionnelles (comme BBL FIGHTERZ) :
`VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_SECURE` (ton propre serveur
PeerJS), `VITE_TURN_URLS`, `VITE_TURN_USERNAME`, `VITE_TURN_CREDENTIAL` (relais TURN).

## Structure

```
src/
  rules/     moteur tactique pur (sans three.js) : terrain, classes, objets, formules, carte,
             actions, tours, objectifs, soutiens, profils des potes, équipes
  ai/        IA (cotes exactes des combats, danger, terrain, objectifs)
  sim/       parties automatiques, simulateur d'équilibrage
  data/      roster et cast (BBL FIGHTERZ), conversations de soutien, campagne, BBL MAX courts
  render/    pipeline PS1, persos, poses (+ poses tactiques), effets, accessoires, armes et
             montures, carte 3D, unités sur la carte
  game/      caméra et gestes, scène de combat 3D, match / sauvegardes, campagne, réglages
  net/       PeerJS (lien d'invitation), session en ligne tour par tour
  screens/   titre, escarmouche, équipes, bataille, résultats, en ligne, campagne, labo, options, aide
  audio/     moteur audio de BBL FIGHTERZ (musiques, bruitages, voix)
  ui/        styles (menus de BBL FIGHTERZ + interface tactique mobile)
tests/       vitest
scripts/     équilibrage, vérifications de l'IA et de la campagne
```

Repris de BBL FIGHTERZ (copié puis nettoyé de ce qui était propre au combat temps réel) : config,
persos, rendu PS1, animations, effets, kit de décors, audio, entrées, labo, options, réseau.
Les règles reprennent les **mécaniques** des tactical RPG de la Game Boy Advance ; noms de classes,
d'armes, d'objets, textes, cartes et histoire sont propres à la bande. Fait avec
[three.js](https://threejs.org), [Vite](https://vite.dev), TypeScript et [PeerJS](https://peerjs.com).
