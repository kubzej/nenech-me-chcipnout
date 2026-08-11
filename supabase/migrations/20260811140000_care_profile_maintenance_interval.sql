-- Maintenance tasks (pruning, repotting, rotating...) were always in scope
-- (care_tasks.task_type already had 'maintenance', care_profiles already had
-- free-text maintenance_notes) but daily_plan.py never actually generated
-- one — there was no interval to schedule it from. This adds the missing
-- cadence field, matching the existing check/photo/pest interval pattern.
alter table public.care_profiles
add column if not exists maintenance_interval_days integer;
