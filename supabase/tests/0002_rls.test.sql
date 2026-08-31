begin;
create extension if not exists pgtap with schema extensions;

-- Rend ce fichier indépendant des données de `supabase/seed.sql` (mêmes UUID de test) :
-- la transaction est annulée par le `rollback` final, donc rien n'est perdu pour le dev.
delete from auth.users;

select plan(31);

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
  ('a0000000-0000-0000-0000-000000000004', 'dave@test.local'),
  ('a0000000-0000-0000-0000-000000000005', 'eve@test.local');

-- Alice crée un projet, devient owner ; bob editor, carol viewer, dave non-membre.
-- Eve crée un second projet ("Projet Eve"), sans lien avec le premier : il sert de cible
-- hors périmètre pour la régression de la faille d'élévation de privilège.
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select public.create_project('Projet RLS');
select tests.logout();
select tests.login_as('a0000000-0000-0000-0000-000000000005', 'eve@test.local');
select public.create_project('Projet Eve');
select tests.logout();

create table tests.ctx as select id as project_id from public.projects where name = 'Projet RLS';
grant select on tests.ctx to authenticated;
create table tests.ctxb as select id as project_id from public.projects where name = 'Projet Eve';
grant select on tests.ctxb to authenticated;

insert into public.memberships (project_id, user_id, role)
select project_id, 'a0000000-0000-0000-0000-000000000002', 'editor' from tests.ctx;
insert into public.memberships (project_id, user_id, role)
select project_id, 'a0000000-0000-0000-0000-000000000003', 'viewer' from tests.ctx;
-- Eve invite légitimement alice comme simple viewer de son propre projet B : ce lien croisé
-- sert de précondition réaliste à la régression d'élévation de privilège plus bas (une
-- fois viewer de B, alice ne doit toujours pas pouvoir y déplacer/ajouter des membres).
insert into public.memberships (project_id, user_id, role)
select project_id, 'a0000000-0000-0000-0000-000000000001', 'viewer' from tests.ctxb;
insert into public.tasks (id, project_id, title, start_date, end_date)
select 'b0000000-0000-0000-0000-000000000001', project_id, 'Tâche 1', '2026-09-01', '2026-09-03' from tests.ctx;
insert into public.tasks (id, project_id, title, start_date, end_date)
select 'b0000000-0000-0000-0000-000000000002', project_id, 'Tâche 2', '2026-09-04', '2026-09-05' from tests.ctx;
insert into public.dependencies (project_id, from_task_id, to_task_id)
select project_id, 'b0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000002' from tests.ctx;
insert into public.invitations (project_id, email, role, token, invited_by)
select project_id, 'invited@test.local', 'viewer', 'seed-token-rls', 'a0000000-0000-0000-0000-000000000001' from tests.ctx;

