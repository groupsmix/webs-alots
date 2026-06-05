create table if not exists public.builder_usage_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  template_id text not null,
  model_id text not null,
  message_count integer not null default 1,
  created_at timestamptz not null default now()
);

alter table public.builder_usage_logs enable row level security;

create policy "super_admin_full_access_builder_logs"
  on public.builder_usage_logs
  for all
  to authenticated
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'super_admin'
    )
  );

create index idx_builder_usage_logs_user_id
  on public.builder_usage_logs(user_id, created_at desc);
