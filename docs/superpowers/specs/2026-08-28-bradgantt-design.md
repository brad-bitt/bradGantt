# BradGantt — Design v1

Date : 2026-08-28
Statut : validé en brainstorming, en attente de relecture avant plan d'implémentation.

## 1. Vision

Application web de diagrammes de Gantt collaboratifs, au style **néo-brutaliste** assumé.
Un utilisateur se connecte (Google ou magic-link), crée des projets, y invite des membres
par email et construit un Gantt à la souris (drag, resize, dépendances).

**v1** : collaboration multi-utilisateurs *sans* temps réel (rechargement pour voir les
modifications des autres), mais architecture conçue pour brancher le temps réel en v2 sans
réécrire les composants.

## 2. Périmètre

### Dans la v1
- Auth : Google OAuth + magic-link email (Supabase Auth)
- Projets : créer / renommer / supprimer, liste « mes projets »
- Membres : inviter par email avec rôle `editor` / `viewer`, lien d'invitation, changer un rôle, retirer un membre
- Tâches : créer, éditer (titre, dates, couleur, assigné, % avancement, type), déplacer par drag, redimensionner, supprimer
- Types : tâche, jalon (losange), groupe (repliable, contient des tâches)
- Dépendances fin → début avec flèches, refus des cycles (pas de décalage automatique en cascade)
- Zoom jour / semaine / mois, ligne « aujourd'hui », weekends grisés

### Repoussé en v2
- Temps réel (Supabase Realtime) + curseurs des autres membres
- Décalage automatique en cascade des dépendances
- Commentaires sur tâche, historique d'activité
- Export PNG / PDF

## 3. Stack

| Couche | Choix |
|---|---|
| Front | Next.js 15 (App Router), TypeScript, Tailwind CSS |
| État client | Zustand |
| Backend / BDD / Auth | Supabase (Postgres, Auth, RLS ; Realtime réservé v2) |
| Email d'invitation | Resend |
| Dates | date-fns |
| Tests | Vitest (unitaire), Playwright (e2e), tests SQL des policies |
| Hébergement | Vercel + Supabase cloud |

Rendu Gantt **maison** (HTML/CSS + un overlay SVG pour les flèches), sans librairie Gantt,
pour un contrôle total du style.

## 4. Modèle de données

```sql
profiles      id uuid PK (= auth.users.id), email, display_name, avatar_url, color, created_at
projects      id uuid PK, name, owner_id → profiles, created_at
memberships   project_id → projects, user_id → profiles, role ('owner'|'editor'|'viewer'), PK (project_id, user_id)
invitations   id uuid PK, project_id → projects, email, role ('editor'|'viewer'), token text unique,
              invited_by → profiles, created_at, accepted_at nullable
tasks         id uuid PK, project_id → projects, parent_id → tasks nullable, title,
              type ('task'|'milestone'|'group'), start_date date, end_date date,
              progress int 0-100, color text, assignee_id → profiles nullable,
              sort_order int, collapsed bool, created_at, updated_at
dependencies  id uuid PK, project_id → projects, from_task_id → tasks, to_task_id → tasks,
              UNIQUE (from_task_id, to_task_id), CHECK (from_task_id <> to_task_id)
```

Règles :
- Un **jalon** a `start_date = end_date`. Un **groupe** a des dates calculées côté client
  (min/max de ses enfants) ; ses colonnes dates sont ignorées.
- `parent_id` : un seul niveau de profondeur en v1 (un groupe ne contient pas de groupe).
- Suppression d'une tâche → cascade sur ses dépendances et ses enfants.
- Suppression d'un projet → cascade sur tout.
- `updated_at` maintenu par trigger ; servira à la détection de conflits en v2.

### Triggers et fonctions
- `handle_new_user()` : à l'insertion dans `auth.users`, crée la ligne `profiles`
  (email, nom/avatar depuis les métadonnées Google si présents) et attribue une `color`
  de la palette en round-robin.
- `create_project(name)` : crée le projet **et** la membership `owner` dans une transaction.
- `accept_invitation(token)` (`security definer`) :
  1. charge l'invitation non acceptée ; introuvable → erreur `invitation_not_found`
  2. si `lower(auth.email()) <> lower(invitation.email)` → erreur `email_mismatch`
  3. insère la membership (upsert, sans rétrograder un owner), marque `accepted_at`
  4. retourne `project_id`

