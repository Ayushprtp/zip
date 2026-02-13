"use client";

import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "ui/card";
import { Button } from "ui/button";
import {
  Coins,
  DollarSign,
  Users,
  CreditCard,
  Settings,
  ArrowRight,
  Tag,
} from "lucide-react";

interface BillingOverviewProps {
  stats: {
    credits: {
      totalUsers: number;
      totalBalance: string;
      totalUsed: string;
      totalGranted: string;
      totalPurchased: string;
    };
    modelPricingCount: number;
    subscriptions: {
      total: number;
      premium: number;
      enterprise: number;
    };
    pricingPlans: {
      total: number;
      active: number;
    };
  };
}

export function BillingOverview({ stats }: BillingOverviewProps) {
  const formatCredits = (val: string | number) => {
    const n = typeof val === "string" ? parseFloat(val) : val;
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Credits Balance
            </CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCredits(stats.credits.totalBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {stats.credits.totalUsers} users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Used</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCredits(stats.credits.totalUsed)}
            </div>
            <p className="text-xs text-muted-foreground">
              ${(parseFloat(stats.credits.totalUsed) / 1000).toFixed(2)} USD
              equivalent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Model Pricing Rules
            </CardTitle>
            <Settings className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.modelPricingCount}</div>
            <p className="text-xs text-muted-foreground">
              Custom pricing entries
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pricing Plans</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.pricingPlans.active}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.pricingPlans.total} total, {stats.pricingPlans.active}{" "}
              active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Paid Subscriptions
            </CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats.subscriptions.premium + stats.subscriptions.enterprise}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.subscriptions.premium} premium,{" "}
              {stats.subscriptions.enterprise} enterprise
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="hover:bg-accent/50 transition-colors">
          <Link href="/admin/billing/pricing">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Model Pricing
              </CardTitle>
              <CardDescription>
                Configure per-model input/output pricing, credit multipliers,
                and access restrictions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="gap-1">
                Manage Pricing <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors">
          <Link href="/admin/billing/credits">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Coins className="h-5 w-5" />
                User Credits
              </CardTitle>
              <CardDescription>
                View user balances, grant credits, and manage subscriptions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="gap-1">
                Manage Credits <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors">
          <Link href="/admin/billing/plans">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Tag className="h-5 w-5" />
                Pricing Plans
              </CardTitle>
              <CardDescription>
                Configure token-based, request-based, and unlimited pricing
                plans with Free, Pro, Plus, and Enterprise tiers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="gap-1">
                Manage Plans <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Link>
        </Card>

        <Card className="hover:bg-accent/50 transition-colors">
          <Link href="/admin/billing/plans">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Subscriptions
              </CardTitle>
              <CardDescription>
                View and manage user subscription plans and billing cycles
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button variant="ghost" size="sm" className="gap-1">
                View Subscriptions <ArrowRight className="h-4 w-4" />
              </Button>
            </CardContent>
          </Link>
        </Card>
      </div>

      {/* Credits Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Credits Summary</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Total Granted</p>
              <p className="text-lg font-semibold">
                {formatCredits(stats.credits.totalGranted)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Purchased</p>
              <p className="text-lg font-semibold">
                {formatCredits(stats.credits.totalPurchased)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Used</p>
              <p className="text-lg font-semibold">
                {formatCredits(stats.credits.totalUsed)}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Balance</p>
              <p className="text-lg font-semibold">
                {formatCredits(stats.credits.totalBalance)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
