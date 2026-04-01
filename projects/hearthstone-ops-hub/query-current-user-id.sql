-- 在 Supabase SQL Editor 中执行
-- 用于查询当前项目里已有的 auth 用户，拿到后续 seed 导入需要的 user_id

select id, email, created_at
from auth.users
order by created_at desc;
