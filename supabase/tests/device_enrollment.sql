begin;
set local role anon;
do $$ begin
 begin perform public.consume_device_enrollment(repeat('a',64),repeat('b',64));raise exception 'Anon can consume capabilities directly';exception when insufficient_privilege then null;end;
 begin perform public.fitlog_device_admin_secret();raise exception 'Anon can read admin secret';exception when insufficient_privilege then null;end;
end $$;
set local role authenticated;
do $$ begin
 begin perform public.create_device_enrollment(gen_random_uuid(),repeat('a',64),15);raise exception 'Client can mint arbitrary account capabilities';exception when insufficient_privilege then null;end;
 begin perform public.fitlog_device_admin_secret();raise exception 'Client can read admin secret';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role service_role;
do $$
declare owner uuid; token text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); finger text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); rate_finger text:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text); claimed uuid; i integer;
begin
 select user_id into owner from public.profiles where slug='mix';
 if owner is null then raise exception 'Provision two accounts before running this cloud test';end if;
 perform public.create_device_enrollment(owner,token,15);
 claimed:=public.consume_device_enrollment(token,finger);
 if claimed is distinct from owner then raise exception 'Owner mismatch';end if;
 if public.consume_device_enrollment(token,finger) is not null then raise exception 'Token reused';end if;
 token:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 perform public.create_device_enrollment(owner,token,15);
 update private.device_enrollments set expires_at=now()-interval '1 minute' where token_hash=token;
 if public.consume_device_enrollment(token,finger) is not null then raise exception 'Expired token accepted';end if;
 token:=md5(gen_random_uuid()::text)||md5(gen_random_uuid()::text);
 perform public.create_device_enrollment(owner,token,15);
 for i in 1..20 loop perform public.consume_device_enrollment(repeat('0',64),rate_finger);end loop;
 if public.consume_device_enrollment(token,rate_finger) is not null then raise exception 'Rate limit bypass';end if;
 if exists(select 1 from private.device_enrollments where token_hash=token and consumed_at is not null) then raise exception 'Rate limit consumed valid link';end if;
 update private.enrollment_rate_limits set window_start=now()-interval '16 minutes' where fingerprint=rate_finger;
 if public.consume_device_enrollment(token,rate_finger) is distinct from owner then raise exception 'Rate window did not reset';end if;
end $$;
reset role;
select 'PASS: service-only minting, secret isolation, atomic one-time consumption, expiry and rate limiting' as result;
rollback;
