-- Utilisateurs de test (mot de passe : password123). Chargé par `supabase db reset`.
create or replace function pg_temp.seed_user(uid uuid, mail text, full_name text) returns void
language plpgsql as $$
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', mail,
    extensions.crypt('password123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', json_build_object('full_name', full_name)::jsonb, now(), now(),
    '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text,
    json_build_object('sub', uid::text, 'email', mail, 'email_verified', true)::jsonb, 'email', now(), now(), now());
end $$;

select pg_temp.seed_user('a0000000-0000-0000-0000-000000000001', 'alice@test.local', 'Alice Test');
select pg_temp.seed_user('a0000000-0000-0000-0000-000000000002', 'bob@test.local', 'Bob Test');
select pg_temp.seed_user('a0000000-0000-0000-0000-000000000003', 'carol@test.local', 'Carol Test');
select pg_temp.seed_user('a0000000-0000-0000-0000-000000000004', 'dave@test.local', 'Dave Test');