### RLS (Row Level Security)
Toutes les tables ont RLS activée. Helper `is_member(project_id, min_role)`.
- `profiles` : lecture par tout utilisateur connecté (pour afficher les membres et retrouver un invité par email), écriture par soi-même **sauf la colonne `email`, figée par trigger** (source de vérité : `auth.users`) — sinon on usurpe une invitation en se donnant l'email de la cible.
- `projects` : SELECT si membre ; UPDATE/DELETE si owner ; INSERT uniquement via `create_project`.
- `memberships` : SELECT si membre du projet ; INSERT/UPDATE/DELETE si owner ; interdit de supprimer ou rétrograder la ligne owner. **Les clauses `USING` et `WITH CHECK` de l'UPDATE portent toutes deux `is_member(project_id, 'owner')`** : sans cela, l'owner d'un projet quelconque peut déplacer une ligne membership vers un projet étranger et s'y ajouter (élévation de privilège).
- `invitations` : SELECT/INSERT/DELETE si owner du projet.
- `tasks`, `dependencies` : SELECT si membre ; INSERT/UPDATE/DELETE si `editor` ou `owner`.

## 5. Structure du projet

```
bradgantt/
  app/
    (auth)/login/page.tsx          bouton Google + champ magic-link
    auth/callback/route.ts         retour OAuth / OTP Supabase
    (app)/layout.tsx               guard session + header
    (app)/projects/page.tsx        liste « mes projets »
    (app)/projects/[id]/page.tsx   le Gantt
    invite/[token]/page.tsx        acceptation d'invitation
    api/invitations/route.ts       POST : créer l'invitation + envoyer l'email (Resend)
  components/
    ui/                            Button, Input, Select, Dialog, Avatar, Badge, Checkbox
    gantt/                         GanttView, Sidebar, Timeline, TimelineHeader, TaskRow,
                                   TaskBar, MilestoneMark, GroupBar, DependencyArrows,
                                   TaskEditor, ZoomControls
    project/                       ProjectCard, NewProjectDialog, MembersDialog, InviteForm
  lib/
    supabase/                      client.ts (navigateur), server.ts, middleware.ts, types.ts (généré)
    gantt/
      store.ts                     Zustand : tasks, dependencies, members, zoom, selection, dragState
      commands.ts                  createTask, updateTask, moveTask, resizeTask, deleteTask,
                                   linkTasks, unlinkTasks, toggleGroup — optimiste + persist + rollback
      geometry.ts                  pur : date↔px, largeur de barre, tracés des flèches
      scheduling.ts                pur : détection de cycle, snap au jour, bornes d'un groupe
      palette.ts                   couleurs brutalistes
    auth/                          getSession, requireUser
  supabase/
    migrations/                    SQL : tables, triggers, fonctions, policies
    seed.sql                       données de dev
  tests/
    unit/                          Vitest : geometry, scheduling, commands (Supabase mocké)
    rls/                           tests SQL des policies (pgTAP ou script node)
    e2e/                           Playwright
  middleware.ts                    redirection vers /login avec `next=` si pas de session
```

## 6. Flux de données (architecture « store + commandes »)

```
UI (composants gantt) ──lit──► store (Zustand)
      │
      └──appelle──► commands.ts ──1. applique au store (optimiste)
                                 ──2. persiste via Supabase
                                 ──3. en cas d'erreur : rollback + toast
```

- Les composants **ne parlent jamais à Supabase**. Ils lisent le store et appellent des commandes.
- Chaque commande produit un **événement typé** (`{ type: 'task.moved', taskId, start, end }`)
  appliqué au store par un réducteur `applyEvent(state, event)`. En v2, le canal Realtime
  injectera les événements des autres membres dans ce même réducteur.
- Chargement initial : page serveur charge projet + membres + tasks + dependencies, hydrate le store.
- Pendant un drag, seul `dragState` du store bouge (60 fps) ; la commande n'est envoyée
  qu'au relâchement (`pointerup`).
- Un `viewer` voit le Gantt en lecture seule : commandes désactivées côté client, et RLS
  refuse quoi qu'il arrive côté serveur.

## 7. Rendu du Gantt

Layout : sidebar gauche fixe (~300 px) + timeline droite en scroll horizontal ; scroll
vertical synchronisé entre les deux.

- **Sidebar** : arbre à un niveau (groupes → tâches), nom, avatar de l'assigné, chevron de
  repli, bouton « + » pour ajouter, drag vertical pour réordonner (`sort_order`).
