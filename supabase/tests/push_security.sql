begin;
do $$ begin if exists(select 1 from public.profiles) then raise exception 'Fixture tests require an empty development project. No personal data was changed.';end if;end $$;
set local role anon;
do $$ begin begin perform public.fitlog_push_config();raise exception 'Anon can read push configuration';exception when insufficient_privilege then null;end;end $$;
set local role authenticated;
do $$ begin
 begin perform public.fitlog_push_config();raise exception 'Client can read push configuration';exception when insufficient_privilege then null;end;
 begin perform public.claim_reminder(gen_random_uuid(),gen_random_uuid(),now());raise exception 'Client can claim deliveries';exception when insufficient_privilege then null;end;
end $$;
reset role;
insert into auth.users(id) values('30000000-0000-4000-8000-000000000001');
insert into auth.users(id) values('30000000-0000-4000-8000-000000000002');
insert into public.profiles(user_id,slug,display_name) values('30000000-0000-4000-8000-000000000001','mix','Temporary push test');
insert into public.profiles(user_id,slug,display_name) values('30000000-0000-4000-8000-000000000002','name','Temporary push test two');
insert into public.reminder_preferences(owner_user_id) values('30000000-0000-4000-8000-000000000001');
insert into public.reminder_preferences(owner_user_id) values('30000000-0000-4000-8000-000000000002');
insert into public.push_subscriptions(id,owner_user_id,endpoint,p256dh,auth_secret) values('40000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','https://fcm.googleapis.com/test/push','aaaaaaaaaaaaaaaa','bbbbbbbb');
set local role service_role;
do $$ declare first_id uuid;again uuid;begin
 begin
  insert into public.push_subscriptions(owner_user_id,endpoint,p256dh,auth_secret) values('30000000-0000-4000-8000-000000000002','https://fcm.googleapis.com/test/push','aaaaaaaaaaaaaaaa','bbbbbbbb');
  raise exception 'Same endpoint accepted for two identities';
 exception when unique_violation then null;end;
 begin
  perform public.claim_reminder('30000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000001','2026-10-01T01:00:00Z');
  raise exception 'Delivery accepted for mismatched subscription owner';
 exception when foreign_key_violation then null;end;
 if not (public.fitlog_push_config() ?& array['fitlog_cron_secret','fitlog_vapid_private','fitlog_vapid_public']) then raise exception 'Missing server configuration';end if;
 first_id:=public.claim_reminder('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-10-01T01:00:00Z');
 if first_id is null then raise exception 'Initial claim failed';end if;
 again:=public.claim_reminder('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-10-01T01:00:00Z');
 if again is not null then raise exception 'Concurrent duplicate claim accepted';end if;
 update public.reminder_deliveries set status='failed',claimed_at=now()-interval '16 minutes' where id=first_id;
 again:=public.claim_reminder('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-10-01T01:00:00Z');
 if again is distinct from first_id then raise exception 'Retry failed';end if;
 update public.reminder_deliveries set status='failed' where id=first_id;
 again:=public.claim_reminder('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-10-01T01:00:00Z');
 if again is not null then raise exception 'Retry backoff not respected';end if;
 update public.reminder_deliveries set status='sent',claimed_at=now()-interval '16 minutes' where id=first_id;
 again:=public.claim_reminder('30000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','2026-10-01T01:00:00Z');
 if again is not null then raise exception 'Sent interval reclaimed';end if;
end $$;
reset role;
select 'PASS: push secrets denied to clients, service-only claims, deduplication, retry and backoff' as result;
rollback;
