begin;
create extension if not exists pgtap with schema extensions;

-- Rend ce fichier indépendant des données de `supabase/seed.sql` (mêmes UUID de test) :
-- la transaction est annulée par le `rollback` final, donc rien n'est perdu pour le dev.
delete from auth.users;

select plan(15);

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

-- Tables
select has_table('public', 'profiles', 'table profiles');
select has_table('public', 'projects', 'table projects');
select has_table('public', 'memberships', 'table memberships');
select has_table('public', 'invitations', 'table invitations');
select has_table('public', 'tasks', 'table tasks');
select has_table('public', 'dependencies', 'table dependencies');

-- handle_new_user : un profil est créé avec une couleur de la palette
insert into auth.users (id, email, raw_user_meta_data)
values ('a0000000-0000-0000-0000-000000000001', 'alice@test.local', '{"full_name":"Alice Test","avatar_url":"https://x/a.png"}');
select results_eq(
  $$ select display_name, avatar_url from public.profiles where id = 'a0000000-0000-0000-0000-000000000001' $$,
  $$ values ('Alice Test', 'https://x/a.png') $$,
  'profil créé depuis les métadonnées');
select ok(
  (select color from public.profiles where id = 'a0000000-0000-0000-0000-000000000001')
    = any (array['#FF8A3D','#FF6FA3','#5B9DFF','#3ECF8E','#A78BFA','#34D3E0','#B4E45C','#E9B44C']),
  'couleur issue de la palette');

-- create_project : projet + membership owner
select tests.login_as('a0000000-0000-0000-0000-000000000001', 'alice@test.local');
select lives_ok($$ select public.create_project('Mon projet') $$, 'create_project fonctionne pour un utilisateur connecté');
select results_eq(
  $$ select m.role::text from public.memberships m join public.projects p on p.id = m.project_id where p.name = 'Mon projet' $$,
  $$ values ('owner') $$,
  'membership owner créée');
select tests.logout();

-- Contraintes sur tasks
select throws_ok(
  $$ insert into public.tasks (project_id, title, type, start_date, end_date)
     select id, 'Jalon', 'milestone', '2026-09-01', '2026-09-02' from public.projects where name = 'Mon projet' $$,
  '23514', null, 'un jalon doit avoir start_date = end_date');
select throws_ok(
  $$ insert into public.tasks (project_id, title, start_date, end_date, progress)
     select id, 'T', '2026-09-01', '2026-09-02', 120 from public.projects where name = 'Mon projet' $$,
  '23514', null, 'progress borné à 100');

-- Profondeur 1 : un groupe ne peut pas avoir de parent
insert into public.tasks (id, project_id, title, type, start_date, end_date)
select 'b0000000-0000-0000-0000-000000000001', id, 'Groupe', 'group', '2026-09-01', '2026-09-01' from public.projects where name = 'Mon projet';
select throws_ok(
  $$ insert into public.tasks (project_id, parent_id, title, type, start_date, end_date)
     select id, 'b0000000-0000-0000-0000-000000000001', 'Sous-groupe', 'group', '2026-09-01', '2026-09-01' from public.projects where name = 'Mon projet' $$,
  'P0001', 'group_cannot_have_parent', 'pas de groupe dans un groupe');

-- updated_at maintenu par trigger : pivot de l'arbitrage des conflits pour le temps réel
-- (v2). Un simple `lives_ok` sur l'update passerait même si le trigger était supprimé —
-- il faut comparer explicitement la valeur avant/après. Piège : `now()` est figé pour
-- toute la durée de la transaction en PostgreSQL (= `transaction_timestamp()`), et tout
-- ce fichier tourne dans UNE seule transaction (begin/rollback) : comparer un
-- `updated_at` capturé avant et après un UPDATE donnerait la même valeur, trigger actif
-- ou non. On force donc d'abord une ancienne valeur en désactivant temporairement le
-- trigger, puis on vérifie qu'un UPDATE normal (trigger réactivé) l'écrase bien par
-- l'horodatage courant de la transaction plutôt que de la laisser inchangée.
alter table public.tasks disable trigger tasks_set_updated_at;
update public.tasks set updated_at = '2020-01-01T00:00:00Z' where id = 'b0000000-0000-0000-0000-000000000001';
alter table public.tasks enable trigger tasks_set_updated_at;

select lives_ok($$
  update public.tasks set title = 'Groupe renommé' where id = 'b0000000-0000-0000-0000-000000000001'
$$, 'update ok');
-- `is(..., now(), ...)` compare directement en timestamptz (pas de cast en texte : un
-- `isnt(...::text, '2020-01-01T00:00:00Z', ...)` comparerait à un littéral ISO avec
-- 'T'/'Z' que `timestamptz::text` ne produit jamais — '2020-01-01 00:00:00+00', avec un
-- espace et un décalage '+00' — rendant l'assertion inconditionnellement vraie, trigger
-- opérant ou non). `now()` vaut `transaction_timestamp()`, exactement ce que pose le
-- trigger : la comparaison est donc un vrai test d'égalité, pas un test de forme.
select is(
  (select updated_at from public.tasks where id = 'b0000000-0000-0000-0000-000000000001'),
  now(),
  'updated_at écrasé par le trigger à l''horodatage courant, pas laissé à l''ancienne valeur forcée'
);

select * from finish();
rollback;
