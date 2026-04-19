
The user is running `01-schema.sql` in their new Supabase project and hitting an error: the `has_role` function references `public.user_roles` before that table has been created. Let me check the schema file ordering.

Looking at the migration package: `migration-package/01-schema.sql` line 28 contains `has_role` function. The error means the function is created before the `user_roles` table exists.

Fix: reorder the SQL so all tables are created first, then enums, then functions, then triggers, then RLS policies.

I'll plan a single fix to the schema file with proper ordering.
