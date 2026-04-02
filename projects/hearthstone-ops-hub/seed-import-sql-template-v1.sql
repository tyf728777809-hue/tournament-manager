-- [历史留档] 旧版 seed 模板，面向 public.events / public.tasks / public.daily_checklists
-- 当前联调请优先改用：node scripts/generate-seed-sql.mjs <SUPABASE_USER_ID>
-- 生成结果默认写入 seed-import.generated.sql（对应 hs_ 并行表方案）
-- Hearthstone Ops Hub V1 Seed Import Template
-- 使用前请先把下面的 user_id 替换成你自己的 Supabase auth.users.id

-- 示例：
-- select id, email from auth.users;

-- ==========================================
-- 1) Events
-- ==========================================
insert into public.events (
  user_id,
  title,
  slug,
  type,
  priority,
  status,
  start_date,
  end_date,
  description,
  source_doc,
  sort_order
)
values
  (
    'YOUR_USER_ID_HERE',
    '世冠赛平台赛决赛美术提需',
    'world-championship-platform-finals-design-request',
    'milestone',
    'critical',
    'planned',
    '2025-04-01',
    '2025-04-01',
    '世冠赛平台赛决赛相关美术提需节点。',
    '网易大神炉石传说社区运营 - 2025年4月工作规划',
    10
  ),
  (
    'YOUR_USER_ID_HERE',
    '冲钻领卡包活动上线',
    'rank-push-card-pack-launch',
    'campaign',
    'critical',
    'planned',
    '2025-04-03',
    '2025-04-03',
    '冲钻领卡包活动上线。',
    '网易大神炉石传说社区运营 - 2025年4月工作规划',
    20
  );

-- ==========================================
-- 2) Tasks
-- 说明：event_id 通过 slug 查出，避免手填 uuid
-- ==========================================
insert into public.tasks (
  user_id,
  event_id,
  title,
  task_type,
  priority,
  status,
  task_date,
  planned_date,
  due_date,
  source_type,
  notes
)
select
  'YOUR_USER_ID_HERE',
  e.id,
  v.title,
  v.task_type,
  v.priority,
  v.status,
  v.task_date,
  v.planned_date,
  v.due_date,
  v.source_type,
  v.notes
from (
  values
    (
      'world-championship-platform-finals-design-request',
      '提交世冠赛平台赛决赛美术提需',
      'design',
      'critical',
      'pending',
      date '2025-04-01',
      date '2025-04-01',
      date '2025-04-01',
      'imported',
      '根据 4 月工作规划执行。'
    ),
    (
      'rank-push-card-pack-launch',
      '冲钻领卡包活动上线检查',
      'launch',
      'critical',
      'pending',
      date '2025-04-03',
      date '2025-04-03',
      date '2025-04-03',
      'imported',
      '上线前确认配置、展示与活动状态。'
    )
) as v(event_slug, title, task_type, priority, status, task_date, planned_date, due_date, source_type, notes)
left join public.events e
  on e.slug = v.event_slug
 and e.user_id = 'YOUR_USER_ID_HERE';

-- ==========================================
-- 3) Daily Checklists
-- ==========================================
insert into public.daily_checklists (
  user_id,
  related_event_id,
  check_date,
  title,
  content,
  priority,
  status,
  source_type,
  sort_order
)
select
  'YOUR_USER_ID_HERE',
  e.id,
  v.check_date,
  v.title,
  v.content,
  v.priority,
  v.status,
  v.source_type,
  v.sort_order
from (
  values
    (
      'world-championship-platform-finals-design-request',
      date '2025-04-01',
      '世冠赛平台赛决赛美术提需',
      '处理世冠赛平台赛决赛相关美术提需。',
      'critical',
      'pending',
      'imported',
      10
    ),
    (
      'rank-push-card-pack-launch',
      date '2025-04-03',
      '冲钻领卡包活动上线',
      '确认活动已按计划上线并检查关键配置。',
      'critical',
      'pending',
      'imported',
      20
    )
) as v(event_slug, check_date, title, content, priority, status, source_type, sort_order)
left join public.events e
  on e.slug = v.event_slug
 and e.user_id = 'YOUR_USER_ID_HERE';
