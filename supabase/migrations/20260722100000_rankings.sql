-- NicheScope P3 — keyword ranking history (Supabase)
-- Enable anonymous sign-in in Auth settings for zero-friction tracking.

create extension if not exists "pgcrypto";

create table if not exists public.tracked_keywords (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  keyword text not null,
  region text not null default '',
  lang text not null default 'fr',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tracked_keywords_keyword_len check (char_length(keyword) between 1 and 120),
  unique (user_id, keyword, region)
);

create table if not exists public.ranking_snapshots (
  id uuid primary key default gen_random_uuid(),
  tracked_keyword_id uuid not null references public.tracked_keywords (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  captured_at timestamptz not null default now(),
  overall_score int not null default 0,
  volume_score int not null default 0,
  competition_score int not null default 0,
  opportunity_score int not null default 0,
  total_results bigint not null default 0,
  avg_top_views numeric not null default 0,
  avg_top_subs numeric not null default 0,
  small_channels int not null default 0,
  top_video_ids jsonb not null default '[]'::jsonb,
  meta jsonb not null default '{}'::jsonb
);

create index if not exists tracked_keywords_user_idx
  on public.tracked_keywords (user_id, active);

create index if not exists ranking_snapshots_kw_time_idx
  on public.ranking_snapshots (tracked_keyword_id, captured_at desc);

create index if not exists ranking_snapshots_user_time_idx
  on public.ranking_snapshots (user_id, captured_at desc);

alter table public.tracked_keywords enable row level security;
alter table public.ranking_snapshots enable row level security;

create policy "tracked_keywords_select_own"
  on public.tracked_keywords for select
  to authenticated
  using (auth.uid() = user_id);

create policy "tracked_keywords_insert_own"
  on public.tracked_keywords for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "tracked_keywords_update_own"
  on public.tracked_keywords for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "tracked_keywords_delete_own"
  on public.tracked_keywords for delete
  to authenticated
  using (auth.uid() = user_id);

create policy "ranking_snapshots_select_own"
  on public.ranking_snapshots for select
  to authenticated
  using (auth.uid() = user_id);

create policy "ranking_snapshots_insert_own"
  on public.ranking_snapshots for insert
  to authenticated
  with check (auth.uid() = user_id);

create policy "ranking_snapshots_delete_own"
  on public.ranking_snapshots for delete
  to authenticated
  using (auth.uid() = user_id);

-- updated_at helper
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists tracked_keywords_updated_at on public.tracked_keywords;
create trigger tracked_keywords_updated_at
  before update on public.tracked_keywords
  for each row execute function public.set_updated_at();
