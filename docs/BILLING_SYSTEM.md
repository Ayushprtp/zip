# Flare.sh Billing & Usage System

## Overview

Flare.sh uses a comprehensive billing, pricing, and usage tracking system that supports:

- **Credit-based billing** - Pay-as-you-go model
- **Token tracking** - Input/output token metering
- **Plan-based limits** - RPM, RPD, quota enforcement
- **Transaction history** - Full audit trail
- **Model-specific pricing** - Per-model cost calculation

---

## Architecture

### Three-Tier System

```
┌─────────────────────────────────────────────────────────────────┐
│                         USER                                     │
├─────────────────────────────────────────────────────────────────┤
│  Plan (Subscription)     │  Credits (Balance)   │  Usage        │
│  - free/premium/enterprise│  - Prepaid balance   │  - Tracking   │
│  - Monthly limits         │  - Top-up anytime    │  - Real-time  │
│  - Rate limits            │  - Auto-deduct       │  - Analytics  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Tables

### 1. user_credits
Stores user's credit balance and usage counters.

| Column | Type | Description |
|--------|------|-------------|
| balance | decimal | Current credit balance |
| total_credits_used | decimal | Lifetime usage |
| monthly_credits_used | decimal | This month's usage |
| daily_request_count | integer | Today's request count |

### 2. usage_log
Detailed log of every AI request.

| Column | Type | Description |
|--------|------|-------------|
| provider | text | Model provider (openai, google, etc.) |
| model | text | Model name |
| input_tokens | integer | Tokens in prompt |
| output_tokens | integer | Tokens in response |
| credits_charged | decimal | Credits deducted |
| status | varchar | success/error/rate_limited |

### 3. credit_transaction
Audit trail of all credit changes.

| Column | Type | Description |
|--------|------|-------------|
| type | varchar | purchase/usage/refund/grant |
| amount | decimal | Credit change (+/-) |
| balance_after | decimal | Balance post-transaction |
| payment_id | text | External payment reference |

### 4. model_pricing
Configurable pricing per model.

| Column | Type | Description |
|--------|------|-------------|
| input_price_per_million | decimal | USD per 1M input tokens |
| output_price_per_million | decimal | USD per 1M output tokens |
| credit_multiplier | decimal | Credits per $1 |
| is_partner_only | boolean | Restrict to partners |
| minimum_plan | varchar | Required plan level |

### 5. subscription
User subscription management.

| Column | Type | Description |
|--------|------|-------------|
| plan | varchar | free/premium/enterprise |
| monthly_credits | decimal | Included credits |
| status | varchar | active/canceled/past_due |
| external_id | text | Stripe subscription ID |

---

## Pricing Configuration

### Default Model Pricing (per 1M tokens, USD)

| Model | Input | Output |
|-------|-------|--------|
| gpt-4o | $2.50 | $10.00 |
| gpt-4o-mini | $0.15 | $0.60 |
| gemini-2.0-flash | $0.10 | $0.40 |
| claude-3.5-sonnet | $3.00 | $15.00 |
| glm-4.7 | $0.50 | $2.00 |

### Credit Conversion

```
1000 credits = $1 USD
1 credit = $0.001 USD
```

### Plan Limits

| Limit | Free | Premium | Enterprise |
|-------|------|---------|------------|
| Monthly Credits | 1,000 | 20,000 | 100,000 |
| Requests/Minute | 5 | 30 | 100 |
| Requests/Day | 100 | 1,000 | Unlimited |
| Tokens/Minute | 10K | 100K | 500K |
| Tokens/Day | 100K | 2M | Unlimited |
| Concurrent | 1 | 5 | 20 |

---

## API Endpoints

### GET /api/billing
Get billing overview.

**Response:**
```json
{
  "balance": 1500,
  "balanceFormatted": "1.5K",
  "balanceUsd": 1.50,
  "plan": "premium",
  "monthlyUsage": {
    "creditsUsed": 5000,
    "percentageUsed": 25,
    "withinQuota": true
  },
  "todayUsage": {
    "requests": 45,
    "tokens": 50000,
    "credits": 15
  },
  "rateLimits": {
    "allowed": true,
    "requestsThisMinute": 2,
    "limits": {...}
  }
}
```

### GET /api/billing/usage?period=month
Get detailed usage statistics.

**Response:**
```json
{
  "period": "month",
  "summary": {
    "totalRequests": 1500,
    "totalTokens": 2500000,
    "totalCreditsUsed": 750
  },
  "modelBreakdown": [
    {
      "provider": "openai",
      "model": "gpt-4o-mini",
      "requests": 1200,
      "tokens": 2000000
    }
  ]
}
```

### GET /api/billing/transactions
Get transaction history.

---

## Cost Calculation

```typescript
import { calculateCost } from "@/lib/billing/billing-service";

const cost = calculateCost("openai", "gpt-4o", {
  inputTokens: 1000,
  outputTokens: 500,
  totalTokens: 1500,
});

// Returns:
// {
//   inputCost: 0.0025,     // $0.0025 USD
//   outputCost: 0.005,     // $0.005 USD
//   totalCost: 0.0075,     // $0.0075 USD
//   creditsCharged: 7.5    // 7.5 credits
// }
```

---

## Rate Limiting

```typescript
import { checkRateLimit } from "@/lib/billing/billing-service";

const result = checkRateLimit(userPlan, {
  requestsThisMinute: 5,
  requestsToday: 100,
  tokensThisMinute: 5000,
  tokensToday: 50000,
  concurrentRequests: 1,
});

if (!result.allowed) {
  throw new Error(`Rate limited: ${result.limitType}`);
}
```

---

## Integration with Chat

In the chat route, usage is tracked automatically:

```typescript
// After AI response
const { usageLog, cost } = await logUsage(userId, {
  provider: chatModel.provider,
  model: chatModel.model,
  inputTokens: response.usage.promptTokens,
  outputTokens: response.usage.completionTokens,
  threadId: threadId,
});

// Deduct credits
await deductCredits(userId, cost.creditsCharged, usageLog.id);
```

---

## File Locations

| File | Purpose |
|------|---------|
| `src/lib/db/pg/schema-billing.pg.ts` | Database schema |
| `src/lib/billing/billing-service.ts` | Business logic |
| `src/lib/billing/usage-repository.ts` | Database operations |
| `src/app/api/billing/route.ts` | Billing API |
| `src/app/api/billing/usage/route.ts` | Usage API |
| `src/components/billing/billing-dashboard.tsx` | UI component |

---

## Future Enhancements

- [ ] Stripe integration for payments
- [ ] Invoice generation
- [ ] Usage alerts and notifications
- [ ] Prepaid credit packages
- [ ] Team/organization billing
- [ ] Cost allocation by project/thread
