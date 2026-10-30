create or replace function public.join_keyword_room(
  p_code text,
  p_team smallint,
  p_display_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room public.keyword_rooms%rowtype;
begin
  if v_user_id is null then
    raise exception 'Se requiere una sesión para conectarse a la sala.';
  end if;
  if p_team is null or p_team not in (0, 1)
    or p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'Selecciona un equipo y escribe tu nombre.';
  end if;

  select * into v_room
  from public.keyword_rooms
  where code = upper(trim(p_code))
  for update;
  if not found or v_room.status not in ('waiting', 'playing')
    or v_room.created_at < now() - interval '12 hours' then
    raise exception 'No existe una sala abierta con ese código.';
  end if;
  if not exists (
    select 1
    from jsonb_array_elements_text(v_room.public_state -> 'teams' -> p_team) as names(member_name)
    where lower(names.member_name) = lower(trim(p_display_name))
  ) then
    raise exception 'Ese nombre no pertenece al equipo seleccionado.';
  end if;
  if exists (
    select 1 from public.keyword_room_members m
    where m.room_id = v_room.id and m.user_id = v_user_id
      and (
        m.role <> 'cluegiver'
        or m.team <> p_team
        or lower(m.display_name) <> lower(trim(p_display_name))
      )
  ) then
    raise exception 'Este dispositivo ya está conectado con otro rol en la sala.';
  end if;
  if v_room.status = 'playing' and not exists (
    select 1 from public.keyword_room_members m
    where m.room_id = v_room.id
      and m.user_id = v_user_id
      and m.role = 'cluegiver'
      and m.team = p_team
      and lower(m.display_name) = lower(trim(p_display_name))
  ) then
    raise exception 'Solo la guía que ya estaba conectada puede volver a esta partida.';
  end if;
  if exists (
    select 1 from public.keyword_room_members m
    where m.room_id = v_room.id and m.role = 'cluegiver'
      and m.team = p_team and m.user_id <> v_user_id
  ) then
    raise exception 'Ese equipo ya tiene una persona guía conectada.';
  end if;

  insert into public.keyword_room_members (room_id, user_id, role, team, display_name)
  values (v_room.id, v_user_id, 'cluegiver', p_team, trim(p_display_name))
  on conflict (room_id, user_id) do update
    set role = excluded.role, team = excluded.team, display_name = excluded.display_name;

  return v_room.id;
end;
$$;

revoke all on function public.join_keyword_room(text, smallint, text)
  from public, anon, authenticated;
grant execute on function public.join_keyword_room(text, smallint, text)
  to authenticated;
