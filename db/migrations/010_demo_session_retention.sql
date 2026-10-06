-- Candidate scans start with expired sessions and must exclude namespaces with
-- a newer session. The existing namespace index serves the newer-session probe.
CREATE INDEX demo_sessions_retention_expiry ON demo_sessions(expires_at,namespace_id);
