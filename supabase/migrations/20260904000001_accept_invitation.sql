-- Acceptation d'une invitation, et recherche d'un invité par email.
--
-- Numérotée au 2026-09-04 et non au 20260831000003 comme le prévoyait le plan : les migrations
-- 20260831000004 et 20260901000001 sont déjà appliquées, y compris sur la base cloud de
-- production. Une migration antidatée s'applique bien sur une base recréée de zéro, mais
-- `supabase db push` refuse de l'insérer avant la dernière migration de l'historique distant.

create or replace function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  inv public.invitations;
  uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into inv from public.invitations where token = p_token and accepted_at is null;
  if inv.id is null then raise exception 'invitation_not_found'; end if;

  -- Comparaison insensible à la casse : l'adresse saisie par l'inviteur et celle du compte
  -- viennent de deux sources différentes, et personne ne retape son email à l'identique.
  if lower(coalesce(auth.email(), '')) <> lower(inv.email) then raise exception 'email_mismatch'; end if;

  -- Le `where` du DO UPDATE protège l'owner : une invitation « viewer » adressée au
  -- propriétaire du projet ne doit pas le rétrograder dans son propre projet.
  insert into public.memberships (project_id, user_id, role)
  values (inv.project_id, uid, inv.role)
  on conflict (project_id, user_id) do update
    set role = excluded.role
    where memberships.role <> 'owner';

  update public.invitations set accepted_at = now() where id = inv.id;
  return inv.project_id;
end $$;

revoke execute on function public.accept_invitation(text) from anon, public;
grant execute on function public.accept_invitation(text) to authenticated;

-- Recherche d'un invité par email. Passe par une RPC `security definer` parce que
-- la policy de `profiles` ne laisse plus voir que soi-même et les membres d'un
-- projet partagé (plan 1, migration 20260831000004) : un invité n'est par
-- définition pas encore membre. L'exigence « appelant owner du projet » évite
-- d'en faire un oracle d'énumération d'emails ouvert à tout compte.
create or replace function public.find_invitee_profile(p_project_id uuid, p_email text) returns uuid
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_member(p_project_id, 'owner') then raise exception 'not_project_owner'; end if;
  select id into uid from public.profiles where lower(email) = lower(trim(p_email));
  return uid;
end $$;

revoke execute on function public.find_invitee_profile(uuid, text) from anon, public;
grant execute on function public.find_invitee_profile(uuid, text) to authenticated;
