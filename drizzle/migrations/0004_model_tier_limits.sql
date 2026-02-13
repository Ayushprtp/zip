-- ============================================================================
-- Migration: Unify 4-tier system + per-tier model limits
-- ============================================================================

-- 1. Update user.plan column: expand to varchar(20) and rename 'premium' → 'pro'
ALTER TABLE "user" ALTER COLUMN plan TYPE varchar(20);
UPDATE "user" SET plan = 'pro' WHERE plan = 'premium';

-- 2. Update subscription.plan enum: add 'pro' and 'plus', rename 'premium' → 'pro'
ALTER TABLE subscription ALTER COLUMN plan TYPE varchar(20);
UPDATE subscription SET plan = 'pro' WHERE plan = 'premium';

-- 3. Update model_pricing.minimum_plan enum: add 'pro' and 'plus', rename 'premium' → 'pro'
ALTER TABLE model_pricing ALTER COLUMN minimum_plan TYPE varchar(20);
UPDATE model_pricing SET minimum_plan = 'pro' WHERE minimum_plan = 'premium';

-- 3. Add per-tier daily token limits to model_pricing
ALTER TABLE model_pricing
  ADD COLUMN daily_input_tokens_free bigint,
  ADD COLUMN daily_input_tokens_pro bigint,
  ADD COLUMN daily_input_tokens_plus bigint,
  ADD COLUMN daily_input_tokens_enterprise bigint,
  ADD COLUMN daily_output_tokens_free bigint,
  ADD COLUMN daily_output_tokens_pro bigint,
  ADD COLUMN daily_output_tokens_plus bigint,
  ADD COLUMN daily_output_tokens_enterprise bigint,
  ADD COLUMN daily_requests_free integer,
  ADD COLUMN daily_requests_pro integer,
  ADD COLUMN daily_requests_plus integer,
  ADD COLUMN daily_requests_enterprise integer,
  ADD COLUMN rpm_free integer,
  ADD COLUMN rpm_pro integer,
  ADD COLUMN rpm_plus integer,
  ADD COLUMN rpm_enterprise integer;

-- 4. Set sensible defaults for existing model_pricing rows
UPDATE model_pricing SET
  daily_input_tokens_free = 10000,
  daily_output_tokens_free = 200000,
  daily_requests_free = 100,
  rpm_free = 5,
  daily_input_tokens_pro = 500000,
  daily_output_tokens_pro = 2000000,
  daily_requests_pro = 1000,
  rpm_pro = 30,
  daily_input_tokens_plus = 2000000,
  daily_output_tokens_plus = 10000000,
  daily_requests_plus = 5000,
  rpm_plus = 60,
  rpm_enterprise = 100
WHERE daily_input_tokens_free IS NULL;

-- 5. Update the free token-based pricing plan seed data
UPDATE pricing_plan SET
  token_limit = 210000,
  features = '["10K input tokens per day","200K output tokens per day","Basic models only","Community support"]'
WHERE tier = 'free' AND pricing_type = 'token_based';

-- 6. Update the free request-based pricing plan
UPDATE pricing_plan SET
  features = '["50 requests per month","Basic models only","Community support"]'
WHERE tier = 'free' AND pricing_type = 'request_based';

-- 7. Update the free unlimited pricing plan
UPDATE pricing_plan SET
  features = '["100 credits per month","Basic models only","Daily token limits apply","Community support"]'
WHERE tier = 'free' AND pricing_type = 'unlimited';
