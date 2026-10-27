-- Runs against real Supabase with execute_sql, or PGlite via npm run db:test.
-- Every fixture, including Auth identities, rolls back. No persistent test accounts.
begin;
do $$ begin if exists(select 1 from public.profiles) then raise exception 'Fixture isolation tests require an empty development project. No personal data was changed.';end if;end $$;
insert into auth.users(id) values ('10000000-0000-4000-8000-000000000001'),('10000000-0000-4000-8000-000000000002'),('10000000-0000-4000-8000-000000000003');
insert into public.profiles(user_id,slug,display_name) values ('10000000-0000-4000-8000-000000000001','mix','Test Mix'),('10000000-0000-4000-8000-000000000002','name','Test Name');
insert into public.meal_entries(owner_user_id,eaten_at,meal_type,name) select user_id,now(),'other','Test meal' from public.profiles;
insert into public.activity_entries(owner_user_id,started_at,activity_type,duration_minutes) select user_id,now(),'walking',10 from public.profiles;
insert into public.weight_checkins(owner_user_id,checkin_date,weight_kg) select user_id,current_date-1,70 from public.profiles;
insert into public.water_entries(owner_user_id,consumed_at,amount_ml) select user_id,now(),250 from public.profiles;
insert into public.routine_plans(id,owner_user_id,title,category,days_of_week) values ('20000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000001','Test routine','activity',array[1]),('20000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000002','Test routine','activity',array[1]);
insert into public.plan_completions(owner_user_id,plan_id) select owner_user_id,id from public.routine_plans;
insert into public.favorite_meals(owner_user_id,name) select user_id,'Test favorite' from public.profiles;
insert into public.reminder_preferences(owner_user_id) select user_id from public.profiles;
insert into public.push_subscriptions(owner_user_id,endpoint,p256dh,auth_secret) select user_id,'https://fcm.googleapis.com/test/'||user_id,'aaaaaaaaaaaaaaaa','bbbbbbbb' from public.profiles;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
do $$ declare t text; n integer; begin
 foreach t in array array['meal_entries','activity_entries','weight_checkins','water_entries','routine_plans','plan_completions','favorite_meals','reminder_preferences','push_subscriptions'] loop
  execute format('select count(*) from public.%I',t) into n;
  if n<>1 then raise exception 'SELECT isolation failed: % = %',t,n; end if;
  execute format('update public.%I set owner_user_id=owner_user_id where owner_user_id=%L',t,'10000000-0000-4000-8000-000000000002');
  get diagnostics n=row_count; if n<>0 then raise exception 'UPDATE isolation failed: %',t; end if;
  execute format('delete from public.%I where owner_user_id=%L',t,'10000000-0000-4000-8000-000000000002');
  get diagnostics n=row_count; if n<>0 then raise exception 'DELETE isolation failed: %',t; end if;
  begin
   execute format('update public.%I set owner_user_id=%L',t,'10000000-0000-4000-8000-000000000002');
   raise exception 'Owner reassignment allowed: %',t;
  exception when insufficient_privilege then null; end;
 end loop;
 if (select count(*) from public.profiles)<>1 then raise exception 'Profile isolation failed'; end if;
 begin
  insert into public.meal_entries(owner_user_id,eaten_at,meal_type,name) values('10000000-0000-4000-8000-000000000002',now(),'other','forged');
  raise exception 'Cross-owner INSERT allowed';
 exception when insufficient_privilege then null;end;
 begin
  insert into public.plan_completions(owner_user_id,plan_id) values('10000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002');
  raise exception 'Foreign plan accepted';
 exception when foreign_key_violation then null;end;
 begin
  update public.profiles set slug='name';raise exception 'Identity slot reassignment allowed';
 exception when insufficient_privilege then null;end;
 begin
  perform * from public.reminder_deliveries;raise exception 'Server ledger readable';
 exception when insufficient_privilege then null;end;
 update public.meal_entries set notes='Own edit works';
 if not exists(select 1 from public.meal_entries where notes='Own edit works') then raise exception 'Own edit failed';end if;
end $$;

-- An unapproved Supabase user cannot self-enroll or write even their own rows.
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000003',true);
do $$ begin
 if exists(select 1 from public.meal_entries) then raise exception 'Unapproved identity reads data';end if;
 begin insert into public.profiles(user_id,slug,display_name) values('10000000-0000-4000-8000-000000000003','mix','Forged');raise exception 'Self enrollment allowed';exception when insufficient_privilege then null;end;
 begin insert into public.meal_entries(owner_user_id,eaten_at,meal_type,name) values('10000000-0000-4000-8000-000000000003',now(),'other','forged');raise exception 'Unapproved write allowed';exception when foreign_key_violation then null;end;
end $$;

set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare t text;begin
 foreach t in array array['profiles','meal_entries','activity_entries','weight_checkins','water_entries','routine_plans','plan_completions','favorite_meals','reminder_preferences','push_subscriptions','reminder_deliveries'] loop
  begin execute format('select * from public.%I',t);raise exception 'Anonymous read allowed: %',t;exception when insufficient_privilege then null;end;
 end loop;
end $$;

set local role authenticated;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000001',true);
select public.clear_my_journal();
do $$ begin if exists(select 1 from public.meal_entries) then raise exception 'Clear failed';end if;if not exists(select 1 from public.profiles) then raise exception 'Clear removed authorization';end if;end $$;
select set_config('request.jwt.claim.sub','10000000-0000-4000-8000-000000000002',true);
do $$ begin if (select count(*) from public.meal_entries)<>1 then raise exception 'Clear affected other owner';end if;end $$;
reset role;
select 'PASS: RLS isolation, anonymous denial, protected enrollment, FK ownership, update checks, atomic per-owner deletion' as result;
rollback;
