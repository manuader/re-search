-- Add quality_flag column to reports table for anti-hallucination tracking
ALTER TABLE reports ADD COLUMN quality_flag TEXT;
