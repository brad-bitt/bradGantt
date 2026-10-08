# BradGantt — Identité éditoriale — Design

Date : 2026-10-08. Statut : validé en brainstorming avec Léo (maquettes dans le navigateur, choix
par écran), en attente de relecture du document.

## 1. Vision

BradGantt quitte le néo-brutalisme. Le lot 05 avait réglé la hiérarchie (une action principale par
écran, commandes d'objet au survol, destructif sobre) mais pas le confort de lecture : capitales en
Archivo Black, bordures de 3 px, ombres portées pleines, crème contre noir pur — tout cela fatigue
sur une application qu'on lit longtemps, et Léo a coché les quatre points quand on lui a demandé ce
qui gênait.

Le projet est une **vitrine** : l'identité est un argument, mais une vitrine illisible est un
argument contre. La nouvelle direction est **éditoriale** : du papier chaud, une encre graphite,
un serif de titre (Fraunces) et une sans d'ingénieur (IBM Plex Sans), des filets fins, des arrondis
francs, des ombres diffuses réservées à ce qui flotte, un or qui ne signifie que « actif », et des
couleurs de tâches portées en liseré plutôt qu'en aplat. Ce qui a été acquis au lot 05 est conservé
tel quel : les trois niveaux de poids, un seul bouton d'encre par écran, les commandes révélées par
l'opacité, le destructif sobre au repos, la grille du Gantt à deux rythmes.

Après ce lot, un utilisateur doit pouvoir passer une heure dans le Gantt sans fatigue, et quelqu'un
qui ouvre le lien de partage doit voir un produit qui ne ressemble à aucun autre.

Ce lot ne touche pas aux performances : le build de production est léger (103 kB partagés, 205 kB
pour le Gantt) et le style n'y est pour rien. Si une lenteur est ressentie, elle est ailleurs
(serveur de dev, réveil à froid sur Vercel, latence Vercel ↔ Supabase) et sera traitée à part.

## 2. Périmètre

### Dans ce lot

- Les **jetons** : palette de structure claire et sombre, or « actif », rouges, fontes, échelle
  typographique, rayons, ombres. Suppression des utilitaires brutalistes.
- Les **primitives** `components/ui/` : bouton, champs, case à cocher, carte, menu, fenêtre,
  toast, badge, avatar.
- Tous les **écrans** : en-têtes, Mes projets et sa carte, Gantt, Tickets (kanban et liste),
  Membres, connexion, invitation, états vides et d'erreur.
- Le **thème sombre**, vérifié écran par écran.
- La **marque** : signe, favicon, icône Apple, image OpenGraph.
- Les **tests** qui vérifiaient une classe de style, réécrits vers la règle qu'ils protègent.
- Le README (section « Design »).

### Hors périmètre (assumé)

- Aucune nouvelle fonctionnalité, aucun changement de données, de RLS ni de migration.
- Pas de virtualisation du Gantt ni d'autre travail de performance.
- Pas de réglage de densité par l'utilisateur : une seule échelle, « aérée ».
- Pas de test d'instantané visuel : le contrôle visuel reste manuel.
- Pas de changement de parcours : les e2e gardent leur sens, seuls les sélecteurs de classes bougent.
- Les courriels d'invitation (`lib/invitations/emails.ts`) adoptent les nouvelles couleurs mais
  gardent leur structure.

## 3. Jetons

Tout vit dans `app/globals.css` (bloc `@theme` et `:root[data-theme="dark"]`). Les noms ci-dessous
sont ceux des jetons Tailwind (`bg-paper`, `text-ink-soft`, `border-line`…).

### Structure

| Jeton | Rôle | Clair | Sombre |
| --- | --- | --- | --- |
| `paper` | fond de page | `#F6F3EC` | `#1C1915` |
| `surface` | cartes, fenêtres, menus, Gantt, tableaux | `#FBF9F4` | `#242019` |
| `ink` | texte, bouton principal, avatars, toast | `#2A2622` | `#EFE8DA` |
| `ink-soft` | texte secondaire, en-têtes de colonne, onglets inactifs | `#746D62` | `#A39B8D` |
| `line` | tous les filets | `#DED7C8` | `#3B362F` |

Disparaissent : `cream`, `band`, `header`, `on-header`, `on-data`. Le bandeau sombre n'existe plus,
et le texte sur une barre est désormais l'encre du thème (voir § 7).

### État et repères

| Jeton | Rôle | Valeur |
| --- | --- | --- |
| `accent` | **actif** uniquement : onglet courant, avatar de l'utilisateur, anneau de focus, anneau de sélection | `#F2C319` |
| `accent-soft` | surfaces actives : colonne du jour, ligne sélectionnée, filtre « N en retard » enclenché, emplacement de dépôt | or à 28 % (clair), 22 % (sombre) |
| `today` | trait du jour | `#E5342A`, inchangé |
| `danger` | destructif : texte au repos, fond sur la confirmation, liseré du retard | `#C8321F` |

`yellow` est renommé `accent`. L'or ne prend jamais un autre sens ; un composant qui a besoin d'un
« avertissement » utilise `danger` ou l'encre douce, pas l'or.

### Données

Les huit teintes gardent leurs valeurs (`tangerine #FF8A3D`, `rose #FF6FA3`, `blue #5B9DFF`,
`emerald #3ECF8E`, `violet #A78BFA`, `cyan #34D3E0`, `lime #B4E45C`, `ochre #E9B44C`). Elles ne sont
plus posées en aplat : une barre, un badge coloré, un liseré de ticket les portent en **teinte pâle**
(`color-mix(in srgb, <teinte> 32%, var(--color-surface))` ; 45 % en sombre) avec un **liseré** de
couleur pleine. Le signe de la marque et l'image OpenGraph restent les deux seuls endroits où elles
sont en aplat.

### Typographie

| Jeton | Fonte | Usage |
| --- | --- | --- |
| `font-display` | Fraunces, graisse 500, axe optique selon la taille | titres de page, de carte, de fenêtre, nom de projet dans le fil d'Ariane, nom sur la connexion |
| `font-ui` | IBM Plex Sans 400/500/600 | tout le reste |
| `font-mono` | JetBrains Mono | dates, compteurs, numéros de ticket, badge « ⌗ » ; chiffres tabulaires |

Archivo Black et Space Grotesk sortent de `app/layout.tsx`. **Aucune capitale forcée nulle part** :
l'utilitaire `uppercase` disparaît du code et un test le garantit.

Échelle (« aérée »). Elle est posée dans le bloc `@theme` en **remplaçant** les tailles Tailwind
(`text-xs` → 13 px, `text-sm` → 14 px, `text-base` → 15 px), de sorte que les classes existantes
restent valables et que rien ne puisse descendre sous 13 px ; les tailles arbitraires
(`text-[11px]`) sont interdites et un test le vérifie.

| Rôle | Classe | Taille / interligne |
| --- | --- | --- |
| corps | `text-base` | 15 px / 1,55 |
| secondaire (lignes de synthèse, fil d'Ariane, pied) | `text-sm` | 14 px / 1,5 |
| petit (badges, en-têtes de colonne, dates de la frise) | `text-xs` | 13 px / 1,4 — **rien en dessous** |
| titre de page | 30 px / 1,1, Fraunces, `letter-spacing -0.015em` |
| titre de fenêtre | 22 px / 1,15 |
| titre de carte, de colonne de kanban | 19 px / 1,2 |
| nom de projet dans l'en-tête | 18 px |

### Rayons et ombres

| Jeton | Valeur | Usage |
| --- | --- | --- |
| `radius-dialog` | 12 px | fenêtre |
| `radius-card` | 10 px | carte, menu, Gantt, tableau, toast |
| `radius-control` | 7 px | bouton, champ |
| `radius-bar` | 6 px | barre de Gantt |
| `shadow-float` | `0 8px 24px` encre 14 % + `0 2px 6px` encre 8 % (sombre : 40 % + 24 %) | menu, menu contextuel, liste déroulante |
| `shadow-dialog` | `0 24px 60px` encre 22 % (sombre : 60 %) | fenêtre |

Rien d'autre ne porte d'ombre. `shadow-brutal`, `-lg`, `-xl`, `hatch-data`, `brutal-focus`,
`brutal-focus-header` disparaissent. Un seul utilitaire de focus reste, `focus-ring` : anneau
`accent` de 2 px à 2 px du bord, visible au clavier seulement (`focus-visible`).

Toutes les bordures passent à 1 px (`border` sans épaisseur), y compris les 39 `border-[3px]` et
`BAR_BORDER_PX` dans `lib/gantt/geometry.ts`.

## 4. Primitives

Les API ne changent pas : `Button` garde `primary | secondary | quiet | danger | danger-quiet` et
`sm | md`, `Menu` ses entrées et son `align`, `Dialog` son portail, `Badge` ses couleurs. Seul le
rendu bouge. Le `tone="header"` de `Menu` disparaît avec le bandeau.

| Composant | Rendu |
| --- | --- |
| `Button primary` | encre pleine, texte papier, `radius-control`, 40 px de haut (`sm` : 32), Plex 500 15 px ; survol : encre à 88 % |
| `Button secondary` | filet `line`, fond transparent ; survol : fond `surface`, filet `ink-soft` |
| `Button quiet` | texte seul, `radius-control` ; survol : fond `surface`. Porte les commandes d'objet (⋯, ✕, « + » d'un groupe, flèches de statut), révélées par l'**opacité** au survol de l'objet — jamais par rendu conditionnel (règle du lot 05, tenue par `gantt-deps.spec.ts`) |
| `Button danger` | `danger` plein, texte papier — bouton de confirmation seulement |
| `Button danger-quiet` | texte `danger` ; survol : `danger` à 8 % |
| `Input`, `Select`, `Textarea` | filet `line`, fond `surface`, `radius-control`, 40 px ; focus : filet `ink` + `focus-ring`. Libellé Plex 500 14 px au-dessus |
| `Checkbox` | 18 px, filet 1 px, rayon 4 ; cochée : encre pleine, coche papier |
| Carte (`ProjectCard`) | `surface`, filet `line`, `radius-card`, pas d'ombre ; survol : filet `ink-soft`, sans déplacement |
| `Menu` | `surface`, `radius-card`, `shadow-float`, filet encre à 6 % (sombre : `line`), 6 px de marge interne, entrées de 36 px en Plex 15, entrée survolée sur `paper`, entrée destructive en `danger-quiet` |
| `Dialog` | `surface`, `radius-dialog`, `shadow-dialog`, voile encre à 32 % derrière (sombre : noir à 55 %), 24 px de marge interne, titre Fraunces 22, pied aligné à droite (`secondary` puis `primary`), l'action destructive seule à gauche. Téléphone : arrive du bas, pleine largeur, coins hauts arrondis, pied qui passe à la ligne |
| `Toast` | encre pleine, texte papier, `radius-card` — le seul aplat d'encre hors boutons et avatars |
| `Badge` | pastille (`999`), 13 px, filet `line` ; `ink` : encre pleine ; couleur de données : teinte pâle + texte `ink` ; `yellow` devient `accent` |
| `Avatar` | rond, initiales Plex 600 ; celui de l'utilisateur en `accent`, les autres en encre |
| Onglets (`ProjectTabs`) | Plex 15 `ink-soft` ; courant : `ink` + soulignement `accent` 2 px ; survol : `ink` |
| Pastilles de filtre | `secondary sm` ; active : `accent-soft` sans filet |

**Règles conservées du lot 05.** Si deux boutons d'encre pleine se voient en même temps, c'est une
erreur ; une fenêtre ouverte compte comme un écran. Une action destructive est sobre au repos et ne
devient rouge pleine qu'à la confirmation.

## 5. En-têtes et navigation

Le bandeau noir disparaît. Les deux groupes de routes (`app/(app)/(accueil)` et `app/(app)/(projet)`)
restent ; seuls `AppHeader.tsx` et `ProjectHeader.tsx` changent de rendu.

- **Accueil** (`/projects`) : bandeau `paper`, filet `line` en bas, 56 px ; signe + nom à gauche
  (`Wordmark`), avatar-menu du compte à droite.
- **Projet** : même bandeau. Première rangée : fil d'Ariane « Projets / *Nom* » (« Projets » en
  `ink-soft` 14, le nom en Fraunces 18 `ink`), puis le ⋯ en `quiet` pour le propriétaire ; à droite
  la pile d'avatars et le compte. Seconde rangée : les onglets, filet `line` en bas. Téléphone : les
  deux rangées restent, le fil d'Ariane tronque le nom à une ligne.
