# BradGantt — Tickets (module optionnel) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ajouter à BradGantt un backlog de tickets par projet, désactivé par défaut, rattachable aux tâches du Gantt, avec vue kanban et vue liste.

**Architecture:** Un module `lib/tickets` calqué sur `lib/gantt` (types, réducteur d'événements, store Zustand, dépôt Supabase, commandes) vit sur sa propre route `/projects/[id]/tickets`. Le store du Gantt ne reçoit qu'un résumé en lecture des tickets rattachés, jamais les tickets eux-mêmes. L'aide au retour arrière des commandes, aujourd'hui enfermée dans `lib/gantt/commands.ts`, est extraite dans `lib/optimistic/run.ts` et partagée par les deux modules.

**Tech Stack:** Next.js 15 (App Router), TypeScript, Tailwind v4, Supabase (Postgres, Auth, RLS), Zustand, Vitest, pgTAP, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-09-bradgantt-tickets-design.md`

## Global Constraints

- **Branche de travail : `feat/04-tickets`.** Elle existe déjà et porte la spec. Ne jamais commiter sur `master`.
- **`npx supabase db reset` et `npx supabase db push` ne doivent JAMAIS être lancés par l'agent.** Ils sont bloqués dans cet environnement. Quand une tâche en a besoin, s'arrêter et demander à Léo de lancer `! npx supabase db reset` dans sa session, puis reprendre.
- **Ports non standards :** application sur `3100`, API Supabase sur `54421`, Postgres sur `54422`, Studio sur `54423`, boîte mail sur `54424`.
- **Politique d'erreur du projet :** une erreur de **validation** part en message inline dans le formulaire, un échec de **persistance** part en toast. Jamais les deux pour un même échec.
- **Écritures sur une seule ligne :** toujours `{ count: 'exact' }` puis rejet si `count !== 1`. `count === 0` laisserait passer un `count` null (en-tête absente) comme un faux succès alors que la RLS a refusé en silence.
- **Toutes les fonctions SQL portent `set search_path = public`,** y compris celles qui n'en ont pas besoin. Règle uniforme du projet.
- **Isolation inter-projets :** toute lecture de `tasks`, `dependencies` ou `tickets` dans une page de projet porte `.eq('project_id', id)`. La RLS autorise la lecture de TOUS les projets dont on est membre, elle ne filtre pas sur CE projet-ci.
- **Langue :** interface et commentaires en français. Les commentaires expliquent le **pourquoi**, jamais le quoi.
- **Style :** néo-brutalisme discipliné. Bordures `border-[3px] border-ink`, pas d'ombre gratuite, commandes révélées au survol (`opacity-0 group-hover/...:opacity-100 focus-visible:opacity-100 touch:opacity-100`), destructif sobre (`variant="danger-quiet"`).
- **Ne jamais écrire dans « Projet démo » depuis un test e2e.** Des specs existantes comptent ses lignes. Les tests de tickets travaillent sur « Projet tickets », ajouté au seed par la tâche 2.
- **Commandes de vérification :** `npm test` (Vitest), `npm run test:db` (pgTAP), `npm run test:e2e` (Playwright), `npm run typecheck`, `npm run lint`.
- **Chaque commit se termine par ce bloc**, en dernier paragraphe du message :

```
Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_012m8LcGJfA4esJ2kpEFVZEE
```

---

## Carte des fichiers

**Créés**

| Fichier | Responsabilité |
| --- | --- |
| `supabase/migrations/20260909000001_tickets.sql` | Table, enum, triggers, RLS, colonnes ajoutées à `projects` |
| `supabase/tests/0004_tickets.test.sql` | pgTAP : RLS, numérotation, immutabilité, rattachement croisé |
| `lib/optimistic/run.ts` | Aide de commande optimiste, extraite de `lib/gantt/commands.ts` |
| `lib/tickets/types.ts` | `Ticket`, `TicketStatus`, `TicketSummary`, `TicketPatch`, filtres |
| `lib/tickets/events.ts` | Réducteur `applyTicketEvent` |
| `lib/tickets/store.ts` | Store Zustand des tickets |
| `lib/tickets/repository.ts` | Conversions de lignes + dépôt Supabase |
| `lib/tickets/validate.ts` | Validation du formulaire de ticket |
| `lib/tickets/commands.ts` | `createTicket`, `updateTicket`, `deleteTicket` |
| `lib/tickets/client-commands.ts` | Singleton navigateur branché sur Supabase et les toasts |
| `lib/tickets/summary.ts` | Filtres de la vue liste et regroupement par tâche pour le Gantt |
| `app/(app)/projects/[id]/tickets/page.tsx` | Page serveur |
| `components/ui/Textarea.tsx` | Champ multiligne |
| `components/tickets/TicketsPage.tsx` | Hydratation + agencement |
| `components/tickets/TicketsToolbar.tsx` | Retour Gantt, création, bascule de vue |
| `components/tickets/TicketBoard.tsx` | Kanban |
| `components/tickets/TicketColumn.tsx` | Colonne de statut |
| `components/tickets/TicketCard.tsx` | Carte de ticket |
| `components/tickets/TicketList.tsx` | Vue tableau + filtres |
| `components/tickets/TicketEditor.tsx` | Modale de création / édition |
| `components/tickets/TicketsDisabled.tsx` | Carte d'activation |
| `components/tickets/useTicketDrag.ts` | Glisser-déposer au pointeur |

**Modifiés**

| Fichier | Modification |
| --- | --- |
| `lib/gantt/commands.ts` | Utilise `createRunner` au lieu de son `run` interne |
| `lib/gantt/store.ts` | `ticketsEnabled` et `ticketsByTask` dans l'état et la charge utile |
| `lib/gantt/types.ts` | Rien. Les types de tickets vivent dans `lib/tickets/types.ts` |
| `app/(app)/projects/[id]/page.tsx` | Lecture non bloquante des tickets rattachés |
| `app/(app)/projects/page.tsx` | Lit `tickets_enabled` pour les cartes |
| `app/(app)/projects/actions.ts` | Action `setTicketsEnabled` |
| `components/project/ProjectCard.tsx` | Bouton d'activation (propriétaire) |
| `components/gantt/GanttToolbar.tsx` | Lien « Tickets » quand activés |
| `components/gantt/SidebarRow.tsx` | Compteur terminés / total |
| `components/gantt/TaskEditor.tsx` | Section « Tickets » + bouton de création |
| `supabase/seed.sql` | Projet « Projet tickets » avec tâches et tickets |

---

# Lot 1 — Base de données

## Task 1: Migration, triggers et RLS des tickets

**Files:**
- Create: `supabase/migrations/20260909000001_tickets.sql`
- Create: `supabase/tests/0004_tickets.test.sql`
- Modify: `lib/supabase/types.ts` (régénéré, jamais édité à la main)

**Interfaces:**
- Consomme : `public.is_member(uuid, member_role)` et `public.set_updated_at()`, déjà en place.
- Produit : la table `public.tickets`, l'enum `public.ticket_status`, et les colonnes `projects.tickets_enabled` / `projects.ticket_counter`. Toutes les tâches suivantes en dépendent.

- [ ] **Step 1: Écrire le test pgTAP (il échoue, la table n'existe pas)**

Créer `supabase/tests/0004_tickets.test.sql` :

```sql
begin;
create extension if not exists pgtap with schema extensions;

-- Indépendant de supabase/seed.sql (mêmes UUID de test) : le rollback final rend la base intacte.
delete from auth.users;

select plan(17);

create schema tests;
grant usage on schema tests to authenticated;
create function tests.login_as(uid uuid, mail text) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', uid, 'email', mail, 'role', 'authenticated')::text, true);
  perform set_config('role', 'authenticated', true);
end $$;
create function tests.logout() returns void language plpgsql as $$
begin
  perform set_config('role', 'postgres', true);
  perform set_config('request.jwt.claims', '', true);
end $$;

insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'bob@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'carol@test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'dave@test.local');

-- Alice owner du projet A, bob editor, carol viewer, dave non-membre.
-- Alice possède aussi un projet B, qui ne sert qu'à vérifier le refus de rattachement croisé.
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select public.create_project('Projet tickets');
select public.create_project('Projet B');
select tests.logout();

create table tests.ctx as select id as project_id from public.projects where name = 'Projet tickets';
grant select on tests.ctx to authenticated;
create table tests.ctxb as select id as project_id from public.projects where name = 'Projet B';
grant select on tests.ctxb to authenticated;

insert into public.memberships (project_id, user_id, role)
select project_id, 'a0000000-0000-0000-0000-000000000002', 'editor' from tests.ctx;
insert into public.memberships (project_id, user_id, role)
select project_id, 'a0000000-0000-0000-0000-000000000003', 'viewer' from tests.ctx;

insert into public.tasks (id, project_id, title, start_date, end_date)
select 'b0000000-0000-0000-0000-000000000001', project_id, 'Tâche A', '2026-09-01', '2026-09-03' from tests.ctx;
insert into public.tasks (id, project_id, title, start_date, end_date)
select 'b0000000-0000-0000-0000-0000000000b1', project_id, 'Tâche B', '2026-09-01', '2026-09-03' from tests.ctxb;

-- RLS activée sur la nouvelle table
select is((select count(*) filter (where relrowsecurity) from pg_class
  where relnamespace = 'public'::regnamespace and relname = 'tickets'), 1::bigint, 'RLS activée sur tickets');

-- Un éditeur crée : la numérotation démarre à 1 puis s'incrémente, sans que l'éditeur
-- n'ait le droit d'écrire sur `projects` (le trigger est security definer, c'est tout l'enjeu).
select tests.login_as('a0000000-0000-0000-0000-000000000002', 'bob@test.local');
insert into public.tickets (id, project_id, title)
select 'f0000000-0000-0000-0000-000000000001', project_id, 'Premier' from tests.ctx;
insert into public.tickets (id, project_id, title)
select 'f0000000-0000-0000-0000-000000000002', project_id, 'Deuxième' from tests.ctx;
select is((select number from public.tickets where id = 'f0000000-0000-0000-0000-000000000001'), 1, 'éditeur : premier ticket numéroté 1');
select is((select number from public.tickets where id = 'f0000000-0000-0000-0000-000000000002'), 2, 'éditeur : deuxième ticket numéroté 2');
select is((select ticket_counter from public.projects, tests.ctx where projects.id = ctx.project_id), 2, 'le compteur du projet suit');
select is((select status from public.tickets where id = 'f0000000-0000-0000-0000-000000000001'), 'todo'::public.ticket_status, 'statut par défaut : todo');

-- Le numéro est figé
select throws_ok(
  $$ update public.tickets set number = 99 where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'ticket_number_is_read_only', 'le numéro d''un ticket est figé');

-- Rattachement : une tâche du même projet passe, une tâche d'un autre projet est refusée
update public.tickets set task_id = 'b0000000-0000-0000-0000-000000000001' where id = 'f0000000-0000-0000-0000-000000000001';
select is((select task_id from public.tickets where id = 'f0000000-0000-0000-0000-000000000001'),
  'b0000000-0000-0000-0000-000000000001'::uuid, 'rattachement à une tâche du même projet accepté');
select throws_ok(
  $$ update public.tickets set task_id = 'b0000000-0000-0000-0000-0000000000b1' where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'ticket_task_cross_project', 'rattachement à une tâche d''un autre projet refusé');
select tests.logout();

-- Un lecteur lit mais n'écrit pas
select tests.login_as('a0000000-0000-0000-0000-000000000003', 'carol@test.local');
select is((select count(*) from public.tickets), 2::bigint, 'lecteur : voit les tickets du projet');
-- Une insertion refusée par un `with check` LÈVE une erreur, elle ne rend pas zéro ligne :
-- c'est `throws_ok` qui exprime le refus, pas un comptage.
select throws_ok(
  $$ insert into public.tickets (project_id, title) select project_id, 'Interdit' from tests.ctx $$,
  '42501', 'lecteur : insertion refusée par la RLS');
select tests.logout();

-- Un non-membre ne voit rien
select tests.login_as('a0000000-0000-0000-0000-000000000004', 'dave@test.local');
select is((select count(*) from public.tickets), 0::bigint, 'non-membre : aucun ticket');
select tests.logout();

-- Supprimer une tâche DÉTACHE ses tickets, elle ne les emporte pas
select tests.login_as('a0000000-0000-0000-0000-000000000002', 'bob@test.local');
delete from public.tasks where id = 'b0000000-0000-0000-0000-000000000001';
select is((select count(*) from public.tickets where id = 'f0000000-0000-0000-0000-000000000001'), 1::bigint,
  'suppression de tâche : le ticket survit');
select is((select task_id from public.tickets where id = 'f0000000-0000-0000-0000-000000000001'), null,
  'suppression de tâche : le ticket est détaché');

-- Un éditeur modifie et supprime
update public.tickets set status = 'done' where id = 'f0000000-0000-0000-0000-000000000002';
select is((select status from public.tickets where id = 'f0000000-0000-0000-0000-000000000002'),
  'done'::public.ticket_status, 'éditeur : modifie un statut');
delete from public.tickets where id = 'f0000000-0000-0000-0000-000000000002';
select is((select count(*) from public.tickets), 1::bigint, 'éditeur : supprime un ticket');
select tests.logout();

-- Supprimer le projet emporte ses tickets
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
delete from public.projects where id = (select project_id from tests.ctx);
select is((select count(*) from public.tickets), 0::bigint, 'suppression du projet : ses tickets partent avec');
select tests.logout();

-- `tickets_enabled` est faux par défaut : un projet existant ne voit rien changer
select is((select count(*) filter (where not tickets_enabled) from public.projects), (select count(*) from public.projects),
  'tickets_enabled est faux par défaut sur tous les projets');

select * from finish();
rollback;
```


- [ ] **Step 2: Demander le reset et vérifier que le test échoue**

L'agent ne peut pas lancer `db reset`. Écrire à Léo :

> Peux-tu lancer `! npx supabase db reset` ? J'ai besoin d'une base fraîche pour vérifier que le nouveau test pgTAP échoue avant d'écrire la migration.

Puis lancer : `npm run test:db`
Attendu : ÉCHEC sur `0004_tickets.test.sql`, avec `relation "public.tickets" does not exist`.

- [ ] **Step 3: Écrire la migration**

Créer `supabase/migrations/20260909000001_tickets.sql` :

```sql
-- ===== Tickets : un backlog optionnel par projet =====
-- Désactivé par défaut. `tickets_enabled` est un choix d'AFFICHAGE, jamais une frontière de
-- sécurité : la RLS ci-dessous l'ignore totalement. Le mêler aux policies compliquerait les
-- tests sans rien protéger — un membre qui lirait les tickets d'un projet « désactivé » ne
-- verrait que des données auxquelles son rôle lui donne déjà droit.
alter table public.projects
  add column tickets_enabled boolean not null default false,
  add column ticket_counter int not null default 0;

comment on column public.projects.ticket_counter is
  'Dernier numéro de ticket attribué dans ce projet. Incrémenté par le trigger '
  'tickets_assign_number, jamais écrit par l''application.';

create type public.ticket_status as enum ('todo', 'doing', 'done');

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  number int not null,
  title text not null check (char_length(trim(title)) between 1 and 200),
  description text not null default '' check (char_length(description) <= 5000),
  status public.ticket_status not null default 'todo',
  assignee_id uuid references public.profiles(id) on delete set null,
  -- `set null` et non `cascade` : un ticket décrit un travail à faire, il survit à la
  -- disparition de la barre qui le portait. Supprimer une tâche DÉTACHE ses tickets.
  task_id uuid references public.tasks(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, number)
);
create index tickets_project_idx on public.tickets(project_id);
create index tickets_task_idx on public.tickets(task_id);

-- ===== Numérotation =====
-- `update … returning` pose un verrou de ligne sur le projet : deux insertions simultanées
-- sont sérialisées, aucun doublon possible.
--
-- `security definer` est INDISPENSABLE et non cosmétique : incrémenter le compteur est une
-- écriture sur `projects`, que la policy projects_update_owner réserve au propriétaire. Sans
-- cela, un simple éditeur ne pourrait pas créer de ticket. La fonction ne touche qu'à
-- `ticket_counter`, sur le projet nommé par la ligne insérée, et l'insertion elle-même reste
-- soumise à tickets_insert_editor : aucune élévation de privilège. Un rejet par la RLS annule
-- la transaction, compteur inclus, donc pas de trou dans la numérotation.
create or replace function public.assign_ticket_number() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  update public.projects set ticket_counter = ticket_counter + 1
   where id = new.project_id
  returning ticket_counter into n;
  if n is null then raise exception 'project_not_found'; end if;
  new.number := n;
  return new;
end $$;

create trigger tickets_assign_number
before insert on public.tickets
for each row execute function public.assign_ticket_number();

-- Numéro figé, même verrou que profiles.email et projects.owner_id : un numéro qui change
-- fait mentir toutes les références écrites ailleurs (message, capture, conversation).
create or replace function public.check_ticket_number_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.number is distinct from old.number then
    raise exception 'ticket_number_is_read_only';
  end if;
  return new;
end $$;

create trigger tickets_number_immutable
before update of number on public.tickets
for each row execute function public.check_ticket_number_immutable();

-- ===== Rattachement à une tâche du MÊME projet =====
-- Volontairement PAS security definer : la lecture de `tasks` passe donc par la RLS, et une
-- tâche invisible à l'appelant se comporte comme une tâche inexistante — c'est le refus voulu.
create or replace function public.check_ticket_task_project() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.task_id is null then return new; end if;
  if not exists (select 1 from public.tasks where id = new.task_id and project_id = new.project_id) then
    raise exception 'ticket_task_cross_project';
  end if;
  return new;
end $$;

create trigger tickets_check_task
before insert or update of task_id, project_id on public.tickets
for each row execute function public.check_ticket_task_project();

create trigger tickets_set_updated_at
before update on public.tickets
for each row execute function public.set_updated_at();

-- ===== RLS : grille strictement identique à `tasks` =====
alter table public.tickets enable row level security;

create policy "tickets_select_member" on public.tickets
  for select to authenticated using (public.is_member(project_id, 'viewer'));
create policy "tickets_insert_editor" on public.tickets
  for insert to authenticated with check (public.is_member(project_id, 'editor'));
create policy "tickets_update_editor" on public.tickets
  for update to authenticated using (public.is_member(project_id, 'editor')) with check (public.is_member(project_id, 'editor'));
create policy "tickets_delete_editor" on public.tickets
  for delete to authenticated using (public.is_member(project_id, 'editor'));
```

- [ ] **Step 4: Demander le reset et vérifier que le test passe**

Écrire à Léo :

> La migration est écrite. Peux-tu relancer `! npx supabase db reset` ?

Puis : `npm run test:db`
Attendu : `0004_tickets.test.sql` au vert, et les trois fichiers pgTAP existants toujours au vert.

- [ ] **Step 5: Régénérer les types Supabase**

Run: `npm run db:types`
Puis : `npm run typecheck`
Attendu : pas d'erreur. `lib/supabase/types.ts` contient désormais `tickets` et `ticket_status`.

Ce fichier est **généré** : ne jamais l'éditer à la main.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260909000001_tickets.sql supabase/tests/0004_tickets.test.sql lib/supabase/types.ts
git commit -m "feat(tickets): table, numérotation par projet et RLS"
```

---

## Task 2: Projet de seed dédié aux tickets

**Files:**
- Modify: `supabase/seed.sql`

**Interfaces:**
- Produit : le projet `c0000000-0000-0000-0000-000000000003` (« Projet tickets »), avec `tickets_enabled = true`, deux tâches et trois tickets aux identifiants figés. Les tests Playwright de la tâche 15 s'y appuient.

- [ ] **Step 1: Ajouter le projet au seed**

Ajouter à la fin de `supabase/seed.sql` :

