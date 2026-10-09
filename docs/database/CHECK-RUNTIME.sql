-- Aggregate operational facts only: no username, digest, token or ciphertext.
SELECT max(version) AS version FROM profile_mcp.schema_versions;
SELECT count(*) AS table_count, count(*) FILTER (WHERE relrowsecurity AND relforcerowsecurity) AS forced_rls_count
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='profile_mcp' AND c.relkind='r';
SELECT has_table_privilege('profile_mcp_app','profile_mcp.users','SELECT') AS runtime_table_read,
has_function_privilege('profile_mcp_app','profile_mcp.runtime_rpc(text,jsonb)','EXECUTE') AS runtime_rpc;
SELECT name,installed_version FROM pg_available_extensions WHERE name='pg_cron';
SELECT count(*) AS allowed_members FROM profile_mcp.memberships WHERE status='active';
