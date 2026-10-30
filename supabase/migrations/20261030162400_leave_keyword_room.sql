create or replace function public.leave_keyword_room(p_room_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Se requiere una sesión para salir de la sala.';
  end if;

  delete from public.keyword_room_members
  where room_id = p_room_id
    and user_id = v_user_id
    and role = 'cluegiver';

  if not found then
    raise exception 'No hay una guía de este dispositivo conectada a esa sala.';
  end if;
end;
$$;

revoke all on function public.leave_keyword_room(uuid)
  from public, anon, authenticated;
grant execute on function public.leave_keyword_room(uuid) to authenticated;
