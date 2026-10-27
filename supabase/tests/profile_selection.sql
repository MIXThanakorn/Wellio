begin;
set local role anon;
do $$ begin begin perform public.allow_profile_selection(repeat('a',64));raise exception 'Anonymous client can bypass the Edge Function';exception when insufficient_privilege then null;end;end $$;
set local role authenticated;
do $$ begin begin perform public.allow_profile_selection(repeat('a',64));raise exception 'Client can bypass the Edge Function';exception when insufficient_privilege then null;end;end $$;
set local role service_role;
do $$ declare test_fingerprint text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); i integer;begin
 for i in 1..30 loop if not public.allow_profile_selection(test_fingerprint) then raise exception 'Allowed selection throttled too early';end if;end loop;
 if public.allow_profile_selection(test_fingerprint) then raise exception 'Rate limit bypass';end if;
 update private.enrollment_rate_limits set window_start=now()-interval '16 minutes' where enrollment_rate_limits.fingerprint=test_fingerprint;
 if not public.allow_profile_selection(test_fingerprint) then raise exception 'Rate limit window did not reset';end if;
end $$;
reset role;
select 'PASS: selection rate limiting, window reset and server-only RPC access' as result;
rollback;