- **Menu du compte** : `Menu` ordinaire (plus de `tone="header"`), avec la bascule de thème et la
  déconnexion.

## 6. Mes projets

Date du jour en `ink-soft` 14, titre Fraunces 30, « Nouveau projet » seul `primary`. Ligne de
synthèse en `ink-soft` 14 ; « N en retard » est un bouton `secondary sm` qui devient `accent-soft`
quand le filtre `?filtre=retard` est actif. Cartes en grille comme aujourd'hui : titre Fraunces 19,
synthèse 14 (« 12 tâches · 3 en retard · 4 membres », le retard en `danger`), vignette
(`GanttPreview` / `MiniGantt`) en barres liseré sur `surface`, barre d'avancement de 4 px en encre
sur `line`. La carte reste entièrement cliquable, le ⋯ posé au-dessus du lien (test e2e existant).
États vides (`NoProjects`) : titre Fraunces 22, texte `ink-soft`, un seul `primary`.

## 7. Le Gantt

### Géométrie

`ROW_HEIGHT` passe de 44 à **48** (barre de 28, `BAR_INSET` 10) : c'est la seule exception à
l'échelle aérée, parce qu'une frise se lit en balayant verticalement et qu'à 52 un projet de vingt
tâches sort de l'écran d'un portable. `BAR_BORDER_PX` passe de 3 à 1. Les poignées de redimensionnement
gardent leur règle (largeur bornée au quart de la barre).

