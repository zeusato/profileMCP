-- Profile MCP / SHA: initial private-store schema, version 20261009_001.
-- No business data, passwords, OTPs, real users, cloud keys or login roles.
-- Review deployment target and run within the intended Supabase project only.
-- Re-running after version exists is intentionally an error; inspect state first.
BEGIN;

CREATE SCHEMA profile_mcp;
REVOKE ALL ON SCHEMA profile_mcp FROM PUBLIC, anon, authenticated, service_role;

CREATE TABLE profile_mcp.schema_versions (
  version text PRIMARY KEY,
  applied_at timestamptz NOT NULL DEFAULT now(),
  description text NOT NULL
);

CREATE TABLE profile_mcp.teams (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 120),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile_mcp.users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sha_subject_digest bytea NOT NULL UNIQUE CHECK (octet_length(sha_subject_digest)=32),
  identity_ciphertext bytea NOT NULL,
  encryption_key_id text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE profile_mcp.memberships (
  team_id uuid NOT NULL REFERENCES profile_mcp.teams(id),
  user_id uuid NOT NULL REFERENCES profile_mcp.users(id),
  role text NOT NULL CHECK (role IN ('member','admin')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (team_id,user_id)
);

CREATE TABLE profile_mcp.upstream_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  token_ciphertext bytea,
  encryption_key_id text,
  state text NOT NULL CHECK (state IN ('active','expired','reauth_required','revoked')),
  generation bigint NOT NULL DEFAULT 1 CHECK (generation>0),
  access_expires_at timestamptz NOT NULL,
  refresh_expires_at timestamptz,
  refresh_contract_enabled boolean NOT NULL DEFAULT false,
  refresh_lease_until timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (team_id,user_id) REFERENCES profile_mcp.memberships(team_id,user_id),
  UNIQUE (id,team_id,user_id),
  CHECK ((token_ciphertext IS NULL) = (encryption_key_id IS NULL)),
  CHECK (state <> 'active' OR token_ciphertext IS NOT NULL),
  CHECK (state <> 'revoked' OR (token_ciphertext IS NULL AND revoked_at IS NOT NULL))
);
CREATE INDEX upstream_sessions_owner_idx ON profile_mcp.upstream_sessions(team_id,user_id,state);
CREATE INDEX upstream_sessions_expiry_idx ON profile_mcp.upstream_sessions(access_expires_at);

CREATE TABLE profile_mcp.connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  upstream_session_id uuid UNIQUE,
  oauth_client_id text NOT NULL,
  oauth_grant_digest bytea UNIQUE CHECK (oauth_grant_digest IS NULL OR octet_length(oauth_grant_digest)=32),
  resource_uri text NOT NULL,
  granted_scopes text[] NOT NULL DEFAULT '{}',
  session_generation bigint NOT NULL DEFAULT 1 CHECK (session_generation>0),
  state text NOT NULL CHECK (state IN ('pending','active','reauth_required','revoked')),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (team_id,user_id) REFERENCES profile_mcp.memberships(team_id,user_id),
  FOREIGN KEY (upstream_session_id,team_id,user_id) REFERENCES profile_mcp.upstream_sessions(id,team_id,user_id),
  UNIQUE (id,team_id,user_id),
  CHECK (state <> 'active' OR (upstream_session_id IS NOT NULL AND oauth_grant_digest IS NOT NULL))
);
CREATE INDEX connections_owner_idx ON profile_mcp.connections(team_id,user_id,state);

