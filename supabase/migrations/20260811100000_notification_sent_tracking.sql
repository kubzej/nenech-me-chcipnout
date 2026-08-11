-- Per-user tracking of the last date each scheduled push type was sent, so
-- the cron job (which may run more than once around the target time, or be
-- retried) never double-sends the same day's daily digest / evening
-- reminder to the same person.
alter table public.notification_preferences
add column if not exists last_daily_digest_sent_on date,
add column if not exists last_evening_reminder_sent_on date;
