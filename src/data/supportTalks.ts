/**
 * Support conversations (C, B, A) between friends who fight side by side.
 * A line = [speaker id, text]. Keys: the two ids sorted alphabetically, "a|b".
 * Written in the voice of their BBL FIGHTERZ lines (src/data/roster.ts).
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
  'dylan|rayan': [
    [
      ['dylan', 'Rayan. Pourquoi, quand tu frappes quelqu’un, il finit toujours par me ressembler ?'],
      ['rayan', 'C’est un hommage, frérot.'],
      ['dylan', 'Un hommage avec des gants de boxe et un uppercut ?'],
      ['rayan', 'Les plus beaux hommages font mal.'],
    ],
    [
      ['rayan', 'Tu sais que t’es mon modèle ? Petit format, gros dégâts.'],
      ['dylan', 'Petit format ?! Je suis compact. C’est pas pareil.'],
      ['rayan', 'Compact. Pardon. Je suis pacifiste, je retire.'],
    ],
    [
      ['dylan', 'Bon. Si un mec t’approche, je le renvoie chez sa mère.'],
      ['rayan', 'Et si un mec t’approche, je le transforme en toi.'],
      ['dylan', 'Ça fait deux moi. Il est mort, le mec.'],
      ['rayan', 'Grove Street, baby.'],
      ['dylan', 'Hé ! C’est MA phrase !'],
    ],
  ],
  'clement|enola': [
    [
      ['enola', 'Clément. Tu ne parles jamais pendant les combats.'],
      ['clement', '…'],
      ['enola', 'D’accord. Moi non plus. On se comprend.'],
    ],
    [
      ['clement', 'Ta flèche est passée à deux centimètres de ma barbe.'],
      ['enola', 'Je visais l’ennemi derrière. Il est tombé.'],
      ['clement', 'Ma barbe aussi a failli tomber.'],
      ['enola', 'Respire. C’est fini.'],
    ],
    [
      ['enola', 'Lunettes noires, sang-froid. Barbe, zéro émotion. On fait une bonne équipe.'],
      ['clement', 'Le survêt est resté propre. Tes flèches aussi.'],
      ['enola', 'C’était presque un compliment, ça.'],
      ['clement', 'N’en parle à personne.'],
    ],
  ],
  'alex|benji': [
    [
      ['benji', 'Alex. C’est quoi la config de ta soucoupe ?'],
      ['alex', 'Aucune idée. C’est le Doc qui me l’a prêtée.'],
      ['benji', 'Il y a un tuyau de poêle sur une soucoupe volante, Alex.'],
      ['alex', 'Il dit que c’est pour le style.'],
    ],
    [
      ['alex', 'Le Doc m’a encore parlé « du dragon et du faucon ».'],
      ['benji', 'Et ça veut dire quoi ?'],
      ['alex', 'Aucune idée non plus. Mais il était ému.'],
      ['benji', 'Je vais quand même vérifier les rivets.'],
    ],
    [
      ['benji', 'J’ai réparé ta soucoupe. Elle tourne en 60 images par seconde maintenant.'],
      ['alex', 'Viens là, mon mignon ! Tope-là !'],
      ['benji', 'Ne m’emmène juste jamais faire un tour avec.'],
      ['alex', 'Trop tard, le Doc t’a déjà réservé une place.'],
    ],
  ],
  'benji|isis': [
    [
      ['isis', 'Benji, soigne-moi le bras. J’ai trop frappé.'],
      ['benji', 'On ne peut pas « trop frapper », Isis.'],
      ['isis', 'Tu n’as jamais vu mes coups XXL.'],
    ],
    [
      ['benji', 'Ton afro est plus grosse que mon brushing.'],
      ['isis', 'Ce n’est pas une compétition.'],
      ['benji', 'Si. C’est une compétition. Et je perds.'],
      ['isis', 'Échauffement terminé, Benji. Accepte.'],
    ],
    [
      ['isis', 'Merci de toujours me remettre sur pied.'],
      ['benji', 'Tant que tu tapes, je soigne. C’est ma config.'],
      ['isis', 'Alors ensemble, on est… afro power.'],
      ['benji', 'Brushing tropical power, on a dit.'],
    ],
  ],
  'billel|zia': [
    [
      ['billel', 'Zia, ton build est pas dans la méta.'],
      ['zia', 'Et toi t’es pas dans le rythme. Écoute :'],
      ['zia', '« Il lit les patch notes, mais il tombe en deux notes. »'],
      ['billel', '…C’est pas mal, en vrai.'],
    ],
    [
      ['zia', 'Pourquoi tu fais des graphiques en plein combat ?'],
      ['billel', 'Statistiquement, tu critiques 12 % plus près de moi.'],
      ['zia', 'Statistiquement, je vais te punchliner la tête.'],
    ],
    [
      ['billel', 'J’ai mis à jour ma tier list. T’es tier S.'],
      ['zia', 'Je savais. Les dreads, c’est cheaté.'],
      ['billel', 'Pas de counter. Zéro pitié.'],
      ['zia', 'Z comme… zéro pitié. Tu me voles mes lignes maintenant ?'],
      ['billel', 'C’est la méta.'],
    ],
  ],
  'isis|matteo': [
    [
      ['matteo', 'Isis. Jour des jambes, demain ?'],
      ['isis', 'Chaque jour est le jour des jambes, Matteo.'],
      ['matteo', 'Respect.'],
    ],
    [
      ['isis', 'Tu as soulevé ce mur porteur tout seul ?'],
      ['matteo', 'Deux séries de dix. Repos entre les séries.'],
      ['isis', 'J’en fais trois. Pour l’échauffement.'],
      ['matteo', '…Je retourne à la salle.'],
    ],
    [
      ['matteo', 'Si un jour tu veux un partenaire pour le développé couché…'],
      ['isis', 'Seulement si tu te rases le dos.'],
      ['matteo', 'Faut vraiment que je me rase.'],
      ['isis', 'Oui, Matteo. Vraiment.'],
    ],
  ],
  'elies|matteo': [
    [
      ['elies', 'Deux murs porteurs côte à côte. Rien ne passe.'],
      ['matteo', 'Même pas le vent.'],
      ['elies', 'Même pas une flèche.'],
      ['matteo', 'Enfin… les ouvre-boîtes, quand même.'],
    ],
    [
      ['matteo', 'Elies, comment tu gardes ta moustache aussi propre sous l’armure ?'],
      ['elies', 'Discipline. Et un petit peigne.'],
      ['matteo', 'Moi, mes poils poussent… ailleurs.'],
      ['elies', 'J’ai vu. Tout le monde a vu.'],
    ],
    [
      ['elies', 'Tu sais, ton buisson géant, c’est une arme de dissuasion.'],
      ['matteo', 'Tu penses ?'],
      ['elies', 'L’ennemi a fui en le voyant. Propre, net, sans bavure.'],
      ['matteo', 'Je garde. Je ne me rase plus.'],
      ['elies', 'Alors là, frérot, je n’ai pas dit ça.'],
    ],
  ],
  'thomas|zia': [
    [
      ['zia', 'Thomas, t’étais où pendant le combat ?'],
      ['thomas', 'Derrière toi.'],
      ['zia', 'Ah. Je n’ai même pas…'],
      ['thomas', 'C’est le principe.'],
    ],
    [
      ['thomas', 'T’as froid ?'],
      ['zia', 'Il fait 30 degrés, Thomas. Enlève le bonnet.'],
      ['thomas', 'Jamais.'],
    ],
    [
      ['zia', 'On est les deux plus rapides de la bande, tu sais.'],
      ['thomas', 'Moi pour fuir. Toi pour frapper.'],
      ['zia', 'Ensemble : bisous, au revoir.'],
      ['thomas', 'Froid comme l’hiver. J’aime bien.'],
    ],
  ],
  'mihai|thomas': [
    [
      ['mihai', 'Thomas ! Souris un peu !'],
      ['thomas', 'Non.'],
      ['mihai', 'Juste un petit sourire ?'],
      ['thomas', 'Regarde derrière toi.'],
      ['mihai', 'Quoi ? …Il est parti. Encore.'],
    ],
    [
      ['thomas', 'Ton cheval me regarde bizarrement.'],
      ['mihai', 'Il sourit. Comme moi.'],
      ['thomas', 'C’est encore pire.'],
    ],
    [
      ['mihai', 'Merci de m’avoir couvert tout à l’heure.'],
      ['thomas', 'Je passais par là. En fuyant.'],
      ['mihai', 'Merci quand même. Bonne soirée !'],
      ['thomas', '…De rien.'],
      ['mihai', 'C’ÉTAIT UN SOURIRE ? THOMAS, C’ÉTAIT UN SOURIRE !'],
    ],
  ],
  'aroa|rayan': [
    [
      ['aroa', 'Rayan ! Garde haute, sourire aux lèvres !'],
      ['rayan', 'Moi je suis pacifiste, Aroa.'],
      ['aroa', 'Un coup ? Non. Cinquante. Pour la paix.'],
      ['rayan', '…D’accord, pour la paix.'],
    ],
    [
      ['rayan', 'Tu comptes tes enchaînements ?'],
      ['aroa', 'Et un, et deux, et… j’ai perdu le compte.'],
      ['rayan', 'Moi aussi. Peace and love… et crochet du droit.'],
    ],
    [
      ['aroa', 'Avec toi, j’ai l’impression d’être sur un ring.'],
      ['rayan', 'Avec toi, j’ai l’impression que la paix a un sacré crochet.'],
      ['aroa', 'Coucou… c’est nous !'],
      ['rayan', 'Bisous, la garde !'],
    ],
  ],
  'aroa|dylan': [
    [
      ['dylan', 'Aroa, tu frappes trop vite. Laisse-moi en un.'],
      ['aroa', 'Il en reste un ! Ah non. Plus maintenant.'],
      ['dylan', 'Je vais te tuer… gentiment.'],
      ['aroa', 'Hé ! C’est ma phrase !'],
    ],
    [
      ['aroa', 'Pourquoi tu ne fais jamais de combo ?'],
      ['dylan', 'Je fais un coup. Il suffit.'],
      ['aroa', 'Et si tu rates ?'],
      ['dylan', 'Je ne rate pas. Mon genou, parfois. Mais pas le coup.'],
    ],
    [
      ['dylan', 'Bon. Toi les cinquante petits coups, moi le gros à la fin.'],
      ['aroa', 'Le peek-a-boo et le bulldozer !'],
      ['dylan', 'Le bulldozer à lunettes, s’il te plaît.'],
      ['aroa', 'Garde haute… et ça enchaîne !'],
    ],
  ],
  'alex|mihai': [
    [
      ['mihai', 'Alex, toi tu livres par les airs, moi par la route !'],
      ['alex', 'On devrait monter une boîte de livraison.'],
      ['mihai', '« BBL Express : on livre des coups, avec le sourire ».'],
    ],
    [
      ['alex', 'Ton cheval a eu peur de ma soucoupe.'],
      ['mihai', 'Il croyait que c’était un super sayan.'],
      ['alex', 'C’est toi le super sayan, Mihaï.'],
      ['mihai', 'Chut. Il ne doit pas savoir.'],
    ],
    [
      ['mihai', 'Si on se retrouve encerclés, tu m’emmènes dans ta soucoupe ?'],
      ['alex', 'Viens là, mon mignon. Il y a toujours de la place.'],
      ['mihai', 'Et le cheval ?'],
      ['alex', 'Le Doc dit que le rayon tracteur supporte jusqu’à un cheval.'],
      ['mihai', 'Merci, bonne soirée !'],
    ],
  ],
  'billel|clement': [
    [
      ['billel', 'Clément, l’anima est faible contre les ténèbres. C’est la méta.'],
      ['clement', 'Une grenade, c’est pas de l’anima. C’est une grenade.'],
      ['billel', 'C’est noté « anima » dans les patch notes.'],
      ['clement', 'Personne ne lit les patch notes.'],
    ],
    [
      ['clement', 'Tu as encore expliqué la méta à un ennemi jusqu’à ce qu’il tombe.'],
      ['billel', 'Il ne voulait pas écouter. Il a écouté.'],
      ['clement', 'Efficace. Zéro émotion. Je respecte.'],
    ],
    [
      ['billel', 'Grenade barbue plus Ponction de méta : c’est le combo tier S.'],
      ['clement', 'Ça veut dire quoi ?'],
      ['billel', 'Ça veut dire qu’on gagne.'],
      ['clement', 'Alors c’est fini pour eux.'],
      ['billel', 'GG ez.'],
    ],
  ],
  'benji|elies': [
    [
      ['benji', 'Elies, ta moustache a pris un coup.'],
      ['elies', 'Soigne d’abord la moustache. Le reste attendra.'],
      ['benji', 'Je ne suis pas coiffeur, frérot.'],
      ['elies', 'Tu as un brushing tropical. Tu es presque coiffeur.'],
    ],
    [
      ['elies', 'Reste derrière moi, Benji. Les flèches ne passent pas l’armure.'],
      ['benji', 'Ta config est solide, j’avoue.'],
      ['elies', 'Mur porteur, édition moustache.'],
    ],
    [
      ['benji', 'Tu sais que tu es le patient le plus facile à soigner ?'],
      ['elies', 'Parce que je ne prends jamais de coups ?'],
      ['benji', 'Parce que tu ne te plains jamais.'],
      ['elies', 'La moustache a parlé : merci, frérot.'],
    ],
  ],
  'dylan|isis': [
    [
      ['isis', 'Dylan, on cogne à la hache ou on cogne à la hache ?'],
      ['dylan', 'On cogne à la hache.'],
      ['isis', 'Parfait. Échauffement terminé.'],
    ],
    [
      ['dylan', 'Je t’ai vue te transformer en bodybuildeuse. C’était… beaucoup.'],
      ['isis', 'Muscles XXL. Et toi, tes jambes de feu ?'],
      ['dylan', 'Mon genou a lâché. On n’en parle pas.'],
    ],
    [
      ['isis', 'Petit format, gros dégâts. Afro XXL, coups XXL. On est complémentaires.'],
      ['dylan', 'On devrait ouvrir une salle de sport.'],
      ['isis', 'Matteo voudra venir.'],
      ['dylan', 'Il se rase le dos d’abord.'],
    ],
  ],
  'enola|thomas': [
    [
      ['enola', 'Lunettes noires.'],
      ['thomas', 'Bonnet vissé.'],
      ['enola', '…'],
      ['thomas', '…On se comprend.'],
    ],
    [
      ['thomas', 'Ta flèche m’a frôlé l’oreille.'],
      ['enola', 'Tu étais derrière l’ennemi. Comme d’habitude.'],
      ['thomas', 'Regarde derrière toi, c’est ma technique, pas la tienne.'],
    ],
    [
      ['enola', 'Tu fuis toujours, mais tu reviens toujours.'],
      ['thomas', 'Pour toi, je reviens plus vite.'],
      ['enola', 'Ne recommence jamais à dire des choses comme ça.'],
      ['thomas', 'Froid comme l’hiver. Promis.'],
    ],
  ],
  'clement|mihai': [
    [
      ['mihai', 'Clément ! Un sourire ?'],
      ['clement', 'Non.'],
      ['mihai', 'Toi et Thomas, vous êtes un défi pour moi.'],
    ],
    [
      ['clement', 'Ton cheval a mangé ma barbe.'],
      ['mihai', 'Il a cru que c’était du foin. C’est un compliment !'],
      ['clement', 'Ce n’est pas un compliment.'],
    ],
    [
      ['mihai', 'Tu sais pourquoi je souris tout le temps ?'],
      ['clement', 'Non.'],
      ['mihai', 'Parce qu’avec ta barbe et tes grenades derrière moi, je n’ai peur de rien.'],
      ['clement', '…'],
      ['mihai', 'C’était un sourire ! J’ai vu un coin de barbe bouger !'],
    ],
  ],
  'alex|aroa': [
    [
      ['aroa', 'Alex, tu peux me déposer au milieu des ennemis ?'],
      ['alex', 'Ma soucoupe n’est pas un taxi.'],
      ['aroa', 'S’il te plaît ! Je veux faire cinquante coups.'],
      ['alex', '…Monte.'],
    ],
    [
      ['alex', 'Tu as fait combien de coups ?'],
      ['aroa', 'J’ai perdu le compte à quarante.'],
      ['alex', 'Le Doc dit qu’il en a compté cent douze.'],
    ],
    [
      ['aroa', 'Toi en haut, moi en bas : personne ne nous voit venir.'],
      ['alex', 'Viens là, mon mignon… disent-ils juste avant.'],
      ['aroa', 'Coucou… c’est nous !'],
    ],
  ],
  'billel|matteo': [
    [
      ['billel', 'Matteo, ton programme de muscu n’est pas optimisé.'],
      ['matteo', 'Je fais jambes, pecs, dos.'],
      ['billel', 'La méta, c’est dos, dos, dos. Et après dos.'],
      ['matteo', 'Pour le dos… on a un petit souci de poils.'],
    ],
    [
      ['matteo', 'Pourquoi tu ne viens jamais à la salle ?'],
      ['billel', 'Je regarde des vidéos de gens à la salle. C’est pareil.'],
      ['matteo', 'C’est pas pareil, Billel.'],
    ],
    [
      ['billel', 'J’ai analysé ton buisson géant. C’est un sort de zone.'],
      ['matteo', 'Un quoi ?'],
      ['billel', 'Tier S, aucun counter. Je n’aurais jamais cru dire ça d’un poil de fion.'],
      ['matteo', 'Faut vraiment que je me rase.'],
      ['billel', 'Non. Surtout pas. Tu casserais la méta.'],
    ],
  ],
  'benji|zia': [
    [
      ['zia', 'Benji, ton afro et mes dreads, c’est le duo capillaire de la bande.'],
      ['benji', 'Il nous faut un nom.'],
      ['zia', '« Les cheveux qui piquent ».'],
    ],
    [
      ['benji', 'Tu as encore pris une flèche en voulant finir une punchline.'],
      ['zia', 'Elle était bonne, la punchline.'],
      ['benji', 'Elle était très bonne. Ne bouge pas.'],
    ],
    [
      ['zia', 'Tu me soignes toujours en premier. Pourquoi ?'],
      ['benji', 'Parce que quand tu tombes, plus personne ne rappe. Et c’est triste.'],
      ['zia', 'Benji… pas de quartier. Mais toi, je te garde.'],
    ],
  ],
  'enola|isis': [
    [
      ['isis', 'Enola, tu tires de loin. Moi je frappe de près.'],
      ['enola', 'Et entre les deux ?'],
      ['isis', 'Entre les deux, il n’y a plus personne.'],
    ],
    [
      ['enola', 'Ton afro m’a bouché la vue pendant tout le combat.'],
      ['isis', 'Afro XXL, désolée.'],
      ['enola', 'J’ai tiré à travers. Personne n’a rien senti. Sauf l’ennemi.'],
    ],
    [
      ['isis', 'On danse ?'],
      ['enola', 'C’est ma phrase.'],
      ['isis', 'Je sais. Je l’aime bien.'],
      ['enola', 'Alors on danse.'],
    ],
  ],
};
