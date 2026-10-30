create or replace function public.cleanup_expired_keyword_rooms()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.keyword_rooms
  where created_at < now() - interval '12 hours';

  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.cleanup_expired_keyword_rooms()
  from public, anon, authenticated;
grant execute on function public.cleanup_expired_keyword_rooms() to postgres;
