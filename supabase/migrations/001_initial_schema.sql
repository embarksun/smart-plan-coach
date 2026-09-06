-- 智能计划教练 - 初始数据库结构
-- 在 Supabase SQL Editor 中执行，或使用 supabase db push

-- plans（计划表）
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cycle TEXT DEFAULT '月',
  goal TEXT,
  mode TEXT DEFAULT 'B',
  status TEXT DEFAULT 'active',
  daily_task_target INT DEFAULT 3,
  min_guarantee INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  category TEXT,
  color TEXT,
  templates JSONB DEFAULT '[]'::jsonb,
  milestones JSONB DEFAULT '[]'::jsonb
);

-- tasks（任务表）
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  duration TEXT,
  priority TEXT DEFAULT 'P1',
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  phase TEXT DEFAULT 'day',
  tpl_idx INT,
  is_milestone BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_tasks_plan_due ON tasks(plan_id, due_date);

-- daily_records（每日记录表）
CREATE TABLE IF NOT EXISTS daily_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id TEXT NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  record_date DATE NOT NULL,
  total_tasks INT DEFAULT 0,
  completed_tasks INT DEFAULT 0,
  completion_rate NUMERIC DEFAULT 0,
  consecutive_good_days INT DEFAULT 0,
  consecutive_bad_days INT DEFAULT 0,
  is_rest_day BOOLEAN DEFAULT FALSE,
  UNIQUE(plan_id, record_date)
);

-- user_points（积分表）
CREATE TABLE IF NOT EXISTS user_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  total_points INT DEFAULT 0
);

-- user_titles（称号表）
CREATE TABLE IF NOT EXISTS user_titles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title_code TEXT,
  title_name TEXT NOT NULL,
  title_emoji TEXT,
  unlocked_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, title_name)
);

-- 扩展状态（settlements、stats、weeklyAvg 等，保证现有功能完整）
CREATE TABLE IF NOT EXISTS user_app_meta (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_titles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_meta ENABLE ROW LEVEL SECURITY;

CREATE POLICY "plans_own" ON plans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tasks_own" ON tasks FOR ALL USING (
  EXISTS (SELECT 1 FROM plans p WHERE p.id = tasks.plan_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM plans p WHERE p.id = tasks.plan_id AND p.user_id = auth.uid())
);
CREATE POLICY "daily_records_own" ON daily_records FOR ALL USING (
  EXISTS (SELECT 1 FROM plans p WHERE p.id = daily_records.plan_id AND p.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM plans p WHERE p.id = daily_records.plan_id AND p.user_id = auth.uid())
);
CREATE POLICY "user_points_own" ON user_points FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_titles_own" ON user_titles FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "user_app_meta_own" ON user_app_meta FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
