begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

-- Helpers de session dans un schéma "tests" : lisibles par le rôle authenticated, annulés par le rollback final
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

-- Utilisateurs
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'alice@test.local'),
  ('a0000000-0000-0000-0000-000000000002', 'bob@test.local'),
  ('a0000000-0000-0000-0000-000000000003', 'carol@test.local'),
  ('a0000000-0000-0000-0000-000000000004', 'dave@test.local');

-- Alice crée un projet, devient owner ; bob editor, carol viewer, dave non-membre
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select public.create_project('Projet RLS');
select tests.logout();
create table tests.ctx as select id as project_id from public.projects where name = 'Projet RLS';
grant select on tests.ctx to authenticated;

insert into public.memberships (project_id, user_id, role)
select project_id, 'a0000000-0000-0000-0000-000000000002', 'editor' from tests.ctx;
insert into public.memberships (project_id, user_id, role)
select project_id, 'a0000000-0000-0000-0000-000000000003', 'viewer' from tests.ctx;
insert into public.tasks (id, project_id, title, start_date, end_date)
select 'b0000000-0000-0000-0000-000000000001', project_id, 'Tâche 1', '2026-09-01', '2026-09-03' from tests.ctx;

-- RLS activée partout
select ok((select bool_and(relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace
  and relname in ('profiles','projects','memberships','invitations','tasks','dependencies')), 'RLS activée sur les 6 tables');

-- Dave (non-membre) ne voit rien
select tests.login_as('a0000000-0000-0000-0000-000000000004', 'dave@test.local');
select is((select count(*) from public.projects), 0::bigint, 'non-membre : aucun projet');
select is((select count(*) from public.tasks), 0::bigint, 'non-membre : aucune tâche');
select is((select count(*) from public.memberships), 0::bigint, 'non-membre : aucune membership');
select is((select count(*) from public.profiles), 4::bigint, 'les profils sont lisibles par tout connecté');
select tests.logout();

-- Carol (viewer) lit mais n'écrit pas
select tests.login_as('a0000000-0000-0000-0000-000000000003', 'carol@test.local');
select is((select count(*) from public.tasks), 1::bigint, 'viewer : lit les tâches');
select throws_ok($$ insert into public.tasks (project_id, title, start_date, end_date)
  select project_id, 'X', '2026-09-01', '2026-09-01' from tests.ctx $$, '42501', null, 'viewer : insert tâche refusé');
update public.tasks set title = 'Piraté' where id = 'b0000000-0000-0000-0000-000000000001';
select tests.logout();
select is((select title from public.tasks where id = 'b0000000-0000-0000-0000-000000000001'), 'Tâche 1', 'viewer : update tâche sans effet');

-- Bob (editor) écrit les tâches mais pas les memberships ni le projet
select tests.login_as('a0000000-0000-0000-0000-000000000002', 'bob@test.local');
select lives_ok($$ insert into public.tasks (project_id, title, start_date, end_date)
  select project_id, 'Tâche de Bob', '2026-09-01', '2026-09-01' from tests.ctx $$, 'editor : insert tâche ok');
select throws_ok($$ insert into public.memberships (project_id, user_id, role)
  select project_id, 'a0000000-0000-0000-0000-000000000004', 'viewer' from tests.ctx $$, '42501', null, 'editor : insert membership refusé');
update public.projects set name = 'Renommé par Bob';
select throws_ok($$ insert into public.invitations (project_id, email, role, token, invited_by)
  select project_id, 'x@test.local', 'viewer', 'tok', 'a0000000-0000-0000-0000-000000000002' from tests.ctx $$, '42501', null, 'editor : insert invitation refusé');
select tests.logout();
select is((select name from public.projects limit 1), 'Projet RLS', 'editor : rename projet sans effet');

-- Alice (owner) gère les membres mais ne touche pas à sa propre ligne owner
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001';
update public.memberships set role = 'viewer' where user_id = 'a0000000-0000-0000-0000-000000000001';
delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000002';
select lives_ok($$ update public.projects set name = 'Renommé par Alice' $$, 'owner : rename ok');
select tests.logout();
select is((select role::text from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001'), 'owner', 'owner : ligne owner intouchable');
select is((select count(*) from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'owner : retrait de bob ok');
select is((select name from public.projects limit 1), 'Renommé par Alice', 'owner : projet renommé');

select * from finish();
rollback;
