# Équilibrage de BBL TACTICS

Rapport généré par `npm run balance` (scripts/balance.ts, src/sim/balance.ts).

## Duels « à triangle neutre »

Chaque pote contre chaque autre, 200 duels par paire (chacun commence une fois sur deux, les deux promotions possibles en Élite), terrain nu, triangle des armes désactivé. Chacun choisit son arme et sa distance (1 ou 2 cases) ; 20 échanges sans K.O. = nul. Benji (soigneur, sans arme) n'est pas dans les duels.

| Pote | Classe | RECRUES | CONFIRMÉS | ÉLITE |
|---|---|---:|---:|---:|
| CLEMENT | Pyromane | 51.7 % | 54.6 % | 47.3 % |
| ELIES | Mur Porteur | 50.9 % | 52.8 % | 50.7 % |
| DYLAN | Cogneur | 48.3 % | 52.6 % | 47.1 % |
| BILLEL | Gourou | 49.2 % | 52.2 % | 47.6 % |
| ALEX | Pilote de Soucoupe | 48.2 % | 51.7 % | 50.2 % |
| RAYAN | Bagarreur | 50.9 % | 51.5 % | 50.5 % |
| ISIS | Cogneur | 54.2 % | 50.8 % | 48.8 % |
| MATTEO | Mur Porteur | 48.0 % | 49.6 % | 52.0 % |
| MIHAI | Livreur à Cheval | 49.6 % | 48.4 % | 48.0 % |
| AROA | Bagarreur | 49.7 % | 48.0 % | 52.1 % |
| ZIA | Lame Express | 50.4 % | 47.5 % | 52.5 % |
| ENOLA | Tireur | 48.7 % | 47.2 % | 54.2 % |
| THOMAS | Filou | 47.8 % | 45.5 % | 51.7 % |

## Matchs 10 contre 10 (IA normale contre IA normale)

240 matchs par format, équipes de 10 tirées au hasard, 5 cartes symétriques, objectifs déroute / chef, 30 tours max. Taux de victoire des équipes qui contenaient chaque pote.

| Pote | Classe | RECRUES | CONFIRMÉS | ÉLITE |
|---|---|---:|---:|---:|
| ALEX | Pilote de Soucoupe | 52.0 % | 49.8 % | 48.9 % |
| AROA | Bagarreur | 49.7 % | 48.1 % | 50.0 % |
| BENJI | Infirmier | 51.0 % | 53.0 % | 54.2 % |
| BILLEL | Gourou | 53.1 % | 51.5 % | 47.9 % |
| CLEMENT | Pyromane | 48.8 % | 49.1 % | 50.9 % |
| DYLAN | Cogneur | 49.7 % | 50.6 % | 50.9 % |
| ELIES | Mur Porteur | 47.2 % | 48.6 % | 48.3 % |
| ENOLA | Tireur | 51.4 % | 53.2 % | 54.1 % |
| ISIS | Cogneur | 51.0 % | 49.5 % | 49.8 % |
| MATTEO | Mur Porteur | 48.8 % | 48.8 % | 48.3 % |
| MIHAI | Livreur à Cheval | 49.7 % | 49.4 % | 47.2 % |
| RAYAN | Bagarreur | 49.0 % | 49.3 % | 48.4 % |
| THOMAS | Filou | 51.1 % | 50.0 % | 48.1 % |
| ZIA | Lame Express | 47.7 % | 49.3 % | 54.0 % |

Par classe de départ :

| Classe | RECRUES | CONFIRMÉS | ÉLITE |
|---|---:|---:|---:|
| Bagarreur | 49.3 % | 48.7 % | 49.2 % |
| Cogneur | 50.4 % | 50.0 % | 50.3 % |
| Filou | 51.1 % | 50.0 % | 48.1 % |
| Gourou | 53.1 % | 51.5 % | 47.9 % |
| Infirmier | 51.0 % | 53.0 % | 54.2 % |
| Lame Express | 47.7 % | 49.3 % | 54.0 % |
| Livreur à Cheval | 49.7 % | 49.4 % | 47.2 % |
| Mur Porteur | 48.0 % | 48.7 % | 48.3 % |
| Pilote de Soucoupe | 52.0 % | 49.8 % | 48.9 % |
| Pyromane | 48.8 % | 49.1 % | 50.9 % |
| Tireur | 51.4 % | 53.2 % | 54.1 % |

- RECRUES : 12.7 tours en moyenne, l'équipe qui commence gagne 43.8 %
- CONFIRMÉS : 13.4 tours en moyenne, l'équipe qui commence gagne 45.0 %
- ÉLITE : 11.5 tours en moyenne, l'équipe qui commence gagne 44.2 %
- jouer en second est un petit avantage (l'équipe qui commence s'avance la première dans la portée adverse) : choisis « qui commence » en conséquence

## Équipes-types contre équipes au hasard

60 matchs chacune (format Confirmés, IA normale, déroute) : aucune ne doit être imbattable. La composition compte, comme dans tout tactical : soigneurs, tireurs et mobilité forment la meilleure équipe-type trouvée (~72 %), tout au corps à corps sans soigneur la plus faible (~27 %) — mais aucune ne gagne à coup sûr.

| Équipe | Composition | Victoires |
|---|---|---:|
| Les costauds | DYLAN, ISIS, ELIES, MATTEO, RAYAN, AROA, MIHAI, ALEX, CLEMENT, BENJI | 40.0 % |
| Les rapides | ZIA, THOMAS, AROA, RAYAN, MIHAI, ALEX, ENOLA, CLEMENT, BILLEL, BENJI | 71.7 % |
| Les tireurs | CLEMENT, BILLEL, ENOLA, BENJI, ELIES, MATTEO, DYLAN, ISIS, MIHAI, ALEX | 55.0 % |
| Sans soigneur | DYLAN, ISIS, ELIES, MATTEO, RAYAN, AROA, ZIA, THOMAS, MIHAI, CLEMENT | 30.0 % |
| Tout au corps à corps | DYLAN, ISIS, ELIES, MATTEO, RAYAN, AROA, ZIA, THOMAS, MIHAI, ALEX | 26.7 % |
| Les 10 meilleurs en duel | CLEMENT, ELIES, DYLAN, BILLEL, ALEX, RAYAN, ISIS, MATTEO, MIHAI, AROA | 35.0 % |

_Simulation : 637 s._
