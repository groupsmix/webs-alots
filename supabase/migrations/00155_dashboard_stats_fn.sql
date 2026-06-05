-- Note: task originally referenced monthly_amount_mad but the actual column
-- in clinic_subscriptions is `amount` (currency defaults to MAD).
create or replace function get_super_admin_dashboard_stats()
returns json
language sql
security definer
as $$
  select json_build_object(
    'total_clinics', count(*),
    'active_clinics', count(*) filter (where status = 'active'),
    'pending_kyc', count(*) filter (where status = 'pending_kyc'),
    'suspended', count(*) filter (where status = 'suspended'),
    'trial', count(*) filter (where status = 'trial'),
    'mrr_mad', coalesce(
      (select sum(amount) from clinic_subscriptions where status = 'active'),
      0
    )
  )
  from clinics;
$$;

grant execute on function get_super_admin_dashboard_stats() to authenticated;
