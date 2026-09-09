# BradGantt — Tickets (module optionnel) — Design

Date : 2026-09-09
Statut : validé en brainstorming, en attente de relecture avant plan d'implémentation.

## 1. Vision

Un suivi de tickets **intégré à BradGantt**, pas une passerelle vers un outil externe.
Chaque projet peut activer un backlog : une liste de tickets numérotés, avec un statut,
un assigné et une description. Un ticket peut être **rattaché à une tâche du Gantt**, ou
rester libre.

Le Gantt reste le cœur du produit. Les tickets sont **désactivés par défaut** : un projet
qui ne les active pas ne voit aucun changement, ni dans son écran, ni dans ses requêtes.

## 2. Périmètre

### Dans ce lot

- Activation par projet, réservée au propriétaire, réversible sans perte de données
- Tickets : créer, modifier, supprimer — titre, description, statut, assigné, tâche liée
- Numérotation automatique par projet (`#1`, `#2`, …), affichée partout
- Deux vues : kanban à trois colonnes (glisser-déposer) et liste filtrable
- Côté Gantt : compteur de tickets sur la ligne de tâche, liste des tickets dans l'éditeur
  de tâche, bouton de création qui pré-remplit le rattachement

### Hors périmètre (assumé)

Ni commentaires, ni pièces jointes, ni priorité, ni type (bug / évolution), ni étiquettes,
ni historique des changements, ni temps réel, ni avancement de tâche calculé depuis les
tickets. L'avancement d'une tâche reste saisi à la main.

Pas d'ordre manuel à l'intérieur d'une colonne du kanban : les cartes y sont rangées par
numéro. Déposer une carte dans sa propre colonne ne fait rien et elle reprend sa place.

## 3. Décisions d'architecture

**Module miroir plutôt qu'extension du Gantt.** `lib/tickets` reprend la structure de
`lib/gantt` (types, réducteur, store, dépôt, commandes) et vit sur sa propre route. Le
store du Gantt ne contient aucun ticket : il ne reçoit qu'un résumé en lecture. Deux
raisons : garder le cœur Gantt léger, et éviter de charger les tickets pour un utilisateur
qui ne les ouvre jamais.

**Le drapeau d'activation n'est pas une frontière de sécurité.** La RLS l'ignore
totalement. C'est un choix d'affichage. Le mêler aux policies compliquerait les tests RLS
sans rien protéger : un membre qui lirait les tickets d'un projet « désactivé » ne verrait
que des données auxquelles son rôle lui donne déjà droit.

**La création n'est pas optimiste, la modification et la suppression le sont.** Le numéro
d'un ticket est attribué par le serveur : l'afficher avant sa réponse obligerait à
inventer une valeur puis à la corriger. La création insère, relit la ligne créée
(`.select().single()`) et applique l'événement avec les vraies valeurs, pendant que la
modale reste en attente — exactement le `busy` de l'éditeur de tâche. Les autres commandes
gardent le schéma optimiste avec retour arrière.

## 4. Schéma de données

### Colonnes ajoutées à `projects`

| Colonne           | Type    | Défaut  | Rôle                                    |
| ----------------- | ------- | ------- | --------------------------------------- |
| `tickets_enabled` | boolean | `false` | Le projet affiche-t-il ses tickets      |
| `ticket_counter`  | int     | `0`     | Dernier numéro attribué dans ce projet  |

### Table `tickets`

```sql
create type public.ticket_status as enum ('todo', 'doing', 'done');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  number int not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  status public.ticket_status not null default 'todo',
  assignee_id uuid references public.profiles(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);
create index tickets_project_idx on public.tickets(project_id);
create index tickets_task_idx on public.tickets(task_id);
```

`task_id` en `on delete set null` : supprimer une tâche **détache** ses tickets, elle ne
les emporte pas. Un ticket décrit un travail à faire, il survit à la disparition de la
barre qui le portait.

### Triggers

**`tickets_assign_number`** (before insert). Incrémente `projects.ticket_counter` et pose
le numéro obtenu :

```sql
update public.projects set ticket_counter = ticket_counter + 1
 where id = new.project_id returning ticket_counter into n;
```

`update … returning` pose un verrou de ligne sur le projet : deux insertions simultanées
sont sérialisées, aucun doublon possible. La fonction est **`security definer`** — c'est
indispensable et non cosmétique : la policy `projects_update_owner` interdit l'écriture
sur `projects` à un simple éditeur, qui ne pourrait donc pas créer de ticket. Elle ne
touche qu'à `ticket_counter`, sur le projet nommé par la ligne insérée, et l'insertion
elle-même reste soumise à la policy `tickets_insert_editor` : aucune élévation de
privilège. Un rejet par la RLS annule la transaction, compteur inclus, donc pas de trou
dans la numérotation.

**`tickets_number_immutable`** (before update of number). Fige le numéro, sur le modèle de
`profiles.email` et `projects.owner_id` : un numéro qui change fait mentir toutes les
références écrites ailleurs (message, capture, conversation).

