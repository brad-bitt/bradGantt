begin;
create extension if not exists pgtap with schema extensions;

-- Indépendant de supabase/seed.sql (mêmes UUID de test) : le rollback final rend la base intacte.
delete from auth.users;

select plan(19);

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
  '42501', null, 'lecteur : insertion refusée par la RLS');
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

-- Le compteur n'est pas écrivable par un client, même par le propriétaire du projet
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select throws_ok(
  $$ update public.projects set ticket_counter = 0 where id = (select project_id from tests.ctx) $$,
  'ticket_counter_is_read_only', 'le propriétaire ne peut pas réécrire ticket_counter');
select tests.logout();

-- Supprimer le projet emporte ses tickets
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
-- Alice est éditrice des deux projets : elle ne peut pourtant pas déplacer un ticket de l'un à l'autre
select throws_ok(
  $$ update public.tickets set project_id = (select project_id from tests.ctxb) where id = 'f0000000-0000-0000-0000-000000000001' $$,
  'ticket_project_is_read_only', 'un ticket ne change pas de projet');
delete from public.projects where id = (select project_id from tests.ctx);
select is((select count(*) from public.tickets), 0::bigint, 'suppression du projet : ses tickets partent avec');
select tests.logout();

-- `tickets_enabled` est faux par défaut : un projet existant ne voit rien changer
select is((select count(*) filter (where not tickets_enabled) from public.projects), (select count(*) from public.projects),
  'tickets_enabled est faux par défaut sur tous les projets');

select * from finish();
rollback;
