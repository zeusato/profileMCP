-- Incremental migration; the existing 001 schema is never recreated.
BEGIN;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM profile_mcp.schema_versions WHERE version='20261009_001') THEN
    RAISE EXCEPTION 'Baseline 001 required';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='profile_mcp_runtime') THEN
    CREATE ROLE profile_mcp_runtime NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
  END IF;
END $$;
ALTER TABLE profile_mcp.oauth_artifacts ADD COLUMN uid_digest bytea;
CREATE INDEX oauth_artifacts_uid_idx ON profile_mcp.oauth_artifacts(model,uid_digest);
CREATE TABLE profile_mcp.request_leases (
  id uuid PRIMARY KEY, owner_digest bytea NOT NULL CHECK(octet_length(owner_digest)=32), expires_at timestamptz NOT NULL
);
ALTER TABLE profile_mcp.request_leases ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.request_leases FORCE ROW LEVEL SECURITY;
REVOKE ALL ON profile_mcp.request_leases FROM PUBLIC,anon,authenticated,service_role;

CREATE FUNCTION profile_mcp.runtime_rpc(action text, p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, profile_mcp
AS $$
DECLARE result jsonb; n integer; row_id uuid; t timestamptz; k bytea;
BEGIN
  CASE action
  WHEN 'artifact.put' THEN
    IF length(p->>'model')>80 OR ((p->>'ttl')::int NOT BETWEEN 1 AND 604800 AND NOT(p->>'model'='Client' AND (p->>'ttl')::int=0)) THEN RAISE EXCEPTION 'Invalid artifact'; END IF;
    INSERT INTO profile_mcp.oauth_artifacts(model,id_digest,grant_digest,uid_digest,payload_ciphertext,encryption_key_id,expires_at)
    VALUES(p->>'model',decode(p->>'id','hex'),decode(p->>'grant','hex'),decode(p->>'uid','hex'),convert_to(p->>'ciphertext','UTF8'),p->>'keyId',CASE WHEN p->>'model'='Client' THEN 'infinity'::timestamptz ELSE clock_timestamp()+make_interval(secs=>(p->>'ttl')::int) END)
    ON CONFLICT(model,id_digest) DO UPDATE SET payload_ciphertext=excluded.payload_ciphertext,encryption_key_id=excluded.encryption_key_id,
      grant_digest=excluded.grant_digest,uid_digest=excluded.uid_digest,expires_at=excluded.expires_at,version=oauth_artifacts.version+1;
    RETURN 'true';
  WHEN 'artifact.get' THEN
    SELECT jsonb_build_object('id',encode(id_digest,'hex'),'ciphertext',convert_from(payload_ciphertext,'UTF8'),'consumed',floor(extract(epoch FROM consumed_at)))
      INTO result FROM profile_mcp.oauth_artifacts WHERE model=p->>'model' AND expires_at>clock_timestamp()
      AND (CASE WHEN coalesce((p->>'byUid')::boolean,false) THEN uid_digest=decode(p->>'id','hex') ELSE id_digest=decode(p->>'id','hex') END);
    RETURN result;
  WHEN 'artifact.consume' THEN
    UPDATE profile_mcp.oauth_artifacts SET consumed_at=clock_timestamp(),version=version+1
      WHERE model=p->>'model' AND id_digest=decode(p->>'id','hex') AND consumed_at IS NULL AND expires_at>clock_timestamp();
    GET DIAGNOSTICS n=ROW_COUNT; RETURN to_jsonb(n=1);
  WHEN 'artifact.destroy' THEN
    DELETE FROM profile_mcp.oauth_artifacts WHERE model=p->>'model' AND id_digest=decode(p->>'id','hex'); RETURN 'true';
  WHEN 'member.get' THEN
    SELECT jsonb_build_object('userId',u.id) INTO result FROM profile_mcp.users u
      JOIN profile_mcp.memberships m ON m.user_id=u.id JOIN profile_mcp.teams t ON t.id=m.team_id
      WHERE u.sha_subject_digest=decode(p->>'subject','hex') AND m.team_id=(p->>'teamId')::uuid
      AND u.status='active' AND m.status='active' AND t.status='active'; RETURN result;
  WHEN 'member.by-id' THEN
    SELECT jsonb_build_object('userId',u.id) INTO result FROM profile_mcp.users u
      JOIN profile_mcp.memberships m ON m.user_id=u.id JOIN profile_mcp.teams t ON t.id=m.team_id
      WHERE u.id=(p->>'userId')::uuid AND m.team_id=(p->>'teamId')::uuid
      AND u.status='active' AND m.status='active' AND t.status='active'; RETURN result;
  WHEN 'session.create' THEN
    IF NOT EXISTS(SELECT 1 FROM profile_mcp.memberships m JOIN profile_mcp.users u ON u.id=m.user_id JOIN profile_mcp.teams t ON t.id=m.team_id
      WHERE m.user_id=(p->>'userId')::uuid AND m.team_id=(p->>'teamId')::uuid AND m.status='active' AND u.status='active' AND t.status='active') THEN
      RAISE EXCEPTION 'Membership denied'; END IF;
    IF (p->>'expiresAt')::timestamptz<=clock_timestamp() THEN RAISE EXCEPTION 'Expired session'; END IF;
    INSERT INTO profile_mcp.upstream_sessions(id,team_id,user_id,token_ciphertext,encryption_key_id,state,access_expires_at)
      VALUES((p->>'id')::uuid,(p->>'teamId')::uuid,(p->>'userId')::uuid,convert_to(p->>'ciphertext','UTF8'),p->>'keyId','active',(p->>'expiresAt')::timestamptz);
    INSERT INTO profile_mcp.connections(id,team_id,user_id,upstream_session_id,oauth_client_id,oauth_grant_digest,resource_uri,granted_scopes,state,expires_at)
      VALUES((p->>'id')::uuid,(p->>'teamId')::uuid,(p->>'userId')::uuid,(p->>'id')::uuid,p->>'clientId',decode(p->>'grant','hex'),p->>'resource',
        ARRAY(SELECT jsonb_array_elements_text(p->'scopes')),'active',(p->>'expiresAt')::timestamptz); RETURN 'true';
  WHEN 'session.get' THEN
    SELECT jsonb_build_object('id',s.id,'ciphertext',convert_from(s.token_ciphertext,'UTF8'),'userId',s.user_id,'generation',s.generation)
      INTO result FROM profile_mcp.upstream_sessions s JOIN profile_mcp.connections c ON c.upstream_session_id=s.id AND c.team_id=s.team_id AND c.user_id=s.user_id
      JOIN profile_mcp.memberships m ON m.team_id=s.team_id AND m.user_id=s.user_id JOIN profile_mcp.users u ON u.id=s.user_id JOIN profile_mcp.teams t ON t.id=s.team_id
      WHERE (CASE WHEN p->>'grant' IS NOT NULL THEN c.oauth_grant_digest=decode(p->>'grant','hex') ELSE s.id=(p->>'id')::uuid END)
      AND s.team_id=(p->>'teamId')::uuid AND s.state='active' AND c.state='active'
      AND s.generation=c.session_generation AND s.access_expires_at>clock_timestamp() AND c.expires_at>clock_timestamp()
      AND m.status='active' AND u.status='active' AND t.status='active'; RETURN result;
  WHEN 'session.revoke' THEN
    UPDATE profile_mcp.connections SET state='revoked',session_generation=session_generation+1,updated_at=clock_timestamp()
      WHERE id=(p->>'id')::uuid AND team_id=(p->>'teamId')::uuid AND user_id=(p->>'userId')::uuid;
    UPDATE profile_mcp.upstream_sessions SET state='revoked',generation=generation+1,token_ciphertext=NULL,encryption_key_id=NULL,revoked_at=clock_timestamp(),updated_at=clock_timestamp()
      WHERE id=(p->>'id')::uuid AND team_id=(p->>'teamId')::uuid AND user_id=(p->>'userId')::uuid;
    DELETE FROM profile_mcp.oauth_artifacts WHERE grant_digest IN (SELECT oauth_grant_digest FROM profile_mcp.connections WHERE id=(p->>'id')::uuid AND team_id=(p->>'teamId')::uuid AND user_id=(p->>'userId')::uuid);
    DELETE FROM profile_mcp.entitlement_snapshots WHERE session_id=(p->>'id')::uuid AND team_id=(p->>'teamId')::uuid AND user_id=(p->>'userId')::uuid;
    RETURN 'true';
  WHEN 'grant.revoke' THEN
    FOR row_id IN SELECT id FROM profile_mcp.connections WHERE oauth_grant_digest=decode(p->>'grant','hex') AND team_id=(p->>'teamId')::uuid LOOP
      PERFORM profile_mcp.runtime_rpc('session.revoke',jsonb_build_object('id',row_id,'teamId',p->>'teamId','userId',(SELECT user_id FROM profile_mcp.connections WHERE id=row_id)));
    END LOOP;
    DELETE FROM profile_mcp.oauth_artifacts WHERE grant_digest=decode(p->>'grant','hex'); RETURN 'true';
  WHEN 'quota.take' THEN
    IF (p->>'seconds')::int NOT BETWEEN 1 AND 3600 OR (p->>'limit')::int NOT BETWEEN 1 AND 10000 THEN RAISE EXCEPTION 'Invalid quota'; END IF;
    t=to_timestamp(floor(extract(epoch FROM clock_timestamp())/(p->>'seconds')::int)*(p->>'seconds')::int); k=decode(p->>'key','hex');
    INSERT INTO profile_mcp.rate_buckets(key_digest,window_start,used,expires_at) VALUES(k,t,1,t+make_interval(secs=>(p->>'seconds')::int))
    ON CONFLICT(key_digest,window_start) DO UPDATE SET used=rate_buckets.used+1 WHERE rate_buckets.used<(p->>'limit')::int;
    GET DIAGNOSTICS n=ROW_COUNT; RETURN to_jsonb(n=1);
  WHEN 'lease.acquire' THEN
    PERFORM pg_advisory_xact_lock(20261009,2);
    DELETE FROM profile_mcp.request_leases WHERE expires_at<=clock_timestamp();
    IF (SELECT count(*) FROM profile_mcp.request_leases)>=10 OR
      (SELECT count(*) FROM profile_mcp.request_leases WHERE owner_digest=decode(p->>'owner','hex'))>=2 THEN RETURN 'false'; END IF;
    INSERT INTO profile_mcp.request_leases(id,owner_digest,expires_at) VALUES((p->>'id')::uuid,decode(p->>'owner','hex'),clock_timestamp()+interval '25 seconds'); RETURN 'true';
  WHEN 'lease.release' THEN
    DELETE FROM profile_mcp.request_leases WHERE id=(p->>'id')::uuid AND owner_digest=decode(p->>'owner','hex'); RETURN 'true';
  WHEN 'audit.write' THEN
    INSERT INTO profile_mcp.audit_events(request_id,subject_digest,event_type,operation_id,result_code,duration_ms,row_count)
      VALUES((p->>'requestId')::uuid,decode(p->>'subject','hex'),'tool',p->>'operation',p->>'result',least((p->>'duration')::int,60000),NULL); RETURN 'true';
  WHEN 'health' THEN RETURN jsonb_build_object('version',(SELECT max(version) FROM profile_mcp.schema_versions));
  ELSE RAISE EXCEPTION 'Unknown operation';
  END CASE;
END $$;
REVOKE ALL ON FUNCTION profile_mcp.runtime_rpc(text,jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT USAGE ON SCHEMA profile_mcp TO profile_mcp_runtime;
GRANT EXECUTE ON FUNCTION profile_mcp.runtime_rpc(text,jsonb) TO profile_mcp_runtime;
CREATE FUNCTION profile_mcp.cleanup_expired() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,profile_mcp AS $$
BEGIN
  UPDATE profile_mcp.upstream_sessions SET state='expired',token_ciphertext=NULL,encryption_key_id=NULL,generation=generation+1,updated_at=clock_timestamp()
    WHERE state='active' AND access_expires_at<=clock_timestamp();
  UPDATE profile_mcp.connections SET state='reauth_required',updated_at=clock_timestamp() WHERE state='active' AND expires_at<=clock_timestamp();
  DELETE FROM profile_mcp.oauth_artifacts WHERE expires_at<=clock_timestamp();
  DELETE FROM profile_mcp.entitlement_snapshots WHERE expires_at<=clock_timestamp();
  DELETE FROM profile_mcp.auth_transactions WHERE expires_at<=clock_timestamp();
  DELETE FROM profile_mcp.request_leases WHERE expires_at<=clock_timestamp();
  DELETE FROM profile_mcp.rate_buckets WHERE expires_at<=clock_timestamp()-interval '1 day';
  DELETE FROM profile_mcp.audit_events WHERE occurred_at<=clock_timestamp()-interval '30 days';
END $$;
REVOKE ALL ON FUNCTION profile_mcp.cleanup_expired() FROM PUBLIC,anon,authenticated,service_role,profile_mcp_runtime;
INSERT INTO profile_mcp.schema_versions(version,description) VALUES('20261009_002','Encrypted OAuth artifacts, atomic consume, membership-bound sessions and runtime RPC');
COMMIT;
