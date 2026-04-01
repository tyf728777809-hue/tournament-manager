-- Hearthstone Ops Hub V1 Schema
-- Target: Supabase Postgres
-- Created: 2026-04-01

create extension if not exists pgcrypto;

-- ==========================================
-- updated_at trigger
-- ==========================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ==========================================
-- profiles
-- ==========================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- ==========================================
-- events
-- ==========================================
create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  slug text,
  type text not null check (type in ('event', 'campaign', 'milestone')),
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'planned' check (status in ('planned', 'active', 'done', 'cancelled')),
  start_date date not null,
  end_date date,
  description text,
  source_doc text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_date_check check (end_date is null or end_date >= start_date)
);

create index if not exists idx_events_user_id on public.events(user_id);
create index if not exists idx_events_type on public.events(type);
create index if not exists idx_events_start_date on public.events(start_date);
create index if not exists idx_events_status on public.events(status);
create unique index if not exists uq_events_user_slug on public.events(user_id, slug) where slug is not null;

create trigger set_events_updated_at
before update on public.events
for each row
execute function public.set_updated_at();

-- ==========================================
-- tasks
-- ==========================================
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_id uuid references public.events(id) on delete set null,
  title text not null,
  task_type text not null default 'misc' check (task_type in ('design', 'config', 'launch', 'content', 'review', 'data', 'ops', 'misc')),
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'overdue')),
  task_date date not null,
  planned_date date,
  due_date date,
  source_type text not null default 'manual' check (source_type in ('manual', 'imported', 'generated')),
  notes text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tasks_due_date_check check (due_date is null or due_date >= task_date or planned_date is not null),
  constraint tasks_planned_due_check check (planned_date is null or due_date is null or due_date >= planned_date)
);

create index if not exists idx_tasks_user_id on public.tasks(user_id);
create index if not exists idx_tasks_event_id on public.tasks(event_id);
create index if not exists idx_tasks_task_date on public.tasks(task_date);
create index if not exists idx_tasks_due_date on public.tasks(due_date);
create index if not exists idx_tasks_status on public.tasks(status);
create index if not exists idx_tasks_priority on public.tasks(priority);

create trigger set_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

-- ==========================================
-- daily_checklists
-- ==========================================
create table if not exists public.daily_checklists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  related_event_id uuid references public.events(id) on delete set null,
  check_date date not null,
  title text not null,
  content text,
  priority text not null default 'medium' check (priority in ('critical', 'high', 'medium', 'low')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'done', 'overdue')),
  source_type text not null default 'imported' check (source_type in ('manual', 'imported', 'generated')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_daily_checklists_user_id on public.daily_checklists(user_id);
create index if not exists idx_daily_checklists_check_date on public.daily_checklists(check_date);
create index if not exists idx_daily_checklists_status on public.daily_checklists(status);
create index if not exists idx_daily_checklists_related_event_id on public.daily_checklists(related_event_id);

create trigger set_daily_checklists_updated_at
before update on public.daily_checklists
for each row
execute function public.set_updated_at();

-- ==========================================
-- helpful views
-- ==========================================
create or replace view public.v_dashboard_today as
select
  'task' as item_kind,
  t.id,
  t.user_id,
  t.title,
  t.task_date as item_date,
  t.priority,
  t.status,
  e.title as related_event_title
from public.tasks t
left join public.events e on e.id = t.event_id
union all
select
  'daily_checklist' as item_kind,
  d.id,
  d.user_id,
  d.title,
  d.check_date as item_date,
  d.priority,
  d.status,
  e.title as related_event_title
from public.daily_checklists d
left join public.events e on e.id = d.related_event_id;

-- ==========================================
-- Row Level Security
-- ==========================================
alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.tasks enable row level security;
alter table public.daily_checklists enable row level security;

create policy "profiles_select_own" on public.profiles
for select using (auth.uid() = id);

create policy "profiles_insert_own" on public.profiles
for insert with check (auth.uid() = id);

create policy "profiles_update_own" on public.profiles
for update using (auth.uid() = id);

create policy "events_all_own" on public.events
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "tasks_all_own" on public.tasks
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "daily_checklists_all_own" on public.daily_checklists
for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ==========================================
-- auto-create profile on signup
-- ==========================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(coalesce(new.email, ''), '@', 1))
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
