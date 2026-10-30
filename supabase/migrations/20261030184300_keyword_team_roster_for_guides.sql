create or replace function public.get_keyword_team_roster(
  p_code text,
  p_team smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_team jsonb;
begin
  if auth.uid() is null then
    raise exception 'Se requiere una sesión para consultar la sala.';
  end if;
  if p_team is null or p_team not in (0, 1)
    or upper(trim(p_code)) !~ '^[A-HJ-NP-Z2-9]{8}$' then
    raise exception 'El equipo o el código de sala no son válidos.';
  end if;

  select public_state -> 'teams' -> p_team
    into v_team
  from public.keyword_rooms
  where code = upper(trim(p_code))
    and status = 'waiting'
    and created_at >= now() - interval '12 hours';

  if v_team is null or jsonb_typeof(v_team) is distinct from 'array' then
    raise exception 'No existe una sala abierta con ese código.';
  end if;

  return v_team;
end;
$$;

revoke all on function public.get_keyword_team_roster(text, smallint) from public;
grant execute on function public.get_keyword_team_roster(text, smallint) to authenticated;
