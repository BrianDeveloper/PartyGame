create or replace function public.get_keyword_key(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key jsonb;
begin
  if not exists (
    select 1
    from public.keyword_rooms r
    join public.keyword_room_members m on m.room_id = r.id
    where r.id = p_room_id
      and m.user_id = auth.uid()
      and m.role = 'cluegiver'
      and r.status = 'playing'
  ) then
    raise exception 'La clave solo está disponible para las guías de esta partida.';
  end if;

  select key_layout into v_key
  from public.keyword_room_secrets
  where room_id = p_room_id;
  return v_key;
end;
$$;

revoke all on function public.get_keyword_key(uuid)
  from public, anon, authenticated;
grant execute on function public.get_keyword_key(uuid) to authenticated;

create or replace function public.end_keyword_turn(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.keyword_rooms%rowtype;
  v_phase text;
  v_next smallint;
begin
  select r.* into v_room
  from public.keyword_rooms r
  join public.keyword_room_members m on m.room_id = r.id
  where r.id = p_room_id
    and m.user_id = auth.uid()
    and m.role = 'board'
  for update of r;

  if not found or v_room.status <> 'playing' then
    raise exception 'No se puede terminar este turno ahora.';
  end if;

  v_phase := v_room.public_state ->> 'phase';
  if v_phase is null or v_phase not in ('clue', 'guessing') then
    raise exception 'No se puede terminar este turno ahora.';
  end if;
  if v_room.public_state ->> 'activeTeam' is null
     or v_room.public_state ->> 'activeTeam' not in ('0', '1') then
    raise exception 'El turno actual no es válido.';
  end if;

  v_next := 1 - (v_room.public_state ->> 'activeTeam')::smallint;

  update public.keyword_rooms
  set public_state = public_state || jsonb_build_object(
    'phase', 'clue',
    'activeTeam', v_next,
    'clue', null,
    'guessesLeft', 0
  )
  where id = p_room_id;
end;
$$;

revoke all on function public.end_keyword_turn(uuid)
  from public, anon, authenticated;
grant execute on function public.end_keyword_turn(uuid) to authenticated;
