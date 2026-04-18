-- Add INSERT policies for tables that the executeResearch tool needs to write to
-- (The user's Supabase client is used in API routes, which means RLS applies)

-- Scraping jobs: users can insert jobs for their own projects
CREATE POLICY "Users can insert own scraping jobs"
  ON scraping_jobs FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- AI analysis configs: users can insert configs for their own projects
CREATE POLICY "Users can insert own ai configs"
  ON ai_analysis_configs FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));

-- Transactions: users can insert their own transactions
CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Reports: users can insert reports for their own projects
CREATE POLICY "Users can insert own reports"
  ON reports FOR INSERT
  WITH CHECK (project_id IN (SELECT id FROM research_projects WHERE user_id = auth.uid()));
