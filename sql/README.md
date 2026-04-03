# SQL setup

Scripts included in this folder:

- `01_schema_tables.sql`: base schema, additive columns, constraints, indexes, and SQL objects used by the app.
- `02_storage_buckets.sql`: storage buckets, filename guards, MIME allowlists, and storage policies.
- `03_sync_existing_supabase.sql`: additive sync script for existing Supabase projects that need to be aligned without rebuilding from scratch.

Operational note:

- `03_sync_existing_supabase.sql` is not loaded by the app at runtime.
- It is used as an operational bootstrap/sync script and is also referenced by repository contract tests.
