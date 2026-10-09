-- Read-only verification of initial schema/isolation. No application/session data returned.
SELECT
  (SELECT version FROM profile_mcp.schema_versions ORDER BY applied_at DESC LIMIT 1) AS migration_version,
  count(*) AS table_count,
  count(*) FILTER (WHERE c.relrowsecurity) AS rls_enabled_count,
  count(*) FILTER (WHERE c.relforcerowsecurity) AS rls_forced_count,
  (SELECT count(*) FROM pg_policies WHERE schemaname='profile_mcp') AS policy_count,
  has_schema_privilege('anon','profile_mcp','USAGE') AS anon_schema_usage,
  has_schema_privilege('authenticated','profile_mcp','USAGE') AS authenticated_schema_usage,
  has_schema_privilege('service_role','profile_mcp','USAGE') AS service_role_schema_usage,
  count(*) FILTER (WHERE has_table_privilege('anon',c.oid,'SELECT')) AS anon_readable_tables,
  count(*) FILTER (WHERE has_table_privilege('authenticated',c.oid,'SELECT')) AS authenticated_readable_tables,
  count(*) FILTER (WHERE has_table_privilege('service_role',c.oid,'SELECT')) AS service_role_readable_tables,
  (SELECT count(*) FROM profile_mcp.users) AS user_count,
  (SELECT count(*) FROM profile_mcp.upstream_sessions) AS session_count,
  (SELECT count(*) FROM profile_mcp.connections) AS connection_count
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='profile_mcp' AND c.relkind='r';