-- RLS activée partout (comptage strict : ne doit pas se satisfaire d'un sous-ensemble de tables)
select is((select count(*) filter (where relrowsecurity) from pg_class where relnamespace = 'public'::regnamespace
  and relname in ('profiles','projects','memberships','invitations','tasks','dependencies')), 6::bigint, 'RLS activée sur les 6 tables');

-- Dave (non-membre) ne voit rien
select tests.login_as('a0000000-0000-0000-0000-000000000004', 'dave@test.local');
select is((select count(*) from public.projects), 0::bigint, 'non-membre : aucun projet');
select is((select count(*) from public.tasks), 0::bigint, 'non-membre : aucune tâche');
select is((select count(*) from public.memberships), 0::bigint, 'non-membre : aucune membership');
select is((select count(*) from public.dependencies), 0::bigint, 'non-membre : aucune dépendance');
-- Visibilité des profils restreinte (A1) : dave n'est membre d'aucun projet, il ne voit
-- donc que son propre profil, plus l'annuaire complet d'avant la restriction.
select is((select count(*) from public.profiles), 1::bigint, 'non-membre : dave ne voit que son propre profil');
select tests.logout();

-- Alice est owner de "Projet RLS" (avec bob editor, carol viewer) et viewer de "Projet Eve"
-- (avec eve owner) : elle doit voir son propre profil et ceux des co-membres de CES DEUX
-- projets (bob, carol, eve), mais jamais dave, avec qui elle ne partage aucun projet.
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select is((select count(*) from public.profiles), 4::bigint, 'alice : voit son profil + les co-membres des projets partagés (bob, carol, eve)');
select ok(exists(select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000001'), 'alice : voit son propre profil');
select ok(exists(select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000002'), 'alice : voit bob, membre d''un projet partagé');
select ok(not exists(select 1 from public.profiles where id = 'a0000000-0000-0000-0000-000000000004'), 'alice : ne voit pas dave, avec qui elle ne partage aucun projet');
select tests.logout();

-- Carol (viewer) lit mais n'écrit pas
select tests.login_as('a0000000-0000-0000-0000-000000000003', 'carol@test.local');
select is((select count(*) from public.tasks), 2::bigint, 'viewer : lit les tâches');
select is((select count(*) from public.dependencies), 1::bigint, 'viewer : lit les dépendances');
select throws_ok($$ insert into public.dependencies (project_id, from_task_id, to_task_id)
  select project_id, 'b0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001' from tests.ctx $$, '42501', null, 'viewer : insert dépendance refusé');
select throws_ok($$ insert into public.tasks (project_id, title, start_date, end_date)
  select project_id, 'X', '2026-09-01', '2026-09-01' from tests.ctx $$, '42501', null, 'viewer : insert tâche refusé');
update public.tasks set title = 'Piraté' where id = 'b0000000-0000-0000-0000-000000000001';
select tests.logout();
select is((select title from public.tasks where id = 'b0000000-0000-0000-0000-000000000001'), 'Tâche 1', 'viewer : update tâche sans effet');

-- Bob (editor) écrit les tâches mais pas les memberships ni le projet, et ne voit pas les invitations
select tests.login_as('a0000000-0000-0000-0000-000000000002', 'bob@test.local');
select lives_ok($$ insert into public.tasks (project_id, title, start_date, end_date)
  select project_id, 'Tâche de Bob', '2026-09-01', '2026-09-01' from tests.ctx $$, 'editor : insert tâche ok');
select throws_ok($$ insert into public.memberships (project_id, user_id, role)
  select project_id, 'a0000000-0000-0000-0000-000000000004', 'viewer' from tests.ctx $$, '42501', null, 'editor : insert membership refusé');
update public.projects set name = 'Renommé par Bob';
select throws_ok($$ insert into public.invitations (project_id, email, role, token, invited_by)
  select project_id, 'x@test.local', 'viewer', 'tok', 'a0000000-0000-0000-0000-000000000002' from tests.ctx $$, '42501', null, 'editor : insert invitation refusé');
select is((select count(*) from public.invitations), 0::bigint, 'editor : ne voit aucune invitation');
select tests.logout();
select is((select name from public.projects where id = (select project_id from tests.ctx)), 'Projet RLS', 'editor : rename projet sans effet');

-- Alice (owner) gère les membres mais ne touche pas à sa propre ligne owner, et ne peut pas
-- utiliser son statut d'owner de A pour se servir de son statut de simple viewer de B afin
-- d'y ajouter n'importe qui comme editor (régression de la faille d'élévation de privilège :
-- le WITH CHECK d'UPDATE doit re-vérifier is_member sur le project_id de la NOUVELLE ligne,
-- pas seulement sur celui de l'ancienne).
--
-- Nuance importante sur la portée du filet SELECT implicite de PostgreSQL (déjà observé au
-- round de correction précédent) : il ne joue QUE lorsque la commande UPDATE requiert un
-- accès en lecture à la relation, c'est-à-dire en présence d'un WHERE ou d'un RETURNING qui
-- référence des colonnes de la table. Un `update memberships set project_id = ..., role = ...`
-- SANS WHERE ni RETURNING n'engage aucune policy SELECT : le scénario littéral du rapport de
-- sécurité (déplacement vers un projet totalement hors d'atteinte) est donc bien exploitable
-- tel quel, malgré ce qui avait été avancé dans le rapport de la tâche précédente. Ce filet
-- dépend en outre d'une policy SELECT permissive aux viewers (`memberships_select_member`) :
-- toute restriction future de cette policy rouvrirait la brèche pour les requêtes avec WHERE.
-- Seul le WITH CHECK explicite ci-dessous constitue une garantie fiable, indépendante de la
-- forme de la requête cliente. Le scénario ci-dessous exerce le cas où alice a un accès
-- viewer légitime à B mais pas owner — avec un WHERE, donc le filet SELECT joue déjà côté
-- ligne existante (project_id = A, visible), mais pas côté nouvelle ligne (project_id = B :
-- is_member(B, 'viewer') est vrai pour alice, donc le filet ne bloque pas non plus la nouvelle
-- ligne ici) — c'est bien le WITH CHECK explicite qui doit porter tout le travail.
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select throws_ok($$
  update public.memberships set project_id = (select project_id from tests.ctxb), user_id = 'a0000000-0000-0000-0000-000000000004', role = 'editor'
  where project_id = (select project_id from tests.ctx) and user_id = 'a0000000-0000-0000-0000-000000000003'
$$, '42501', null, 'owner : ajout de dave comme editor du projet où il n est que viewer refusé');
select is((select count(*) from public.memberships m join tests.ctxb b on b.project_id = m.project_id
  where m.user_id = 'a0000000-0000-0000-0000-000000000004'), 0::bigint, 'owner : dave non ajoute au projet cible');
-- Non-régression : le correctif ne doit pas empêcher un owner de continuer à modifier le
-- rôle d'un membre au sein de son PROPRE projet (seul le déplacement inter-projets doit être
-- bloqué).
select results_eq($$
  update public.memberships set role = 'viewer'
  where project_id = (select project_id from tests.ctx) and user_id = 'a0000000-0000-0000-0000-000000000002'
  returning role::text
$$, $$ values ('viewer') $$, 'owner : modification du role dun membre de son propre projet toujours autorisee');
delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001' and project_id = (select project_id from tests.ctx);
update public.memberships set role = 'viewer' where user_id = 'a0000000-0000-0000-0000-000000000001' and project_id = (select project_id from tests.ctx);
delete from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000002';
select lives_ok($$ update public.projects set name = 'Renommé par Alice' $$, 'owner : rename ok');
-- owner_id figé (A2) : la colonne projects.owner_id ne fait pas autorité, memberships
-- (role owner) est la seule source de vérité. Même l'owner ne peut pas la réécrire.
select throws_ok($$
  update public.projects set owner_id = 'a0000000-0000-0000-0000-000000000002'
  where id = (select project_id from tests.ctx)
$$, 'P0001', 'owner_id_is_read_only', 'owner_id figé : update refusé même par l''owner');
select tests.logout();
select is((select role::text from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000001' and project_id = (select project_id from tests.ctx)), 'owner', 'owner : ligne owner intouchable');
select is((select count(*) from public.memberships where user_id = 'a0000000-0000-0000-0000-000000000002'), 0::bigint, 'owner : retrait de bob ok');
select is((select name from public.projects where id = (select project_id from tests.ctx)), 'Renommé par Alice', 'owner : projet renommé');

-- Email figé : la source de vérité reste auth.users, la mise à jour directe de profiles.email
-- doit être bloquée pour empêcher qu'on s'attribue l'email d'une cible (résolution d'invitation).
select tests.login_as('a0000000-0000-0000-0000-000000000003', 'carol@test.local');
select throws_ok($$ update public.profiles set email = 'pirate@test.local' where id = auth.uid() $$, 'P0001', 'email_is_read_only', 'email figé : update refusé');
-- Non-régression : le trigger de gel de l'email ne doit pas gêner la modification des autres
-- colonnes du profil par son propriétaire.
select results_eq($$
  update public.profiles set display_name = 'Carol Renommée' where id = auth.uid() returning display_name
$$, $$ values ('Carol Renommée') $$, 'profil : modification du display_name toujours autorisee malgre le trigger email');
select tests.logout();
select is((select email from public.profiles where id = 'a0000000-0000-0000-0000-000000000003'), 'carol@test.local', 'email figé : email inchangé');

select * from finish();
rollback;
