# BradGantt — Hiérarchie visuelle et navigation — Design

Date : 2026-10-06. Statut : validé en brainstorming avec Léo, en attente de relecture du document.

## 1. Vision

BradGantt garde son identité néo-brutaliste (bordures encre de 3 px, crème et papier, ombres portées
pleines, jaune = actif). Ce lot ne change pas le style : il corrige la **hiérarchie de l'information**
et les **parcours**. Aujourd'hui tout a le même poids, l'action principale d'un écran n'est jamais
évidente, la navigation entre Projets, Gantt, Tickets et Membres tient dans des petits liens texte, et
le vocabulaire mélange français et anglais.

Après ce lot, un utilisateur qui ouvre n'importe quel écran doit savoir en une seconde : où il est,
ce qu'il peut faire de principal, et comment aller ailleurs.

## 2. Périmètre

### Dans ce lot

- Un système de **trois niveaux de poids** appliqué à tous les boutons, liens et libellés.
- Une **navigation de projet dans l'en-tête noir** : fil d'Ariane, onglets Gantt / Tickets / Membres.
- La page **Mes projets** : ligne de synthèse à la place des tuiles, carte cliquable, menu « ⋯ ».
- Le **Gantt** : barre d'outils de vue, ligne de tâche avec badge tickets et menu « ⋯ », pied de page lisible.
- Les **tickets** : barre d'outils commune aux deux vues, colonnes allégées, carte à accent de statut.
- **Vocabulaire** français partout, « Gantt » à la place de « Frise ».
- **Téléphone** : en-tête sur deux rangées, barres d'outils repliées.
- Les tests e2e existants adaptés, plus ceux qui couvrent les nouveaux parcours.

### Hors périmètre (assumé)

- Aucune nouvelle fonctionnalité métier : pas de commentaires, de notifications, de réglages de projet.
- Pas de barre latérale d'application (option écartée au profit de l'en-tête noir).
- Pas de page « Réglages » : renommer, supprimer et activer les tickets restent dans le menu « ⋯ ».
- Pas de changement de schéma ni de RLS. Une seule lecture ajoutée : le nombre de tickets par projet
  sur la liste des projets.
- Pas de refonte du thème sombre : il hérite des jetons, rien de plus.
- La vue liste des tickets et la fenêtre de ticket gardent leur structure ; elles adoptent seulement
  les nouveaux poids et l'accent de statut.

## 3. Les trois niveaux de poids

C'est la règle qui gouverne tout le reste. Elle vit dans `components/ui/Button.tsx` et dans un
nouveau composant `components/ui/Menu.tsx`.

| Niveau | Usage | Rendu | Variant |
| --- | --- | --- | --- |
| 1 — action principale | Une seule par écran : « Nouveau projet », « + Tâche », « + Ticket », « Enregistrer » dans une fenêtre | Fond encre, texte crème, bordure 3 px, ombre brutale | `primary` |
| 2 — commande secondaire | « Annuler », zoom, bascule de vue, « + Jalon », « + Groupe », « Déconnexion » | Bordure 3 px, fond papier, **sans ombre** | `secondary` |
| 3 — commande discrète | Liens de navigation, commandes d'objet (renommer, supprimer, flèches d'un ticket) | Texte seul, souligné au survol ; si elle porte sur un objet, révélée au survol de cet objet par l'opacité | `quiet` |
| destructif | « Supprimer » partout | Texte rouge sans fond au repos, rouge plein au survol et sur le bouton de confirmation | `danger-quiet` au repos, `danger` sur la confirmation seulement |

Règles associées :

- **Si deux boutons noirs se voient en même temps, c'est une erreur.** Une fenêtre ouverte compte
  comme un écran : son « Enregistrer » est le seul noir visible, le fond est assombri.
- **Typographie.** Les capitales grasses (`font-display`, `uppercase`) ne servent plus qu'aux titres
  de page et aux en-têtes de section ou de colonne. Boutons, liens, libellés de champ, badges de rôle
  et de statut passent en casse mixte. `font-mono` est réservée aux chiffres, dates, numéros de ticket
  et au badge « ⌗ 1/2 ».
- **Ombres.** L'ombre brutale est réservée au niveau 1 et aux surfaces posées : cartes de projet,
  cartes de ticket, fenêtres, menus. Les boutons secondaires n'en ont plus.