**`tickets_check_task`** (before insert or update of `task_id`, `project_id`). Refuse un
rattachement vers une tâche d'un autre projet, sur le modèle de
`check_dependency_project`. La fonction n'est **pas** `security definer` : sa lecture de
`tasks` passe donc par la RLS, et une tâche invisible à l'appelant se comporte comme une
tâche inexistante — c'est le refus voulu.

**`set_updated_at`** : la fonction existante est réutilisée telle quelle.

Toutes les fonctions portent `set search_path = public`, règle uniforme du projet.

### RLS

Grille strictement identique à `tasks` : `select` pour tout membre (`viewer`), `insert`,
`update` et `delete` pour `editor` et au-dessus, via `public.is_member`.

### Migration

Un seul fichier, `supabase/migrations/20260909000001_tickets.sql`, suivi de
`npm run db:types` pour régénérer `lib/supabase/types.ts`.

## 5. Structure des fichiers

```
lib/
  optimistic/run.ts              helper de commande optimiste, EXTRAIT de lib/gantt/commands.ts
  tickets/
    types.ts                     Ticket, TicketStatus, TicketSummary, TicketFilters
    events.ts                    applyEvent : ticket.created / updated / deleted
    store.ts                     Zustand : tickets, epoch, editor, filtres
    repository.ts                rowToTicket, ticketToRow, patchToRow, dépôt Supabase
    commands.ts                  createTicket, updateTicket, deleteTicket
    client-commands.ts           singleton branché sur Supabase + toasts
    validate.ts                  validateTicketInput
app/(app)/projects/[id]/tickets/page.tsx    page serveur
components/
  tickets/
    TicketsPage.tsx              hydratation + agencement
    TicketsToolbar.tsx           retour au Gantt, « + Ticket », bascule de vue, filtres
    TicketBoard.tsx              kanban, trois colonnes
    TicketColumn.tsx
    TicketCard.tsx
    TicketList.tsx               vue tableau
    TicketEditor.tsx             modale de création / édition
    TicketsDisabled.tsx          carte d'activation (propriétaire)
    useTicketDrag.ts             glisser-déposer au pointeur
  ui/Textarea.tsx                nouveau, sur le patron de Input
```

### L'extraction partagée

L'aide `run` de `lib/gantt/commands.ts` porte deux décisions subtiles : le garde-fou par
`epoch` (ne rien annuler si les données affichées ont été remplacées entre-temps) et
l'événement inverse plutôt qu'un instantané global (pour commuter avec les autres
commandes en vol). Dupliquer cela dans `lib/tickets` serait le vrai risque de divergence.
Elle devient donc `createRunner<E>({ store, notify, errorMessage })`, générique sur le
type d'événement, dans `lib/optimistic/run.ts`. Les commandes du Gantt s'y branchent sans
changement de comportement. C'est la seule modification apportée au code existant du
Gantt, hors affichage.

## 6. Écrans

### Page des tickets — `/projects/[id]/tickets`

Lectures groupées, à la manière de la page du Gantt : le projet (dont `tickets_enabled`),
les memberships (rôle et membres), les tickets, et les tâches réduites à `id`, `title`,
`type` pour le sélecteur de rattachement. Même politique d'erreur : une lecture en échec
donne l'écran d'erreur, jamais une liste vide qui pousserait à recréer des tickets
existants.

Tickets désactivés : le propriétaire reçoit la carte d'activation, tout autre membre reçoit
un 404.

**Paramètres d'URL**

| Paramètre           | Effet                                                        |
| ------------------- | ------------------------------------------------------------ |
| `?vue=liste`        | Vue tableau au lieu du kanban (défaut)                       |
| `?nouveau=<taskId>` | Ouvre l'éditeur en création, tâche liée pré-remplie          |

Le choix de vue passe par l'URL et non par le stockage navigateur : il se partage par lien
et ne provoque aucun décalage à l'hydratation.

Un `?nouveau=` qui ne désigne aucune tâche **de ce projet** est ignoré : l'éditeur s'ouvre
en création sans rattachement, plutôt que de refuser ou d'afficher une erreur. Ce paramètre
est une commodité de navigation, pas une saisie à valider.

### Kanban

Trois colonnes — À faire, En cours, Terminé — chacune coiffée de son compteur. Le
glisser-déposer est **au pointeur**, sur le modèle de `useReorderDrag`, et non en
glisser-déposer HTML natif, inutilisable au doigt. Le dépôt change le statut, rien d'autre.

Chaque carte porte, révélées au survol et atteignables au clavier, deux flèches de
déplacement vers la colonne voisine : c'est l'équivalent accessible du geste, et le seul
chemin praticable au clavier.

Une carte affiche son numéro, son titre, l'avatar de son assigné et, si le ticket est
rattaché, le titre de sa tâche.

### Liste

Un tableau trié par numéro, avec trois filtres : statut, assigné, tâche liée. Les filtres
vivent dans le store, pas dans l'URL — ce sont des gestes de consultation, pas un état à
partager.

