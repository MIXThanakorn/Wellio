create extension if not exists pg_cron;
create extension if not exists pg_net;
create schema if not exists private;
revoke all on schema private from public,anon,authenticated;
grant usage on schema private to service_role;

-- This small elevated helper reads only FitLog's server secrets from Vault.
-- It is outside the exposed schema, has a fixed search path, rejects user sessions,
-- and is executable only by the server role. Clients cannot call it or the wrapper.
create function private.fitlog_push_config() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is not null or current_setting('role',true) <> 'service_role' then
  raise exception 'Server role required' using errcode='42501';
 end if;
 return (select jsonb_object_agg(name,decrypted_secret) from vault.decrypted_secrets
  where name in ('fitlog_vapid_public','fitlog_vapid_private','fitlog_cron_secret'));
end; $$;
revoke all on function private.fitlog_push_config() from public,anon,authenticated;
grant execute on function private.fitlog_push_config() to service_role;
create function public.fitlog_push_config() returns jsonb language sql security invoker set search_path='' as $$
 select private.fitlog_push_config();
$$;
revoke all on function public.fitlog_push_config() from public,anon,authenticated;
grant execute on function public.fitlog_push_config() to service_role;

-- Explicit deny documents the server-only ledger and removes the no-policy advisory.
create policy deny_client_delivery_access on public.reminder_deliveries for all to authenticated using(false) with check(false);

-- Token and project URL come from Vault. Jobs do nothing until secrets are configured.
select cron.schedule('fitlog-meal-reminders','*/15 * * * *',$job$
 select net.http_post(
  url := (select decrypted_secret from vault.decrypted_secrets where name='fitlog_project_url')||'/functions/v1/send-reminders',
  headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='fitlog_cron_secret')),
  body := '{}'::jsonb,
  timeout_milliseconds := 10000
 ) where exists(select 1 from vault.decrypted_secrets where name='fitlog_cron_secret');
$job$);