### Grille (`TimelineGrid`, `TimelineHeader`)

Règles inchangées : jours en pointillé, lundis en trait, bande de week-end à tous les zooms, hachures
de week-end au zoom jour seulement (encre à 6 %, jamais aux zooms semaine et mois — moiré), mois
alternés. Les valeurs changent : filets en `line`, bande de week-end et mois alternés en `surface`
sur `paper`, colonne du jour en `accent-soft`, trait du jour en `today` 2 px. En-tête de frise :
dates en mono 13 `ink-soft`, jour courant en `ink` 500.

### Barre (`TaskBar`)

- Fond : teinte pâle de la couleur de la tâche (32 % dans `surface` ; 45 % en sombre).
- Liseré gauche : 4 px de couleur pleine, coins gauches à 4 px, droits à `radius-bar`.
- Filet : 1 px de la couleur à 40 %.
- Texte : `ink` du thème, Plex 500 14, tronqué.
- **Avancement** : plus de hachures. Un trait de 3 px de couleur pleine le long du bord bas, de la
  longueur de l'avancement (`width: progress%`). Le chiffre reste dans l'éditeur et l'infobulle.
- **Sélection** : anneau `accent` 2 px (`outline`, `outline-offset 1px`).
- **Retard mis en évidence** (bouton du pied, Échap pour l'éteindre) : liseré et filet en `danger`,
  les autres barres à 50 % — mécanisme inchangé.
- Poignées de redimensionnement et de liaison : encre, révélées par l'opacité au survol ; inchangées.
- Jalons (`MilestoneMark`) : losange encre 14 px, libellé 14 ; groupes (`GroupBar`) : trait encre
  de 6 px avec embouts, libellé Fraunces 15.

### Flèches de dépendance (`DependencyArrows`)

Encre 1,5 px, pointe pleine ; le liseré clair qui les détachait des bandes de week-end devient
`paper` à 70 %. Aperçu de liaison en pointillé, inchangé.

### Barre latérale, barre d'outils, pied

- `Sidebar` / `SidebarRow` : fond `surface`, filet `line` à droite, noms en Plex 15, indentation des
  groupes par 16 px, badge « ⌗ 2/5 » en `Badge` 13 mono, ⋯ en `quiet` révélé au survol.
- `GanttToolbar` / `ZoomControls` : « + Tâche » seul `primary` ; « Aujourd'hui », « + Jalon »,
  « + Groupe » en `secondary` ; Jour / Semaine / Mois en groupe de `secondary sm` dont l'actif est
  `accent-soft`. Téléphone : repliés comme aujourd'hui.
- `GanttSummary` (pied) : `surface`, filet `line` en haut, texte `ink-soft` 14, chiffres mono ;
  « N en retard » en `secondary sm`, `accent-soft` quand allumé.
- `EmptyProject`, `ProjectLoadError`, `RotateHint` : gabarit des états vides (§ 6).

## 8. Les tickets

- **Barre d'outils** (`TicketsToolbar`) : « + Ticket » seul `primary`, bascule Kanban / Liste en
  `secondary sm` à actif `accent-soft`, filtres statut / assigné / tâche en pastilles (§ 4).
- **Kanban** (`TicketColumn`) : trois colonnes sans cadre, titre de colonne Fraunces 19 `ink` et
  compteur mono 13 `ink-soft`, emplacement de dépôt en `accent-soft` avec filet pointillé `accent`.
- **Carte** (`TicketCard`) : `surface`, `radius-card`, filet `line`, liseré gauche 4 px selon le statut
  — à faire : `line` ; en cours : `blue` ; terminé : `emerald` (`STATUS_SWATCH` suit) ; terminé à
  75 % d'opacité comme aujourd'hui. Titre Plex 500 15, numéro mono 13, assigné en `Avatar sm`,
  tâche liée en `Badge`. Flèches de statut et ⋯ en `quiet`, révélés au survol.
- **Liste** (`TicketList`) : tableau `surface`, `radius-card`, en-têtes Plex 500 13 `ink-soft`, filets
  `line`, lignes de 48 px, statut en `Badge` (teinte pâle), tri inchangé.
- **Fenêtre de ticket** (`TicketEditor`) : gabarit `Dialog` ; l'accent de statut passe du bandeau
  coloré à un liseré gauche de 4 px sur le titre (test `TicketEditorAccent` réécrit).
- `TicketsDisabled` : gabarit des états vides.

## 9. Membres, connexion, invitation

- **Membres** (`MembersPage`) : titre Fraunces 30, « Inviter » seul `primary` (ouvre `InviteForm`),
  tableau à filets (avatar, nom, courriel en `ink-soft`, rôle en `Select`, retrait en `danger-quiet`
  révélé au survol de la ligne). La ligne du propriétaire reste intouchable.
- **Connexion** (`app/(auth)/login`) : `paper`, signe + nom en Fraunces 30 centrés, carte `surface`
  de 400 px (`radius-dialog`, filet, pas d'ombre), champs § 4, « Se connecter » seul `primary`,
  bascule de thème en haut à droite.
- **Invitation** (`app/invite/[token]`, `InviteError`) : même gabarit.
- **Courriels** (`lib/invitations/emails.ts`) : couleurs `paper` / `ink` / `accent`, bouton encre
  pleine ; structure inchangée.

## 10. Thème sombre

Mécanisme inchangé : `data-theme` sur `<html>`, posé par le script de démarrage d'après le choix
enregistré sinon le réglage du système ; bascule dans le menu du compte et sur la connexion.

Seuls les cinq jetons de structure s'inversent (§ 3). L'or, les rouges et les huit teintes restent.
Adaptations propres au sombre :

- barres et badges colorés à 45 % de couleur, pour que l'encre claire reste à 4,5:1 dessus ;
- ombres à encre 40 % (`shadow-float`) et 60 % (`shadow-dialog`), plus un filet `line` sur toute
  surface flottante : une ombre à 14 % ne se voit pas sur du brun ;
- voile de fenêtre en noir à 55 % ;
- hachures de week-end en encre à 6 %, donc claires ;
- le texte de l'avatar `accent` et du bouton de confirmation `danger` reste `#111` / papier, fixe.

Chaque écran est vérifié dans les deux thèmes avant la fin du lot ; une couleur qui ne passe pas
4,5:1 sur son fond (texte) ou 3:1 (filet, liseré) se corrige dans le jeton, pas localement.

## 11. Marque

- `Mark` (`components/layout/Logo.tsx`) : carré `ink` nu, sans le cadre crème fixe (il ne servait
  qu'à se détacher du bandeau sombre), trois barres `blue` / `tangerine` / `rose` en aplat — le
  signe est le seul endroit où les teintes restent pleines. `app/icon.svg` et `app/apple-icon.png`
  suivent le même dessin.
- `Wordmark` : signe + « BradGantt » en Fraunces 500, casse mixte.
- `app/opengraph-image.tsx` : papier `#F6F3EC`, « BradGantt » en Fraunces, une frise de quatre barres
  liseré sur `surface`, trait du jour rouge. C'est la vignette du lien partagé.

## 12. Téléphone

Les points de rupture (`sm:` à 640 px) et les comportements du lot 05 restent : en-tête sur deux
rangées, barres d'outils repliées, fenêtre venue du bas, `RotateHint` pour le Gantt en portrait.
L'échelle aérée ne descend pas sur téléphone (corps 15, lignes de Gantt 48) ; ce qui s'adapte, ce
sont les marges (16 px) et les grilles (une colonne). Rien ne doit déborder à 390 px.

## 13. Fichiers

### Modifiés

- `app/globals.css` — jetons, suppression des utilitaires brutalistes, `focus-ring`.
- `app/layout.tsx` — fontes Fraunces, IBM Plex Sans, JetBrains Mono.
- `app/icon.svg`, `app/apple-icon.png`, `app/opengraph-image.tsx` — marque.
- `app/(auth)/login/page.tsx`, `app/(auth)/login/LoginForm.tsx`, `app/invite/[token]/InviteError.tsx`.
- `components/ui/` : `Avatar`, `Badge`, `Button`, `Checkbox`, `Dialog`, `Input`, `Menu`, `Select`,
  `Textarea`, `Toast`.
- `components/layout/` : `AppHeader`, `GanttPreview`, `Logo`, `ProjectHeader`, `ProjectTabs`,
  `ThemeToggle`, `UserMenu`.
- `components/project/` : `InviteForm`, `MiniGantt`, `NoProjects`, `ProjectCard`, `ProjectsSummaryLine`.
- `components/gantt/` : `ContextMenu`, `DependencyArrows`, `EmptyProject`, `GanttSummary`,
  `GanttToolbar`, `GanttView`, `GroupBar`, `MilestoneMark`, `ProjectLoadError`, `RotateHint`,
  `Sidebar`, `SidebarRow`, `TaskBar`, `TaskEditor`, `TimelineGrid`, `TimelineHeader`, `ZoomControls`.
- `components/tickets/` : `TicketCard`, `TicketColumn`, `TicketEditor`, `TicketList`,
  `TicketsToolbar`, `status.ts`.
- `components/members/MembersPage.tsx`.
- `lib/gantt/geometry.ts` — `ROW_HEIGHT`, `BAR_INSET`, `BAR_BORDER_PX`.
- `lib/invitations/emails.ts` — couleurs des courriels.
- `README.md` — section « Design ».

### Supprimés

Aucun fichier ; seulement des utilitaires CSS (`shadow-brutal*`, `hatch-data`, `brutal-focus*`) et
les jetons `cream`, `band`, `header`, `on-header`, `on-data`, `yellow`.

## 14. Tests

Les parcours e2e ciblent des rôles et des libellés : ils ne changent pas de sens. Onze fichiers
vérifient une classe de style ; chacun est réécrit vers la règle qu'il protège, aucun n'est supprimé :

| Fichier | Règle protégée après ce lot |
| --- | --- |
| `tests/unit/components/ui/Button.test.tsx` | `primary` seul porte `bg-ink` ; `danger-quiet` n'a pas de fond ; aucun variant ne porte `uppercase` ni d'ombre |
| `tests/unit/components/ui/Casing.test.tsx` → **`Typography.test.tsx`** | titres en `font-display`, aucun `uppercase` dans `app/` ni `components/`, aucune taille arbitraire sous 13 px (`text-[1[0-2]px]`), `text-xs` vaut 13 px dans le thème |
| `tests/unit/components/ui/Badge.test.tsx` | `ink` plein, couleurs en teinte pâle, `accent` à la place de `yellow` |
| `tests/unit/components/gantt/GanttView.test.tsx`, `GanttToolbar.test.tsx`, `GanttSummary.test.tsx`, `TaskEditor.test.tsx` | un seul `bg-ink` visible par écran ; le retard porte `border-danger` ; l'actif porte `accent-soft` |
| `tests/unit/components/tickets/TicketColumn.test.tsx`, `TicketList.test.tsx`, `TicketEditorAccent.test.tsx` | liseré de statut sur la carte, le tableau et le titre de la fenêtre |
| `tests/e2e/gantt-chaining.spec.ts` | la barre chaînée porte l'anneau `accent` (plus `border-ink`) |

Nouveaux tests unitaires : `TaskBar` (teinte pâle + liseré + trait d'avancement de la bonne largeur,
anneau de sélection, liseré rouge en retard), `Mark` (plus de cadre), `geometry` (48 / 10 / 1).

Vérifications de fin de lot : `npm test`, `npm run typecheck && npm run lint`, `npm run test:db`
(non-régression, aucune migration), `npm run test:e2e` (hors les trois échecs environnementaux
connus), puis contrôle visuel manuel de chaque écran en clair, en sombre et à 390 px, sans rien
écrire dans le projet démo.

## 15. Ordre de livraison

Branche `feat/06-identite-editoriale` depuis `master`, intégrée en avance rapide à la fin, après
l'accord de Léo. Sept lots, un ou plusieurs commits chacun, l'application restant fonctionnelle à
chaque commit :

1. **Jetons** — `globals.css`, `layout.tsx` (fontes), suppression des utilitaires brutalistes et des
   anciens jetons, `geometry.ts`. L'application est laide mais cohérente et tous les tests qui ne
   vérifient pas une classe passent.
2. **Primitives** — `components/ui/` et leurs tests, `Typography.test.tsx`.
3. **En-têtes, compte, connexion, invitation, marque** — `layout/`, `(auth)`, `invite`, `Logo`,
   icônes, OpenGraph, courriels.
4. **Mes projets** — `project/`, vignette.
5. **Gantt** — `gantt/` et ses tests, e2e de chaînage.
6. **Tickets et Membres** — `tickets/`, `members/` et leurs tests.
7. **Passe finale** — thème sombre écran par écran, téléphone, README, suite e2e complète.
