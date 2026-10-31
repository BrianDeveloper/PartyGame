create or replace function public.keyword_turn_deadline(p_room_id uuid)
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (r.public_state ->> 'turnSeconds') ~ '^[1-9][0-9]*$'
      then (extract(epoch from now()) * 1000)::bigint
        + (r.public_state ->> 'turnSeconds')::bigint * 1000
    else null
  end
  from public.keyword_rooms r
  where r.id = p_room_id;
$$;

create or replace function public.create_keyword_room(
  p_code text,
  p_board jsonb,
  p_teams jsonb,
  p_starting_team smallint,
  p_turn_seconds smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_room_id uuid;
  v_board jsonb;
  v_key integer[];
  v_team_one jsonb := p_teams -> 0;
  v_team_two jsonb := p_teams -> 1;
begin
  if v_user_id is null then
    raise exception 'Se requiere una sesión para crear la sala.';
  end if;
  if upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{8}$' then
    raise exception 'El código de sala debe tener ocho caracteres.';
  end if;
  if p_starting_team is null or p_starting_team not in (0, 1) then
    raise exception 'El equipo inicial no es válido.';
  end if;
  if p_turn_seconds is null or p_turn_seconds < 30 or p_turn_seconds > 300 then
    raise exception 'La duración del turno debe estar entre 30 y 300 segundos.';
  end if;
  if jsonb_typeof(p_board) is distinct from 'array' then
    raise exception 'El tablero debe ser una lista de palabras.';
  end if;
  if jsonb_array_length(p_board) <> 25
     or (select count(distinct value) from jsonb_array_elements_text(p_board)) <> 25 then
    raise exception 'El tablero debe tener 25 palabras únicas.';
  end if;
  if jsonb_typeof(p_teams) is distinct from 'array'
     or jsonb_array_length(p_teams) <> 2 then
    raise exception 'La sala debe tener exactamente dos equipos.';
  end if;
  if jsonb_typeof(v_team_one) is distinct from 'array'
     or jsonb_typeof(v_team_two) is distinct from 'array' then
    raise exception 'Cada equipo debe ser una lista de integrantes.';
  end if;
  if jsonb_array_length(v_team_one) < 2
     or jsonb_array_length(v_team_two) < 2 then
    raise exception 'Cada equipo necesita al menos dos integrantes.';
  end if;
  if exists (
    select 1
    from jsonb_array_elements_text(v_team_one) a(value)
    join jsonb_array_elements_text(v_team_two) b(value)
      on lower(a.value) = lower(b.value)
  ) then
    raise exception 'Una persona no puede estar en los dos equipos.';
  end if;

  select jsonb_agg(jsonb_build_object('word', value, 'revealed', false) order by ordinality)
    into v_board
    from jsonb_array_elements_text(p_board) with ordinality;

  v_key := array_fill(2, array[7])
    || array_fill(p_starting_team, array[9])
    || array_fill(1 - p_starting_team, array[8])
    || array[3];
  select array_agg(owner order by random())
    into v_key from unnest(v_key) as values_to_shuffle(owner);

  insert into public.keyword_rooms (code, host_id, public_state)
  values (
    upper(trim(p_code)),
    v_user_id,
    jsonb_build_object(
      'board', v_board,
      'teams', jsonb_build_array(v_team_one, v_team_two),
      'scores', jsonb_build_array(0, 0),
      'startingTeam', p_starting_team,
      'activeTeam', p_starting_team,
      'phase', 'waiting_guides',
      'clue', null,
      'guessesLeft', 0,
      'winner', null,
      'endReason', null,
      'turnSeconds', p_turn_seconds,
      'turnEndsAt', null
    )
  )
  returning id into v_room_id;

  insert into public.keyword_room_members (room_id, user_id, role, team, display_name)
  values (v_room_id, v_user_id, 'board', null, 'Tablero');
  insert into public.keyword_room_secrets (room_id, key_layout)
  values (v_room_id, to_jsonb(v_key));

  return v_room_id;
end;
$$;

create or replace function public.create_keyword_room(
  p_code text,
  p_board jsonb,
  p_teams jsonb,
  p_starting_team smallint
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public.create_keyword_room(
    p_code,
    p_board,
    p_teams,
    p_starting_team,
    90::smallint
  );
end;
$$;

create or replace function public.start_keyword_game(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.keyword_rooms%rowtype;
begin
  select * into v_room from public.keyword_rooms where id = p_room_id for update;
  if not found or v_room.host_id <> auth.uid() then
    raise exception 'Solo el anfitrión puede iniciar la partida.';
  end if;
  if v_room.status <> 'waiting' or (
    select count(*) from public.keyword_room_members
    where room_id = p_room_id and role = 'cluegiver'
  ) <> 2 then
    raise exception 'Falta conectar a las dos personas guía.';
  end if;
  update public.keyword_rooms
  set status = 'playing',
      public_state = public_state || jsonb_build_object(
        'phase', 'clue',
        'turnEndsAt', public.keyword_turn_deadline(p_room_id)
      )
  where id = p_room_id;
end;
$$;

create or replace function public.submit_keyword_clue(
  p_room_id uuid,
  p_clue text,
  p_count smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.keyword_rooms%rowtype;
  v_team smallint;
  v_left integer;
begin
  select r.* into v_room
  from public.keyword_rooms r
  join public.keyword_room_members m on m.room_id = r.id
  where r.id = p_room_id and m.user_id = auth.uid()
    and m.role = 'cluegiver'
    and m.team = (r.public_state ->> 'activeTeam')::smallint
  for update of r;
  if not found or v_room.status <> 'playing'
    or v_room.public_state ->> 'phase' <> 'clue' then
    raise exception 'No es el turno para dar una pista.';
  end if;
  if coalesce((v_room.public_state ->> 'turnEndsAt')::bigint, 0) > 0
     and (v_room.public_state ->> 'turnEndsAt')::bigint
       <= (extract(epoch from now()) * 1000)::bigint then
    raise exception 'El tiempo del turno terminó.';
  end if;
  if p_clue is null or p_count is null
    or trim(p_clue) = '' or length(trim(p_clue)) > 40
    or trim(p_clue) ~ '[[:space:]]' or p_count < 1 or p_count > 9 then
    raise exception 'La pista debe ser una palabra y el número estar entre 1 y 9.';
  end if;

  v_team := (v_room.public_state ->> 'activeTeam')::smallint;
  select count(*) into v_left
  from generate_series(0, 24) as positions(i)
  join public.keyword_room_secrets s on s.room_id = p_room_id
  where (s.key_layout ->> positions.i)::smallint = v_team
    and coalesce((v_room.public_state -> 'board' -> positions.i ->> 'revealed')::boolean, false) = false;
  if p_count > v_left then
    raise exception 'La pista no puede indicar más palabras que las que quedan a tu equipo.';
  end if;

  update public.keyword_rooms
  set public_state = public_state || jsonb_build_object(
    'phase', 'guessing',
    'clue', jsonb_build_object('word', trim(p_clue), 'count', p_count),
    'guessesLeft', p_count + 1,
    'turnEndsAt', public.keyword_turn_deadline(p_room_id)
  )
  where id = p_room_id;
end;
$$;

create or replace function public.guess_keyword_card(
  p_room_id uuid,
  p_card_index smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.keyword_rooms%rowtype;
  v_secret jsonb;
  v_board jsonb;
  v_scores jsonb;
  v_card jsonb;
  v_owner smallint;
  v_active smallint;
  v_next smallint;
  v_remaining integer;
  v_guesses_left integer;
  v_winner smallint := null;
  v_end_reason text := null;
  i integer;
begin
  select r.* into v_room
  from public.keyword_rooms r
  join public.keyword_room_members m on m.room_id = r.id
  where r.id = p_room_id and m.user_id = auth.uid() and m.role = 'board'
  for update of r;
  if not found or v_room.status <> 'playing'
    or v_room.public_state ->> 'phase' <> 'guessing' then
    raise exception 'El tablero no está esperando una elección.';
  end if;
  if coalesce((v_room.public_state ->> 'turnEndsAt')::bigint, 0) > 0
     and (v_room.public_state ->> 'turnEndsAt')::bigint
       <= (extract(epoch from now()) * 1000)::bigint then
    raise exception 'El tiempo del turno terminó.';
  end if;
  if p_card_index is null or p_card_index < 0 or p_card_index > 24 then
    raise exception 'La casilla seleccionada no es válida.';
  end if;

  v_board := v_room.public_state -> 'board';
  v_card := v_board -> p_card_index;
  if coalesce((v_card ->> 'revealed')::boolean, false) then
    raise exception 'Esa palabra ya fue revelada.';
  end if;
  select key_layout into v_secret
  from public.keyword_room_secrets where room_id = p_room_id;

  v_active := (v_room.public_state ->> 'activeTeam')::smallint;
  v_owner := (v_secret ->> p_card_index)::smallint;
  v_scores := v_room.public_state -> 'scores';
  v_board := jsonb_set(
    v_board,
    array[p_card_index::text],
    v_card || jsonb_build_object('revealed', true, 'owner', v_owner),
    false
  );
  if v_owner in (0, 1) then
    v_scores := jsonb_set(
      v_scores,
      array[v_owner::text],
      to_jsonb((v_scores ->> v_owner)::integer + 1),
      false
    );
  end if;

  if v_owner = 3 then
    v_winner := 1 - v_active;
    v_end_reason := 'assassin';
  elsif v_owner in (0, 1) then
    select count(*) into v_remaining
    from generate_series(0, 24) as positions(idx)
    where (v_secret ->> positions.idx)::smallint = v_owner
      and coalesce((v_board -> positions.idx ->> 'revealed')::boolean, false) = false;
    if v_remaining = 0 then
      v_winner := v_owner;
      v_end_reason := 'all_words';
    elsif v_owner <> v_active then
      v_next := 1 - v_active;
    else
      v_guesses_left := (v_room.public_state ->> 'guessesLeft')::integer - 1;
      if v_guesses_left <= 0 then
        v_next := 1 - v_active;
      end if;
    end if;
  else
    v_next := 1 - v_active;
  end if;

  if v_winner is not null then
    update public.keyword_rooms
    set status = 'finished',
        public_state = v_room.public_state || jsonb_build_object(
          'board', v_board, 'scores', v_scores, 'phase', 'finished',
          'winner', v_winner, 'endReason', v_end_reason, 'clue', null,
          'turnEndsAt', null
        )
    where id = p_room_id;
  elsif v_next is not null then
    update public.keyword_rooms
    set public_state = v_room.public_state || jsonb_build_object(
      'board', v_board, 'scores', v_scores, 'phase', 'clue',
      'activeTeam', v_next, 'clue', null, 'guessesLeft', 0,
      'turnEndsAt', public.keyword_turn_deadline(p_room_id)
    )
    where id = p_room_id;
  else
    update public.keyword_rooms
    set public_state = v_room.public_state || jsonb_build_object(
      'board', v_board, 'scores', v_scores, 'guessesLeft', v_guesses_left
    )
    where id = p_room_id;
  end if;
end;
$$;

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
    'guessesLeft', 0,
    'turnEndsAt', public.keyword_turn_deadline(p_room_id)
  )
  where id = p_room_id;
end;
$$;

create or replace function public.end_keyword_turn_checked(
  p_room_id uuid,
  p_expected_turn_ends_at bigint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.keyword_rooms%rowtype;
  v_phase text;
  v_current_deadline bigint;
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

  v_current_deadline := (v_room.public_state ->> 'turnEndsAt')::bigint;
  if p_expected_turn_ends_at is distinct from v_current_deadline then
    raise exception 'El turno ya cambió. Actualiza la pantalla.';
  end if;

  v_next := 1 - (v_room.public_state ->> 'activeTeam')::smallint;

  update public.keyword_rooms
  set public_state = public_state || jsonb_build_object(
    'phase', 'clue',
    'activeTeam', v_next,
    'clue', null,
    'guessesLeft', 0,
    'turnEndsAt', public.keyword_turn_deadline(p_room_id)
  )
  where id = p_room_id;
end;
$$;

create or replace function public.expire_keyword_turn(p_room_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.keyword_rooms%rowtype;
  v_phase text;
  v_deadline bigint;
  v_now bigint := (extract(epoch from now()) * 1000)::bigint;
  v_next smallint;
begin
  select r.* into v_room
  from public.keyword_rooms r
  join public.keyword_room_members m on m.room_id = r.id
  where r.id = p_room_id and m.user_id = auth.uid()
  for update of r;

  if not found or v_room.status <> 'playing' then
    return false;
  end if;

  v_phase := v_room.public_state ->> 'phase';
  if v_phase is null or v_phase not in ('clue', 'guessing') then
    return false;
  end if;
  if v_room.public_state ->> 'activeTeam' is null
     or v_room.public_state ->> 'activeTeam' not in ('0', '1') then
    return false;
  end if;

  v_deadline := (v_room.public_state ->> 'turnEndsAt')::bigint;
  if v_deadline is null or v_now < v_deadline then
    return false;
  end if;

  v_next := 1 - (v_room.public_state ->> 'activeTeam')::smallint;

  update public.keyword_rooms
  set public_state = public_state || jsonb_build_object(
    'phase', 'clue',
    'activeTeam', v_next,
    'clue', null,
    'guessesLeft', 0,
    'turnEndsAt', public.keyword_turn_deadline(p_room_id)
  )
  where id = p_room_id;

  return true;
end;
$$;

create or replace function public.close_keyword_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_room public.keyword_rooms%rowtype;
begin
  select * into v_room
  from public.keyword_rooms
  where id = p_room_id
  for update;
  if not found or v_room.host_id <> auth.uid() then
    raise exception 'Solo el anfitrión puede cerrar esta sala.';
  end if;
  if v_room.status <> 'finished' then
    update public.keyword_rooms
    set status = 'finished',
        public_state = public_state || jsonb_build_object(
          'phase', 'finished', 'winner', null, 'endReason', 'closed',
          'clue', null, 'turnEndsAt', null
        )
    where id = p_room_id;
  end if;
end;
$$;

revoke all on function public.keyword_turn_deadline(uuid)
  from public, anon, authenticated;
revoke all on function public.create_keyword_room(text, jsonb, jsonb, smallint, smallint)
  from public, anon, authenticated;
revoke all on function public.create_keyword_room(text, jsonb, jsonb, smallint)
  from public, anon, authenticated;
revoke all on function public.start_keyword_game(uuid)
  from public, anon, authenticated;
revoke all on function public.submit_keyword_clue(uuid, text, smallint)
  from public, anon, authenticated;
revoke all on function public.guess_keyword_card(uuid, smallint)
  from public, anon, authenticated;
revoke all on function public.end_keyword_turn(uuid)
  from public, anon, authenticated;
revoke all on function public.end_keyword_turn_checked(uuid, bigint)
  from public, anon, authenticated;
revoke all on function public.expire_keyword_turn(uuid)
  from public, anon, authenticated;
revoke all on function public.close_keyword_room(uuid)
  from public, anon, authenticated;

grant execute on function public.create_keyword_room(text, jsonb, jsonb, smallint, smallint)
  to authenticated;
grant execute on function public.create_keyword_room(text, jsonb, jsonb, smallint)
  to authenticated;
grant execute on function public.start_keyword_game(uuid)
  to authenticated;
grant execute on function public.submit_keyword_clue(uuid, text, smallint)
  to authenticated;
grant execute on function public.guess_keyword_card(uuid, smallint)
  to authenticated;
grant execute on function public.end_keyword_turn(uuid)
  to authenticated;
grant execute on function public.end_keyword_turn_checked(uuid, bigint)
  to authenticated;
grant execute on function public.expire_keyword_turn(uuid)
  to authenticated;
grant execute on function public.close_keyword_room(uuid)
  to authenticated;

notify pgrst, 'reload schema';
