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