- **Jaune.** Il garde son seul sens : « actif » (onglet courant, segment sélectionné, focus).
- **Révélation au survol** : par l'opacité (`opacity-0 group-hover/…:opacity-100
  focus-within:opacity-100 touch:opacity-100`), jamais par un rendu conditionnel. Une commande
  révélée doit exister dans le DOM pour le clavier et le toucher.

Le variant `ghost` actuel disparaît au profit de `quiet`. Le variant `danger` reste pour le bouton de
confirmation des fenêtres de suppression.

### Le menu « ⋯ »

Nouveau composant `components/ui/Menu.tsx` : un déclencheur « ⋯ » (bouton de niveau 3, `aria-label`
explicite, `aria-haspopup="menu"`) et une liste `role="menu"` posée sous lui, bordure 3 px, fond
papier, ombre brutale. Navigation clavier : flèches, Entrée, Échap ; le focus revient au déclencheur à
la fermeture. Un item destructif est rouge. Trois usages : la carte de projet, le nom du projet dans
l'en-tête (propriétaire), le bouton « + » replié sur téléphone.

La ligne de tâche du Gantt n'utilise pas ce composant : son « ⋯ » ouvre le `ContextMenu` existant,
ancré au bouton, pour ne pas avoir deux listes de commandes à maintenir.

## 4. Navigation : le projet dans l'en-tête noir

### Deux en-têtes pour deux contextes

L'en-tête noir reste la seule bande fixe de l'application, mais il change de contenu selon qu'on
est dans la liste des projets ou dans un projet.

- **Hors projet** (`/projects`) : signe + nom « BradGantt » (lien vers la liste), puis à droite le
  menu utilisateur : l'avatar ouvre un petit menu avec le nom, le thème et « Déconnexion ».
- **Dans un projet** (`/projects/[id]` et dessous) : signe seul (lien vers la liste), fil d'Ariane
  « Projets / Nom du projet », onglets, puis à droite la pile d'avatars des membres, le thème, l'avatar
  de l'utilisateur avec le même menu utilisateur. Le nom du projet porte un « ⋯ » pour le propriétaire (renommer, activer ou
  désactiver les tickets, supprimer), le même menu que sur la carte.

Les onglets sont soulignés de 3 px, le courant en jaune, `aria-current="page"` :

| Onglet | Route | Visible |
| --- | --- | --- |
| Gantt | `/projects/[id]` | toujours |
| Tickets | `/projects/[id]/tickets` | si les tickets sont activés ; sinon pour le propriétaire seul, et la page montre la carte d'activation existante |
| Membres | `/projects/[id]/membres` | toujours |

« Membres » devient une **page** et non plus une fenêtre : le contenu actuel de `MembersDialog`
(liste des membres, formulaire d'invitation) est rendu en pleine page, avec le même composant de
ligne et le même formulaire. La fenêtre disparaît, ainsi que l'indicateur `membersDialogOpen` du
store du Gantt et le bouton « Membres » de la barre d'outils.

### Mise en œuvre dans Next

Le layout `app/(app)/layout.tsx` garde l'authentification et l'ossature. Deux groupes de routes
portent chacun leur en-tête :

```
app/(app)/layout.tsx                       auth + profil + ossature (pas d'en-tête)
app/(app)/(accueil)/layout.tsx             <AppHeader />
app/(app)/(accueil)/projects/page.tsx      liste des projets (déplacée, inchangée)
app/(app)/(accueil)/projects/actions.ts    (déplacé, inchangé)
app/(app)/(projet)/projects/[id]/layout.tsx   <ProjectHeader /> + {children}
app/(app)/(projet)/projects/[id]/page.tsx     Gantt (déplacé)
app/(app)/(projet)/projects/[id]/tickets/page.tsx
app/(app)/(projet)/projects/[id]/membres/page.tsx   nouvelle page
```

Le layout de projet lit en une requête `projects(name, tickets_enabled)` et les `memberships` avec
leurs profils (pour la pile d'avatars et le rôle de l'utilisateur), avec `.eq('id', id)`. Un projet
introuvable ou dont l'utilisateur n'est pas membre donne `notFound()` dès le layout. Les pages gardent
leurs propres lectures : une petite requête de plus par navigation est acceptée, et le layout ne
connaît ni les tâches ni les tickets.

`ProjectHeader` est un composant serveur qui reçoit ces données et rend un sous-composant client
`ProjectTabs` (il a besoin de `usePathname` pour l'onglet courant) et, pour le propriétaire, le menu
« ⋯ » branché sur les actions serveur existantes (`renameProject`, `deleteProject`,
`setTicketsEnabled`). Un renommage ou une bascule des tickets revalide `/projects` **et**
`/projects/[id]` (type `layout`), pour que l'en-tête se mette à jour sans rechargement manuel : c'est
l'occasion de retirer le `router.refresh()` posé dans `TicketsDisabled`.

Le profil (nom, couleur, avatar) est lu dans `app/(app)/layout.tsx` comme aujourd'hui et passé aux
en-têtes par un petit contexte React serveur-compatible (`components/layout/ProfileProvider.tsx`),
pour ne pas le relire dans chaque groupe.

## 5. Mes projets

### La tête de page

Le titre « Mes projets » garde ses capitales. Les quatre tuiles (`ProjectsOverview`) deviennent une
**ligne de synthèse** sous le titre : « 12 projets · 317 tâches · 8 jalons sous 14 jours · 2 en
retard ». Les nombres sont en gras, le reste en encre douce. « N en retard » est rouge et cliquable
quand N > 0 : il ajoute `?filtre=retard` à l'URL et la grille ne montre plus que les projets qui ont
au moins une tâche en retard, avec un lien « Tout afficher » à côté. La ligne n'apparaît qu'avec au
moins un projet, comme aujourd'hui. Le seul bouton noir de la page est « Nouveau projet ».

### La carte

- **Toute la carte ouvre le Gantt.** Le titre est le lien (`<a>` avec un pseudo-élément qui couvre la
  carte), le reste est décoratif. Au survol et au focus, la carte prend un liseré jaune. Le curseur
  est une main.
- **Le rôle** est un badge en casse mixte : Propriétaire (violet), Éditeur (bleu), Lecteur (cyan).
- **Le menu « ⋯ »** en haut à droite, révélé au survol et au focus, pour le propriétaire seul :
  « Renommer », « Activer les tickets » ou « Désactiver les tickets », « Supprimer » (rouge). Il est
  posé au-dessus du lien de la carte et arrête la propagation du clic. Les boutons « Tickets »,
  « Renommer », « Supprimer » du pied de carte disparaissent.
- **Le pied de carte** : pile d'avatars à gauche ; à droite, le prochain jalon s'il existe et, si les
  tickets sont activés, un lien discret « Tickets · 3 » vers le kanban. Le compte vient d'une
  lecture `tickets(project_id)` sur la page, groupée côté serveur.
- Frise miniature, dates, barre d'avancement : inchangés. Le libellé « Frise vide » devient
  « Aucune tâche ».

## 6. Le Gantt

### La barre d'outils de vue

`GanttToolbar` ne porte plus ni le nom du projet, ni le rôle, ni les membres, ni le lien Tickets : tout
cela est dans l'en-tête. Elle devient une barre d'outils de vue, fond papier, bordure basse 3 px :

- à gauche : le zoom (segments Jour / Semaine / Mois, le courant en jaune) et un bouton secondaire
  « Aujourd'hui », nouveau, qui recentre la frise sur le jour courant (le recentrage existe déjà à
  l'ouverture, il devient rappelable) ;
- à droite, pour un éditeur : « + Jalon » et « + Groupe » en secondaire, « + Tâche » en principal.
  Un lecteur n'a pas de boutons de création et voit un badge « Lecture seule » à la place.

Sur téléphone (`< sm`), la barre garde le zoom en segments courts (J / S / M) et un seul bouton
principal « + » qui ouvre un menu (`Menu`) : « Tâche », « Jalon », « Groupe ». Le bandeau qui propose
de tourner le téléphone reste.

### La ligne de tâche

`SidebarRow` affiche, après le nom : le badge tickets « ⌗ 1/2 » (mono, bordure fine, encre douce,
`aria-label` « 1 ticket terminé sur 2 », seulement si les tickets sont activés et qu'il y en a), puis
l'avatar de l'assigné, puis un « ⋯ » révélé au survol et au focus de la ligne. Ce « ⋯ » ouvre le
`ContextMenu` existant ancré au bouton, avec les mêmes items que le clic droit. Double-clic et clic
droit continuent de fonctionner : on rend visible le chemin qui existe, on n'en crée pas un second.
En mode compact (téléphone), le badge disparaît et le « ⋯ » reste visible en permanence : il n'y a pas
de survol au doigt, et c'est la seule porte vers le menu de la ligne.

### Le pied de page

`GanttSummary` garde ses données et grossit : nombres en gras de taille `text-sm`, libellés en encre
douce et casse mixte, barre d'avancement avec son pourcentage. « N en retard » devient un bouton
discret rouge quand N > 0 : il bascule `highlightLate` dans le store du Gantt. Quand c'est actif, les
barres en retard prennent un liseré rouge de 3 px, les autres passent à 50 % d'opacité, la frise se
recentre sur la première tâche en retard, et le bouton est en jaune (actif). Un second clic ou Échap
annule. Rien n'est persisté.

### Ce qui ne change pas

Barres, dépendances, poignées, glisser, raccourcis clavier, menu contextuel, éditeur de tâche
(hors boutons : « Supprimer » passe en `danger-quiet`, « Enregistrer » reste le seul noir).

## 7. Les tickets

### La barre d'outils

`TicketsToolbar` perd le lien « ← Frise » et le titre (ils sont dans l'en-tête). Elle porte, de
gauche à droite : la bascule Kanban / Liste en segments (le courant en jaune, liens réels avec
`aria-current`), les trois filtres (statut, assigné, tâche) en sélecteurs compacts, le compte
« 3 tickets » en encre douce, et « + Ticket » en principal pour un éditeur. Les filtres viennent du
store (`filters`, déjà conservés entre les vues) : ils s'appliquent **aux deux vues**, kanban compris.
Sur téléphone, les filtres se replient derrière un bouton secondaire « Filtres » qui ouvre une petite
fenêtre.

### Le kanban

- Les colonnes perdent leur grand cadre. Chaque colonne a un en-tête : pastille carrée de la couleur
  du statut (à faire = papier, en cours = bleu, terminé = émeraude, bordure encre), nom du statut en
  capitales, compte en mono à droite, filet 3 px dessous. Le corps de colonne n'a pas de bordure et
  fait la hauteur de son contenu, avec une hauteur minimale d'une carte pour rester une cible.
- Pendant un glisser (`drag` non nul dans le store), chaque colonne qui n'est pas celle d'origine
  affiche en bas un emplacement « Déposer ici » en pointillés ; la colonne survolée le passe en
  jaune. Hors glisser, rien.
- Les cartes terminées sont à 75 % d'opacité.

### La carte de ticket

Retenue : **l'accent de statut**.

- Une bande verticale de 7 px à gauche, dans la couleur du statut, bordée d'encre.
- Première ligne : « #2 » en mono encre douce ; à droite, révélés au survol et au focus : les deux
  flèches de statut (inchangées, c'est le chemin clavier et tactile) puis un « ⋯ » (`Menu`) avec
  « Modifier », « Déplacer vers… » (sous-liste des deux autres statuts), « Supprimer ».
- Le titre en gras, deux lignes au plus.
- Dernière ligne : la tâche liée en puce mono « ↳ Développement » (ou « Sans tâche » en encre
  douce), l'avatar de l'assigné à droite.
- Ombre brutale de 3 px. Le double-clic ouvre toujours l'éditeur.

### La liste

Même tableau. La colonne « Statut » affiche un badge en casse mixte dans la couleur du statut. Le
titre reste un bouton de niveau 3 (c'est le chemin clavier vers l'éditeur). Les filtres ne sont plus
au-dessus du tableau : ils sont dans la barre d'outils.

### La fenêtre de ticket

Le bandeau de titre « Ticket #3 » porte la même bande de statut à gauche. Boutons : « Supprimer » en
`danger-quiet`, « Annuler » secondaire, « Enregistrer » principal. Rien d'autre ne change.

## 8. Vocabulaire

| Avant | Après |
| --- | --- |
| owner / editor / viewer (badges) | Propriétaire / Éditeur / Lecteur |
| « Lecture seule » | gardé, pour le badge d'un lecteur dans la barre d'outils du Gantt |
| « Frise » (lien retour, barre tickets) | « Gantt » (onglet) ; le mot « frise » reste dans la prose française où il désigne la miniature |
| « Frise vide » (carte) | « Aucune tâche » |
| « 1/2 » nu | « ⌗ 1/2 » avec `aria-label` complet |
| « ← Projets » | fil d'Ariane « Projets / Nom » dans l'en-tête |

Les libellés de statut (À faire, En cours, Terminé) et les textes des fenêtres sont déjà en français.

## 9. Téléphone

- **En-tête de projet** sur deux rangées sous `sm` : signe, nom du projet tronqué et avatar sur la
  première ; les onglets, défilables horizontalement, sur la seconde. Le fil d'Ariane se réduit au
  nom (le signe ramène à la liste).
- **Mes projets** : la ligne de synthèse passe à la ligne ; les cartes restent en une colonne ; le
  « ⋯ » est toujours visible (pas de survol au doigt).
- **Gantt** : barre d'outils réduite à J / S / M et « + » (section 6). Le bandeau de rotation reste.
- **Tickets** : bascule de vue, bouton « Filtres », « + Ticket ». Les flèches de statut sont toujours
  visibles sur écran tactile (règle existante). Les colonnes s'empilent.
- Aucun débordement horizontal à 390 px : c'est un test e2e existant (`mobile.spec.ts`) qui gagne les
  pages Tickets et Membres.

## 10. Thème sombre

Rien de spécifique. Les nouveaux éléments utilisent les jetons existants (`ink`, `cream`, `paper`,
`band`, `on-data`) ; les couleurs de statut sont des couleurs de données et gardent un texte
`on-data`. L'onglet courant est souligné de jaune dans les deux thèmes.

## 11. Fichiers

**Créés**

| Fichier | Rôle |
| --- | --- |
| `components/ui/Menu.tsx` | Menu « ⋯ » accessible |
| `components/layout/ProjectHeader.tsx` | En-tête noir d'un projet (serveur) |
| `components/layout/ProjectTabs.tsx` | Onglets (client, `usePathname`) |
| `components/layout/UserMenu.tsx` | Avatar + menu (thème, déconnexion) |
| `components/layout/ProfileProvider.tsx` | Profil partagé entre les deux en-têtes |
| `components/project/ProjectMenu.tsx` | Menu « ⋯ » d'un projet (carte et en-tête) |
| `components/project/ProjectsSummaryLine.tsx` | Remplace `ProjectsOverview` |
| `app/(app)/(accueil)/layout.tsx`, `app/(app)/(projet)/projects/[id]/layout.tsx` | Les deux en-têtes |
| `app/(app)/(projet)/projects/[id]/membres/page.tsx` | Page Membres |
| `components/members/MembersPage.tsx` | Contenu de la page, à partir de `MembersDialog` |

**Modifiés** : `Button.tsx` (variants, casse), `Badge.tsx` (casse mixte), `AppHeader.tsx`,
`ProjectCard.tsx`, `app/(app)/projects/page.tsx` (déplacé, synthèse, filtre retard, compte de
tickets), `actions.ts` (revalidation du layout), `GanttToolbar.tsx`, `ZoomControls.tsx`,
`SidebarRow.tsx`, `GanttSummary.tsx`, `GanttView.tsx` et `TaskBar.tsx` (`highlightLate`),
`lib/gantt/store.ts` (`highlightLate`, suppression de `membersDialogOpen`), `TicketsToolbar.tsx`,
`TicketBoard.tsx`, `TicketColumn.tsx`, `TicketCard.tsx`, `TicketList.tsx`, `TicketEditor.tsx`,
`TicketsDisabled.tsx`, `MiniGantt.tsx`, `TaskEditor.tsx` (bouton Supprimer).

**Supprimés** : `ProjectsOverview.tsx`, `MembersDialog.tsx` (son contenu migre dans `MembersPage`).

## 12. Tests

- **Unitaires** : `Menu` (ouverture, flèches, Échap, retour du focus, item destructif) ;
  `ProjectTabs` (onglet courant, onglet Tickets selon activation et rôle) ; `ProjectsSummaryLine`
  (pluriels, lien retard absent à zéro) ; `ProjectCard` (carte entière = lien, menu propriétaire
  seul, lien Tickets · N) ; `GanttSummary` (bouton retard bascule `highlightLate`) ; `TicketColumn`
  (emplacement de dépôt seulement pendant un glisser) ; `TicketCard` (accent, menu, opacité
  terminé) ; `Button` (plus de capitales, pas d'ombre en secondaire).
- **e2e à adapter** : `projects.spec` (actions dans le menu « ⋯ », carte cliquable), `members.spec`
  (page au lieu de la fenêtre), `gantt-view.spec` et `gantt-readonly.spec` (barre d'outils, badge
  Lecture seule), `context-menu.spec` (ouverture par « ⋯ »), `tickets.spec` (onglets, filtres
  communs), `mobile.spec` (deux rangées d'en-tête, pages Tickets et Membres sans débordement),
  `authorization.spec` (onglet Tickets caché à un non-propriétaire quand désactivé).
- **e2e nouveaux** : le filtre « en retard » sur Mes projets ; la mise en évidence du retard dans le
  Gantt ; le menu « ⋯ » du nom de projet dans l'en-tête (renommer depuis le Gantt).
- Les tests continuent d'écrire dans des projets jetables, jamais dans « Projet démo ».

## 13. Ordre de livraison

1. Primitives : `Button`, `Badge`, `Menu`, casse mixte.
2. Ossature : groupes de routes, `ProjectHeader`, `ProjectTabs`, `UserMenu`, page Membres.
3. Mes projets : synthèse, filtre retard, carte, `ProjectMenu`.
4. Gantt : barre d'outils de vue, ligne de tâche, pied de page et `highlightLate`.
5. Tickets : barre d'outils, colonnes, carte, liste, fenêtre.
6. Vocabulaire et téléphone.
7. Passe e2e complète.
