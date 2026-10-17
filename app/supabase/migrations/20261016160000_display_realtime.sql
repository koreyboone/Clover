do $$
begin
  if not exists (
    select 1
      from pg_publication_tables
     where pubname = 'supabase_realtime'
       and schemaname = 'public'
       and tablename = 'sample_tasks'
  ) then
    alter publication supabase_realtime add table public.sample_tasks;
  end if;
end;
$$;
