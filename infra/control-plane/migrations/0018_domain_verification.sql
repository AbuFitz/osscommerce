-- Only the trusted portal verification flow may mark a registered hostname verified.
-- The merchant-facing runtime can no longer write verification flags directly.
revoke insert, update on cp.store_hostnames, cp.storefront_hosts from oss_runtime;

create function cp.record_domain_verification(p_store_id text, p_host text) returns boolean
language plpgsql security definer set search_path = cp, pg_temp as $$
declare changed boolean := false;
begin
  if p_store_id is distinct from nullif(current_setting('app.store_id', true), '') then
    raise exception 'store context mismatch';
  end if;

  update cp.storefront_hosts set verified=true, verified_at=coalesce(verified_at, now())
  where store_id=p_store_id and host=lower(p_host);
  changed := found;
  if not changed then return false; end if;

  insert into cp.store_hostnames(host,store_id,verified,verified_at)
  values (lower(p_host),p_store_id,true,now())
  on conflict(host) do update set verified=true, verified_at=coalesce(cp.store_hostnames.verified_at,excluded.verified_at)
  where cp.store_hostnames.store_id=excluded.store_id;

  insert into cp.audit_log(store_id,actor,action,after)
  values (p_store_id,'merchant','domain.verified',jsonb_build_object('host',lower(p_host)));
  return true;
end $$;
revoke all on function cp.record_domain_verification(text,text) from public;
grant execute on function cp.record_domain_verification(text,text) to oss_runtime;

insert into cp.schema_migrations(version) values ('0018_domain_verification') on conflict do nothing;
