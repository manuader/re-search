-- ============================================================
-- ResearchBot Initial Schema
-- ============================================================

-- Profiles (extends Supabase Auth)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  locale TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Research projects (1 project = 1 chat = 1 research)
CREATE TABLE research_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'configured', 'running', 'completed', 'failed')),
  total_estimated_cost DECIMAL(10,2),
  total_actual_cost DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- Chat messages (linked to project)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tool_invocations JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Scraping jobs (1 per tool used in a project)
CREATE TABLE scraping_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL,
  tool_name TEXT,
  actor_input JSONB NOT NULL,
  search_terms TEXT[],
  estimated_results INT,
  estimated_cost DECIMAL(10,2),
  actual_results INT,
  actual_cost DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed', 'partial')),
  apify_run_id TEXT,
  apify_dataset_id TEXT,
  error_message TEXT,
  quality_score TEXT CHECK (quality_score IN ('high', 'medium', 'low')),
  validation_report JSONB,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Extracted data
CREATE TABLE raw_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES scraping_jobs(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  content JSONB NOT NULL,
  ai_fields JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- AI analysis configurations
CREATE TABLE ai_analysis_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  analysis_type TEXT NOT NULL
    CHECK (analysis_type IN ('sentiment', 'classification', 'entities', 'summary', 'spam_detection', 'pain_points', 'custom')),
  config JSONB NOT NULL,
  output_field_name TEXT NOT NULL,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  batch_id TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tool health (dynamic data, catalog is in code)
CREATE TABLE actor_health (
  tool_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'unknown'
    CHECK (status IN ('healthy', 'degraded', 'down', 'unknown')),
  success_rate_7d DECIMAL(5,2),
  success_rate_30d DECIMAL(5,2),
  avg_cost_per_result DECIMAL(10,4),
  last_test_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_error TEXT,
  consecutive_failures INT DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Health check log
CREATE TABLE actor_health_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id TEXT NOT NULL,
  test_result TEXT NOT NULL CHECK (test_result IN ('success', 'partial', 'failure')),
  results_count INT,
  cost DECIMAL(10,4),
  duration_seconds INT,
  error_message TEXT,
  tested_at TIMESTAMPTZ DEFAULT now()
);

-- Transactions (source of truth for credits)
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES research_projects(id) ON DELETE SET NULL,
  amount DECIMAL(10,2) NOT NULL,
  type TEXT NOT NULL
    CHECK (type IN ('credit_purchase', 'scraping_reserve', 'scraping_cost', 'ai_cost', 'refund')),
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Generated reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES research_projects(id) ON DELETE CASCADE,
  title TEXT,
  html_content TEXT,
  file_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- Indexes
-- ============================================================

CREATE INDEX idx_research_projects_user ON research_projects(user_id);
CREATE INDEX idx_chat_messages_project ON chat_messages(project_id, created_at);
CREATE INDEX idx_scraping_jobs_project ON scraping_jobs(project_id);
CREATE INDEX idx_raw_data_project_job ON raw_data(project_id, job_id);
CREATE INDEX idx_transactions_user ON transactions(user_id);
CREATE INDEX idx_transactions_project ON transactions(project_id);
CREATE INDEX idx_actor_health_log_tool ON actor_health_log(tool_id, tested_at);

-- ============================================================
-- Row Level Security
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE scraping_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE raw_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_analysis_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

-- Research projects: users can CRUD their own projects
CREATE POLICY "Users can view own projects"
  ON research_projects FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create projects"
  ON research_projects FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own projects"
  ON research_projects FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own projects"
  ON research_projects FOR DELETE
  USING (user_id = auth.uid());

-- Chat messages: users can access messages of their own projects
CREATE POLICY "Users can view own chat messages"
  ON chat_messages FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

CREATE POLICY "Users can insert own chat messages"
  ON chat_messages FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- Scraping jobs: users can view jobs of their own projects
CREATE POLICY "Users can view own scraping jobs"
  ON scraping_jobs FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- Raw data: users can view data of their own projects
CREATE POLICY "Users can view own raw data"
  ON raw_data FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- AI analysis configs: users can view configs of their own projects
CREATE POLICY "Users can view own ai configs"
  ON ai_analysis_configs FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- Transactions: users can view their own transactions
CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  USING (user_id = auth.uid());

-- Reports: users can view reports of their own projects
CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  USING (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- ============================================================
-- Functions
-- ============================================================

-- Get user credit balance
CREATE OR REPLACE FUNCTION get_credit_balance(p_user_id UUID)
RETURNS DECIMAL(10,2)
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM transactions
  WHERE user_id = p_user_id;
$$;

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'name', split_part(NEW.email, '@', 1))
  );

  -- Welcome credits ($3)
  INSERT INTO public.transactions (user_id, amount, type, description)
  VALUES (NEW.id, 3.00, 'credit_purchase', 'Welcome credits');

  RETURN NEW;
END;
$$;

-- Trigger: create profile on auth.users insert
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================================
-- Realtime
-- ============================================================

-- Enable realtime for scraping_jobs (progress tracking)
ALTER PUBLICATION supabase_realtime ADD TABLE scraping_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE research_projects;
