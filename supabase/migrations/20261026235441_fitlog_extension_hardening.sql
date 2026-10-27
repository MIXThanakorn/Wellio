-- pg_net is not relocatable; reinstall its extension anchor in extensions.
-- This changes no application data. Refuse to discard any queued HTTP request.
do $$ begin
 if exists(select 1 from net.http_request_queue) then raise exception 'Wait for pending HTTP requests before relocating pg_net';end if;
end $$;
drop extension pg_net;
create extension pg_net with schema extensions;