CREATE TABLE profile_mcp.auth_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  browser_binding_digest bytea NOT NULL CHECK (octet_length(browser_binding_digest)=32),
  state_digest bytea NOT NULL UNIQUE CHECK (octet_length(state_digest)=32),
  oauth_client_id text NOT NULL,
  redirect_uri text NOT NULL,
  resource_uri text NOT NULL,
  pkce_challenge text NOT NULL,
  requested_scopes text[] NOT NULL DEFAULT '{}',
  challenge_ciphertext bytea,
  encryption_key_id text,
  state text NOT NULL DEFAULT 'created' CHECK (state IN ('created','password_submitted','challenge_ready','verifying','succeeded','failed','expired','cancelled')),
  version bigint NOT NULL DEFAULT 1 CHECK (version>0),
  verify_attempts integer NOT NULL DEFAULT 0 CHECK (verify_attempts>=0),
  claimed_until timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((challenge_ciphertext IS NULL) = (encryption_key_id IS NULL)),
  CHECK (state NOT IN ('succeeded','failed','expired','cancelled') OR challenge_ciphertext IS NULL)
);
CREATE INDEX auth_transactions_expiry_idx ON profile_mcp.auth_transactions(expires_at);

CREATE TABLE profile_mcp.oauth_artifacts (
  model text NOT NULL,
  id_digest bytea NOT NULL CHECK (octet_length(id_digest)=32),
  grant_digest bytea CHECK (grant_digest IS NULL OR octet_length(grant_digest)=32),
  connection_id uuid REFERENCES profile_mcp.connections(id),
  payload_ciphertext bytea NOT NULL,
  encryption_key_id text NOT NULL,
  version bigint NOT NULL DEFAULT 1 CHECK (version>0),
  consumed_at timestamptz,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (model,id_digest)
);
CREATE INDEX oauth_artifacts_grant_idx ON profile_mcp.oauth_artifacts(grant_digest);
CREATE INDEX oauth_artifacts_expiry_idx ON profile_mcp.oauth_artifacts(expires_at);

CREATE TABLE profile_mcp.entitlement_snapshots (
  session_id uuid PRIMARY KEY,
  team_id uuid NOT NULL,
  user_id uuid NOT NULL,
  session_generation bigint NOT NULL CHECK (session_generation>0),
  version bigint NOT NULL DEFAULT 1 CHECK (version>0),
  payload_ciphertext bytea NOT NULL,
  encryption_key_id text NOT NULL,
  complete boolean NOT NULL DEFAULT false,
  source_fetched_at timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  FOREIGN KEY (session_id,team_id,user_id) REFERENCES profile_mcp.upstream_sessions(id,team_id,user_id)
);
CREATE INDEX entitlement_expiry_idx ON profile_mcp.entitlement_snapshots(expires_at);

CREATE TABLE profile_mcp.audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  request_id uuid NOT NULL,
  subject_digest bytea CHECK (subject_digest IS NULL OR octet_length(subject_digest)=32),
  event_type text NOT NULL,
  operation_id text,
  result_code text NOT NULL,
  duration_ms integer CHECK (duration_ms>=0),
  row_count integer CHECK (row_count>=0),
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_events_time_idx ON profile_mcp.audit_events(occurred_at);

CREATE TABLE profile_mcp.rate_buckets (
  key_digest bytea NOT NULL CHECK (octet_length(key_digest)=32),
  window_start timestamptz NOT NULL,
  used integer NOT NULL DEFAULT 0 CHECK (used>=0),
  expires_at timestamptz NOT NULL,
  PRIMARY KEY (key_digest,window_start)
);
CREATE INDEX rate_buckets_expiry_idx ON profile_mcp.rate_buckets(expires_at);

ALTER TABLE profile_mcp.schema_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.upstream_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.auth_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.oauth_artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.entitlement_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.rate_buckets ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.schema_versions FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.teams FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.users FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.memberships FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.upstream_sessions FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.connections FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.auth_transactions FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.oauth_artifacts FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.entitlement_snapshots FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.audit_events FORCE ROW LEVEL SECURITY;
ALTER TABLE profile_mcp.rate_buckets FORCE ROW LEVEL SECURITY;

REVOKE ALL ON ALL TABLES IN SCHEMA profile_mcp FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA profile_mcp FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA profile_mcp FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA profile_mcp REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA profile_mcp REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA profile_mcp REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated, service_role;

INSERT INTO profile_mcp.schema_versions(version,description)
VALUES ('20261009_001','Private encrypted session store foundation; runtime grants/adapters not yet provisioned');

COMMIT;
