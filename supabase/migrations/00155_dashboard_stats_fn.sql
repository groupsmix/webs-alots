-- Note: task originally referenced monthly_amount_mad but the actual column
-- in clinic_subscriptions is `amount` (currency defaults to MAD).
--
-- This function is SECURITY DEFINER, so it bypasses RLS and runs with the
-- function owner's privileges. We therefore re-implement the caller-side
-- authorization check ourselves, requiring the calling JWT to belong to a
-- super_admin user. `search_path` is pinned to prevent search-path
-- redirection attacks against the `users`/`clinics`/`clinic_subscriptions`
-- references below.
create or replace function get_super_admin_dashboard_stats()
returns json
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  v_role text;
begin
  select role into v_role
    from public.users
   where id = auth.uid();

  if v_role is null or v_role <> 'super_admin' then
    raise exception 'forbidden: super_admin role required'
      using errcode = '42501';
  end if;

  return (
    select json_build_object(
      'total_clinics', count(*),
      'active_clinics', count(*) filter (where status = 'active'),
      'pending_kyc', count(*) filter (where status = 'pending_kyc'),
      'suspended', count(*) filter (where status = 'suspended'),
      'trial', count(*) filter (where status = 'trial'),
      'mrr_mad', coalesce(
        (select sum(amount) from public.clinic_subscriptions where status = 'active'),
        0
      )
    )
    from public.clinics
  );
end;
$$;

revoke all on function get_super_admin_dashboard_stats() from public;
grant execute on function get_super_admin_dashboard_stats() to authenticated;
