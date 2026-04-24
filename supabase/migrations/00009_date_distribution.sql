-- Migration 00009: Date Distribution Support
--
-- Adds columns to scraping_jobs for temporal distribution:
-- - bucket_label: identifies which time bucket this sub-job belongs to
-- - parent_job_id: links sub-jobs to their parent job
--
-- When a user requests a date distribution (e.g., "500 tweets from last month,
-- 300 from last 6 months"), the parent job is created with no execution,
-- and N child jobs are created with individual date ranges and targets.

ALTER TABLE scraping_jobs
  ADD COLUMN IF NOT EXISTS bucket_label TEXT,
  ADD COLUMN IF NOT EXISTS parent_job_id UUID REFERENCES scraping_jobs(id);

-- Index for efficiently querying sub-jobs of a parent
CREATE INDEX IF NOT EXISTS idx_scraping_jobs_parent
  ON scraping_jobs(parent_job_id)
  WHERE parent_job_id IS NOT NULL;

COMMENT ON COLUMN scraping_jobs.bucket_label IS 'Temporal bucket label for date distribution sub-jobs (e.g., "Jan 2026", "Last 30 days")';
COMMENT ON COLUMN scraping_jobs.parent_job_id IS 'References the parent scraping_job when this is a date distribution sub-job';
