"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "ui/card";
import { Progress } from "ui/progress";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import { Tabs, TabsList, TabsTrigger } from "ui/tabs";
import { Coins, ArrowUpRight, ArrowDownRight, RefreshCw } from "lucide-react";
import { fetcher, cn } from "lib/utils";

interface BillingData {
  balance: number;
  balanceFormatted: string;
  balanceUsd: number;
  plan: string;
  monthlyCreditsAllowed: number;
  monthlyUsage: {
    creditsUsed: number;
    creditsUsedFormatted: string;
    percentageUsed: number;
    creditsRemaining: number;
    withinQuota: boolean;
  };
  todayUsage: {
    requests: number;
    tokens: number;
    tokensFormatted: string;
    cost: number;
    credits: number;
  };
  rateLimits: {
    allowed: boolean;
    requestsThisMinute: number;
    requestsToday: number;
    tokensThisMinute: number;
    tokensToday: number;
    limits: {
      requestsPerMinute: number;
      requestsPerDay: number;
      tokensPerMinute: number;
      tokensPerDay: number;
    };
  };
  lifetime: {
    totalCreditsUsed: number;
    totalCreditsPurchased: number;
    totalCreditsGranted: number;
  };
}

interface UsageData {
  period: string;
  summary: {
    totalRequests: number;
    totalTokens: number;
    totalTokensFormatted: string;
    totalCreditsUsed: number;
    totalCreditsFormatted: string;
  };
  modelBreakdown: Array<{
    provider: string;
    model: string;
    requests: number;
    tokens: number;
    tokensFormatted: string;
    costUsd: number;
  }>;
}

interface Transaction {
  id: string;
  type: string;
  amount: number;
  amountFormatted: string;
  balanceAfter: number;
  description: string;
  createdAt: string;
}

