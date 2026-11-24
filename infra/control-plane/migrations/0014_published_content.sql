-- Narrow publication API over the content revision tables introduced in 0004.
-- Storefronts read only the latest published revision through a security-definer function;
-- merchants write drafts and publish only inside their own transaction-scoped store.
create function cp.save_content_draft(p_store text, p_entry text, p_body jsonb, p_author text) returns table(storefront_id text, revision integer)
language plpgsql security definer set search_path = cp, pg_temp as $$
declare v_sf text; v_rev integer; v_schema integer;
begin
  if nullif(current_setting('app.store_id', true), '') is distinct from p_store then raise exception 'store scope mismatch' using errcode='42501'; end if;
  if p_entry !~ '^[a-z0-9][a-z0-9:/_-]{0,119}$' then raise exception 'invalid content entry'; end if;
  if pg_column_size(p_body) > 65536 then raise exception 'content body is too large'; end if;
  select f.storefront_id into v_sf from cp.storefronts f where f.store_id=p_store and f.state not in ('disabled','retired') order by (f.env='production') desc, f.created_at desc limit 1 for update;
  if v_sf is null then raise exception 'storefront is not configured'; end if;
  select coalesce(max(s.version),0) into v_schema from cp.content_schemas s where s.storefront_id=v_sf;
  select coalesce(max(r.revision),0)+1 into v_rev from cp.content_revisions r where r.storefront_id=v_sf and r.entry=p_entry;
  insert into cp.content_revisions(storefront_id,store_id,entry,revision,schema_version,body,author) values(v_sf,p_store,p_entry,v_rev,v_schema,p_body,p_author);
  insert into cp.audit_log(store_id,actor,action,after) values(p_store,p_author,'content.draft_saved',jsonb_build_object('storefront_id',v_sf,'entry',p_entry,'revision',v_rev));
  return query select v_sf,v_rev;
end $$;

create function cp.publish_content_entry(p_store text, p_entry text, p_author text) returns table(storefront_id text, revision integer, changed boolean)
language plpgsql security definer set search_path = cp, pg_temp as $$
declare v_sf text; v_rev integer; v_published timestamptz;
begin
  if nullif(current_setting('app.store_id', true), '') is distinct from p_store then raise exception 'store scope mismatch' using errcode='42501'; end if;
  select f.storefront_id into v_sf from cp.storefronts f where f.store_id=p_store and f.state not in ('disabled','retired') order by (f.env='production') desc, f.created_at desc limit 1 for update;
  select r.revision,r.published_at into v_rev,v_published from cp.content_revisions r where r.storefront_id=v_sf and r.entry=p_entry order by r.revision desc limit 1 for update;
  if v_rev is null then return query select v_sf,0,false; return; end if;
  if v_published is not null then return query select v_sf,v_rev,false; return; end if;
  update cp.content_revisions r set published_at=now() where r.storefront_id=v_sf and r.entry=p_entry and r.revision=v_rev;
  insert into cp.audit_log(store_id,actor,action,after) values(p_store,p_author,'content.published',jsonb_build_object('storefront_id',v_sf,'entry',p_entry,'revision',v_rev));
  return query select v_sf,v_rev,true;
end $$;

create function cp.get_published_content(p_storefront text, p_entry text) returns table(entry text, revision integer, schema_version integer, body jsonb, published_at timestamptz)
language sql security definer set search_path = cp, pg_temp stable as $$
  select r.entry,r.revision,r.schema_version,r.body,r.published_at
  from cp.content_revisions r join cp.storefronts f using(storefront_id) join cp.stores s using(store_id)
  where r.storefront_id=p_storefront and r.entry=p_entry and r.published_at is not null
    and f.state in ('connected','approved','live') and s.lifecycle in ('configuring','ready','live')
  order by r.revision desc limit 1
$$;

revoke insert,update on cp.content_revisions from oss_runtime;
revoke all on function cp.save_content_draft(text,text,jsonb,text) from public;
revoke all on function cp.publish_content_entry(text,text,text) from public;
revoke all on function cp.get_published_content(text,text) from public;
grant execute on function cp.save_content_draft(text,text,jsonb,text) to oss_runtime;
grant execute on function cp.publish_content_entry(text,text,text) to oss_runtime;
grant execute on function cp.get_published_content(text,text) to oss_runtime;

insert into cp.schema_migrations(version) values ('0014_published_content') on conflict do nothing;