- **Timeline** : header à deux niveaux (mois / jours ou semaines selon zoom), grille verticale,
  weekends grisés, ligne « aujourd'hui » rouge épaisse. Plage affichée : du min des dates − 7 j
  au max + 30 j (bornes minimales : aujourd'hui ± 30 j).
- **Géométrie** (`geometry.ts`) : `pxPerDay` = 40 (jour) / 12 (semaine) / 4 (mois) ;
  `x = differenceInDays(date, rangeStart) * pxPerDay` ; hauteur de ligne 44 px.
- **TaskBar** : `div` en `position:absolute`, bordure 3 px noire, ombre dure, remplissage du
  `% progress` en hachures. **MilestoneMark** : losange noir centré sur la date.
  **GroupBar** : barre noire fine couvrant min/max des enfants.
- **DependencyArrows** : un seul `<svg>` overlay ; chaque flèche sort à droite de la source,
  entre à gauche de la cible, tracé en angles droits, pointe triangulaire. Recalculé à chaque
  changement du store (y compris pendant un drag).

### Interactions (pointer events natifs)
| Geste | Effet |
|---|---|
| Drag corps de barre | déplacer (snap au jour), conserve la durée |
| Drag bord gauche/droit (zone 8 px) | redimensionner ; durée min 1 jour |
| Drag depuis la poignée ronde en bout de barre → relâcher sur une autre barre | créer une dépendance ; refusée si cycle ou doublon (toast) |
| Double-clic barre ou ligne sidebar | ouvrir `TaskEditor` |
| Clic | sélectionner ; `Suppr` supprime (confirmation) ; `Échap` désélectionne |
| Clic flèche | sélectionner la dépendance ; `Suppr` la supprime |
| Clic chevron groupe | replier / déplier (persisté dans `collapsed`) |

## 8. Auth & invitations

- **Login** : Supabase Auth, providers Google et OTP email. `middleware.ts` protège `(app)/*`
  et `/invite/*` : sans session → `/login?next=<url>`.
- **Callback** : `/auth/callback` échange le code, puis redirige vers `next` ou `/projects`.
- **Inviter** (owner uniquement, dans `MembersDialog`) : `POST /api/invitations` `{ projectId, email, role }` :
  1. vérifie que l'appelant est owner
  2. si un `profile` avec cet email existe → crée directement la membership, email « tu as été ajouté »
  3. sinon → insère `invitations` avec token aléatoire (32 octets), envoie l'email avec le lien `/invite/<token>`
- **Accepter** : `/invite/[token]` appelle `accept_invitation(token)` ; succès → redirection
  vers `/projects/<id>` ; `email_mismatch` → page d'erreur « Cette invitation est destinée à une
  autre adresse » avec bouton « changer de compte » ; `invitation_not_found` → « lien invalide ou déjà utilisé ».
- **Gestion** : l'owner change un rôle ou retire un membre ; la ligne owner est intouchable.
  Pas de transfert d'ownership en v1.

## 9. Design system néo-brutaliste

Tokens Tailwind (`tailwind.config.ts`) :
- Fond `#FDF6E3` (crème), encre `#111111`, blanc `#FFFFFF`
- Palette accents / membres / tâches : jaune `#FFD500`, rose `#FF6B9D`, bleu `#3B82F6`,
  vert `#22C55E`, orange `#FF8A00`, violet `#A855F7` ; danger rouge `#EF4444`
- Bordure : `3px solid #111` partout ; `border-radius: 0`
- Ombre : `4px 4px 0 #111` ; hover `6px 6px 0 #111` ; actif `0 0 0` + `translate(4px,4px)`
- Typo : **Archivo Black** (titres), **Space Grotesk** (UI), **JetBrains Mono** (dates, nombres)
- Sélection : contour `3px dashed #111` ; focus clavier idem
- Grille de la timeline visible (lignes 1 px `#111` à 20 % d'opacité), weekends hachurés

Composants `ui/` : `Button` (variants primary / secondary / danger / ghost), `Input`, `Select`,
`Dialog` (bordure + ombre 8 px), `Avatar` (carré, couleur du membre, initiales), `Badge`,
`Checkbox`, `Toast`.

## 10. Gestion des erreurs

- Échec de persistance d'une commande → rollback du store + toast rouge « Modification non
  enregistrée ». Pas de file de retry en v1.
- Perte de session (401) → redirection `/login?next=`.
- Dépendance refusée (cycle, doublon, vers soi-même) → toast, aucune modification.
- Erreurs d'invitation (email invalide, déjà membre, déjà invité) → message inline dans le formulaire.

## 11. Tests

- **Unitaires (Vitest)** : `geometry.ts` (date↔px, tracés), `scheduling.ts` (cycle, snap,
  bornes de groupe, durée min), `commands.ts` (application optimiste, rollback sur erreur,
  événements émis) avec client Supabase mocké.
- **RLS** : pour chaque table, vérifier qu'un non-membre ne lit rien, qu'un viewer ne peut pas
  écrire, qu'un editor ne touche pas aux memberships, qu'on ne supprime pas l'owner.
- **E2E (Playwright)** : login (magic-link en env de test) → créer projet → créer tâche → drag →
  resize → dépendance → inviter → accepter avec le bon email → refus avec un autre email →
  viewer en lecture seule.

## 12. Préparation v2 (temps réel)

Ce qui est en place dès la v1 pour rendre la v2 mécanique :
- Réducteur `applyEvent` unique, déjà utilisé par les commandes locales
- Événements typés avec `taskId` et `updatedAt` pour arbitrer les conflits
- `updated_at` en base ; tables publiables sur Supabase Realtime sans migration de schéma
- Composants sans accès Supabase : brancher le canal = un seul hook `useRealtime(projectId)`
