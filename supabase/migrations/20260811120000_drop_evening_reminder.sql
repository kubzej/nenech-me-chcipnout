-- Evening reminder was built (Fáze 1 push notifications) but removed
-- immediately after — Jakub wants to keep the notification setup simple for
-- now, and redo evening reminders properly later rather than leave a
-- half-used feature around. Clean removal, not a disable.
alter table public.notification_preferences
drop column if exists evening_reminder_enabled,
drop column if exists evening_time,
drop column if exists last_evening_reminder_sent_on;