export function BillingDashboard() {
  const [usagePeriod, setUsagePeriod] = useState<"day" | "week" | "month">(
    "month",
  );

  const {
    data: billing,
    isLoading: billingLoading,
    mutate: refetchBilling,
  } = useSWR<BillingData>("/api/billing", fetcher);

  const { data: usage, isLoading: usageLoading } = useSWR<UsageData>(
    `/api/billing/usage?period=${usagePeriod}`,
    fetcher,
  );

  const { data: transactions } = useSWR<{ transactions: Transaction[] }>(
    "/api/billing/transactions?limit=10",
    fetcher,
  );

  if (billingLoading) {
    return (
      <div className="space-y-6 p-4">
        <div className="animate-pulse space-y-4">
          <div className="h-32 bg-muted rounded-lg" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 bg-muted rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Billing & Usage</h2>
          <p className="text-muted-foreground">
            Monitor your credits, usage, and plan limits
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchBilling()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Balance Card */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-5 w-5" />
            Credit Balance
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold">
              {billing?.balanceFormatted}
            </span>
            <span className="text-muted-foreground">credits</span>
            <Badge variant="outline" className="ml-auto">
              ≈ ${billing?.balanceUsd?.toFixed(2)} USD
            </Badge>
          </div>
          <div className="mt-4 flex items-center gap-4 text-sm">
            <Badge
              variant={billing?.plan === "enterprise" ? "default" : "secondary"}
            >
              {billing?.plan?.toUpperCase()} Plan
            </Badge>
            {!billing?.rateLimits?.allowed && (
              <Badge variant="destructive">Rate Limited</Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Usage Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Monthly Usage */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Monthly Usage
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>{billing?.monthlyUsage?.creditsUsedFormatted} used</span>
                <span className="text-muted-foreground">
                  of {billing?.monthlyCreditsAllowed?.toLocaleString()}
                </span>
              </div>
              <Progress
                value={billing?.monthlyUsage?.percentageUsed || 0}
                className={cn(
                  (billing?.monthlyUsage?.percentageUsed || 0) > 90
                    ? "bg-destructive/20"
                    : (billing?.monthlyUsage?.percentageUsed || 0) > 75
                      ? "bg-yellow-500/20"
                      : "",
                )}
              />
              <div className="text-xs text-muted-foreground">
                {billing?.monthlyUsage?.creditsRemaining?.toLocaleString()}{" "}
                credits remaining
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Activity */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today's Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="flex justify-between">
                <span className="text-2xl font-bold">
                  {billing?.todayUsage?.requests}
                </span>
                <span className="text-sm text-muted-foreground">requests</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>{billing?.todayUsage?.tokensFormatted} tokens</span>
                <span className="text-muted-foreground">
                  {billing?.todayUsage?.credits?.toFixed(1)} credits
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limits */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Rate Limits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Requests/min</span>
                <span>
                  {billing?.rateLimits?.requestsThisMinute} /{" "}
                  {billing?.rateLimits?.limits?.requestsPerMinute}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Requests/day</span>
                <span>
                  {billing?.rateLimits?.requestsToday} /{" "}
                  {billing?.rateLimits?.limits?.requestsPerDay === -1
                    ? "∞"
                    : billing?.rateLimits?.limits?.requestsPerDay}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Usage */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Usage Details</CardTitle>
            <Tabs
              value={usagePeriod}
              onValueChange={(v) => setUsagePeriod(v as any)}
            >
              <TabsList className="h-8">
                <TabsTrigger value="day" className="text-xs">
                  Today
                </TabsTrigger>
                <TabsTrigger value="week" className="text-xs">
                  Week
                </TabsTrigger>
                <TabsTrigger value="month" className="text-xs">
                  Month
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </CardHeader>
        <CardContent>
          {usageLoading ? (
            <div className="animate-pulse h-32 bg-muted rounded" />
          ) : (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold">
                    {usage?.summary?.totalRequests || 0}
                  </div>
                  <div className="text-xs text-muted-foreground">Requests</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {usage?.summary?.totalTokensFormatted || "0"}
                  </div>
                  <div className="text-xs text-muted-foreground">Tokens</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    {usage?.summary?.totalCreditsFormatted || "0"}
                  </div>
                  <div className="text-xs text-muted-foreground">Credits</div>
                </div>
                <div>
                  <div className="text-2xl font-bold">
                    $
                    {(usage?.summary?.totalCreditsUsed
                      ? usage.summary.totalCreditsUsed / 1000
                      : 0
                    ).toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Cost (USD)
                  </div>
                </div>
              </div>

              {/* Model breakdown */}
              {usage?.modelBreakdown && usage.modelBreakdown.length > 0 && (
                <div className="mt-6">
                  <h4 className="text-sm font-medium mb-3">By Model</h4>
                  <div className="space-y-2">
                    {usage.modelBreakdown.slice(0, 5).map((model, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2 rounded bg-muted/50"
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className="font-mono text-xs"
                          >
                            {model.provider}
                          </Badge>
                          <span className="text-sm">{model.model}</span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {model.requests} req • {model.tokensFormatted} tokens
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Your credit activity history</CardDescription>
        </CardHeader>
        <CardContent>
          {transactions?.transactions?.length ? (
            <div className="space-y-2">
              {transactions.transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-3 rounded bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    {tx.amount >= 0 ? (
                      <div className="p-1.5 rounded-full bg-green-500/20">
                        <ArrowUpRight className="h-4 w-4 text-green-500" />
                      </div>
                    ) : (
                      <div className="p-1.5 rounded-full bg-red-500/20">
                        <ArrowDownRight className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                    <div>
                      <div className="text-sm font-medium capitalize">
                        {tx.type}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {tx.description || "No description"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={cn(
                        "font-medium",
                        tx.amount >= 0 ? "text-green-500" : "text-red-500",
                      )}
                    >
                      {tx.amount >= 0 ? "+" : ""}
                      {tx.amountFormatted}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              No transactions yet
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
