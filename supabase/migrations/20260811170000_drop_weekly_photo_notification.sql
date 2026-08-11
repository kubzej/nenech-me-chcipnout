-- weekly_photo_enabled was a settings toggle with no trigger behind it —
-- nothing in the cron jobs ever read it, so it was a dead switch that lied
-- about doing something. Same call as the evening reminder: remove
-- cleanly now, revisit properly later if a weekly-photo nudge is wanted.
alter table public.notification_preferences
drop column if exists weekly_photo_enabled;
