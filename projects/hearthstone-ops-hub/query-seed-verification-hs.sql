-- hs_ Seed 导入后的快速验证 SQL

select id, title, slug, type, priority, status, start_date, end_date, user_id
from public.hs_events
order by start_date asc, sort_order asc;

select id, title, task_type, priority, status, task_date, due_date, event_id, user_id
from public.hs_tasks
order by task_date asc, created_at asc;

select id, check_date, title, priority, status, related_event_id, user_id
from public.hs_daily_checklists
order by check_date asc, sort_order asc;

select
  user_id,
  count(*) filter (where kind = 'event') as event_count,
  count(*) filter (where kind = 'task') as task_count,
  count(*) filter (where kind = 'daily') as daily_count
from (
  select user_id, 'event' as kind from public.hs_events
  union all
  select user_id, 'task' as kind from public.hs_tasks
  union all
  select user_id, 'daily' as kind from public.hs_daily_checklists
) t
group by user_id;
