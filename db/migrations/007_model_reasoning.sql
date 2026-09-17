ALTER TABLE agent_runs ADD COLUMN execution jsonb NOT NULL DEFAULT '{"kind":"demo","version":1}';
ALTER TABLE agent_runs ADD CHECK(jsonb_typeof(execution)='object' AND execution->>'kind' IN ('demo','model'));

-- Deliberately independent of demo namespace/workspace foreign keys: deleting or
-- resetting a workspace cannot refund calls, including calls with unknown cost.
CREATE TABLE model_call_budgets (
  scope text NOT NULL, day date NOT NULL, reserved integer NOT NULL DEFAULT 0,
  call_limit integer NOT NULL, PRIMARY KEY(scope,day),
  CHECK(reserved >= 0 AND call_limit BETWEEN 1 AND 100)
);
-- Dispatch slots also survive workspace reset. Keep uncertain/cancelled calls
-- reserved for their full bounded window; remote cancellation is not promised.
CREATE TABLE model_dispatch_slots (
  scope text NOT NULL, run_id uuid NOT NULL, expires_at timestamptz NOT NULL,
  PRIMARY KEY(scope,run_id)
);
CREATE INDEX model_dispatch_slots_expiry ON model_dispatch_slots(scope,expires_at);
CREATE TABLE model_attempts (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, run_id uuid NOT NULL,
  budget_scope text NOT NULL, budget_day date NOT NULL,
  status text NOT NULL CHECK(status IN ('intent','succeeded','failed','unknown')),
  request_sha256 text NOT NULL, request_bytes integer NOT NULL,
  provider text NOT NULL CHECK(provider='anthropic'), model text NOT NULL, prompt_version text NOT NULL,
  message_id text, request_id text, input_tokens integer, output_tokens integer, error_code text,
  created_at timestamptz NOT NULL DEFAULT clock_timestamp(), updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(run_id),
  FOREIGN KEY(namespace_id,profile_id,run_id) REFERENCES agent_runs(namespace_id,profile_id,id) ON DELETE CASCADE,
  CHECK(request_bytes BETWEEN 1 AND 32768),
  CHECK(input_tokens IS NULL OR input_tokens >= 0), CHECK(output_tokens IS NULL OR output_tokens BETWEEN 0 AND 1024)
);