```sql
-- Troisième projet, dédié aux TICKETS. Il existe parce que « Projet démo » ne peut pas
-- accueillir de tickets : des specs Playwright comptent ses lignes et inspectent sa sidebar,
-- où un compteur de tickets apparaîtrait. Ce projet-ci est le seul avec `tickets_enabled`.
-- Alice owner, bob editor, carol viewer : les trois rôles sont couverts sans toucher au démo.
insert into public.projects (id, name, owner_id, tickets_enabled)
values ('c0000000-0000-0000-0000-000000000003', 'Projet tickets', 'a0000000-0000-0000-0000-000000000001', true);
insert into public.memberships (project_id, user_id, role) values
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000001', 'owner'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000002', 'editor'),
  ('c0000000-0000-0000-0000-000000000003', 'a0000000-0000-0000-0000-000000000003', 'viewer');

insert into public.tasks (id, project_id, title, type, start_date, end_date, color, sort_order) values
  ('d0000000-0000-0000-0000-0000000000a1', 'c0000000-0000-0000-0000-000000000003', 'Développement', 'task', current_date, current_date + 5, '#5B9DFF', 0),
  ('d0000000-0000-0000-0000-0000000000a2', 'c0000000-0000-0000-0000-000000000003', 'Recette', 'task', current_date + 6, current_date + 9, '#3ECF8E', 1);

-- Le NUMÉRO n'est pas fourni : le trigger tickets_assign_number l'attribue et incrémente
-- projects.ticket_counter. L'ordre de ces trois insertions fixe donc #1, #2, #3.
insert into public.tickets (id, project_id, title, description, status, assignee_id, task_id) values
  ('f0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000003', 'Brancher la connexion', 'Le formulaire doit accepter un email et un mot de passe.', 'done', 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000a1'),
  ('f0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000003', 'Dessiner la frise', '', 'doing', 'a0000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-0000000000a1'),
  ('f0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000003', 'Écrire le mode d''emploi', '', 'todo', null, null);
```

- [ ] **Step 2: Demander le reset et vérifier le seed**

Écrire à Léo :

> Le seed a un troisième projet. Peux-tu lancer `! npx supabase db reset` ?

Puis vérifier la numérotation :

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 54422 -U postgres -d postgres -c \
  "select number, title, status from public.tickets order by number"
```

Attendu : trois lignes numérotées 1, 2, 3 dans l'ordre du seed.

- [ ] **Step 3: Vérifier que la suite existante n'a pas bougé**

Run: `npm run test:e2e`
Attendu : toute la suite au vert. Le troisième projet ajoute une carte à la liste, ce qui est sans effet : aucune spec ne compte les cartes de projet, et le bandeau de chiffres n'est contrôlé que sur ses libellés.

Si une spec casse ici, ne pas contourner en retirant le projet du seed : lire l'échec, il révèle une dépendance implicite au nombre de projets qui vaut d'être nommée.

- [ ] **Step 4: Commit**

```bash
git add supabase/seed.sql
git commit -m "test(tickets): projet de seed dédié, le démo reste sans tickets"
```

---

# Lot 2 — Module `lib/tickets`

## Task 3: Extraire l'aide de commande optimiste

**Files:**
- Create: `lib/optimistic/run.ts`
- Create: `tests/unit/lib/optimistic/run.test.ts`
- Modify: `lib/gantt/commands.ts:60-90` (la fonction `run` interne disparaît)

**Interfaces:**
- Produit :
  - `createRunner<E>(deps: RunnerDeps<E>): Runner<E>`
  - `type Runner<E> = (event: E | E[], inverse: E[], persist: () => Promise<void>) => Promise<boolean>`
  - `interface RunnerDeps<E> { store: OptimisticStore<E>; notify: (message: string) => void; errorMessage: string }`
  - `interface OptimisticStore<E> { getState(): { epoch: number; apply: (event: E) => void } }`
- La tâche 6 consomme `createRunner<TicketEvent>`.

- [ ] **Step 1: Écrire le test de l'aide extraite**

Créer `tests/unit/lib/optimistic/run.test.ts` :

```ts
import { createRunner, type OptimisticStore } from '@/lib/optimistic/run'

type FakeEvent = { type: 'a' } | { type: 'b' }

function fakeStore(epoch = 1) {
  const applied: FakeEvent[] = []
  const state = { epoch, apply: (e: FakeEvent) => { applied.push(e) } }
  const store: OptimisticStore<FakeEvent> = { getState: () => state }
  return { store, state, applied }
}

