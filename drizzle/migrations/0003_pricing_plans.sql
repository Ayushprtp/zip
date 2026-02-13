-- Pricing Plans table for configurable pricing tiers
CREATE TABLE IF NOT EXISTS "pricing_plan" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tier" varchar NOT NULL,
  "pricing_type" varchar NOT NULL,
  "display_name" text NOT NULL,
  "description" text,
  "monthly_price" numeric(10, 2) NOT NULL DEFAULT '0',
  "yearly_price" numeric(10, 2) NOT NULL DEFAULT '0',
  "token_limit" bigint,
  "request_limit" integer,
  "request_period" varchar DEFAULT 'monthly',
  "monthly_credits" numeric(12, 4) NOT NULL DEFAULT '0',
  "features" text DEFAULT '[]',
  "highlighted" boolean NOT NULL DEFAULT false,
  "badge" text,
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX IF NOT EXISTS "pricing_plan_type_tier_idx" ON "pricing_plan" ("pricing_type", "tier");
CREATE INDEX IF NOT EXISTS "pricing_plan_active_idx" ON "pricing_plan" ("is_active");

-- Seed default pricing plans

-- TOKEN-BASED plans (unlimited requests, limited tokens)
INSERT INTO "pricing_plan" ("tier", "pricing_type", "display_name", "description", "monthly_price", "yearly_price", "token_limit", "monthly_credits", "features", "sort_order", "is_active")
VALUES
  ('free', 'token_based', 'Free', 'Get started with basic AI access', '0', '0', 100000, '100', '["100K tokens/month","Unlimited requests","Basic models","Community support"]', 0, true),
  ('pro', 'token_based', 'Pro', 'For power users who need more tokens', '19.99', '199.99', 1000000, '1000', '["1M tokens/month","Unlimited requests","All models","Priority support","API access"]', 1, true),
  ('plus', 'token_based', 'Plus', 'Advanced usage with generous token limits', '49.99', '499.99', 5000000, '5000', '["5M tokens/month","Unlimited requests","All models","Priority support","API access","Advanced analytics"]', 2, true),
  ('enterprise', 'token_based', 'Enterprise', 'Custom token allocation for teams', '99.99', '999.99', 25000000, '25000', '["25M tokens/month","Unlimited requests","All models","Dedicated support","API access","Advanced analytics","SSO","Custom integrations"]', 3, true);

-- REQUEST-BASED plans (unlimited tokens, limited requests)
INSERT INTO "pricing_plan" ("tier", "pricing_type", "display_name", "description", "monthly_price", "yearly_price", "request_limit", "request_period", "monthly_credits", "features", "sort_order", "is_active")
VALUES
  ('free', 'request_based', 'Free', 'Get started with basic AI access', '0', '0', 50, 'monthly', '100', '["50 requests/month","Unlimited tokens","Basic models","Community support"]', 0, true),
  ('pro', 'request_based', 'Pro', 'More requests for active users', '19.99', '199.99', 500, 'monthly', '1000', '["500 requests/month","Unlimited tokens","All models","Priority support","API access"]', 1, true),
  ('plus', 'request_based', 'Plus', 'High-volume request access', '49.99', '499.99', 2000, 'monthly', '5000', '["2,000 requests/month","Unlimited tokens","All models","Priority support","API access","Advanced analytics"]', 2, true),
  ('enterprise', 'request_based', 'Enterprise', 'Maximum request volume for teams', '99.99', '999.99', 10000, 'monthly', '25000', '["10,000 requests/month","Unlimited tokens","All models","Dedicated support","API access","Advanced analytics","SSO","Custom integrations"]', 3, true);

-- UNLIMITED plans (unlimited tokens AND requests)
INSERT INTO "pricing_plan" ("tier", "pricing_type", "display_name", "description", "monthly_price", "yearly_price", "monthly_credits", "features", "highlighted", "badge", "sort_order", "is_active")
VALUES
  ('free', 'unlimited', 'Free', 'Try unlimited access with basic features', '0', '0', '100', '["Basic models only","Community support","Limited features"]', false, NULL, 0, true),
  ('pro', 'unlimited', 'Pro', 'Unlimited access for professionals', '29.99', '299.99', '5000', '["All models","Unlimited tokens","Unlimited requests","Priority support","API access"]', true, 'Most Popular', 1, true),
  ('plus', 'unlimited', 'Plus', 'Premium unlimited experience', '59.99', '599.99', '15000', '["All models","Unlimited tokens","Unlimited requests","Priority support","API access","Advanced analytics","Early access to new features"]', false, 'Best Value', 2, true),
  ('enterprise', 'unlimited', 'Enterprise', 'Full unlimited access for organizations', '149.99', '1499.99', '50000', '["All models","Unlimited tokens","Unlimited requests","Dedicated support","API access","Advanced analytics","SSO","Custom integrations","SLA guarantee","Admin dashboard"]', false, NULL, 3, true);
