-- Seed actor_health with initial 'unknown' status for all catalog tools
INSERT INTO actor_health (tool_id, status, is_available, consecutive_failures, updated_at)
VALUES
  ('google-maps', 'unknown', true, 0, now()),
  ('google-maps-reviews', 'unknown', true, 0, now()),
  ('twitter', 'unknown', true, 0, now()),
  ('reddit', 'unknown', true, 0, now()),
  ('google-search', 'unknown', true, 0, now()),
  ('web-crawler', 'unknown', true, 0, now()),
  ('instagram', 'unknown', true, 0, now()),
  ('tripadvisor', 'unknown', true, 0, now()),
  ('amazon-products', 'unknown', true, 0, now()),
  ('contact-extractor', 'unknown', true, 0, now()),
  ('linkedin-jobs', 'unknown', true, 0, now()),
  ('linkedin-profiles', 'unknown', true, 0, now()),
  ('tweets', 'unknown', true, 0, now())
ON CONFLICT (tool_id) DO NOTHING;