describe('createRunner', () => {
  it('applique les événements puis persiste, et ne touche pas à l\'inverse en cas de succès', async () => {
    const { store, applied } = fakeStore()
    const notify = vi.fn()
    const run = createRunner<FakeEvent>({ store, notify, errorMessage: 'raté' })

    const ok = await run([{ type: 'a' }, { type: 'b' }], [{ type: 'b' }], async () => {})

    expect(ok).toBe(true)
    expect(applied).toEqual([{ type: 'a' }, { type: 'b' }])
    expect(notify).not.toHaveBeenCalled()
  })

  it('accepte un événement seul comme un tableau', async () => {
    const { store, applied } = fakeStore()
    const run = createRunner<FakeEvent>({ store, notify: vi.fn(), errorMessage: 'raté' })
    await run({ type: 'a' }, [], async () => {})
    expect(applied).toEqual([{ type: 'a' }])
  })

  it('rejoue l\'inverse et signale quand la persistance échoue', async () => {
    const { store, applied } = fakeStore()
    const notify = vi.fn()
    const run = createRunner<FakeEvent>({ store, notify, errorMessage: 'raté' })

    const ok = await run({ type: 'a' }, [{ type: 'b' }], async () => { throw new Error('boum') })

    expect(ok).toBe(false)
    expect(applied).toEqual([{ type: 'a' }, { type: 'b' }])
    expect(notify).toHaveBeenCalledWith('raté')
  })

  it('n\'annule RIEN si les données ont été remplacées pendant l\'écriture, mais signale quand même', async () => {
    const { store, state, applied } = fakeStore()
    const notify = vi.fn()
    const run = createRunner<FakeEvent>({ store, notify, errorMessage: 'raté' })

    const ok = await run({ type: 'a' }, [{ type: 'b' }], async () => {
      // Un hydrate est survenu pendant l'écriture : les entités d'avant n'ont plus rien à
      // faire dans l'état frais.
      state.epoch = 2
      throw new Error('boum')
    })

    expect(ok).toBe(false)
    expect(applied).toEqual([{ type: 'a' }])
    expect(notify).toHaveBeenCalledWith('raté')
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/lib/optimistic/run.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "@/lib/optimistic/run"`.

- [ ] **Step 3: Écrire `lib/optimistic/run.ts`**

Créer le fichier avec le corps déplacé depuis `lib/gantt/commands.ts`, commentaires compris :

```ts
/**
 * Aide de commande optimiste, partagée par `lib/gantt` et `lib/tickets`.
 *
 * Extraite de `lib/gantt/commands.ts` plutôt que dupliquée : elle porte deux décisions
 * subtiles qu'on ne veut pas voir diverger entre deux modules.
 */

/** Le minimum qu'un store doit exposer pour être piloté par ce coureur. Un store Zustand créé par `create()` le satisfait structurellement. */
export interface OptimisticStore<E> {
  getState(): { epoch: number; apply: (event: E) => void }
}

export interface RunnerDeps<E> {
  store: OptimisticStore<E>
  notify: (message: string) => void
  /** Message utilisateur en cas d'échec de persistance. Générique : la cause technique part au journal. */
  errorMessage: string
}

export type Runner<E> = (event: E | E[], inverse: E[], persist: () => Promise<void>) => Promise<boolean>

/**
 * Applique `event` (optimiste), persiste, puis en cas d'échec rejoue `inverse` pour annuler
 * *uniquement* ce que cette commande a fait — jamais un instantané global.
 *
 * Un instantané global casserait dès que deux commandes sont en vol en même temps (un
 * glisser-déposer suivi d'une autre action, typiquement) : le rollback de la première
 * effacerait le travail déjà réussi de la seconde. L'événement inverse, lui, ne touche que les
 * entités que cette commande a modifiées, donc il commute proprement avec le reste — y
 * compris, plus tard, avec des événements distants reçus en temps réel.
 *
 * Garde-fou de contexte : si les données affichées ont été remplacées pendant que la commande
 * était en vol, on n'annule rien. `epoch` change à chaque `hydrate`, ce qui couvre les deux
 * cas — navigation vers un autre projet (les entités de l'ancien corrompraient le nouveau) et
 * rechargement du même projet (l'état frais vient du serveur, y réinjecter des entités d'avant
 * y ferait réapparaître des fantômes). On signale simplement l'échec.
 */
export function createRunner<E>({ store, notify, errorMessage }: RunnerDeps<E>): Runner<E> {
  return async function run(event, inverse, persist) {
    const epoch = store.getState().epoch
    for (const e of Array.isArray(event) ? event : [event]) store.getState().apply(e)
    try {
      await persist()
      return true
    } catch (err) {
      // Cause technique préservée pour le diagnostic (RLS, réseau, requête) ; le message utilisateur reste générique.
      console.error(err)
      if (store.getState().epoch === epoch) {
        for (const e of inverse) store.getState().apply(e)
      }
      notify(errorMessage)
      return false
    }
  }
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/lib/optimistic/run.test.ts`
Attendu : PASS, quatre tests.

- [ ] **Step 5: Rebrancher les commandes du Gantt**

Dans `lib/gantt/commands.ts` :

1. Ajouter en tête : `import { createRunner } from '@/lib/optimistic/run'`
2. Supprimer entièrement la fonction `run` interne (depuis son bloc de commentaire jusqu'à sa dernière accolade) et son commentaire, qui vit désormais dans `lib/optimistic/run.ts`.
3. La remplacer par une seule ligne, au même endroit dans `createCommands` :

```ts
  const run = createRunner<GanttEvent>({ store, notify, errorMessage: PERSIST_ERROR })
```

Aucun appel `run(...)` ne change : la signature est identique.

- [ ] **Step 6: Vérifier que RIEN n'a bougé côté Gantt**

Run: `npm test`
Attendu : toute la suite Vitest au vert, `tests/unit/lib/gantt/commands.test.ts` compris. C'est le vrai contrôle de cette extraction : ces tests couvrent déjà le rollback et le garde-fou `epoch` à travers les commandes.

Run: `npm run typecheck && npm run lint`
Attendu : pas d'erreur.

- [ ] **Step 7: Commit**

```bash
git add lib/optimistic/run.ts tests/unit/lib/optimistic/run.test.ts lib/gantt/commands.ts
git commit -m "refactor(gantt): extraire l'aide de commande optimiste pour la partager"
```

---

## Task 4: Types et réducteur d'événements des tickets

**Files:**
- Create: `lib/tickets/types.ts`
- Create: `lib/tickets/events.ts`
- Create: `tests/unit/lib/tickets/fixtures.ts`
- Create: `tests/unit/lib/tickets/events.test.ts`

**Interfaces:**
- Produit :
  - `type TicketStatus = 'todo' | 'doing' | 'done'`
  - `interface Ticket { id, projectId, number, title, description, status, assigneeId, taskId, createdAt, updatedAt }`
  - `type TicketPatch = Partial<Omit<Ticket, 'id' | 'projectId' | 'number'>>`
  - `interface TicketSummary { id: string; number: number; title: string; status: TicketStatus }`
  - `interface TicketTaskOption { id: string; title: string }`
  - `interface TicketFilters { status: TicketStatus | 'all'; assigneeId: string; taskId: string }`
  - `type TicketEditorState`, `type TicketDragState`
  - `STATUS_ORDER: readonly TicketStatus[]`, `STATUS_LABELS: Record<TicketStatus, string>`
  - `applyTicketEvent(tickets, event): Record<string, Ticket>`
  - `makeTicket(patch)` (fixture de test)

- [ ] **Step 1: Écrire les types**

Créer `lib/tickets/types.ts` :

```ts
export type TicketStatus = 'todo' | 'doing' | 'done'

/** Ordre des colonnes du kanban, et ordre de déplacement des flèches d'une carte. */
export const STATUS_ORDER = ['todo', 'doing', 'done'] as const satisfies readonly TicketStatus[]

export const STATUS_LABELS: Record<TicketStatus, string> = {
  todo: 'À faire',
  doing: 'En cours',
  done: 'Terminé',
}

export interface Ticket {
  id: string
  projectId: string
  /** Attribué par le SERVEUR (trigger tickets_assign_number), jamais par le client. */
  number: number
  title: string
  description: string
  status: TicketStatus
  assigneeId: string | null
  /** Tâche du Gantt à laquelle ce ticket est rattaché. `null` = ticket libre. */
  taskId: string | null
  createdAt: string
  updatedAt: string
}

/** `number` exclu : il est figé en base par le trigger tickets_number_immutable. */
export type TicketPatch = Partial<Omit<Ticket, 'id' | 'projectId' | 'number'>>

/** Ce que le GANTT sait d'un ticket : de quoi compter et lister, rien de plus. */
export interface TicketSummary {
  id: string
  number: number
  title: string
  status: TicketStatus
}

/** Une tâche telle qu'elle apparaît dans le sélecteur de rattachement. */
export interface TicketTaskOption {
  id: string
  title: string
}

/**
 * Filtres de la vue liste. `'all'` plutôt que `null` : ce sont les valeurs d'un `<select>`,
 * et une chaîne vide y désigne déjà « aucun assigné » / « aucune tâche ».
 */
export interface TicketFilters {
  status: TicketStatus | 'all'
  assigneeId: string
  taskId: string
}

export const NO_FILTERS: TicketFilters = { status: 'all', assigneeId: 'all', taskId: 'all' }

export type TicketEditorState =
  | { mode: 'edit'; ticketId: string }
  /** `taskId` pré-remplit le rattachement : c'est le chemin « + Ticket » depuis l'éditeur de tâche du Gantt. */
  | { mode: 'create'; taskId: string | null }
  | null

/** Geste de glisser-déposer en cours sur le kanban. `overStatus` est la colonne survolée. */
export type TicketDragState = { ticketId: string; overStatus: TicketStatus } | null
```

- [ ] **Step 2: Écrire le test du réducteur**

Créer `tests/unit/lib/tickets/fixtures.ts` :

```ts
import type { Ticket } from '@/lib/tickets/types'

let n = 0

/** Ticket de test. Les champs non fournis prennent des valeurs neutres et stables. */
export function makeTicket(patch: Partial<Ticket> = {}): Ticket {
  n += 1
  return {
    id: `t${n}`,
    projectId: 'p1',
    number: n,
    title: `Ticket ${n}`,
    description: '',
    status: 'todo',
    assigneeId: null,
    taskId: null,
    createdAt: '2026-09-09T10:00:00Z',
    updatedAt: '2026-09-09T10:00:00Z',
    ...patch,
  }
}
```

Créer `tests/unit/lib/tickets/events.test.ts` :

```ts
import { applyTicketEvent, indexTickets } from '@/lib/tickets/events'
import { makeTicket } from './fixtures'

describe('applyTicketEvent', () => {
  it('ajoute un ticket créé', () => {
    const t = makeTicket({ id: 'a' })
    const out = applyTicketEvent({}, { type: 'ticket.created', ticket: t })
    expect(out).toEqual({ a: t })
  })

  it('fusionne un patch sur un ticket existant', () => {
    const t = makeTicket({ id: 'a', status: 'todo' })
    const out = applyTicketEvent({ a: t }, { type: 'ticket.updated', ticketId: 'a', patch: { status: 'done' } })
    expect(out.a.status).toBe('done')
    expect(out.a.title).toBe(t.title)
  })

  it('ignore un patch sur un ticket inconnu plutôt que d\'en inventer un', () => {
    const before = {}
    const out = applyTicketEvent(before, { type: 'ticket.updated', ticketId: 'fantome', patch: { status: 'done' } })
    expect(out).toBe(before)
  })

  it('retire un ticket supprimé', () => {
    const t = makeTicket({ id: 'a' })
    const out = applyTicketEvent({ a: t }, { type: 'ticket.deleted', ticketId: 'a' })
    expect(out).toEqual({})
  })

  it('ignore la suppression d\'un ticket déjà absent', () => {
    const before = {}
    expect(applyTicketEvent(before, { type: 'ticket.deleted', ticketId: 'a' })).toBe(before)
  })

  it('indexe une liste par identifiant', () => {
    const a = makeTicket({ id: 'a' })
    const b = makeTicket({ id: 'b' })
    expect(indexTickets([a, b])).toEqual({ a, b })
  })
})
```

- [ ] **Step 3: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/lib/tickets/events.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "@/lib/tickets/events"`.

- [ ] **Step 4: Écrire le réducteur**

Créer `lib/tickets/events.ts` :

```ts
import type { Ticket, TicketPatch } from './types'

export type TicketEvent =
  | { type: 'ticket.created'; ticket: Ticket }
  | { type: 'ticket.updated'; ticketId: string; patch: TicketPatch }
  | { type: 'ticket.deleted'; ticketId: string }

export function indexTickets(tickets: Ticket[]): Record<string, Ticket> {
  return Object.fromEntries(tickets.map((t) => [t.id, t]))
}

/**
 * Réducteur unique des tickets, sur le modèle de `lib/gantt/events.ts`. Il retourne l'état
 * REÇU à l'identique quand l'événement ne s'applique à rien : le store Zustand compare par
 * référence, un nouvel objet re-rendrait toute la page pour rien.
 */
export function applyTicketEvent(
  tickets: Record<string, Ticket>,
  event: TicketEvent,
): Record<string, Ticket> {
  switch (event.type) {
    case 'ticket.created':
      return { ...tickets, [event.ticket.id]: event.ticket }

    case 'ticket.updated': {
      const current = tickets[event.ticketId]
      if (!current) return tickets
      return { ...tickets, [event.ticketId]: { ...current, ...event.patch } }
    }

    case 'ticket.deleted': {
      if (!tickets[event.ticketId]) return tickets
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- extraction volontaire pour retirer la clé par déstructuration
      const { [event.ticketId]: _removed, ...rest } = tickets
      return rest
    }
  }
}
```

- [ ] **Step 5: Vérifier que le test passe**

Run: `npx vitest run tests/unit/lib/tickets/events.test.ts`
Attendu : PASS, six tests.

- [ ] **Step 6: Commit**

```bash
git add lib/tickets/types.ts lib/tickets/events.ts tests/unit/lib/tickets/
git commit -m "feat(tickets): types et réducteur d'événements"
```

---


## Task 5: Store des tickets et fonctions de tri / filtre

**Files:**
- Create: `lib/tickets/store.ts`
- Create: `lib/tickets/summary.ts`
- Create: `tests/unit/lib/tickets/store.test.ts`
- Create: `tests/unit/lib/tickets/summary.test.ts`

**Interfaces:**
- Consomme : `applyTicketEvent`, `indexTickets`, `TicketEvent` (tâche 4) ; `Member`, `Role` de `@/lib/gantt/types`.
- Produit :
  - `useTicketsStore` (Zustand), `interface TicketsState`, `interface TicketsHydratePayload`
  - `selectCanEditTickets(s: TicketsState): boolean`
  - `byNumber(a: Ticket, b: Ticket): number`
  - `filterTickets(tickets: Ticket[], filters: TicketFilters): Ticket[]`
  - `ticketsByStatus(tickets: Ticket[]): Record<TicketStatus, Ticket[]>`
  - `groupByTask(rows: TicketRowSummary[]): Record<string, TicketSummary[]>`
  - `countDone(summaries: TicketSummary[]): { done: number; total: number }`
  - `interface TicketRowSummary extends TicketSummary { taskId: string | null }`

- [ ] **Step 1: Écrire le test des fonctions pures**

Créer `tests/unit/lib/tickets/summary.test.ts` :

```ts
import { byNumber, countDone, filterTickets, groupByTask, ticketsByStatus } from '@/lib/tickets/summary'
import { NO_FILTERS } from '@/lib/tickets/types'
import { makeTicket } from './fixtures'

describe('filterTickets', () => {
  const a = makeTicket({ id: 'a', number: 2, status: 'done', assigneeId: 'u1', taskId: 'k1' })
  const b = makeTicket({ id: 'b', number: 1, status: 'todo', assigneeId: null, taskId: null })
  const all = [a, b]

  it('sans filtre, rend tout, trié par numéro croissant', () => {
    expect(filterTickets(all, NO_FILTERS).map((t) => t.id)).toEqual(['b', 'a'])
  })

  it('filtre par statut', () => {
    expect(filterTickets(all, { ...NO_FILTERS, status: 'done' }).map((t) => t.id)).toEqual(['a'])
  })

  it('la chaîne vide sur l\'assigné désigne « personne », pas « tout le monde »', () => {
    expect(filterTickets(all, { ...NO_FILTERS, assigneeId: '' }).map((t) => t.id)).toEqual(['b'])
    expect(filterTickets(all, { ...NO_FILTERS, assigneeId: 'u1' }).map((t) => t.id)).toEqual(['a'])
  })

  it('la chaîne vide sur la tâche désigne « ticket libre »', () => {
    expect(filterTickets(all, { ...NO_FILTERS, taskId: '' }).map((t) => t.id)).toEqual(['b'])
    expect(filterTickets(all, { ...NO_FILTERS, taskId: 'k1' }).map((t) => t.id)).toEqual(['a'])
  })

  it('ne modifie pas le tableau reçu', () => {
    const input = [a, b]
    filterTickets(input, NO_FILTERS)
    expect(input.map((t) => t.id)).toEqual(['a', 'b'])
  })
})

describe('ticketsByStatus', () => {
  it('rend les trois colonnes, même vides, chacune triée par numéro', () => {
    const t1 = makeTicket({ id: '1', number: 3, status: 'todo' })
    const t2 = makeTicket({ id: '2', number: 1, status: 'todo' })
    const out = ticketsByStatus([t1, t2])
    expect(Object.keys(out)).toEqual(['todo', 'doing', 'done'])
    expect(out.todo.map((t) => t.id)).toEqual(['2', '1'])
    expect(out.doing).toEqual([])
    expect(out.done).toEqual([])
  })
})

describe('groupByTask', () => {
  it('groupe par tâche, ignore les tickets libres et trie par numéro', () => {
    const out = groupByTask([
      { id: 'x', number: 5, title: 'X', status: 'todo', taskId: 'k1' },
      { id: 'y', number: 2, title: 'Y', status: 'done', taskId: 'k1' },
      { id: 'z', number: 9, title: 'Z', status: 'todo', taskId: null },
    ])
    expect(Object.keys(out)).toEqual(['k1'])
    expect(out.k1.map((t) => t.id)).toEqual(['y', 'x'])
  })
})

describe('countDone', () => {
  it('compte les terminés sur le total', () => {
    expect(countDone([
      { id: 'a', number: 1, title: 'A', status: 'done' },
      { id: 'b', number: 2, title: 'B', status: 'todo' },
    ])).toEqual({ done: 1, total: 2 })
  })
  it('rend zéro sur zéro pour une tâche sans ticket', () => {
    expect(countDone([])).toEqual({ done: 0, total: 0 })
  })
})

describe('byNumber', () => {
  it('ordonne croissant', () => {
    expect([makeTicket({ number: 3 }), makeTicket({ number: 1 })].sort(byNumber).map((t) => t.number)).toEqual([1, 3])
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/lib/tickets/summary.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "@/lib/tickets/summary"`.

- [ ] **Step 3: Écrire `lib/tickets/summary.ts`**

```ts
import type { Ticket, TicketFilters, TicketStatus, TicketSummary } from './types'

/** Ticket résumé tel qu'il sort de la lecture serveur du Gantt : le résumé, plus sa tâche. */
export interface TicketRowSummary extends TicketSummary {
  taskId: string | null
}

/**
 * Tri de TOUTES les vues : par numéro croissant, c'est-à-dire par ordre de création. Un ordre
 * manuel dans une colonne du kanban n'existe pas — le numéro est le seul rang, et il ne bouge
 * jamais (le trigger tickets_number_immutable le fige).
 */
export function byNumber(a: Ticket, b: Ticket): number {
  return a.number - b.number
}

/**
 * `'all'` laisse tout passer. La CHAÎNE VIDE, elle, est une valeur significative : elle
 * désigne « aucun assigné » ou « ticket libre ». Confondre les deux rendrait ces deux
 * filtres-là inatteignables depuis un `<select>`.
 */
export function filterTickets(tickets: Ticket[], filters: TicketFilters): Ticket[] {
  return tickets
    .filter((t) => {
      if (filters.status !== 'all' && t.status !== filters.status) return false
      if (filters.assigneeId !== 'all' && (t.assigneeId ?? '') !== filters.assigneeId) return false
      if (filters.taskId !== 'all' && (t.taskId ?? '') !== filters.taskId) return false
      return true
    })
    // Copie implicite : `filter` rend un nouveau tableau, `sort` ne touche donc pas l'entrée.
    .sort(byNumber)
}

/** Les trois colonnes du kanban, toujours présentes même vides : une colonne qui disparaît décalerait les deux autres. */
export function ticketsByStatus(tickets: Ticket[]): Record<TicketStatus, Ticket[]> {
  const out: Record<TicketStatus, Ticket[]> = { todo: [], doing: [], done: [] }
  for (const t of [...tickets].sort(byNumber)) out[t.status].push(t)
  return out
}

/** Regroupement destiné au GANTT. Les tickets libres n'y ont pas de place : aucune ligne ne les porterait. */
export function groupByTask(rows: TicketRowSummary[]): Record<string, TicketSummary[]> {
  const out: Record<string, TicketSummary[]> = {}
  for (const r of rows) {
    if (!r.taskId) continue
    const list = out[r.taskId] ?? []
    list.push({ id: r.id, number: r.number, title: r.title, status: r.status })
    out[r.taskId] = list
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.number - b.number)
  return out
}

export function countDone(summaries: TicketSummary[]): { done: number; total: number } {
  return { done: summaries.filter((s) => s.status === 'done').length, total: summaries.length }
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/lib/tickets/summary.test.ts`
Attendu : PASS.

- [ ] **Step 5: Écrire le test du store**

Créer `tests/unit/lib/tickets/store.test.ts` :

```ts
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { makeTicket } from './fixtures'

const base = {
  projectId: 'p1',
  projectName: 'Projet tickets',
  myRole: 'editor' as const,
  members: [],
  tasks: [{ id: 'k1', title: 'Développement' }],
}

describe('useTicketsStore', () => {
  it('hydrate en indexant par identifiant et incrémente epoch', () => {
    const t = makeTicket({ id: 'a' })
    const before = useTicketsStore.getState().epoch
    useTicketsStore.getState().hydrate({ ...base, tickets: [t] })
    const s = useTicketsStore.getState()
    expect(s.tickets).toEqual({ a: t })
    expect(s.projectName).toBe('Projet tickets')
    expect(s.epoch).toBe(before + 1)
  })

  it('referme l\'éditeur et abandonne le geste en cours à chaque hydratation', () => {
    useTicketsStore.getState().hydrate({ ...base, tickets: [] })
    useTicketsStore.getState().openEditor({ mode: 'create', taskId: null })
    useTicketsStore.getState().setDrag({ ticketId: 'a', overStatus: 'doing' })
    useTicketsStore.getState().hydrate({ ...base, tickets: [] })
    expect(useTicketsStore.getState().editor).toBeNull()
    expect(useTicketsStore.getState().drag).toBeNull()
  })

  it('conserve les filtres au rechargement : ce sont des gestes de consultation, pas des données', () => {
    useTicketsStore.getState().hydrate({ ...base, tickets: [] })
    useTicketsStore.getState().setFilter('status', 'done')
    useTicketsStore.getState().hydrate({ ...base, tickets: [] })
    expect(useTicketsStore.getState().filters.status).toBe('done')
  })

  it('applique un événement au travers du réducteur', () => {
    const t = makeTicket({ id: 'a', status: 'todo' })
    useTicketsStore.getState().hydrate({ ...base, tickets: [t] })
    useTicketsStore.getState().apply({ type: 'ticket.updated', ticketId: 'a', patch: { status: 'doing' } })
    expect(useTicketsStore.getState().tickets.a.status).toBe('doing')
  })

  it('un lecteur ne peut pas écrire', () => {
    useTicketsStore.getState().hydrate({ ...base, myRole: 'viewer', tickets: [] })
    expect(selectCanEditTickets(useTicketsStore.getState())).toBe(false)
    useTicketsStore.getState().hydrate({ ...base, myRole: 'owner', tickets: [] })
    expect(selectCanEditTickets(useTicketsStore.getState())).toBe(true)
  })
})
```

- [ ] **Step 6: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/lib/tickets/store.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "@/lib/tickets/store"`.

- [ ] **Step 7: Écrire `lib/tickets/store.ts`**

```ts
import { create } from 'zustand'
import type { Member, Role } from '@/lib/gantt/types'
import { applyTicketEvent, indexTickets, type TicketEvent } from './events'
import { NO_FILTERS, type Ticket, type TicketDragState, type TicketEditorState, type TicketFilters, type TicketTaskOption } from './types'

export interface TicketsHydratePayload {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  /** Tâches du projet, réduites à ce que le sélecteur de rattachement affiche. */
  tasks: TicketTaskOption[]
  tickets: Ticket[]
}

export interface TicketsState {
  projectId: string
  projectName: string
  myRole: Role
  members: Member[]
  tasks: TicketTaskOption[]
  tickets: Record<string, Ticket>
  /**
   * Compteur incrémenté à chaque `hydrate`, lu par `createRunner` : une commande en vol le
   * capture au départ et refuse d'annuler si la valeur a changé au retour. Même rôle que dans
   * le store du Gantt.
   */
  epoch: number
  editor: TicketEditorState
  filters: TicketFilters
  drag: TicketDragState
  hydrate: (p: TicketsHydratePayload) => void
  apply: (e: TicketEvent) => void
  openEditor: (e: Exclude<TicketEditorState, null>) => void
  closeEditor: () => void
  setFilter: <K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) => void
  setDrag: (d: TicketDragState) => void
}

export const useTicketsStore = create<TicketsState>((set) => ({
  projectId: '',
  projectName: '',
  myRole: 'viewer',
  members: [],
  tasks: [],
  tickets: {},
  epoch: 0,
  editor: null,
  filters: NO_FILTERS,
  drag: null,

  hydrate: (p) => set((s) => ({
    epoch: s.epoch + 1,
    projectId: p.projectId,
    projectName: p.projectName,
    myRole: p.myRole,
    members: p.members,
    tasks: p.tasks,
    tickets: indexTickets(p.tickets),
    editor: null,
    drag: null,
    // `filters` n'est VOLONTAIREMENT pas réinitialisé : un filtre est un geste de consultation,
    // pas une donnée du projet. Le remettre à zéro à chaque `router.refresh()` reviendrait à
    // défaire sous les doigts de l'utilisateur le tri qu'il vient de poser.
  })),

  apply: (e) => set((s) => ({ tickets: applyTicketEvent(s.tickets, e) })),
  openEditor: (editor) => set({ editor }),
  closeEditor: () => set({ editor: null }),
  setFilter: (key, value) => set((s) => ({ filters: { ...s.filters, [key]: value } })),
  setDrag: (drag) => set({ drag }),
}))

export const selectCanEditTickets = (s: TicketsState) => s.myRole !== 'viewer'
```

- [ ] **Step 8: Vérifier que le test passe**

Run: `npx vitest run tests/unit/lib/tickets/store.test.ts`
Attendu : PASS, cinq tests.

- [ ] **Step 9: Commit**

```bash
git add lib/tickets/store.ts lib/tickets/summary.ts tests/unit/lib/tickets/store.test.ts tests/unit/lib/tickets/summary.test.ts
git commit -m "feat(tickets): store et fonctions de tri, filtre et regroupement"
```

---

## Task 6: Dépôt Supabase et validation du formulaire

**Files:**
- Create: `lib/tickets/repository.ts`
- Create: `lib/tickets/validate.ts`
- Create: `tests/unit/lib/tickets/repository.test.ts`
- Create: `tests/unit/lib/tickets/validate.test.ts`

**Interfaces:**
- Consomme : `Ticket`, `TicketPatch`, `TicketStatus` (tâche 4) ; `Database`, `Tables`, `TablesUpdate` de `@/lib/supabase/types` (tâche 1).
- Produit :
  - `interface TicketInsert { projectId: string; title: string; description: string; status: TicketStatus; assigneeId: string | null; taskId: string | null }`
  - `interface TicketRepository { insertTicket(input: TicketInsert): Promise<Ticket>; updateTicket(id: string, patch: TicketPatch): Promise<void>; deleteTicket(id: string): Promise<void> }`
  - `rowToTicket(row): Ticket`, `patchToRow(patch): TablesUpdate<'tickets'>`
  - `createSupabaseTicketRepository(client: SupabaseClient<Database>): TicketRepository`
  - `validateTicketInput(input: TicketInput): { ok: true } | { ok: false; errors: TicketErrors }`
  - `TITLE_MAX_LENGTH = 200`, `DESCRIPTION_MAX_LENGTH = 5000`

- [ ] **Step 1: Écrire le test de validation**

Créer `tests/unit/lib/tickets/validate.test.ts` :

```ts
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, validateTicketInput } from '@/lib/tickets/validate'

describe('validateTicketInput', () => {
  it('accepte un titre simple sans description', () => {
    expect(validateTicketInput({ title: 'Corriger la frise', description: '' })).toEqual({ ok: true })
  })

  it('refuse un titre vide ou fait d\'espaces', () => {
    expect(validateTicketInput({ title: '', description: '' })).toEqual({ ok: false, errors: { title: 'Le titre est requis' } })
    expect(validateTicketInput({ title: '   ', description: '' })).toEqual({ ok: false, errors: { title: 'Le titre est requis' } })
  })

  it('refuse un titre plus long que la contrainte en base', () => {
    const v = validateTicketInput({ title: 'x'.repeat(TITLE_MAX_LENGTH + 1), description: '' })
    expect(v).toEqual({ ok: false, errors: { title: `Le titre ne peut pas dépasser ${TITLE_MAX_LENGTH} caractères` } })
  })

  it('mesure le titre APRÈS trim, comme la contrainte SQL', () => {
    expect(validateTicketInput({ title: `  ${'x'.repeat(TITLE_MAX_LENGTH)}  `, description: '' })).toEqual({ ok: true })
  })

  it('refuse une description plus longue que la contrainte en base', () => {
    const v = validateTicketInput({ title: 'Titre', description: 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1) })
    expect(v).toEqual({ ok: false, errors: { description: `La description ne peut pas dépasser ${DESCRIPTION_MAX_LENGTH} caractères` } })
  })

  it('signale les deux erreurs à la fois', () => {
    const v = validateTicketInput({ title: '', description: 'x'.repeat(DESCRIPTION_MAX_LENGTH + 1) })
    expect(v.ok).toBe(false)
    if (!v.ok) expect(Object.keys(v.errors).sort()).toEqual(['description', 'title'])
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/lib/tickets/validate.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "@/lib/tickets/validate"`.

- [ ] **Step 3: Écrire `lib/tickets/validate.ts`**

```ts
/** Contraintes `tickets` en base : `char_length(trim(title)) between 1 and 200`, description ≤ 5000. */
export const TITLE_MAX_LENGTH = 200
export const DESCRIPTION_MAX_LENGTH = 5000

export interface TicketInput {
  title: string
  description: string
}

export interface TicketErrors {
  title?: string
  description?: string
}

/**
 * Validation du formulaire de ticket. Pure et sans dépendance au store : c'est elle qui
 * produit les messages INLINE de la politique d'erreur du projet (un échec de persistance,
 * lui, part en toast depuis les commandes).
 *
 * Les bornes reprennent EXACTEMENT les contraintes SQL, `trim` compris pour le titre : une
 * validation plus permissive ferait remonter une erreur Postgres brute là où l'utilisateur
 * attend un message sous son champ.
 */
export function validateTicketInput(input: TicketInput): { ok: true } | { ok: false; errors: TicketErrors } {
  const errors: TicketErrors = {}
  const title = input.title.trim()
  if (title.length === 0) errors.title = 'Le titre est requis'
  else if (title.length > TITLE_MAX_LENGTH) errors.title = `Le titre ne peut pas dépasser ${TITLE_MAX_LENGTH} caractères`
  if (input.description.length > DESCRIPTION_MAX_LENGTH) {
    errors.description = `La description ne peut pas dépasser ${DESCRIPTION_MAX_LENGTH} caractères`
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true }
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/lib/tickets/validate.test.ts`
Attendu : PASS, six tests.

- [ ] **Step 5: Écrire le test du dépôt**

Créer `tests/unit/lib/tickets/repository.test.ts` :

```ts
import { patchToRow, rowToTicket } from '@/lib/tickets/repository'
import type { Tables } from '@/lib/supabase/types'

const row: Tables<'tickets'> = {
  id: 'a',
  project_id: 'p1',
  number: 7,
  title: 'Corriger la frise',
  description: 'Détail',
  status: 'doing',
  assignee_id: 'u1',
  task_id: 'k1',
  created_at: '2026-09-09T10:00:00Z',
  updated_at: '2026-09-09T11:00:00Z',
}

describe('rowToTicket', () => {
  it('convertit une ligne en ticket, casse serpent vers casse chameau', () => {
    expect(rowToTicket(row)).toEqual({
      id: 'a',
      projectId: 'p1',
      number: 7,
      title: 'Corriger la frise',
      description: 'Détail',
      status: 'doing',
      assigneeId: 'u1',
      taskId: 'k1',
      createdAt: '2026-09-09T10:00:00Z',
      updatedAt: '2026-09-09T11:00:00Z',
    })
  })
})

describe('patchToRow', () => {
  it('ne retient que les champs présents', () => {
    expect(patchToRow({ status: 'done' })).toEqual({ status: 'done' })
  })

  it('sait écrire null sur l\'assigné et sur la tâche : c\'est « détacher », pas « ne pas toucher »', () => {
    expect(patchToRow({ assigneeId: null, taskId: null })).toEqual({ assignee_id: null, task_id: null })
  })

  it('n\'écrit JAMAIS le numéro ni la date de mise à jour', () => {
    // `number` est figé par trigger, `updatedAt` est posé par `set_updated_at` : les envoyer
    // ferait échouer l'écriture ou écraserait l'horodatage du serveur.
    expect(patchToRow({ updatedAt: '2026-01-01T00:00:00Z' } as never)).toEqual({})
  })

  it('rend un objet vide pour un patch vide', () => {
    expect(patchToRow({})).toEqual({})
  })
})
```

- [ ] **Step 6: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/lib/tickets/repository.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "@/lib/tickets/repository"`.

- [ ] **Step 7: Écrire `lib/tickets/repository.ts`**

```ts
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesUpdate } from '@/lib/supabase/types'
import type { Ticket, TicketPatch, TicketStatus } from './types'

/** Ce qu'on envoie pour créer. Ni `id` ni `number` : les deux viennent du serveur. */
export interface TicketInsert {
  projectId: string
  title: string
  description: string
  status: TicketStatus
  assigneeId: string | null
  taskId: string | null
}

export interface TicketRepository {
  /** Rend le ticket TEL QU'IL EST EN BASE, numéro compris. */
  insertTicket(input: TicketInsert): Promise<Ticket>
  updateTicket(ticketId: string, patch: TicketPatch): Promise<void>
  deleteTicket(ticketId: string): Promise<void>
}

export function rowToTicket(row: Tables<'tickets'>): Ticket {
  return {
    id: row.id,
    projectId: row.project_id,
    number: row.number,
    title: row.title,
    description: row.description,
    status: row.status,
    assigneeId: row.assignee_id,
    taskId: row.task_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/**
 * Colonnes RÉINSCRIPTIBLES, et elles seules. `number` est figé par le trigger
 * tickets_number_immutable, `updated_at` est posé par `set_updated_at`, `created_at` et
 * `project_id` n'ont aucune raison de changer : les envoyer ferait au mieux du bruit, au pire
 * échouer l'écriture.
 */
const COLUMN: { [K in keyof Ticket]?: keyof TablesUpdate<'tickets'> } = {
  title: 'title',
  description: 'description',
  status: 'status',
  assigneeId: 'assignee_id',
  taskId: 'task_id',
}

export function patchToRow(patch: TicketPatch): TablesUpdate<'tickets'> {
  const row: Record<string, unknown> = {}
  for (const [key, col] of Object.entries(COLUMN) as [keyof Ticket, string][]) {
    // `key in patch` et non une simple vérité : `null` sur l'assigné ou la tâche est une
    // valeur à écrire (« détacher »), pas une absence.
    if (key in patch && patch[key] !== undefined) row[col] = patch[key]
  }
  return row as TablesUpdate<'tickets'>
}

export function createSupabaseTicketRepository(client: SupabaseClient<Database>): TicketRepository {
  // Même formulation fermée que le dépôt du Gantt : `.eq('id', …)` cible au plus une ligne,
  // `count` doit donc valoir exactement 1. Rejeter tout le reste est indispensable —
  // `count === 0` laisserait passer un `count` null (en-tête content-range absente) comme un
  // faux succès alors que la RLS a refusé l'écriture en silence.
  const check = (error: { message: string } | null, count?: number | null) => {
    if (error) throw new Error(error.message)
    if (count !== undefined && count !== 1) throw new Error('no_row_affected')
  }
  return {
    async insertTicket(input) {
      // `.select().single()` : le NUMÉRO est attribué côté serveur par un trigger. On relit
      // donc la ligne créée plutôt que d'inventer une valeur qu'il faudrait corriger ensuite.
      const { data, error } = await client
        .from('tickets')
        .insert({
          project_id: input.projectId,
          title: input.title,
          description: input.description,
          status: input.status,
          assignee_id: input.assigneeId,
          task_id: input.taskId,
        })
        .select()
        .single()
      if (error) throw new Error(error.message)
      return rowToTicket(data)
    },
    async updateTicket(ticketId, patch) {
      const { error, count } = await client.from('tickets').update(patchToRow(patch), { count: 'exact' }).eq('id', ticketId)
      check(error, count)
    },
    async deleteTicket(ticketId) {
      const { error, count } = await client.from('tickets').delete({ count: 'exact' }).eq('id', ticketId)
      check(error, count)
    },
  }
}
```

- [ ] **Step 8: Vérifier que le test passe**

Run: `npx vitest run tests/unit/lib/tickets/repository.test.ts`
Puis : `npm run typecheck`
Attendu : PASS, cinq tests, et aucune erreur de types.

- [ ] **Step 9: Commit**

```bash
git add lib/tickets/repository.ts lib/tickets/validate.ts tests/unit/lib/tickets/repository.test.ts tests/unit/lib/tickets/validate.test.ts
git commit -m "feat(tickets): dépôt Supabase et validation du formulaire"
```

---

## Task 7: Commandes des tickets

**Files:**
- Create: `lib/tickets/commands.ts`
- Create: `lib/tickets/client-commands.ts`
- Create: `tests/unit/lib/tickets/commands.test.ts`

**Interfaces:**
- Consomme : `createRunner` (tâche 3), `useTicketsStore` / `TicketsState` (tâche 5), `TicketRepository` / `createSupabaseTicketRepository` (tâche 6).
- Produit :
  - `createTicketCommands(deps: TicketCommandDeps): TicketCommands`
  - `interface TicketCommands { createTicket(input: CreateTicketInput): Promise<Ticket | null>; updateTicket(id: string, patch: TicketPatch): Promise<boolean>; deleteTicket(id: string): Promise<boolean> }`
  - `interface CreateTicketInput { title: string; description?: string; status?: TicketStatus; assigneeId?: string | null; taskId?: string | null }`
  - `PERSIST_ERROR = 'Modification non enregistrée'`, `UNKNOWN_TICKET_ERROR = 'Ticket introuvable'`
  - `getTicketCommands(): TicketCommands` (singleton navigateur)

- [ ] **Step 1: Écrire le test des commandes**

Créer `tests/unit/lib/tickets/commands.test.ts` :

```ts
import { createTicketCommands, PERSIST_ERROR, UNKNOWN_TICKET_ERROR } from '@/lib/tickets/commands'
import { useTicketsStore } from '@/lib/tickets/store'
import type { TicketRepository } from '@/lib/tickets/repository'
import { makeTicket } from './fixtures'

const existing = makeTicket({ id: 'a', number: 1, status: 'todo', title: 'Existant' })

function fakeRepo(overrides: Partial<TicketRepository> = {}): TicketRepository {
  return {
    insertTicket: vi.fn().mockResolvedValue(makeTicket({ id: 'neuf', number: 42, title: 'Neuf' })),
    updateTicket: vi.fn().mockResolvedValue(undefined),
    deleteTicket: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function setup(repo = fakeRepo()) {
  useTicketsStore.getState().hydrate({
    projectId: 'p1',
    projectName: 'Projet tickets',
    myRole: 'editor',
    members: [],
    tasks: [{ id: 'k1', title: 'Développement' }],
    tickets: [existing],
  })
  const notify = vi.fn()
  const cmd = createTicketCommands({ store: useTicketsStore, repo, notify })
  return { cmd, repo, notify }
}

describe('createTicket', () => {
  it('n\'ajoute le ticket QU\'APRÈS la réponse du serveur, avec le numéro attribué en base', async () => {
    const { cmd, repo } = setup()
    const created = await cmd.createTicket({ title: '  Neuf  ' })
    expect(created?.number).toBe(42)
    expect(useTicketsStore.getState().tickets.neuf.number).toBe(42)
    // Le titre part sans ses espaces : la contrainte SQL mesure après trim.
    expect(repo.insertTicket).toHaveBeenCalledWith(expect.objectContaining({ projectId: 'p1', title: 'Neuf', description: '', status: 'todo', assigneeId: null, taskId: null }))
  })

  it('transmet le rattachement et l\'assigné quand ils sont fournis', async () => {
    const { cmd, repo } = setup()
    await cmd.createTicket({ title: 'Neuf', taskId: 'k1', assigneeId: 'u1', status: 'doing', description: 'Détail' })
    expect(repo.insertTicket).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'k1', assigneeId: 'u1', status: 'doing', description: 'Détail' }))
  })

  it('signale l\'échec, n\'ajoute rien et rend null', async () => {
    const { cmd, notify } = setup(fakeRepo({ insertTicket: vi.fn().mockRejectedValue(new Error('rls')) }))
    expect(await cmd.createTicket({ title: 'Neuf' })).toBeNull()
    expect(Object.keys(useTicketsStore.getState().tickets)).toEqual(['a'])
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })

  it('n\'injecte PAS le ticket créé si les données ont été remplacées pendant l\'écriture', async () => {
    const repo = fakeRepo({
      insertTicket: vi.fn().mockImplementation(async () => {
        // L'utilisateur a navigué vers un autre projet pendant l'appel.
        useTicketsStore.getState().hydrate({ projectId: 'p2', projectName: 'Autre', myRole: 'editor', members: [], tasks: [], tickets: [] })
        return makeTicket({ id: 'neuf', number: 1 })
      }),
    })
    const { cmd } = setup(repo)
    expect(await cmd.createTicket({ title: 'Neuf' })).toBeNull()
    expect(useTicketsStore.getState().tickets).toEqual({})
  })
})

describe('updateTicket', () => {
  it('applique tout de suite puis persiste', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.updateTicket('a', { status: 'done' })).toBe(true)
    expect(useTicketsStore.getState().tickets.a.status).toBe('done')
    expect(repo.updateTicket).toHaveBeenCalledWith('a', { status: 'done' })
  })

  it('remet la valeur d\'avant et signale quand la persistance échoue', async () => {
    const { cmd, notify } = setup(fakeRepo({ updateTicket: vi.fn().mockRejectedValue(new Error('rls')) }))
    expect(await cmd.updateTicket('a', { status: 'done' })).toBe(false)
    expect(useTicketsStore.getState().tickets.a.status).toBe('todo')
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })

  it('refuse un ticket inconnu et un patch vide, sans écrire', async () => {
    const { cmd, repo, notify } = setup()
    expect(await cmd.updateTicket('fantome', { status: 'done' })).toBe(false)
    expect(notify).toHaveBeenCalledWith(UNKNOWN_TICKET_ERROR)
    expect(await cmd.updateTicket('a', {})).toBe(false)
    expect(repo.updateTicket).not.toHaveBeenCalled()
  })
})

describe('deleteTicket', () => {
  it('retire tout de suite puis persiste', async () => {
    const { cmd, repo } = setup()
    expect(await cmd.deleteTicket('a')).toBe(true)
    expect(useTicketsStore.getState().tickets.a).toBeUndefined()
    expect(repo.deleteTicket).toHaveBeenCalledWith('a')
  })

  it('rend le ticket INTACT quand la suppression échoue', async () => {
    const { cmd, notify } = setup(fakeRepo({ deleteTicket: vi.fn().mockRejectedValue(new Error('rls')) }))
    expect(await cmd.deleteTicket('a')).toBe(false)
    expect(useTicketsStore.getState().tickets.a).toEqual(existing)
    expect(notify).toHaveBeenCalledWith(PERSIST_ERROR)
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/lib/tickets/commands.test.ts`
Attendu : ÉCHEC, `Failed to resolve import "@/lib/tickets/commands"`.

- [ ] **Step 3: Écrire `lib/tickets/commands.ts`**

```ts
import type { StoreApi } from 'zustand'
import { createRunner } from '@/lib/optimistic/run'
import type { TicketsState } from './store'
import type { TicketRepository } from './repository'
import type { TicketEvent } from './events'
import type { Ticket, TicketPatch, TicketStatus } from './types'

export const PERSIST_ERROR = 'Modification non enregistrée'
export const UNKNOWN_TICKET_ERROR = 'Ticket introuvable'

export interface CreateTicketInput {
  title: string
  description?: string
  status?: TicketStatus
  assigneeId?: string | null
  taskId?: string | null
}

export interface TicketCommands {
  createTicket(input: CreateTicketInput): Promise<Ticket | null>
  updateTicket(ticketId: string, patch: TicketPatch): Promise<boolean>
  deleteTicket(ticketId: string): Promise<boolean>
}

export interface TicketCommandDeps {
  store: StoreApi<TicketsState>
  repo: TicketRepository
  notify: (message: string) => void
}

export function createTicketCommands({ store, repo, notify }: TicketCommandDeps): TicketCommands {
  const run = createRunner<TicketEvent>({ store, notify, errorMessage: PERSIST_ERROR })

  return {
    /**
     * SEULE commande non optimiste du module. Le numéro d'un ticket est attribué par le
     * serveur (trigger `tickets_assign_number`) : l'afficher avant sa réponse obligerait à
     * inventer une valeur puis à la corriger sous les yeux de l'utilisateur. On insère, on
     * relit la ligne créée, et on l'applique telle quelle.
     */
    async createTicket(input) {
      const s = store.getState()
      const epoch = s.epoch
      try {
        const ticket = await repo.insertTicket({
          projectId: s.projectId,
          title: input.title.trim(),
          description: input.description ?? '',
          status: input.status ?? 'todo',
          assigneeId: input.assigneeId ?? null,
          taskId: input.taskId ?? null,
        })
        // Même garde-fou que dans `createRunner`, et pour la même raison : si les données
        // affichées ont été remplacées pendant l'écriture, injecter ce ticket ferait
        // apparaître dans un projet l'entité d'un autre. Le ticket EST bien créé en base, il
        // apparaîtra au prochain chargement de son projet.
        if (store.getState().epoch !== epoch) return null
        store.getState().apply({ type: 'ticket.created', ticket })
        return ticket
      } catch (err) {
        // Cause technique au journal, message générique à l'écran : politique d'erreur du projet.
        console.error(err)
        notify(PERSIST_ERROR)
        return null
      }
    },

    updateTicket(ticketId, patch) {
      const before = store.getState().tickets[ticketId]
      if (!before) {
        notify(UNKNOWN_TICKET_ERROR)
        return Promise.resolve(false)
      }
      // Un patch vide n'a pas à produire d'écriture : la modale « Enregistrer » sans rien
      // changer ne doit ni appeler le réseau ni signaler une erreur.
      if (Object.keys(patch).length === 0) return Promise.resolve(false)

      // Valeurs D'AVANT des SEULS champs touchés, relevées sur le store : le retour arrière
      // doit rendre le ticket tel qu'il était, sans toucher au reste.
      const inversePatch: Record<string, unknown> = {}
      for (const key of Object.keys(patch)) {
        inversePatch[key] = (before as unknown as Record<string, unknown>)[key]
      }

      return run(
        { type: 'ticket.updated', ticketId, patch },
        [{ type: 'ticket.updated', ticketId, patch: inversePatch as TicketPatch }],
        () => repo.updateTicket(ticketId, patch),
      )
    },

    deleteTicket(ticketId) {
      const before = store.getState().tickets[ticketId]
      if (!before) {
        notify(UNKNOWN_TICKET_ERROR)
        return Promise.resolve(false)
      }
      // L'inverse recrée le ticket TEL QU'IL ÉTAIT, numéro compris : c'est le même ticket qui
      // revient, pas une copie neuve.
      return run(
        { type: 'ticket.deleted', ticketId },
        [{ type: 'ticket.created', ticket: before }],
        () => repo.deleteTicket(ticketId),
      )
    },
  }
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/lib/tickets/commands.test.ts`
Attendu : PASS, neuf tests.

- [ ] **Step 5: Écrire le branchement navigateur**

Créer `lib/tickets/client-commands.ts` :

```ts
'use client'
import { createClient } from '@/lib/supabase/client'
import { toast } from '@/lib/toast/store'
import { useTicketsStore } from './store'
import { createSupabaseTicketRepository } from './repository'
import { createTicketCommands, type TicketCommands } from './commands'

let instance: TicketCommands | null = null

/** Commandes branchées sur Supabase + toasts. Singleton côté navigateur, comme pour le Gantt. */
export function getTicketCommands(): TicketCommands {
  if (!instance) {
    instance = createTicketCommands({
      store: useTicketsStore,
      repo: createSupabaseTicketRepository(createClient()),
      notify: toast.error,
    })
  }
  return instance
}
```

- [ ] **Step 6: Vérifier l'ensemble**

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert. Le module `lib/tickets` est complet et testé, sans une seule ligne d'interface.

- [ ] **Step 7: Commit**

```bash
git add lib/tickets/commands.ts lib/tickets/client-commands.ts tests/unit/lib/tickets/commands.test.ts
git commit -m "feat(tickets): commandes de création, modification et suppression"
```

---

# Lot 3 — Écrans

## Task 8: Champ multiligne

**Files:**
- Create: `components/ui/Textarea.tsx`
- Create: `tests/unit/components/ui/Textarea.test.tsx`

**Interfaces:**
- Produit : `Textarea` (`forwardRef<HTMLTextAreaElement, TextareaProps>`), `interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> { label?: string; error?: string }`.

- [ ] **Step 1: Écrire le test**

Créer `tests/unit/components/ui/Textarea.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { Textarea } from '@/components/ui/Textarea'

describe('Textarea', () => {
  it('associe son libellé au champ', () => {
    render(<Textarea label="Description" defaultValue="Bonjour" />)
    expect(screen.getByLabelText('Description')).toHaveValue('Bonjour')
  })

  it('annonce l\'erreur et la relie au champ', () => {
    render(<Textarea label="Description" error="Trop long" />)
    const field = screen.getByLabelText('Description')
    expect(field).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('alert')).toHaveTextContent('Trop long')
    expect(field).toHaveAttribute('aria-describedby', screen.getByRole('alert').id)
  })

  it('sans erreur, n\'écrase pas l\'aria-describedby fourni par l\'appelant', () => {
    render(<Textarea label="Description" aria-describedby="aide" />)
    expect(screen.getByLabelText('Description')).toHaveAttribute('aria-describedby', 'aide')
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/ui/Textarea.test.tsx`
Attendu : ÉCHEC, `Failed to resolve import "@/components/ui/Textarea"`.

- [ ] **Step 3: Écrire le composant**

Créer `components/ui/Textarea.tsx`, calqué sur `components/ui/Input.tsx` :

```tsx
import { forwardRef, useId, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string
  error?: string
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, error, className, id, rows = 4, ...props },
  ref,
) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const errorId = `${fieldId}-error`
  return (
    <div className="flex flex-col gap-1">
      {label && <label htmlFor={fieldId} className="font-bold uppercase text-sm">{label}</label>}
      {/* Même discipline que `Input` : aria-invalid/aria-describedby posés APRÈS le spread,
          pour qu'un appelant ne puisse pas les écraser silencieusement quand une erreur est
          affichée, tout en laissant passer sa propre valeur quand il n'y en a pas. */}
      <textarea
        ref={ref}
        id={fieldId}
        rows={rows}
        className={cn('bg-paper border-[3px] border-ink px-3 py-2 font-ui brutal-focus-field placeholder:text-ink/40', error && 'border-danger', className)}
        {...props}
        aria-invalid={error ? 'true' : props['aria-invalid']}
        aria-describedby={error ? errorId : props['aria-describedby']}
      />
      {error && <p id={errorId} role="alert" className="text-danger text-sm font-bold">{error}</p>}
    </div>
  )
})
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/components/ui/Textarea.test.tsx`
Attendu : PASS, trois tests.

- [ ] **Step 5: Commit**

```bash
git add components/ui/Textarea.tsx tests/unit/components/ui/Textarea.test.tsx
git commit -m "feat(ui): champ multiligne"
```

---

## Task 9: Activation des tickets par le propriétaire

**Files:**
- Modify: `app/(app)/projects/actions.ts` (ajout en fin de fichier)
- Modify: `app/(app)/projects/page.tsx:20-24` (colonne lue) et `:70-80` (construction de `ProjectListItem`)
- Modify: `components/project/ProjectCard.tsx:20-31` (type) et `:140-146` (commandes du propriétaire)
- Modify: `tests/unit/app/projects/actions.test.ts` (ajout d'un `describe`)

**Interfaces:**
- Produit :
  - `setTicketsEnabled(projectId: string, enabled: boolean): Promise<ActionResult>` dans `@/app/(app)/projects/actions`
  - `ProjectListItem` gagne `ticketsEnabled: boolean`
- Consommé par la tâche 10 (`TicketsDisabled`).

- [ ] **Step 1: Écrire le test de l'action**

Ajouter à la fin de `tests/unit/app/projects/actions.test.ts`, et compléter l'import en tête du fichier pour qu'il devienne :

```ts
import { createProject, renameProject, deleteProject, setTicketsEnabled } from '@/app/(app)/projects/actions'
```

Puis ajouter :

```ts
describe('setTicketsEnabled', () => {
  beforeEach(() => {
    mockEq.mockReset()
    mockUpdate.mockClear()
    mockFrom.mockClear()
    mockRevalidatePath.mockClear()
  })

  it('écrit la colonne et réinvalide la liste des projets', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    const res = await setTicketsEnabled('p1', true)
    expect(res.error).toBeUndefined()
    expect(mockUpdate).toHaveBeenCalledWith({ tickets_enabled: true }, { count: 'exact' })
    expect(mockRevalidatePath).toHaveBeenCalledWith('/projects')
  })

  it('désactive aussi bien qu\'il active', async () => {
    mockEq.mockResolvedValue({ error: null, count: 1 })
    await setTicketsEnabled('p1', false)
    expect(mockUpdate).toHaveBeenCalledWith({ tickets_enabled: false }, { count: 'exact' })
  })

  it('count null (en-tête content-range absente) est traité comme un échec', async () => {
    mockEq.mockResolvedValue({ error: null, count: null })
    expect((await setTicketsEnabled('p1', true)).error).toBe('Modification non enregistrée')
  })

  it('count à 0 (la RLS a refusé : l\'appelant n\'est pas propriétaire) est un échec', async () => {
    mockEq.mockResolvedValue({ error: null, count: 0 })
    expect((await setTicketsEnabled('p1', true)).error).toBe('Modification non enregistrée')
    expect(mockRevalidatePath).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/app/projects/actions.test.ts`
Attendu : ÉCHEC, `setTicketsEnabled is not a function` (ou une erreur d'import).

- [ ] **Step 3: Écrire l'action**

Ajouter à la fin de `app/(app)/projects/actions.ts` :

```ts
/**
 * Active ou désactive le backlog de tickets d'un projet.
 *
 * L'autorisation n'est PAS vérifiée ici : la policy `projects_update_owner` la porte, et
 * `count !== 1` transforme son refus silencieux en échec explicite. Dupliquer le contrôle dans
 * l'action donnerait deux sources de vérité pour la même règle.
 *
 * Désactiver ne supprime AUCUNE donnée : les tickets restent en base et réapparaissent tels
 * quels à la réactivation. C'est un choix d'affichage, réversible sans conséquence.
 */
export async function setTicketsEnabled(projectId: string, enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error, count } = await supabase
    .from('projects')
    .update({ tickets_enabled: enabled }, { count: 'exact' })
    .eq('id', projectId)
  if (error || count !== 1) return { error: 'Modification non enregistrée' }
  revalidatePath('/projects')
  return {}
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/app/projects/actions.test.ts`
Attendu : PASS, tests existants compris.

- [ ] **Step 5: Faire remonter la colonne jusqu'à la carte**

Dans `app/(app)/projects/page.tsx`, ajouter `tickets_enabled` à la lecture :

```ts
    .select('id, name, created_at, tickets_enabled, memberships!inner(role, user_id)')
```

Puis, dans la construction de `projects`, ajouter la propriété :

```ts
    ticketsEnabled: p.tickets_enabled,
```

Dans `components/project/ProjectCard.tsx`, ajouter au type :

```ts
export interface ProjectListItem {
  id: string
  name: string
  role: 'owner' | 'editor' | 'viewer'
  createdAt: string
  ticketsEnabled: boolean
  tasks: CardTask[]
  summary: ProjectSummary
  members: Member[]
  today: string
}
```

- [ ] **Step 6: Ajouter le bouton de bascule**

Dans `components/project/ProjectCard.tsx`, compléter l'import des actions :

```ts
import { deleteProject, setTicketsEnabled } from '@/app/(app)/projects/actions'
```

Ajouter la fonction, à côté de `remove` :

```ts
  function toggleTickets() {
    start(async () => {
      const res = await setTicketsEnabled(project.id, !project.ticketsEnabled)
      if (res.error) toast.error(res.error)
    })
  }
```

Et insérer le bouton en tête des commandes du propriétaire :

```tsx
        {project.role === 'owner' && (
          <span className="flex gap-2">
            {/* `aria-pressed` plutôt qu'un libellé qui changerait (« Activer » / « Désactiver ») :
                un bouton dont le texte bascule oblige à le relire pour savoir dans quel état on
                est. Ici le mot reste « Tickets », c'est son état enfoncé qui répond. */}
            <Button
              size="sm"
              variant={project.ticketsEnabled ? 'primary' : 'secondary'}
              aria-pressed={project.ticketsEnabled}
              onClick={toggleTickets}
            >
              Tickets
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setRenaming(true)}>Renommer</Button>
            <Button size="sm" variant="danger-quiet" onClick={remove}>Supprimer</Button>
          </span>
        )}
```

- [ ] **Step 7: Vérifier**

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

Lancer le serveur si besoin (`npm run dev`, en tâche de fond, jamais tué par motif) et vérifier à l'œil sur `http://localhost:3100/projects` : sur « Projet tickets » le bouton est enfoncé, sur « Projet démo » il ne l'est pas, et un clic bascule sans recharger la page à la main.

- [ ] **Step 8: Commit**

```bash
git add app/\(app\)/projects/actions.ts app/\(app\)/projects/page.tsx components/project/ProjectCard.tsx tests/unit/app/projects/actions.test.ts
git commit -m "feat(tickets): activation par projet depuis la carte du propriétaire"
```

---

## Task 10: Page serveur des tickets et son ossature

**Files:**
- Create: `app/(app)/projects/[id]/tickets/page.tsx`
- Create: `components/tickets/TicketsPage.tsx`
- Create: `components/tickets/TicketsToolbar.tsx`
- Create: `components/tickets/TicketsDisabled.tsx`

**Interfaces:**
- Consomme : `useTicketsStore` / `TicketsHydratePayload` (tâche 5), `rowToTicket` (tâche 6), `setTicketsEnabled` (tâche 9), `ProjectLoadError` (existant).
- Produit :
  - `TicketsPage({ payload, view, initialCreate })` où `view: 'board' | 'list'` et `initialCreate: { taskId: string | null } | null`
  - `TicketsToolbar({ view })`
  - `TicketsDisabled({ projectId, projectName })`
- Les tâches 11 à 13 remplissent `TicketBoard`, `TicketList` et `TicketEditor`, montés par `TicketsPage`.

- [ ] **Step 1: Écrire la page serveur**

Créer `app/(app)/projects/[id]/tickets/page.tsx` :

```tsx
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { rowToTicket } from '@/lib/tickets/repository'
import type { Member, Role } from '@/lib/gantt/types'
import type { TicketTaskOption } from '@/lib/tickets/types'
import { TicketsPage } from '@/components/tickets/TicketsPage'
import { TicketsDisabled } from '@/components/tickets/TicketsDisabled'
import { ProjectLoadError } from '@/components/gantt/ProjectLoadError'

export default async function ProjectTicketsPage({ params, searchParams }: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ vue?: string; nouveau?: string }>
}) {
  const { id } = await params
  const query = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()

  // Même politique que la page du Gantt : `maybeSingle`, car l'absence de ligne est le cas
  // nominal d'un identifiant inconnu OU d'un projet auquel on n'a pas accès — les deux se
  // répondent par un 404, volontairement indistinguables.
  const { data: project, error: projectError } = await supabase
    .from('projects').select('id, name, tickets_enabled').eq('id', id).maybeSingle()
  if (projectError) return renderLoadError(id, [['projects', projectError]])
  if (!project) notFound()

  const { data: memberships, error: membershipsError } = await supabase
    .from('memberships').select('user_id, role, profiles(display_name, email, avatar_url, color)').eq('project_id', id)
  if (membershipsError) return renderLoadError(id, [['memberships', membershipsError]], project.name)

  // Le rôle se dérive des lignes BRUTES, jamais de la projection d'affichage `members` :
  // un profil masqué par la RLS priverait sinon l'utilisateur de ses droits d'écriture.
  const rows = memberships ?? []
  const myRole: Role = rows.find((m) => m.user_id === user.id)?.role ?? 'viewer'

  // Tickets désactivés : le propriétaire se voit proposer de les activer, tout autre membre
  // reçoit un 404. Ne pas offrir une porte qui se referme.
  if (!project.tickets_enabled) {
    if (myRole !== 'owner') notFound()
    return <TicketsDisabled projectId={project.id} projectName={project.name} />
  }

  // `.eq('project_id', id)` sur tickets ET tasks : SEUL rempart d'isolation inter-projets à ce
  // niveau. La RLS autorise la lecture de toutes les lignes des projets dont on est membre,
  // elle ne filtre pas sur CE projet-ci. Ne jamais retirer ces filtres.
  const [ticketsRes, tasksRes] = await Promise.all([
    supabase.from('tickets').select('*').eq('project_id', id).order('number'),
    supabase.from('tasks').select('id, title, type').eq('project_id', id).order('sort_order'),
  ])

  // Une lecture en échec ne doit JAMAIS se présenter comme une liste vide : un kanban vide
  // affiché sur un `tickets` en erreur pousse l'utilisateur à recréer des tickets qui existent
  // déjà. On refuse donc de rendre l'écran sur des données partielles.
  const failures: Array<[string, { message: string }]> = []
  if (ticketsRes.error) failures.push(['tickets', ticketsRes.error])
  if (tasksRes.error) failures.push(['tasks', tasksRes.error])
  if (failures.length > 0) return renderLoadError(id, failures, project.name)

  const members: Member[] = rows.flatMap((m) => {
    if (!m.profiles) return []
    return [{
      userId: m.user_id,
      role: m.role,
      displayName: m.profiles.display_name,
      email: m.profiles.email,
      avatarUrl: m.profiles.avatar_url,
      color: m.profiles.color,
    }]
  })

  // Un GROUPE n'est pas une cible de rattachement : c'est un contenant, ses dates viennent de
  // ses enfants. Rattacher un ticket à une phase entière ne veut rien dire.
  const tasks: TicketTaskOption[] = (tasksRes.data ?? [])
    .filter((t) => t.type !== 'group')
    .map((t) => ({ id: t.id, title: t.title }))

  // `?nouveau=` est une commodité de navigation, pas une saisie à valider : une valeur qui ne
  // désigne aucune tâche DE CE PROJET ouvre simplement l'éditeur sans rattachement.
  const initialCreate = query.nouveau === undefined
    ? null
    : { taskId: tasks.some((t) => t.id === query.nouveau) ? query.nouveau : null }

  return (
    <TicketsPage
      payload={{
        projectId: project.id,
        projectName: project.name,
        myRole,
        members,
        tasks,
        tickets: (ticketsRes.data ?? []).map(rowToTicket),
      }}
      view={query.vue === 'liste' ? 'list' : 'board'}
      initialCreate={initialCreate}
    />
  )
}

/** Politique d'erreur du projet : cause technique au journal serveur, message générique à l'écran. */
function renderLoadError(projectId: string, failures: Array<[string, { message: string }]>, projectName?: string) {
  for (const [what, error] of failures) {
    console.error(`[projects/${projectId}/tickets] lecture "${what}" en échec :`, error.message)
  }
  return <ProjectLoadError retryHref={`/projects/${projectId}/tickets`} projectName={projectName} />
}
```

- [ ] **Step 2: Écrire la carte d'activation**

Créer `components/tickets/TicketsDisabled.tsx` :

```tsx
'use client'
import Link from 'next/link'
import { useTransition } from 'react'
import { Button } from '@/components/ui/Button'
import { toast } from '@/lib/toast/store'
import { setTicketsEnabled } from '@/app/(app)/projects/actions'

/**
 * Ce que voit le PROPRIÉTAIRE d'un projet sans tickets. Tout autre membre reçoit un 404 depuis
 * la page serveur : lui montrer un écran qu'il ne peut pas débloquer serait une impasse.
 */
export function TicketsDisabled({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [pending, start] = useTransition()

  function enable() {
    start(async () => {
      const res = await setTicketsEnabled(projectId, true)
      if (res.error) toast.error(res.error)
    })
  }

  return (
    <main className="mx-auto max-w-2xl p-4 sm:p-8">
      <Link href={`/projects/${projectId}`} className="font-mono text-sm underline brutal-focus">← {projectName}</Link>
      <div className="mt-6 bg-paper brutal p-6 space-y-3">
        <h1 className="text-2xl">Tickets</h1>
        <p className="text-sm">
          Ce projet n&apos;a pas de backlog. En l&apos;activant, tu obtiens une liste de tickets
          numérotés, rattachables aux tâches de la frise.
        </p>
        <p className="font-mono text-xs text-ink-soft">
          Rien n&apos;est perdu si tu changes d&apos;avis : désactiver masque les tickets, ne les supprime pas.
        </p>
        <Button onClick={enable} disabled={pending}>Activer les tickets</Button>
      </div>
    </main>
  )
}
```

- [ ] **Step 3: Écrire l'ossature cliente**

Créer `components/tickets/TicketsPage.tsx` :

```tsx
'use client'
import { useEffect, useRef } from 'react'
import { useTicketsStore, type TicketsHydratePayload } from '@/lib/tickets/store'
import { TicketsToolbar } from './TicketsToolbar'
import { TicketBoard } from './TicketBoard'
import { TicketList } from './TicketList'
import { TicketEditor } from './TicketEditor'

export interface TicketsPageProps {
  payload: TicketsHydratePayload
  view: 'board' | 'list'
  /** Ouverture immédiate de l'éditeur, demandée par `?nouveau=` depuis l'éditeur de tâche du Gantt. */
  initialCreate: { taskId: string | null } | null
}

export function TicketsPage({ payload, view, initialCreate }: TicketsPageProps) {
  const hydrate = useTicketsStore((s) => s.hydrate)
  const openEditor = useTicketsStore((s) => s.openEditor)
  // Le store est un singleton de module : au premier rendu il contient encore les tickets du
  // projet précédent. On attend `hydrate` avant de monter les vues, sinon on afficherait
  // brièvement le backlog d'un autre projet.
  const ready = useTicketsStore((s) => s.projectId === payload.projectId)
  const opened = useRef(false)

  useEffect(() => { hydrate(payload) }, [hydrate, payload])

  useEffect(() => {
    // UNE seule ouverture pour toute la vie de la page : `hydrate` referme l'éditeur, et sans
    // ce garde-fou le moindre `router.refresh()` (un changement de vue, par exemple) le
    // rouvrirait par-dessus le travail en cours.
    if (!ready || !initialCreate || opened.current) return
    opened.current = true
    openEditor({ mode: 'create', taskId: initialCreate.taskId })
  }, [ready, initialCreate, openEditor])

  if (!ready) return <div className="p-8 font-mono">Chargement…</div>
  return (
    <div className="flex flex-col h-[calc(100dvh-3.5rem)]">
      <TicketsToolbar view={view} />
      {view === 'board' ? <TicketBoard /> : <TicketList />}
      <TicketEditor />
    </div>
  )
}
```

- [ ] **Step 4: Écrire la barre d'outils**

Créer `components/tickets/TicketsToolbar.tsx` :

```tsx
'use client'
import Link from 'next/link'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

export function TicketsToolbar({ view }: { view: 'board' | 'list' }) {
  const projectId = useTicketsStore((s) => s.projectId)
  const projectName = useTicketsStore((s) => s.projectName)
  const myRole = useTicketsStore((s) => s.myRole)
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)
  const count = useTicketsStore((s) => Object.keys(s.tickets).length)

  // La vue passe par l'URL et non par le store : elle se partage par lien, et un rechargement
  // rend la même page. Deux liens plutôt qu'un bouton : c'est une navigation, elle mérite un
  // clic milieu et un « ouvrir dans un onglet ».
  const tab = (target: 'board' | 'list', label: string) => (
    <Link
      href={target === 'list' ? `/projects/${projectId}/tickets?vue=liste` : `/projects/${projectId}/tickets`}
      aria-current={view === target ? 'page' : undefined}
      className={cn(
        'border-[3px] border-ink px-3 py-1 font-bold uppercase text-sm brutal-focus',
        view === target ? 'bg-yellow text-on-data' : 'bg-paper',
      )}
    >
      {label}
    </Link>
  )

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b-[3px] border-ink bg-paper px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
      <Link href={`/projects/${projectId}`} className="font-mono text-sm underline brutal-focus">← Frise</Link>
      <h1 className="max-w-md truncate text-xl sm:text-2xl">{projectName}</h1>
      <Badge color="ink">{count} ticket{count > 1 ? 's' : ''}</Badge>
      {!canEdit && <Badge color="cyan">Lecture seule</Badge>}
      <div className="ml-auto flex flex-wrap items-center gap-2 sm:gap-3">
        <nav aria-label="Vue" className="flex gap-2">{tab('board', 'Kanban')}{tab('list', 'Liste')}</nav>
        {canEdit && <Button size="sm" onClick={() => openEditor({ mode: 'create', taskId: null })}>+ Ticket</Button>}
      </div>
      <span className="sr-only" aria-live="polite">Rôle : {myRole}</span>
    </div>
  )
}
```

- [ ] **Step 5: Poser des versions minimales des trois vues restantes**

Pour que la page compile avant les tâches 11 à 13, créer les trois fichiers avec un contenu provisoire **explicitement marqué**, remplacé intégralement plus loin :

`components/tickets/TicketBoard.tsx`, `components/tickets/TicketList.tsx`, `components/tickets/TicketEditor.tsx` :

```tsx
'use client'
// Remplacé intégralement par la tâche 12 (TicketBoard), 13 (TicketList), 11 (TicketEditor).
export function TicketBoard() {
  return <div className="p-8 font-mono">Kanban à venir</div>
}
```

Adapter le nom exporté dans chacun des trois fichiers (`TicketBoard`, `TicketList`, `TicketEditor`).

- [ ] **Step 6: Vérifier**

Run: `npm run typecheck && npm run lint && npm run build`
Attendu : la construction passe.

Vérifier à l'œil, serveur de dev lancé :
- `http://localhost:3100/projects/c0000000-0000-0000-0000-000000000003/tickets` en tant qu'alice affiche la barre d'outils, « 3 tickets » et la bascule de vue.
- `http://localhost:3100/projects/c0000000-0000-0000-0000-000000000001/tickets` (Projet démo, tickets désactivés) en tant qu'alice affiche la carte d'activation.
- La même URL en tant que carol (lectrice du démo) renvoie un 404.

- [ ] **Step 7: Commit**

```bash
git add app/\(app\)/projects/\[id\]/tickets/page.tsx components/tickets/
git commit -m "feat(tickets): page serveur, barre d'outils et carte d'activation"
```

---

## Task 11: Éditeur de ticket

**Files:**
- Create: `components/tickets/TicketEditor.tsx` (remplace le fichier provisoire de la tâche 10)
- Create: `tests/unit/components/tickets/TicketEditor.test.tsx`

**Interfaces:**
- Consomme : `useTicketsStore` / `selectCanEditTickets` (tâche 5), `validateTicketInput` (tâche 6), `getTicketCommands` (tâche 7), `Textarea` (tâche 8).
- Produit : `TicketEditor()`, monté par `TicketsPage`. Aucune prop : il lit l'état `editor` du store.

- [ ] **Step 1: Écrire le test**

Créer `tests/unit/components/tickets/TicketEditor.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketEditor } from '@/components/tickets/TicketEditor'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

const createTicket = vi.fn().mockResolvedValue(makeTicket({ id: 'neuf' }))
const updateTicket = vi.fn().mockResolvedValue(true)
const deleteTicket = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/tickets/client-commands', () => ({
  getTicketCommands: () => ({ createTicket, updateTicket, deleteTicket }),
}))

const existing = makeTicket({ id: 'a', number: 7, title: 'Existant', description: 'Détail', status: 'doing', taskId: 'k1' })

function hydrate(role: 'editor' | 'viewer' = 'editor') {
  useTicketsStore.getState().hydrate({
    projectId: 'p1',
    projectName: 'Projet tickets',
    myRole: role,
    members: [{ userId: 'u1', role: 'editor', displayName: 'Bob', email: 'b@t.l', avatarUrl: null, color: '#FFD500' }],
    tasks: [{ id: 'k1', title: 'Développement' }],
    tickets: [existing],
  })
}

beforeEach(() => {
  createTicket.mockClear()
  updateTicket.mockClear()
  deleteTicket.mockClear()
})

describe('TicketEditor', () => {
  it('ne rend rien quand aucun éditeur n\'est ouvert', () => {
    hydrate()
    const { container } = render(<TicketEditor />)
    expect(container).toBeEmptyDOMElement()
  })

  it('ne rend rien pour un lecteur, même si l\'éditeur est ouvert', () => {
    hydrate('viewer')
    useTicketsStore.getState().openEditor({ mode: 'create', taskId: null })
    const { container } = render(<TicketEditor />)
    expect(container).toBeEmptyDOMElement()
  })

  it('crée un ticket avec le titre nettoyé et la tâche pré-remplie', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'create', taskId: 'k1' })
    render(<TicketEditor />)
    await userEvent.type(screen.getByLabelText('Titre'), '  Corriger la frise  ')
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(createTicket).toHaveBeenCalledWith(expect.objectContaining({ title: '  Corriger la frise  ', taskId: 'k1', status: 'todo' }))
  })

  it('refuse un titre vide par un message inline, sans appeler la commande', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'create', taskId: null })
    render(<TicketEditor />)
    await userEvent.click(screen.getByRole('button', { name: 'Créer' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Le titre est requis')
    expect(createTicket).not.toHaveBeenCalled()
  })

  it('en édition, n\'envoie QUE les champs réellement modifiés', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'edit', ticketId: 'a' })
    render(<TicketEditor />)
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'done')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateTicket).toHaveBeenCalledWith('a', { status: 'done' })
  })

  it('en édition sans aucune modification, n\'écrit rien et referme', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'edit', ticketId: 'a' })
    render(<TicketEditor />)
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateTicket).not.toHaveBeenCalled()
    expect(useTicketsStore.getState().editor).toBeNull()
  })

  it('détache le ticket quand on choisit « Aucune » comme tâche', async () => {
    hydrate()
    useTicketsStore.getState().openEditor({ mode: 'edit', ticketId: 'a' })
    render(<TicketEditor />)
    await userEvent.selectOptions(screen.getByLabelText('Tâche liée'), '')
    await userEvent.click(screen.getByRole('button', { name: 'Enregistrer' }))
    expect(updateTicket).toHaveBeenCalledWith('a', { taskId: null })
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/tickets/TicketEditor.test.tsx`
Attendu : ÉCHEC — le fichier provisoire de la tâche 10 rend « Kanban à venir » et n'expose aucun champ.

- [ ] **Step 3: Écrire l'éditeur**

Remplacer intégralement `components/tickets/TicketEditor.tsx` :

```tsx
'use client'
import { useState, type FormEvent } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { getTicketCommands } from '@/lib/tickets/client-commands'
import { DESCRIPTION_MAX_LENGTH, TITLE_MAX_LENGTH, validateTicketInput, type TicketErrors } from '@/lib/tickets/validate'
import { STATUS_LABELS, STATUS_ORDER, type Ticket, type TicketPatch, type TicketStatus } from '@/lib/tickets/types'
import { Dialog } from '@/components/ui/Dialog'
import { Input } from '@/components/ui/Input'
import { Textarea } from '@/components/ui/Textarea'
import { Select } from '@/components/ui/Select'
import { Button } from '@/components/ui/Button'

const FORM_ID = 'ticket-editor'

export function TicketEditor() {
  const editor = useTicketsStore((s) => s.editor)
  const canEdit = useTicketsStore(selectCanEditTickets)
  const existing = useTicketsStore((s) => (editor?.mode === 'edit' ? s.tickets[editor.ticketId] : undefined))

  if (!editor) return null
  // Défense en profondeur : les points d'ouverture filtrent déjà sur `canEdit`, mais
  // `openEditor` reste appelable et un lecteur ne doit jamais voir un formulaire dont chaque
  // écriture serait refusée par la RLS.
  if (!canEdit) return null
  // Le ticket visé a disparu pendant que la modale était ouverte (suppression optimiste, ou
  // rechargement) : on ne rend pas un formulaire sur du vide.
  if (editor.mode === 'edit' && !existing) return null

  return (
    <TicketEditorForm
      // La clé remonte le mode ET l'ancre : sans elle, passer d'une création rattachée à une
      // autre garderait la tâche de la précédente dans l'état du formulaire.
      key={editor.mode === 'edit' ? `edit:${editor.ticketId}` : `create:${editor.taskId ?? ''}`}
      existing={existing}
      defaultTaskId={editor.mode === 'create' ? editor.taskId : (existing?.taskId ?? null)}
    />
  )
}

/** Champs réellement modifiés : inutile d'écrire (et d'annuler) ce que l'utilisateur n'a pas touché. */
function changedFields(before: Ticket, next: TicketPatch): TicketPatch {
  const out: Record<string, unknown> = {}
  const source = before as unknown as Record<string, unknown>
  for (const [key, value] of Object.entries(next)) {
    if (source[key] !== value) out[key] = value
  }
  return out as TicketPatch
}

function TicketEditorForm({ existing, defaultTaskId }: { existing?: Ticket; defaultTaskId: string | null }) {
  const closeEditor = useTicketsStore((s) => s.closeEditor)
  const members = useTicketsStore((s) => s.members)
  const tasks = useTicketsStore((s) => s.tasks)

  const [title, setTitle] = useState(existing?.title ?? '')
  const [description, setDescription] = useState(existing?.description ?? '')
  const [status, setStatus] = useState<TicketStatus>(existing?.status ?? 'todo')
  const [assigneeId, setAssigneeId] = useState(existing?.assigneeId ?? '')
  const [taskId, setTaskId] = useState(defaultTaskId ?? '')
  const [errors, setErrors] = useState<TicketErrors>({})
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const verdict = validateTicketInput({ title, description })
    if (!verdict.ok) {
      setErrors(verdict.errors)
      return
    }
    // Politique d'erreur du projet : le message inline disparaît dès que la saisie est valide,
    // la suite ne peut plus échouer que sur la persistance — signalée par un toast.
    setErrors({})
    setBusy(true)
    const cmd = getTicketCommands()
    const fields = {
      title,
      description,
      status,
      // Chaîne vide = « personne » / « aucune tâche ». En base, c'est `null`.
      assigneeId: assigneeId || null,
      taskId: taskId || null,
    }

    let ok: boolean
    if (existing) {
      const patch = changedFields(existing, { ...fields, title: title.trim() })
      // Enregistrer sans rien avoir changé n'a pas à produire d'écriture : `updateTicket`
      // refuse d'ailleurs un patch vide, et rester ouvert sur ce refus serait incompréhensible.
      ok = Object.keys(patch).length === 0 ? true : await cmd.updateTicket(existing.id, patch)
    } else {
      ok = (await cmd.createTicket(fields)) !== null
    }
    setBusy(false)
    if (ok) closeEditor()
  }

  async function remove() {
    if (!existing) return
    if (!window.confirm(`Supprimer le ticket #${existing.number} « ${existing.title} » ?`)) return
    // Fermeture AVANT l'attente : la suppression est optimiste, le ticket quitte le store
    // immédiatement et la modale n'aurait plus rien à éditer. L'échec reste signalé par le toast.
    closeEditor()
    await getTicketCommands().deleteTicket(existing.id)
  }

  return (
    <Dialog
      open
      onClose={closeEditor}
      title={existing ? `Ticket #${existing.number}` : 'Nouveau ticket'}
      footer={
        <>
          {existing && <Button variant="danger" onClick={remove} disabled={busy} className="mr-auto">Supprimer</Button>}
          <Button variant="secondary" onClick={closeEditor} disabled={busy}>Annuler</Button>
          <Button type="submit" form={FORM_ID} disabled={busy}>{existing ? 'Enregistrer' : 'Créer'}</Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={submit} className="space-y-4">
        <Input
          label="Titre"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors.title}
          maxLength={TITLE_MAX_LENGTH}
          autoFocus
        />
        <Textarea
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          error={errors.description}
          maxLength={DESCRIPTION_MAX_LENGTH}
        />
        <Select
          label="Statut"
          value={status}
          onChange={(e) => setStatus(e.target.value as TicketStatus)}
          options={STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
        />
        <Select
          label="Assigné à"
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          options={[{ value: '', label: 'Personne' }, ...members.map((m) => ({ value: m.userId, label: m.displayName }))]}
        />
        <Select
          label="Tâche liée"
          value={taskId}
          onChange={(e) => setTaskId(e.target.value)}
          options={[{ value: '', label: 'Aucune' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
        />
      </form>
    </Dialog>
  )
}
```

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/components/tickets/TicketEditor.test.tsx`
Attendu : PASS, sept tests.

- [ ] **Step 5: Commit**

```bash
git add components/tickets/TicketEditor.tsx tests/unit/components/tickets/TicketEditor.test.tsx
git commit -m "feat(tickets): éditeur de ticket"
```

---

## Task 12: Kanban

**Files:**
- Create: `components/tickets/useTicketDrag.ts`
- Create: `components/tickets/TicketCard.tsx`
- Create: `components/tickets/TicketColumn.tsx`
- Create: `components/tickets/TicketBoard.tsx` (remplace le fichier provisoire de la tâche 10)
- Create: `tests/unit/components/tickets/TicketBoard.test.tsx`

**Interfaces:**
- Consomme : `useTicketsStore` / `selectCanEditTickets` (tâche 5), `ticketsByStatus` (tâche 5), `getTicketCommands` (tâche 7).
- Produit :
  - `useTicketDrag(): TicketDragHandlers` avec `onCardPointerDown(e, ticketId)`, `onPointerMove(e)`, `onPointerUp(e)`
  - `TicketCard({ ticket, onPointerDown })`
  - `TicketColumn({ status, tickets, onCardPointerDown })`
  - `TicketBoard()`

- [ ] **Step 1: Écrire le geste**

Créer `components/tickets/useTicketDrag.ts` :

```ts
'use client'
import { useCallback, useMemo, type PointerEvent } from 'react'
import { useTicketsStore } from '@/lib/tickets/store'
import { getTicketCommands } from '@/lib/tickets/client-commands'
import type { TicketStatus } from '@/lib/tickets/types'

export interface TicketDragHandlers {
  onCardPointerDown(e: PointerEvent, ticketId: string): void
  onPointerMove(e: PointerEvent): void
  onPointerUp(e: PointerEvent): void
}

function columnUnder(x: number, y: number): TicketStatus | null {
  const status = document.elementFromPoint(x, y)?.closest<HTMLElement>('[data-column-status]')?.dataset.columnStatus
  return status === 'todo' || status === 'doing' || status === 'done' ? status : null
}

/**
 * Glisser-déposer d'une carte entre colonnes, AU POINTEUR et non en glisser-déposer HTML natif :
 * ce dernier est inutilisable au doigt, et l'application se veut praticable sur téléphone.
 *
 * Même discipline que `useReorderDrag` : le geste n'écrit qu'un `overStatus` dans le store — la
 * colonne survolée s'en sert pour s'éclairer — et une seule commande part au relâchement, jamais
 * une par colonne traversée.
 *
 * Le dépôt ne change QUE le statut. Il n'existe pas d'ordre manuel dans une colonne : les cartes
 * y sont rangées par numéro, et déposer une carte dans sa propre colonne ne fait donc rien.
 */
export function useTicketDrag(): TicketDragHandlers {
  const onCardPointerDown = useCallback((e: PointerEvent, ticketId: string) => {
    if (e.button !== 0) return
    const s = useTicketsStore.getState()
    if (s.myRole === 'viewer') return
    const ticket = s.tickets[ticketId]
    if (!ticket) return
    try {
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    } catch {
      // Pointeur déjà relâché : le geste reste utilisable, il passera par le survol.
    }
    s.setDrag({ ticketId, overStatus: ticket.status })
  }, [])

  const onPointerMove = useCallback((e: PointerEvent) => {
    const s = useTicketsStore.getState()
    const d = s.drag
    if (!d) return
    const status = columnUnder(e.clientX, e.clientY)
    // Écrire un état identique à chaque image re-rendrait tout le tableau pour rien.
    if (!status || status === d.overStatus) return
    s.setDrag({ ...d, overStatus: status })
  }, [])

  const onPointerUp = useCallback(async () => {
    const s = useTicketsStore.getState()
    const d = s.drag
    if (!d) return
    // L'aperçu tombe AVANT l'écriture : la commande est optimiste, laisser la colonne éclairée
    // superposerait le repère de dépôt au résultat déjà appliqué.
    s.setDrag(null)
    const ticket = s.tickets[d.ticketId]
    if (!ticket || ticket.status === d.overStatus) return
    await getTicketCommands().updateTicket(d.ticketId, { status: d.overStatus })
  }, [])

  return useMemo(
    () => ({ onCardPointerDown, onPointerMove, onPointerUp }),
    [onCardPointerDown, onPointerMove, onPointerUp],
  )
}
```

- [ ] **Step 2: Écrire la carte**

Créer `components/tickets/TicketCard.tsx` :

```tsx
'use client'
import type { PointerEvent } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { getTicketCommands } from '@/lib/tickets/client-commands'
import { STATUS_LABELS, STATUS_ORDER, type Ticket } from '@/lib/tickets/types'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils'

export function TicketCard({ ticket, onPointerDown }: {
  ticket: Ticket
  onPointerDown: (e: PointerEvent, ticketId: string) => void
}) {
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)
  const dragging = useTicketsStore((s) => s.drag?.ticketId === ticket.id)
  const assignee = useTicketsStore((s) => s.members.find((m) => m.userId === ticket.assigneeId))
  const taskTitle = useTicketsStore((s) => s.tasks.find((t) => t.id === ticket.taskId)?.title)

  const index = STATUS_ORDER.indexOf(ticket.status)
  const previous = STATUS_ORDER[index - 1]
  const next = STATUS_ORDER[index + 1]

  function move(to: (typeof STATUS_ORDER)[number]) {
    void getTicketCommands().updateTicket(ticket.id, { status: to })
  }

  return (
    <article
      data-ticket-id={ticket.id}
      aria-label={`#${ticket.number} ${ticket.title}`}
      onPointerDown={(e) => onPointerDown(e, ticket.id)}
      onClick={() => canEdit && openEditor({ mode: 'edit', ticketId: ticket.id })}
      className={cn(
        'group/card flex flex-col gap-2 border-[3px] border-ink bg-paper p-3 select-none',
        canEdit && 'cursor-grab active:cursor-grabbing',
        // La carte en cours de déplacement s'efface : c'est la colonne éclairée qui porte
        // l'information « où ça va tomber », pas la carte qui la quitte.
        dragging && 'opacity-40',
      )}
    >
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs text-ink-soft">#{ticket.number}</span>
        {assignee && (
          <span className="ml-auto">
            <Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />
          </span>
        )}
      </div>
      <p className="text-sm font-bold leading-snug">{ticket.title}</p>
      {taskTitle && <p className="truncate font-mono text-xs text-ink-soft">↳ {taskTitle}</p>}
      {canEdit && (
        // Les flèches sont l'équivalent ACCESSIBLE du glisser-déposer : sans elles, changer un
        // statut serait impossible au clavier. Elles suivent la règle de l'application —
        // discrètes au repos, présentes au survol, au focus et sur écran tactile.
        <div className="flex gap-1 opacity-0 transition-opacity group-hover/card:opacity-100 focus-within:opacity-100 touch:opacity-100">
          {previous && (
            <button
              type="button"
              aria-label={`Déplacer vers ${STATUS_LABELS[previous]}`}
              className="size-6 border-[3px] border-ink bg-paper font-mono text-xs leading-none hover:bg-yellow hover:text-on-data brutal-focus"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); move(previous) }}
            >
              ←
            </button>
          )}
          {next && (
            <button
              type="button"
              aria-label={`Déplacer vers ${STATUS_LABELS[next]}`}
              className="size-6 border-[3px] border-ink bg-paper font-mono text-xs leading-none hover:bg-yellow hover:text-on-data brutal-focus"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => { e.stopPropagation(); move(next) }}
            >
              →
            </button>
          )}
        </div>
      )}
    </article>
  )
}
```

- [ ] **Step 3: Écrire la colonne**

Créer `components/tickets/TicketColumn.tsx` :

```tsx
'use client'
import type { PointerEvent } from 'react'
import { useTicketsStore } from '@/lib/tickets/store'
import { STATUS_LABELS, type Ticket, type TicketStatus } from '@/lib/tickets/types'
import { TicketCard } from './TicketCard'
import { cn } from '@/lib/utils'

export function TicketColumn({ status, tickets, onCardPointerDown }: {
  status: TicketStatus
  tickets: Ticket[]
  onCardPointerDown: (e: PointerEvent, ticketId: string) => void
}) {
  // Éclairée seulement si un geste est en cours ET qu'il vise CETTE colonne : sans la première
  // condition, la colonne du ticket survolé s'allumerait au simple passage de la souris.
  const isDropTarget = useTicketsStore((s) => s.drag !== null && s.drag.overStatus === status)

  return (
    <section
      data-column-status={status}
      aria-label={STATUS_LABELS[status]}
      className={cn(
        'flex min-h-0 flex-col border-[3px] border-ink bg-band',
        isDropTarget && 'bg-yellow',
      )}
    >
      <header className="flex items-center justify-between border-b-[3px] border-ink px-3 py-2">
        <h2 className="font-display uppercase text-sm">{STATUS_LABELS[status]}</h2>
        <span className="font-mono text-xs text-ink-soft">{tickets.length}</span>
      </header>
      <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2">
        {tickets.map((t) => <TicketCard key={t.id} ticket={t} onPointerDown={onCardPointerDown} />)}
        {tickets.length === 0 && <p className="p-2 font-mono text-xs text-ink-soft">Vide</p>}
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Écrire le tableau**

Remplacer intégralement `components/tickets/TicketBoard.tsx` :

```tsx
'use client'
import { useMemo } from 'react'
import { useTicketsStore } from '@/lib/tickets/store'
import { ticketsByStatus } from '@/lib/tickets/summary'
import { STATUS_ORDER } from '@/lib/tickets/types'
import { TicketColumn } from './TicketColumn'
import { useTicketDrag } from './useTicketDrag'

export function TicketBoard() {
  const tickets = useTicketsStore((s) => s.tickets)
  const drag = useTicketDrag()
  // Mémoïsé : `ticketsByStatus` construit trois tableaux neufs à chaque appel, et le sélecteur
  // Zustand compare par référence — le calculer dans le sélecteur bouclerait.
  const columns = useMemo(() => ticketsByStatus(Object.values(tickets)), [tickets])

  return (
    <div
      className="grid min-h-0 flex-1 gap-3 overflow-y-auto p-3 sm:gap-4 sm:p-6 md:grid-cols-3"
      onPointerMove={drag.onPointerMove}
      onPointerUp={drag.onPointerUp}
      // Un pointeur qui quitte la fenêtre en plein geste laisserait la colonne éclairée pour
      // toujours : on traite l'annulation comme un relâchement.
      onPointerCancel={drag.onPointerUp}
    >
      {STATUS_ORDER.map((status) => (
        <TicketColumn key={status} status={status} tickets={columns[status]} onCardPointerDown={drag.onCardPointerDown} />
      ))}
    </div>
  )
}
```

- [ ] **Step 5: Écrire le test**

Créer `tests/unit/components/tickets/TicketBoard.test.tsx` :

```tsx
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketBoard } from '@/components/tickets/TicketBoard'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

const updateTicket = vi.fn().mockResolvedValue(true)
vi.mock('@/lib/tickets/client-commands', () => ({
  getTicketCommands: () => ({ createTicket: vi.fn(), updateTicket, deleteTicket: vi.fn() }),
}))

const todo = makeTicket({ id: 'a', number: 1, title: 'À faire ça', status: 'todo', taskId: 'k1' })
const doing = makeTicket({ id: 'b', number: 2, title: 'En cours ça', status: 'doing' })

function hydrate(role: 'editor' | 'viewer' = 'editor') {
  useTicketsStore.getState().hydrate({
    projectId: 'p1',
    projectName: 'Projet tickets',
    myRole: role,
    members: [],
    tasks: [{ id: 'k1', title: 'Développement' }],
    tickets: [todo, doing],
  })
}

beforeEach(() => updateTicket.mockClear())

describe('TicketBoard', () => {
  it('rend les trois colonnes, avec leur compteur, même vides', () => {
    hydrate()
    render(<TicketBoard />)
    expect(within(screen.getByRole('region', { name: 'À faire' })).getByText('1')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Terminé' })).getByText('Vide')).toBeInTheDocument()
  })

  it('range chaque ticket dans sa colonne et montre sa tâche liée', () => {
    hydrate()
    render(<TicketBoard />)
    const column = screen.getByRole('region', { name: 'À faire' })
    expect(within(column).getByRole('article', { name: '#1 À faire ça' })).toBeInTheDocument()
    expect(within(column).getByText('↳ Développement')).toBeInTheDocument()
  })

  it('la flèche avance le statut d\'une colonne', async () => {
    hydrate()
    render(<TicketBoard />)
    const card = screen.getByRole('article', { name: '#1 À faire ça' })
    await userEvent.click(within(card).getByRole('button', { name: 'Déplacer vers En cours' }))
    expect(updateTicket).toHaveBeenCalledWith('a', { status: 'doing' })
  })

  it('pas de flèche « précédent » sur la première colonne ni « suivant » sur la dernière', () => {
    hydrate()
    render(<TicketBoard />)
    const card = screen.getByRole('article', { name: '#1 À faire ça' })
    expect(within(card).queryByRole('button', { name: /Déplacer vers À faire/ })).not.toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'Déplacer vers En cours' })).toBeInTheDocument()
  })

  it('un lecteur ne voit AUCUNE commande de déplacement', () => {
    hydrate('viewer')
    render(<TicketBoard />)
    expect(screen.queryByRole('button', { name: /Déplacer vers/ })).not.toBeInTheDocument()
  })

  it('un clic sur la carte ouvre l\'éditeur, un clic sur une flèche ne l\'ouvre pas', async () => {
    hydrate()
    render(<TicketBoard />)
    const card = screen.getByRole('article', { name: '#1 À faire ça' })
    await userEvent.click(within(card).getByRole('button', { name: 'Déplacer vers En cours' }))
    expect(useTicketsStore.getState().editor).toBeNull()
    await userEvent.click(card)
    expect(useTicketsStore.getState().editor).toEqual({ mode: 'edit', ticketId: 'a' })
  })
})
```

- [ ] **Step 6: Vérifier**

Run: `npx vitest run tests/unit/components/tickets/TicketBoard.test.tsx`
Attendu : PASS, six tests.

Run: `npm run typecheck && npm run lint`
Attendu : pas d'erreur.

Vérifier à la main sur `http://localhost:3100/projects/c0000000-0000-0000-0000-000000000003/tickets` : trois colonnes, trois tickets répartis, et une carte glissée d'une colonne à l'autre change bien de statut après relâchement.

- [ ] **Step 7: Commit**

```bash
git add components/tickets/useTicketDrag.ts components/tickets/TicketCard.tsx components/tickets/TicketColumn.tsx components/tickets/TicketBoard.tsx tests/unit/components/tickets/TicketBoard.test.tsx
git commit -m "feat(tickets): kanban à trois colonnes, glisser-déposer et flèches au clavier"
```

---

## Task 13: Vue liste et filtres

**Files:**
- Create: `components/tickets/TicketList.tsx` (remplace le fichier provisoire de la tâche 10)
- Create: `tests/unit/components/tickets/TicketList.test.tsx`

**Interfaces:**
- Consomme : `useTicketsStore` / `selectCanEditTickets` (tâche 5), `filterTickets` (tâche 5).
- Produit : `TicketList()`, monté par `TicketsPage` quand `?vue=liste`.

- [ ] **Step 1: Écrire le test**

Créer `tests/unit/components/tickets/TicketList.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TicketList } from '@/components/tickets/TicketList'
import { useTicketsStore } from '@/lib/tickets/store'
import { makeTicket } from '../../lib/tickets/fixtures'

const a = makeTicket({ id: 'a', number: 1, title: 'Alpha', status: 'todo', assigneeId: 'u1', taskId: 'k1' })
const b = makeTicket({ id: 'b', number: 2, title: 'Beta', status: 'done', assigneeId: null, taskId: null })

function hydrate() {
  useTicketsStore.getState().hydrate({
    projectId: 'p1',
    projectName: 'Projet tickets',
    myRole: 'editor',
    members: [{ userId: 'u1', role: 'editor', displayName: 'Bob', email: 'b@t.l', avatarUrl: null, color: '#FFD500' }],
    tasks: [{ id: 'k1', title: 'Développement' }],
    tickets: [b, a],
  })
}

describe('TicketList', () => {
  it('trie par numéro croissant quel que soit l\'ordre reçu', () => {
    hydrate()
    render(<TicketList />)
    const rows = screen.getAllByRole('row').slice(1)
    expect(rows[0]).toHaveTextContent('Alpha')
    expect(rows[1]).toHaveTextContent('Beta')
  })

  it('filtre par statut', async () => {
    hydrate()
    render(<TicketList />)
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'done')
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('filtre sur « Personne » et sur « Aucune tâche »', async () => {
    hydrate()
    render(<TicketList />)
    await userEvent.selectOptions(screen.getByLabelText('Assigné'), '')
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.queryByText('Alpha')).not.toBeInTheDocument()
    await userEvent.selectOptions(screen.getByLabelText('Assigné'), 'all')
    await userEvent.selectOptions(screen.getByLabelText('Tâche'), 'k1')
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.queryByText('Beta')).not.toBeInTheDocument()
  })

  it('dit que le filtre ne rend rien plutôt que d\'afficher un tableau vide sans explication', async () => {
    hydrate()
    render(<TicketList />)
    await userEvent.selectOptions(screen.getByLabelText('Statut'), 'doing')
    expect(screen.getByText(/Aucun ticket ne correspond/)).toBeInTheDocument()
  })

  it('un clic sur une ligne ouvre l\'éditeur du bon ticket', async () => {
    hydrate()
    render(<TicketList />)
    await userEvent.click(screen.getByRole('button', { name: /#1 Alpha/ }))
    expect(useTicketsStore.getState().editor).toEqual({ mode: 'edit', ticketId: 'a' })
  })
})
```

- [ ] **Step 2: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/tickets/TicketList.test.tsx`
Attendu : ÉCHEC — le fichier provisoire ne rend aucun tableau.

- [ ] **Step 3: Écrire la vue liste**

Remplacer intégralement `components/tickets/TicketList.tsx` :

```tsx
'use client'
import { useMemo } from 'react'
import { useTicketsStore, selectCanEditTickets } from '@/lib/tickets/store'
import { filterTickets } from '@/lib/tickets/summary'
import { STATUS_LABELS, STATUS_ORDER, type TicketStatus } from '@/lib/tickets/types'
import type { BadgeColor } from '@/components/ui/Badge'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { Select } from '@/components/ui/Select'

const STATUS_COLOR: Record<TicketStatus, BadgeColor> = { todo: 'ink', doing: 'blue', done: 'emerald' }

export function TicketList() {
  const tickets = useTicketsStore((s) => s.tickets)
  const filters = useTicketsStore((s) => s.filters)
  const setFilter = useTicketsStore((s) => s.setFilter)
  const members = useTicketsStore((s) => s.members)
  const tasks = useTicketsStore((s) => s.tasks)
  const canEdit = useTicketsStore(selectCanEditTickets)
  const openEditor = useTicketsStore((s) => s.openEditor)

  // Mémoïsé : `filterTickets` rend un tableau neuf à chaque appel, et le sélecteur Zustand
  // compare par référence — le calculer dans le sélecteur bouclerait.
  const rows = useMemo(() => filterTickets(Object.values(tickets), filters), [tickets, filters])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-3 sm:p-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Select
          label="Statut"
          value={filters.status}
          onChange={(e) => setFilter('status', e.target.value as TicketStatus | 'all')}
          options={[{ value: 'all', label: 'Tous' }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_LABELS[s] }))]}
        />
        {/* `'all'` et la chaîne vide sont DEUX valeurs distinctes : « tout le monde » et
            « personne ». Les confondre rendrait le second filtre inatteignable. */}
        <Select
          label="Assigné"
          value={filters.assigneeId}
          onChange={(e) => setFilter('assigneeId', e.target.value)}
          options={[{ value: 'all', label: 'Tous' }, { value: '', label: 'Personne' }, ...members.map((m) => ({ value: m.userId, label: m.displayName }))]}
        />
        <Select
          label="Tâche"
          value={filters.taskId}
          onChange={(e) => setFilter('taskId', e.target.value)}
          options={[{ value: 'all', label: 'Toutes' }, { value: '', label: 'Aucune' }, ...tasks.map((t) => ({ value: t.id, label: t.title }))]}
        />
      </div>

      {rows.length === 0 ? (
        // Un tableau vide sans un mot laisse croire que le projet n'a pas de ticket, alors que
        // c'est le filtre qui les cache.
        <p className="font-mono text-sm text-ink-soft">Aucun ticket ne correspond à ces filtres.</p>
      ) : (
        // Le tableau défile DANS son propre cadre : sur un téléphone, laisser la page défiler
        // horizontalement décalerait aussi la barre d'outils.
        <div className="overflow-x-auto border-[3px] border-ink">
          <table className="w-full border-collapse bg-paper text-sm">
            <thead>
              <tr className="border-b-[3px] border-ink bg-band text-left">
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">#</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Titre</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Statut</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Assigné</th>
                <th scope="col" className="px-3 py-2 font-display uppercase text-xs">Tâche</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const assignee = members.find((m) => m.userId === t.assigneeId)
                const task = tasks.find((k) => k.id === t.taskId)
                return (
                  <tr key={t.id} className="border-b border-ink/20 last:border-b-0">
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">#{t.number}</td>
                    <td className="px-3 py-2">
                      {/* Un vrai bouton et non une ligne cliquable : la liste doit se parcourir
                          au clavier, et une balise `tr` avec un `onClick` n'est atteignable par
                          aucune tabulation. */}
                      {canEdit ? (
                        <button
                          type="button"
                          className="text-left font-bold underline brutal-focus"
                          onClick={() => openEditor({ mode: 'edit', ticketId: t.id })}
                        >
                          #{t.number} {t.title}
                        </button>
                      ) : (
                        <span className="font-bold">{t.title}</span>
                      )}
                    </td>
                    <td className="px-3 py-2"><Badge color={STATUS_COLOR[t.status]}>{STATUS_LABELS[t.status]}</Badge></td>
                    <td className="px-3 py-2">
                      {assignee
                        ? <span className="flex items-center gap-2"><Avatar name={assignee.displayName} color={assignee.color} src={assignee.avatarUrl} size="sm" />{assignee.displayName}</span>
                        : <span className="font-mono text-xs text-ink-soft">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-ink-soft">{task?.title ?? '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
```

Le libellé du bouton contient `#{t.number} {t.title}`, d'où le titre visible « #1 Alpha » attendu par le test.

- [ ] **Step 4: Vérifier que le test passe**

Run: `npx vitest run tests/unit/components/tickets/TicketList.test.tsx`
Attendu : PASS, cinq tests.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert.

- [ ] **Step 5: Commit**

```bash
git add components/tickets/TicketList.tsx tests/unit/components/tickets/TicketList.test.tsx
git commit -m "feat(tickets): vue liste filtrable"
```

---

# Lot 4 — Branchement dans le Gantt

## Task 14: Compteur de tickets sur la ligne de tâche

**Files:**
- Modify: `app/(app)/projects/[id]/page.tsx:29-40` (lecture) et `:76-88` (charge utile)
- Modify: `lib/gantt/store.ts:6-46` (charge utile et état) et `:70-84` (hydrate)
- Modify: `components/gantt/SidebarRow.tsx:88-92` (colonne du compteur)
- Create: `tests/unit/components/gantt/SidebarTicketCount.test.tsx`

**Interfaces:**
- Consomme : `groupByTask`, `countDone`, `TicketRowSummary` (tâche 5).
- Produit : `HydratePayload` et `GanttState` gagnent `ticketsEnabled: boolean` et `ticketsByTask: Record<string, TicketSummary[]>`. La tâche 15 consomme les deux.

- [ ] **Step 1: Étendre le store du Gantt**

Dans `lib/gantt/store.ts`, ajouter l'import :

```ts
import type { TicketSummary } from '@/lib/tickets/types'
```

Ajouter à `HydratePayload` :

```ts
  /** Le projet affiche-t-il ses tickets. Faux : ni lien, ni compteur, ni section dans l'éditeur. */
  ticketsEnabled?: boolean
  /**
   * RÉSUMÉ seulement, groupé par tâche. Le store du Gantt ne contient volontairement aucun
   * ticket complet : le backlog vit dans `lib/tickets`, sur sa propre route.
   */
  ticketsByTask?: Record<string, TicketSummary[]>
```

Ajouter à `GanttState`, à côté de `invitations` :

```ts
  ticketsEnabled: boolean
  ticketsByTask: Record<string, TicketSummary[]>
```

Ajouter aux valeurs initiales : `ticketsEnabled: false,` et `ticketsByTask: {},`

Ajouter dans `hydrate` :

```ts
    ticketsEnabled: p.ticketsEnabled ?? false,
    ticketsByTask: p.ticketsByTask ?? {},
```

- [ ] **Step 2: Lire les tickets rattachés dans la page du Gantt**

Dans `app/(app)/projects/[id]/page.tsx`, élargir la lecture du projet :

```ts
  const { data: project, error: projectError } = await supabase.from('projects').select('id, name, tickets_enabled').eq('id', id).maybeSingle()
```

Ajouter l'import :

```ts
import { countDone, groupByTask, type TicketRowSummary } from '@/lib/tickets/summary'
```

Ajouter la lecture au `Promise.all` existant, en cinquième position :

```ts
    // Tickets RATTACHÉS uniquement, et seulement si le projet les active : un projet sans
    // backlog n'émet même pas la requête. `.not('task_id', 'is', null)` parce qu'un ticket
    // libre n'a aucune ligne où s'afficher dans la frise.
    project.tickets_enabled
      ? supabase.from('tickets').select('id, number, title, status, task_id').eq('project_id', id).not('task_id', 'is', null)
      : Promise.resolve({ data: [], error: null }),
```

En adaptant la déstructuration :

```ts
  const [membershipsRes, tasksRes, depsRes, invitationsRes, ticketsRes] = await Promise.all([
```

**Ne PAS ajouter `tickets` aux échecs bloquants.** Comme les invitations, c'est un complément : le Gantt fonctionne entièrement sans. Ajouter à la place, à côté du commentaire qui explique déjà ce choix pour les invitations :

```ts
  // Les tickets non plus ne sont PAS bloquants : le compteur disparaît, la frise reste entière.
  // Refuser de rendre un Gantt parce qu'un décompte n'a pas pu être lu serait une régression
  // de disponibilité pour un écran qui n'en dépend pas.
  if (ticketsRes.error) console.error(`[projects/${id}] lecture "tickets" en échec :`, ticketsRes.error.message)
```

Et passer la charge utile :

```ts
        ticketsEnabled: project.tickets_enabled,
        ticketsByTask: groupByTask(
          (ticketsRes.data ?? []).map((t): TicketRowSummary => ({
            id: t.id, number: t.number, title: t.title, status: t.status, taskId: t.task_id,
          })),
        ),
```

- [ ] **Step 3: Écrire le test du compteur**

Créer `tests/unit/components/gantt/SidebarTicketCount.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { Sidebar } from '@/components/gantt/Sidebar'
import { GanttViewContext } from '@/components/gantt/GanttView'
import { useGanttStore } from '@/lib/gantt/store'
import { computeLayout } from '@/lib/gantt/layout'
import { makeTask } from '../../lib/gantt/fixtures'

const task = makeTask({ id: 'k1', title: 'Développement' })

function hydrate(options: { enabled: boolean; done: number; total: number }) {
  const summaries = Array.from({ length: options.total }, (_, i) => ({
    id: `t${i}`, number: i + 1, title: `Ticket ${i + 1}`, status: i < options.done ? ('done' as const) : ('todo' as const),
  }))
  useGanttStore.getState().hydrate({
    projectId: 'p1', projectName: 'D', myRole: 'editor', members: [], today: '2026-09-09',
    tasks: [task], dependencies: [],
    ticketsEnabled: options.enabled,
    ticketsByTask: options.total > 0 ? { k1: summaries } : {},
  })
}

function renderSidebar(compact: boolean) {
  const s = useGanttStore.getState()
  const layout = computeLayout({ tasks: s.tasks, dependencies: s.dependencies }, null, 'day', s.today, 800)
  return render(
    <GanttViewContext.Provider
      value={{ layout, canEdit: true, drag: { onPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} } as never, reorder: { onGripPointerDown: () => {}, onPointerMove: () => {}, onPointerUp: () => {} }, sidebarWidth: 260, compact }}
    >
      <Sidebar />
    </GanttViewContext.Provider>,
  )
}

describe('compteur de tickets dans la sidebar', () => {
  it('affiche « terminés / total » sur une tâche qui a des tickets', () => {
    hydrate({ enabled: true, done: 2, total: 5 })
    renderSidebar(false)
    expect(screen.getByLabelText('2 tickets terminés sur 5')).toHaveTextContent('2/5')
  })

  it('n\'affiche rien sur un projet dont les tickets sont désactivés', () => {
    hydrate({ enabled: false, done: 2, total: 5 })
    renderSidebar(false)
    expect(screen.queryByText('2/5')).not.toBeInTheDocument()
  })

  it('n\'affiche rien sur une tâche sans ticket', () => {
    hydrate({ enabled: true, done: 0, total: 0 })
    renderSidebar(false)
    expect(screen.queryByText(/\d+\/\d+/)).not.toBeInTheDocument()
  })

  it('s\'efface sur un écran étroit, où chaque pixel est pris sur le titre', () => {
    hydrate({ enabled: true, done: 2, total: 5 })
    renderSidebar(true)
    expect(screen.queryByText('2/5')).not.toBeInTheDocument()
  })
})
```

Si la signature exacte du contexte de `GanttView` a changé, relire `components/gantt/GanttView.tsx` et aligner l'objet passé au `Provider` : ce test ne doit jamais forcer une modification du composant testé.

- [ ] **Step 4: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/gantt/SidebarTicketCount.test.tsx`
Attendu : ÉCHEC sur le premier test, `Unable to find a label with the text of: 2 tickets terminés sur 5`.

- [ ] **Step 5: Ajouter le compteur**

Dans `components/gantt/SidebarRow.tsx`, ajouter l'import :

```ts
import { countDone } from '@/lib/tickets/summary'
```

Ajouter le sélecteur, à côté de celui de l'assigné :

```ts
  const ticketsEnabled = useGanttStore((s) => s.ticketsEnabled)
  // La référence du tableau vient du store et reste stable entre deux rendus : la lire
  // directement ne provoque pas de boucle, contrairement à un calcul fait dans le sélecteur.
  const ticketSummaries = useGanttStore((s) => s.ticketsByTask[task.id])
```

Puis, juste AVANT l'avatar de l'assigné dans le JSX :

```tsx
      {/* Compteur de tickets, effacé en mode compact comme l'avatar : sur un téléphone, ces
          quelques pixels sont pris sur le titre, qui est la seule chose indispensable. */}
      {ticketsEnabled && ticketSummaries && ticketSummaries.length > 0 && !compact && (() => {
        const { done, total } = countDone(ticketSummaries)
        return (
          <span
            aria-label={`${done} ticket${done > 1 ? 's' : ''} terminé${done > 1 ? 's' : ''} sur ${total}`}
            className="shrink-0 font-mono text-xs text-ink-soft"
          >
            {done}/{total}
          </span>
        )
      })()}
```

- [ ] **Step 6: Vérifier**

Run: `npx vitest run tests/unit/components/gantt/SidebarTicketCount.test.tsx`
Attendu : PASS, quatre tests.

Run: `npm test && npm run typecheck && npm run lint`
Attendu : tout au vert, y compris les tests existants du Gantt.

- [ ] **Step 7: Commit**

```bash
git add lib/gantt/store.ts app/\(app\)/projects/\[id\]/page.tsx components/gantt/SidebarRow.tsx tests/unit/components/gantt/SidebarTicketCount.test.tsx
git commit -m "feat(gantt): compteur de tickets sur les lignes de tâche"
```

---

## Task 15: Lien et section « Tickets » dans le Gantt

**Files:**
- Modify: `lib/tickets/types.ts` (accueille la table des couleurs de statut)
- Modify: `components/tickets/TicketList.tsx` (importe la table au lieu de la définir)
- Modify: `components/gantt/GanttToolbar.tsx` (lien « Tickets »)
- Modify: `components/gantt/TaskEditor.tsx` (section « Tickets » en mode édition)
- Create: `tests/unit/components/gantt/TaskEditorTickets.test.tsx`

**Interfaces:**
- Consomme : `ticketsEnabled` et `ticketsByTask` du store du Gantt (tâche 14).
- Produit : `TICKET_STATUS_BADGE: Record<TicketStatus, BadgeColor>` dans `@/lib/tickets/types`.

- [ ] **Step 1: Sortir la table des couleurs de statut**

Ajouter à `lib/tickets/types.ts` :

```ts
import type { BadgeColor } from '@/components/ui/Badge'

/**
 * Couleur du badge de chaque statut. Vit ici plutôt que dans un composant : la vue liste et
 * l'éditeur de tâche du Gantt l'affichent tous les deux, et deux tables jumelles finiraient
 * par diverger. L'import est un import de TYPE seul, aucun composant n'est tiré dans `lib`.
 */
export const TICKET_STATUS_BADGE: Record<TicketStatus, BadgeColor> = {
  todo: 'ink',
  doing: 'blue',
  done: 'emerald',
}
```

Dans `components/tickets/TicketList.tsx`, supprimer la constante locale `STATUS_COLOR` et son import `BadgeColor`, puis importer et utiliser `TICKET_STATUS_BADGE` à sa place (deux occurrences : l'import et l'attribut `color` du badge).

Run: `npx vitest run tests/unit/components/tickets/TicketList.test.tsx`
Attendu : PASS, inchangé.

- [ ] **Step 2: Ajouter le lien dans la barre d'outils**

Dans `components/gantt/GanttToolbar.tsx`, ajouter le sélecteur :

```ts
  const projectId = useGanttStore((s) => s.projectId)
  const ticketsEnabled = useGanttStore((s) => s.ticketsEnabled)
```

Et le lien, en tête du groupe de droite, juste avant `<ZoomControls />` :

```tsx
        {/* Affiché SEULEMENT quand les tickets sont activés : la page renvoie un 404 à tout
            membre non propriétaire d'un projet sans backlog, et offrir une porte qui se referme
            serait pire que de ne rien offrir. */}
        {ticketsEnabled && (
          <Link href={`/projects/${projectId}/tickets`} className="font-bold uppercase text-sm underline brutal-focus">
            Tickets
          </Link>
        )}
```

- [ ] **Step 3: Écrire le test de la section dans l'éditeur de tâche**

Créer `tests/unit/components/gantt/TaskEditorTickets.test.tsx` :

```tsx
import { render, screen } from '@testing-library/react'
import { TaskEditor } from '@/components/gantt/TaskEditor'
import { useGanttStore } from '@/lib/gantt/store'
import { makeTask } from '../../lib/gantt/fixtures'

const task = makeTask({ id: 'k1', title: 'Développement' })

function hydrate(options: { enabled: boolean; withTickets: boolean }) {
  useGanttStore.getState().hydrate({
    projectId: 'p1', projectName: 'D', myRole: 'editor', members: [], today: '2026-09-09',
    tasks: [task], dependencies: [],
    ticketsEnabled: options.enabled,
    ticketsByTask: options.withTickets
      ? { k1: [
          { id: 't1', number: 1, title: 'Brancher la connexion', status: 'done' },
          { id: 't2', number: 2, title: 'Dessiner la frise', status: 'doing' },
        ] }
      : {},
  })
}

describe('section « Tickets » de l\'éditeur de tâche', () => {
  it('liste les tickets rattachés avec leur numéro et leur statut', () => {
    hydrate({ enabled: true, withTickets: true })
    useGanttStore.getState().openEditor({ mode: 'edit', taskId: 'k1' })
    render(<TaskEditor />)
    expect(screen.getByText('Brancher la connexion')).toBeInTheDocument()
    expect(screen.getByText('#2')).toBeInTheDocument()
    expect(screen.getByText('En cours')).toBeInTheDocument()
  })

  it('le bouton de création NAVIGUE vers la page des tickets avec la tâche pré-remplie', () => {
    hydrate({ enabled: true, withTickets: true })
    useGanttStore.getState().openEditor({ mode: 'edit', taskId: 'k1' })
    render(<TaskEditor />)
    expect(screen.getByRole('link', { name: '+ Nouveau ticket' })).toHaveAttribute('href', '/projects/p1/tickets?nouveau=k1')
  })

  it('dit qu\'il n\'y a aucun ticket plutôt que de masquer la section', () => {
    hydrate({ enabled: true, withTickets: false })
    useGanttStore.getState().openEditor({ mode: 'edit', taskId: 'k1' })
    render(<TaskEditor />)
    expect(screen.getByText('Aucun ticket rattaché.')).toBeInTheDocument()
  })

  it('aucune section quand les tickets sont désactivés', () => {
    hydrate({ enabled: false, withTickets: false })
    useGanttStore.getState().openEditor({ mode: 'edit', taskId: 'k1' })
    render(<TaskEditor />)
    expect(screen.queryByRole('link', { name: '+ Nouveau ticket' })).not.toBeInTheDocument()
  })

  it('aucune section en CRÉATION : la tâche n\'a pas encore d\'identifiant à rattacher', () => {
    hydrate({ enabled: true, withTickets: true })
    useGanttStore.getState().openEditor({ mode: 'create', parentId: null, type: 'task' })
    render(<TaskEditor />)
    expect(screen.queryByRole('link', { name: '+ Nouveau ticket' })).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Vérifier que le test échoue**

Run: `npx vitest run tests/unit/components/gantt/TaskEditorTickets.test.tsx`
Attendu : ÉCHEC, `Unable to find an element with the text: Brancher la connexion`.

- [ ] **Step 5: Ajouter la section**

Dans `components/gantt/TaskEditor.tsx`, ajouter les imports :

```ts
import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { STATUS_LABELS, TICKET_STATUS_BADGE } from '@/lib/tickets/types'
```

Dans `TaskEditorForm`, ajouter les sélecteurs à côté de `today` :

```ts
  const projectId = useGanttStore((s) => s.projectId)
  const ticketsEnabled = useGanttStore((s) => s.ticketsEnabled)
  const ticketSummaries = useGanttStore((s) => (existing ? s.ticketsByTask[existing.id] : undefined))
```

Puis insérer la section dans le formulaire, après le champ « Groupe » :

```tsx
        {/* Section présente uniquement en ÉDITION : une tâche en cours de création n'a pas
            encore d'identifiant, il n'y aurait rien à rattacher. */}
        {existing && ticketsEnabled && (
          <section className="brutal bg-band px-3 py-2 space-y-2">
            <h3 className="font-bold uppercase text-sm">Tickets</h3>
            {!ticketSummaries || ticketSummaries.length === 0 ? (
              <p className="font-mono text-xs text-ink-soft">Aucun ticket rattaché.</p>
            ) : (
              <ul className="space-y-1">
                {ticketSummaries.map((t) => (
                  <li key={t.id} className="flex items-center gap-2 text-sm">
                    <span className="font-mono text-xs text-ink-soft">#{t.number}</span>
                    <span className="flex-1 truncate">{t.title}</span>
                    <Badge color={TICKET_STATUS_BADGE[t.status]}>{STATUS_LABELS[t.status]}</Badge>
                  </li>
                ))}
              </ul>
            )}
            {/* Un LIEN, pas un bouton : la création n'a pas lieu ici. Le store du Gantt ne
                contient aucun ticket — c'était tout l'intérêt de séparer les deux modules — et
                y brancher les commandes de tickets pour ce seul formulaire réintroduirait le
                couplage qu'on a évité. On emmène l'utilisateur là où le backlog vit, la tâche
                déjà rattachée dans le formulaire. */}
            <Link
              href={`/projects/${projectId}/tickets?nouveau=${existing.id}`}
              className="inline-block font-bold uppercase text-sm underline brutal-focus"
            >
              + Nouveau ticket
            </Link>
          </section>
        )}
```

- [ ] **Step 6: Vérifier**

Run: `npx vitest run tests/unit/components/gantt/TaskEditorTickets.test.tsx`
Attendu : PASS, cinq tests.

Run: `npm test && npm run typecheck && npm run lint && npm run build`
Attendu : tout au vert.

- [ ] **Step 7: Commit**

```bash
git add lib/tickets/types.ts components/tickets/TicketList.tsx components/gantt/GanttToolbar.tsx components/gantt/TaskEditor.tsx tests/unit/components/gantt/TaskEditorTickets.test.tsx
git commit -m "feat(gantt): lien vers les tickets et liste des tickets d'une tâche"
```

---

## Task 16: Parcours de bout en bout

**Files:**
- Create: `tests/e2e/tickets.spec.ts`
- Modify: `tests/e2e/helpers.ts` (ajout d'un helper)

**Interfaces:**
- Consomme : le seed de la tâche 2 et l'interface complète des tâches 9 à 15.
- Produit : `TICKETS_PROJECT` et `createProjectWithTickets(page, name)` dans `tests/e2e/helpers.ts`.

**Règle de cette suite :** les tests qui **lisent** s'appuient sur « Projet tickets » du seed, ceux qui **écrivent** créent leur propre projet. Sans cette séparation, un test d'écriture ferait dériver les décomptes lus par les autres, exactement le piège déjà connu sur « Projet démo ».

- [ ] **Step 1: Ajouter les helpers**

Ajouter à `tests/e2e/helpers.ts` :

```ts
/** Projet de seed dédié aux tickets, en LECTURE SEULE pour les tests : trois tickets, deux tâches. */
export const TICKETS_PROJECT = {
  id: 'c0000000-0000-0000-0000-000000000003',
  name: 'Projet tickets',
  taskId: 'd0000000-0000-0000-0000-0000000000a1',
  taskTitle: 'Développement',
} as const

/**
 * Crée un projet neuf par l'interface et y active les tickets. Tout test qui ÉCRIT passe par
 * là : écrire dans un projet du seed ferait dériver les décomptes que les autres tests lisent.
 */
export async function createProjectWithTickets(page: Page, name: string): Promise<void> {
  await page.goto('/projects')
  await page.getByRole('button', { name: 'Nouveau projet' }).click()
  await page.getByLabel('Nom du projet').fill(name)
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.waitForURL('**/projects/**')
  await page.goto('/projects')
  const card = page.getByRole('article', { name })
  await card.getByRole('button', { name: 'Tickets' }).click()
  await expect(card.getByRole('button', { name: 'Tickets' })).toHaveAttribute('aria-pressed', 'true')
}
```

Compléter l'import en tête du fichier : `import { expect, type Page } from '@playwright/test'`.

Si le libellé du bouton de création de projet diffère, relire `components/project/NewProjectDialog.tsx` et aligner le helper sur l'interface réelle plutôt que l'inverse.

- [ ] **Step 2: Écrire la spec**

Créer `tests/e2e/tickets.spec.ts` :

```ts
import { expect, test } from '@playwright/test'
import { createProjectWithTickets, loginAs, TICKETS_PROJECT } from './helpers'

test('le kanban montre les tickets du projet, rangés par statut', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(`/projects/${TICKETS_PROJECT.id}/tickets`)

  await expect(page.getByRole('region', { name: 'À faire' }).getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'En cours' }).getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('region', { name: 'Terminé' }).getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article', { name: '#1 Brancher la connexion' })).toBeVisible()
  // La tâche liée s'affiche sur la carte : c'est le seul rappel du rattachement côté kanban.
  await expect(page.getByRole('article', { name: '#1 Brancher la connexion' })).toContainText(TICKETS_PROJECT.taskTitle)
})

test('la vue liste filtre par statut et par tâche', async ({ page }) => {
  await loginAs(page, 'alice')
  await page.goto(`/projects/${TICKETS_PROJECT.id}/tickets?vue=liste`)

  await expect(page.getByRole('row')).toHaveCount(4) // en-tête + trois tickets
  await page.getByLabel('Statut').selectOption('done')
  await expect(page.getByRole('row')).toHaveCount(2)
  await expect(page.getByText('Brancher la connexion')).toBeVisible()

  await page.getByLabel('Statut').selectOption('all')
  await page.getByLabel('Tâche').selectOption({ label: 'Aucune' })
  await expect(page.getByText('Écrire le mode d\'emploi')).toBeVisible()
  await expect(page.getByText('Brancher la connexion')).toHaveCount(0)
})

test('créer un ticket, le déplacer à la souris puis au clavier', async ({ page }) => {
  await loginAs(page, 'alice')
  await createProjectWithTickets(page, `Kanban ${Date.now()}`)
  await page.getByRole('link', { name: 'Tickets' }).click()
  await page.waitForURL('**/tickets')

  await page.getByRole('button', { name: '+ Ticket' }).click()
  await page.getByLabel('Titre').fill('Premier ticket')
  await page.getByRole('button', { name: 'Créer' }).click()

  // Le numéro vient du serveur : un projet neuf commence à #1.
  const card = page.getByRole('article', { name: '#1 Premier ticket' })
  await expect(page.getByRole('region', { name: 'À faire' }).getByRole('article')).toHaveCount(1)

  // Glisser jusqu'à la colonne « Terminé ». Le geste est au POINTEUR : une souris Playwright
  // suffit, là où un glisser-déposer HTML natif aurait demandé une simulation à part.
  const target = page.getByRole('region', { name: 'Terminé' })
  const from = await card.boundingBox()
  const to = await target.boundingBox()
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2)
  await page.mouse.down()
  await page.mouse.move(to!.x + to!.width / 2, to!.y + to!.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(target.getByRole('article', { name: '#1 Premier ticket' })).toBeVisible()

  // Retour en arrière par la flèche, seul chemin praticable au clavier.
  await card.getByRole('button', { name: 'Déplacer vers En cours' }).click()
  await expect(page.getByRole('region', { name: 'En cours' }).getByRole('article', { name: '#1 Premier ticket' })).toBeVisible()

  // Le statut a bien été PERSISTÉ, pas seulement appliqué à l'écran.
  await page.reload()
  await expect(page.getByRole('region', { name: 'En cours' }).getByRole('article', { name: '#1 Premier ticket' })).toBeVisible()
})

test('un ticket rattaché à une tâche fait apparaître le compteur dans la frise', async ({ page }) => {
  await loginAs(page, 'alice')
  const name = `Compteur ${Date.now()}`
  await createProjectWithTickets(page, name)
  await page.getByRole('article', { name }).getByRole('link', { name }).click()
  await page.waitForURL('**/projects/**')

  // Une tâche, puis un ticket créé DEPUIS son éditeur : c'est le chemin que la spec décrit.
  await page.getByRole('button', { name: '+ Tâche' }).click()
  await page.getByLabel('Titre').fill('Développement')
  await page.getByRole('button', { name: 'Créer' }).click()
  await page.locator('[data-row-task-id]', { hasText: 'Développement' }).dblclick()
  await expect(page.getByText('Aucun ticket rattaché.')).toBeVisible()
  await page.getByRole('link', { name: '+ Nouveau ticket' }).click()

  // L'éditeur s'ouvre déjà rattaché : `?nouveau=` a pré-rempli le sélecteur.
  await page.waitForURL('**/tickets?nouveau=**')
  await expect(page.getByLabel('Tâche liée')).toHaveValue(/.+/)
  await page.getByLabel('Titre').fill('Brancher la connexion')
  await page.getByRole('button', { name: 'Créer' }).click()

  await page.getByRole('link', { name: '← Frise' }).click()
  await page.waitForURL('**/projects/**')
  await expect(page.getByLabel('0 ticket terminé sur 1')).toBeVisible()
})

test('un lecteur voit les tickets sans aucune commande d\'écriture', async ({ page }) => {
  await loginAs(page, 'carol')
  await page.goto(`/projects/${TICKETS_PROJECT.id}/tickets`)

  await expect(page.getByText('Lecture seule')).toBeVisible()
  await expect(page.getByRole('article', { name: '#1 Brancher la connexion' })).toBeVisible()
  await expect(page.getByRole('button', { name: '+ Ticket' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Déplacer vers/ })).toHaveCount(0)

  // Un clic sur une carte n'ouvre aucun formulaire : chaque écriture serait refusée par la RLS.
  await page.getByRole('article', { name: '#1 Brancher la connexion' }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('un projet sans tickets n\'offre ni lien ni page, sauf à son propriétaire', async ({ page }) => {
  const demoId = 'c0000000-0000-0000-0000-000000000001'

  // Une lectrice du projet démo : aucun lien dans la barre d'outils, et la page renvoie un 404.
  await loginAs(page, 'carol')
  await page.goto(`/projects/${demoId}`)
  await expect(page.getByRole('link', { name: 'Tickets' })).toHaveCount(0)
  const response = await page.goto(`/projects/${demoId}/tickets`)
  expect(response?.status()).toBe(404)

  // La propriétaire, elle, se voit proposer d'activer.
  await loginAs(page, 'alice')
  await page.goto(`/projects/${demoId}/tickets`)
  await expect(page.getByRole('button', { name: 'Activer les tickets' })).toBeVisible()
  // On n'active PAS : le projet démo doit rester sans tickets pour les autres specs.
})
```

- [ ] **Step 3: Lancer la suite**

Run: `npm run test:e2e`
Attendu : toute la suite au vert, les specs existantes comprises.

Deux échecs plausibles à traiter sans contourner :
- Le glisser-déposer ne relâche pas au bon endroit : vérifier que `TicketBoard` porte bien `onPointerMove` / `onPointerUp`, et que la colonne porte `data-column-status`.
- Le test du lecteur trouve un dialogue : c'est un vrai défaut, `TicketCard` ouvre l'éditeur sans vérifier `canEdit`. Corriger le composant, pas le test.

- [ ] **Step 4: Vérification complète avant intégration**

Run: `npm test && npm run test:db && npm run test:e2e && npm run typecheck && npm run lint && npm run build`
Attendu : les six commandes au vert. Ne pas déclarer la fonctionnalité terminée avant d'avoir vu les six sorties.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/tickets.spec.ts tests/e2e/helpers.ts
git commit -m "test(tickets): parcours de bout en bout du backlog"
```

- [ ] **Step 6: Mettre le README à jour**

Insérer dans `README.md`, juste après le tableau des utilisateurs de test :

```markdown
## Tickets

Chaque projet peut ouvrir un backlog de tickets numérotés (`#1`, `#2`, …), rattachables aux
tâches de la frise. Un ticket porte un titre, une description, un statut (À faire / En cours /
Terminé) et un assigné.

La fonctionnalité est **désactivée par défaut**. Le propriétaire l'active depuis le bouton
« Tickets » de la carte du projet, sur `/projects`. La désactiver masque les tickets sans en
supprimer aucun : les réactiver les rend tels quels.

Une fois activés, la barre d'outils de la frise porte un lien « Tickets » vers
`/projects/<id>/tickets`, qui s'ouvre sur un kanban à trois colonnes (`?vue=liste` pour la vue
tableau filtrable). Les lignes de la frise affichent alors un compteur « terminés / total », et
l'éditeur d'une tâche liste ses tickets.

Côté seed, « Projet tickets » est le seul projet avec un backlog, et il sert de terrain aux
tests de bout en bout. « Projet démo » en est volontairement dépourvu : des specs comptent ses
lignes et inspectent sa barre latérale, où un compteur fausserait les décomptes.
```

```bash
git add README.md
git commit -m "docs: le backlog de tickets dans le README"
```

---

## Intégration

Une fois les seize tâches passées et les six commandes de vérification au vert :

```bash
git checkout master
git merge --ff-only feat/04-tickets
git push origin master
```

Le `--ff-only` est délibéré : ce dépôt intègre en avance rapide, sans demande de fusion. Si la fusion est refusée pour non-avance rapide, c'est que `master` a bougé — rebaser `feat/04-tickets` dessus, relancer les vérifications, et recommencer.
