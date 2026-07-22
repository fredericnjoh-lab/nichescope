-- Optional: schedule daily scan via pg_cron + pg_net
-- Run in SQL Editor AFTER AFTER replacing placeholders.
--
-- 1. Set secrets first:
--    npx supabase secrets set YOUTUBE_API_KEY=your_yt_key
--    npx supabase secrets set CRON_SECRET=a_long_random_string
-- 2. Deploy: npx supabase functions deploy scan-daily
-- 3. Replace PROJECT_REF and YOUR_CRON_SECRET below, then Run.

-- Enable extensions (usually already on for Supabase)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Unschedule old job if re-running
select cron.unschedule('nichescope-scan-daily')
where exists (
  select 1 from cron.job where jobname = 'nichescope-scan-daily'
);

select cron.schedule(
  'nichescope-scan-daily',
  '0 6 * * *',  -- 06:00 UTC daily
  $$
  select net.http_post(
    url := 'https://PROJECT_REF.supabase.co/functions/v1/scan-daily',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', 'YOUR_CRON_SECRET'
    ),
    body := jsonb_build_object('limit', 40)
  );
  $$
);
