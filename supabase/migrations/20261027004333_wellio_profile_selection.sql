-- The owner explicitly approved selecting either account without identity verification.
-- Session issuance stays server-side and permits only the two fixed profile slots.
create function public.allow_profile_selection(p_fingerprint text) returns boolean
language plpgsql security invoker set search_path='' as $$
declare request_count integer;
begin
 insert into private.enrollment_rate_limits(fingerprint) values(p_fingerprint)
 on conflict(fingerprint) do update set
  attempts=case when private.enrollment_rate_limits.window_start<now()-interval '15 minutes' then 1 else private.enrollment_rate_limits.attempts+1 end,
  window_start=case when private.enrollment_rate_limits.window_start<now()-interval '15 minutes' then now() else private.enrollment_rate_limits.window_start end
 returning private.enrollment_rate_limits.attempts into request_count;
 delete from private.enrollment_rate_limits where window_start<now()-interval '1 day';
 return request_count<=30;
end; $$;
revoke all on function public.allow_profile_selection(text) from public,anon,authenticated;
grant execute on function public.allow_profile_selection(text) to service_role;
