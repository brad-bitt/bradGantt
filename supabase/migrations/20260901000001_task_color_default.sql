-- La couleur par défaut d'une tâche était #FFD500, or le jaune ne signale plus qu'une
-- chose dans l'interface : la sélection. Une tâche créée sans couleur explicite serait
-- donc indiscernable d'une ligne sélectionnée. L'application envoie toujours une couleur
-- (voir nextColor dans lib/gantt/palette.ts) : ce défaut n'est qu'un filet, mais il doit
-- tomber dans le même registre que les autres.
alter table public.tasks alter column color set default '#FF8A3D';

-- Même raison pour la couleur d'avatar attribuée à l'inscription : sa palette contenait le
-- jaune, désormais réservé à la sélection. On reprend les huit teintes de tâches, qui sont
-- calées pour rester lisibles avec du texte noir — c'est le cas des initiales d'un avatar.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  palette text[] := array['#FF8A3D', '#FF6FA3', '#5B9DFF', '#3ECF8E', '#A78BFA', '#34D3E0', '#B4E45C', '#E9B44C'];
  n int;
begin
  select count(*) into n from public.profiles;
  insert into public.profiles (id, email, display_name, avatar_url, color)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    palette[1 + (n % 8)]
  );
  return new;
end $$;
