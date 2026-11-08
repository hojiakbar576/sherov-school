# Database changes

Applied to the Supabase project `lpxtpxawrvorybllgucg` in this order:

1. `001_centers_branches_profiles` – centres, branches, staff accounts (applied earlier)
2. `002_private_helpers` – `private.my_center()`, `private.my_role()` (applied earlier)
3. `003_school_records` – the `records` table that holds all school data, its history table, and the security rules (who may read or change each row)
4. `004_hide_centre_finance_from_branch_staff` – organisation-wide finance rows are visible to the owner only

All school data lives in `public.records` (one row per student, payment, lesson…), tagged with
`branch_id` and, for personal records, `person_id`. `public.records_history` keeps the old version
of every changed or deleted row, readable by the owner only.
