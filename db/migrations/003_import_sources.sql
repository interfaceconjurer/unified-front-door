CREATE TABLE legacy_import_sources (
  namespace_id uuid NOT NULL, profile_id text NOT NULL, source_hash text NOT NULL,
  source jsonb NOT NULL, recovery jsonb NOT NULL,
  PRIMARY KEY (namespace_id, profile_id, source_hash),
  FOREIGN KEY (namespace_id, profile_id, source_hash) REFERENCES import_receipts(namespace_id, profile_id, source_hash) ON DELETE CASCADE
);