### Éditeur de ticket

Modale sur le patron de `TaskEditor` : titre, description, statut, assigné, tâche liée.
Même politique d'erreur que partout — validation en message inline, échec de persistance en
toast, jamais les deux pour un même échec. La suppression demande confirmation.

### Style

Cartes à bordure épaisse, sans ombre gratuite. Commandes de déplacement et de suppression
révélées au survol. Suppression sobre (`danger-quiet`), comme sur les cartes de projet.
C'est la ligne déjà tenue ailleurs dans l'application : décor en retrait, commandes au
survol, destructif discret.

## 7. Branchement dans le Gantt

**Lecture supplémentaire.** Quand et seulement quand `tickets_enabled` est vrai, la page du
Gantt lit les tickets rattachés (`id`, `number`, `title`, `status`, `task_id`) et les
groupe par tâche. Cette lecture est **non bloquante**, comme celle des invitations : si
elle échoue, le compteur disparaît et le Gantt reste entier. Le Gantt ne dépend pas des
tickets pour fonctionner.

**Charge utile.** `HydratePayload` gagne `ticketsEnabled: boolean` et
`ticketsByTask: Record<string, TicketSummary[]>`. Le store du Gantt les expose, sans plus.

**Trois points d'affichage.**

- `SidebarRow` : un compteur sur les tâches qui ont des tickets, au format
  **terminés / total** — « 2/5 » se lit « deux tickets terminés sur cinq ». Il s'efface en
  mode compact, comme l'avatar de l'assigné : sur un téléphone, chaque pixel est pris sur
  le titre.
- `TaskEditor` : une section listant les tickets de la tâche avec leur statut, plus un
  bouton de création. Ce bouton **ne crée rien sur place** : il navigue vers
  `/projects/[id]/tickets?nouveau=<taskId>`. C'est ce qui garde le store du Gantt vierge de
  tickets, tout l'intérêt de l'approche retenue.
- `GanttToolbar` : un lien « Tickets », affiché uniquement quand ils sont activés. Ne
  jamais offrir à un lecteur une porte qui se referme en 404.

**Activation.** Une server action `setTicketsEnabled(projectId, enabled)` dans
`app/(app)/projects/actions.ts`, à côté du renommage, suivant le contrôle
`count !== 1` déjà en place. Elle est appelée depuis `ProjectCard`, qui connaît déjà le
rôle et n'affiche ses commandes qu'au propriétaire.

## 8. Tests

**pgTAP** — `supabase/tests/0004_tickets.test.sql` : un non-membre ne lit rien, un lecteur
n'écrit pas, un éditeur écrit, la numérotation est unique et croissante par projet, un
numéro ne peut pas être modifié, un rattachement vers une tâche d'un autre projet est
refusé, supprimer une tâche détache ses tickets sans les supprimer.

**Vitest** — le réducteur d'événements, les commandes (application optimiste, retour
arrière sur échec, création non optimiste), la validation, la conversion des lignes,
l'aide partagée extraite (`lib/optimistic/run.ts`, avec le garde-fou `epoch`), et les
composants nouveaux (éditeur, carte, colonne).

**Playwright** — créer un ticket, le déplacer entre colonnes au pointeur puis au clavier,
le rattacher à une tâche, retrouver le compteur dans la barre latérale du Gantt, ouvrir la
liste et filtrer, vérifier qu'un lecteur ne voit aucune commande d'écriture, vérifier
qu'un projet sans tickets activés n'affiche ni lien ni compteur.

**Attention au seed.** Des specs existantes comptent les lignes du projet démo : y ajouter
des tickets casserait leur décompte et ferait apparaître des compteurs dans une barre
latérale qu'elles inspectent. Le projet démo reste donc **sans tickets et non activé**. Le
seed gagne un troisième projet dédié (alice propriétaire, bob éditeur, carol lectrice),
avec tickets activés, quelques tâches et quelques tickets aux identifiants figés.

## 9. Ordre de livraison

1. Migration, RLS, triggers, tests pgTAP, types régénérés, seed du projet dédié
2. Extraction de `lib/optimistic/run.ts` et rebranchement des commandes du Gantt, puis
   module `lib/tickets` complet avec ses tests unitaires
3. Page des tickets : kanban, liste, éditeur, carte d'activation, composant `Textarea`
4. Branchement dans le Gantt (compteur, section de l'éditeur, lien de barre d'outils),
   server action d'activation, bouton dans la carte de projet, tests de bout en bout

Chaque lot est livrable et testé seul. Le lot 4 est le seul à toucher au Gantt existant.

Le lot 1 ajoute une carte à la liste des projets, par son projet de seed. Vérifié avant
d'écrire cette spec : aucune spec Playwright ne compte les cartes de projet, et le bandeau
de chiffres n'est contrôlé que sur ses libellés, jamais sur ses valeurs. Cet ajout est donc
sans effet sur la suite existante — à revérifier si une spec se met un jour à compter les
cartes.
