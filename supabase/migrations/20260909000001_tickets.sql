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
-- `project_id` est figé pour la même raison : un ticket déplacé garderait son numéro et
-- pourrait entrer en collision avec le compteur du projet d'arrivée (unique project_id, number).
create or replace function public.check_ticket_number_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.number is distinct from old.number then
    raise exception 'ticket_number_is_read_only';
  end if;
  if new.project_id is distinct from old.project_id then
    raise exception 'ticket_project_is_read_only';
  end if;
  return new;
end $$;

create trigger tickets_number_immutable
before update of number, project_id on public.tickets
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

-- ===== Compteur protégé =====
-- projects_update_owner laisse le propriétaire écrire n'importe quelle colonne : sans ce verrou,
-- il pourrait réécrire ticket_counter et provoquer des doublons de numéros. Le trigger de
-- numérotation (security definer, exécuté par le propriétaire de la fonction, rôle postgres)
-- reste autorisé ; seul un rôle client (anon/authenticated) est refusé.
create or replace function public.check_ticket_counter_immutable() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.ticket_counter is distinct from old.ticket_counter
     and current_user in ('anon', 'authenticated') then
    raise exception 'ticket_counter_is_read_only';
  end if;
  return new;
end $$;

create trigger projects_ticket_counter_immutable
before update of ticket_counter on public.projects
for each row execute function public.check_ticket_counter_immutable();
