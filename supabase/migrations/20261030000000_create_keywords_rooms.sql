create table if not exists public.keyword_rooms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  host_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'waiting'
    check (status in ('waiting', 'playing', 'finished')),
  public_state jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.keyword_room_members (
  room_id uuid not null references public.keyword_rooms (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('board', 'cluegiver')),
  team smallint check (team in (0, 1)),
  display_name text not null,
  joined_at timestamptz not null default now(),
  primary key (room_id, user_id),
  check ((role = 'board' and team is null) or (role = 'cluegiver' and team is not null))
);

create unique index if not exists keyword_one_cluegiver_per_team
  on public.keyword_room_members (room_id, team)
  where role = 'cluegiver';

create table if not exists public.keyword_room_secrets (
  room_id uuid primary key references public.keyword_rooms (id) on delete cascade,
  key_layout jsonb not null
);

create or replace function public.is_keyword_room_member(p_room_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.keyword_room_members m
    where m.room_id = p_room_id and m.user_id = auth.uid()
  );
$$;

revoke all on function public.is_keyword_room_member(uuid) from public;
grant execute on function public.is_keyword_room_member(uuid) to authenticated;

alter table public.keyword_rooms enable row level security;
alter table public.keyword_room_members enable row level security;
alter table public.keyword_room_secrets enable row level security;

drop policy if exists "Room members can read public game state"
  on public.keyword_rooms;
create policy "Room members can read public game state"
  on public.keyword_rooms for select to authenticated
  using (public.is_keyword_room_member(id));

drop policy if exists "Room members can see room participants"
  on public.keyword_room_members;
create policy "Room members can see room participants"
  on public.keyword_room_members for select to authenticated
  using (public.is_keyword_room_member(room_id));

revoke all on public.keyword_rooms from anon, authenticated;
grant select on public.keyword_rooms to authenticated;
revoke all on public.keyword_room_members from anon, authenticated;
grant select on public.keyword_room_members to authenticated;
revoke all on public.keyword_room_secrets from anon, authenticated;

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
      'endReason', null
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
    raise exception 'Se requiere una sesión para unirse a la sala.';
  end if;
  if p_team is null or p_team not in (0, 1)
    or p_display_name is null or length(trim(p_display_name)) = 0 then
    raise exception 'Selecciona un equipo y escribe tu nombre.';
  end if;

  select * into v_room
  from public.keyword_rooms
  where code = upper(trim(p_code))
  for update;
  if not found or v_room.status <> 'waiting'
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
      public_state = public_state || jsonb_build_object('phase', 'clue')
  where id = p_room_id;
end;
$$;

create or replace function public.get_keyword_key(p_room_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_team smallint;
  v_key jsonb;
begin
  select (r.public_state ->> 'activeTeam')::smallint
    into v_active_team
    from public.keyword_rooms r
    join public.keyword_room_members m on m.room_id = r.id
   where r.id = p_room_id
     and m.user_id = auth.uid()
     and m.role = 'cluegiver'
     and r.status = 'playing'
     and r.public_state ->> 'phase' = 'clue'
     and m.team = (r.public_state ->> 'activeTeam')::smallint;
  if not found then
    raise exception 'La clave solo está disponible para la guía del equipo activo.';
  end if;
  select key_layout into v_key
  from public.keyword_room_secrets
  where room_id = p_room_id;
  return v_key;
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
    'guessesLeft', p_count + 1
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
          'winner', v_winner, 'endReason', v_end_reason, 'clue', null
        )
    where id = p_room_id;
  elsif v_next is not null then
    update public.keyword_rooms
    set public_state = v_room.public_state || jsonb_build_object(
      'board', v_board, 'scores', v_scores, 'phase', 'clue',
      'activeTeam', v_next, 'clue', null, 'guessesLeft', 0
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
  v_next smallint;
begin
  select r.* into v_room
  from public.keyword_rooms r
  join public.keyword_room_members m on m.room_id = r.id
  where r.id = p_room_id and m.user_id = auth.uid() and m.role = 'board'
  for update of r;
  if not found or v_room.status <> 'playing'
    or v_room.public_state ->> 'phase' <> 'guessing' then
    raise exception 'No se puede terminar este turno ahora.';
  end if;
  v_next := 1 - (v_room.public_state ->> 'activeTeam')::smallint;
  update public.keyword_rooms
  set public_state = public_state || jsonb_build_object(
    'phase', 'clue', 'activeTeam', v_next, 'clue', null, 'guessesLeft', 0
  )
  where id = p_room_id;
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
          'phase', 'finished', 'winner', null, 'endReason', 'closed', 'clue', null
        )
    where id = p_room_id;
  end if;
end;
$$;

revoke all on function public.create_keyword_room(text, jsonb, jsonb, smallint) from public;
revoke all on function public.join_keyword_room(text, smallint, text) from public;
revoke all on function public.start_keyword_game(uuid) from public;
revoke all on function public.get_keyword_key(uuid) from public;
revoke all on function public.submit_keyword_clue(uuid, text, smallint) from public;
revoke all on function public.guess_keyword_card(uuid, smallint) from public;
revoke all on function public.end_keyword_turn(uuid) from public;
revoke all on function public.close_keyword_room(uuid) from public;
grant execute on function public.create_keyword_room(text, jsonb, jsonb, smallint) to authenticated;
grant execute on function public.join_keyword_room(text, smallint, text) to authenticated;
grant execute on function public.start_keyword_game(uuid) to authenticated;
grant execute on function public.get_keyword_key(uuid) to authenticated;
grant execute on function public.submit_keyword_clue(uuid, text, smallint) to authenticated;
grant execute on function public.guess_keyword_card(uuid, smallint) to authenticated;
grant execute on function public.end_keyword_turn(uuid) to authenticated;
grant execute on function public.close_keyword_room(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'keyword_rooms'
  ) then
    alter publication supabase_realtime add table public.keyword_rooms;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'keyword_room_members'
  ) then
    alter publication supabase_realtime add table public.keyword_room_members;
  end if;
end;
$$;
