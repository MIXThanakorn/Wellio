-- Enrollment capabilities are server-only. No email or password is collected by the app.
create table private.device_enrollments (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null references public.profiles(user_id) on delete cascade,
 token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 expires_at timestamptz not null, consumed_at timestamptz,
 created_at timestamptz not null default now()
);
create index device_enrollment_owner on private.device_enrollments(owner_user_id,expires_at);
create table private.enrollment_rate_limits (
 fingerprint text primary key check(char_length(fingerprint)=64),
 window_start timestamptz not null default now(), attempts integer not null default 1
);
alter table private.device_enrollments enable row level security;
alter table private.enrollment_rate_limits enable row level security;
revoke all on private.device_enrollments,private.enrollment_rate_limits from public,anon,authenticated;
grant all on private.device_enrollments,private.enrollment_rate_limits to service_role;
create policy deny_client_enrollments on private.device_enrollments for all to authenticated using(false) with check(false);
create policy deny_client_rate_limits on private.enrollment_rate_limits for all to authenticated using(false) with check(false);

create function public.create_device_enrollment(p_owner uuid,p_hash text,p_minutes integer default 15) returns timestamptz
language plpgsql security invoker set search_path='' as $$
declare expiry timestamptz;
begin
 if p_minutes<1 or p_minutes>1440 then raise exception 'Invalid expiry';end if;
 expiry:=now()+make_interval(mins=>p_minutes);
 insert into private.device_enrollments(owner_user_id,token_hash,expires_at) values(p_owner,p_hash,expiry);
 return expiry;
end; $$;
create function public.consume_device_enrollment(p_hash text,p_fingerprint text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare attempts integer; owner uuid;
begin
 insert into private.enrollment_rate_limits(fingerprint) values(p_fingerprint)
 on conflict(fingerprint) do update set
  attempts=case when private.enrollment_rate_limits.window_start<now()-interval '15 minutes' then 1 else private.enrollment_rate_limits.attempts+1 end,
  window_start=case when private.enrollment_rate_limits.window_start<now()-interval '15 minutes' then now() else private.enrollment_rate_limits.window_start end
 returning private.enrollment_rate_limits.attempts into attempts;
 if attempts>20 then return null;end if;
 update private.device_enrollments set consumed_at=now()
 where token_hash=p_hash and consumed_at is null and expires_at>now() returning owner_user_id into owner;
 -- Expired hashes and IP fingerprints are not retained indefinitely.
 delete from private.device_enrollments where expires_at<now()-interval '7 days';
 delete from private.enrollment_rate_limits where window_start<now()-interval '1 day';
 return owner;
end; $$;
create function public.revoke_device_enrollments(p_owner uuid) returns void
language sql security invoker set search_path='' as $$
 update private.device_enrollments set consumed_at=now() where owner_user_id=p_owner and consumed_at is null;
$$;
revoke all on function public.create_device_enrollment(uuid,text,integer),public.consume_device_enrollment(text,text),public.revoke_device_enrollments(uuid) from public,anon,authenticated;
grant execute on function public.create_device_enrollment(uuid,text,integer),public.consume_device_enrollment(text,text),public.revoke_device_enrollments(uuid) to service_role;

-- Separate administrative capability from the reminder cron token.
create function private.fitlog_device_admin_secret() returns text language plpgsql security definer set search_path='' as $$
begin
 if (select auth.uid()) is not null or current_setting('role',true)<>'service_role' then raise exception 'Server role required' using errcode='42501';end if;
 return (select decrypted_secret from vault.decrypted_secrets where name='fitlog_device_admin');
end; $$;
create function public.fitlog_device_admin_secret() returns text language sql security invoker set search_path='' as $$ select private.fitlog_device_admin_secret(); $$;
revoke all on function private.fitlog_device_admin_secret(),public.fitlog_device_admin_secret() from public,anon,authenticated;
grant execute on function private.fitlog_device_admin_secret(),public.fitlog_device_admin_secret() to service_role;
