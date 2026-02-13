"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "ui/table";
import { Badge } from "ui/badge";
import { Button } from "ui/button";
import { Input } from "ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "ui/dialog";
import { Label } from "ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "ui/select";
import {
  ArrowLeft,
  Search,
  Coins,
  UserCog,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";
import {
  grantCreditsAction,
  adjustCreditsAction,
  updateSubscriptionAction,
} from "@/app/api/admin/billing/actions";
import type { AdminUserCredits } from "lib/admin/billing-repository";

interface Props {
  users: AdminUserCredits[];
  total: number;
  page: number;
  limit: number;
  search?: string;
}

export function UserCreditsManager({
  users,
  total,
  page,
  limit,
  search,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchValue, setSearchValue] = useState(search || "");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Grant credits dialog
  const [grantDialog, setGrantDialog] = useState<{
    open: boolean;
    userId: string;
    email: string;
  }>({ open: false, userId: "", email: "" });
  const [grantAmount, setGrantAmount] = useState("");
  const [grantDescription, setGrantDescription] = useState("");

  // Subscription dialog
  const [subDialog, setSubDialog] = useState<{
    open: boolean;
    userId: string;
    email: string;
    currentPlan: string;
  }>({ open: false, userId: "", email: "", currentPlan: "free" });
  const [subPlan, setSubPlan] = useState<
    "free" | "pro" | "plus" | "enterprise"
  >("free");
  const [subCredits, setSubCredits] = useState("");

  const totalPages = Math.ceil(total / limit);

  const formatCredits = (val: string | number) => {
    const n = typeof val === "string" ? parseFloat(val) : val;
    return n.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  const handleSearch = () => {
    const url = new URL(window.location.href);
    if (searchValue) {
      url.searchParams.set("search", searchValue);
    } else {
      url.searchParams.delete("search");
    }
    url.searchParams.set("page", "1");
    router.push(url.pathname + url.search);
  };

  const handlePageChange = (newPage: number) => {
    const url = new URL(window.location.href);
    url.searchParams.set("page", newPage.toString());
    router.push(url.pathname + url.search);
  };

  const handleGrantCredits = () => {
    const fd = new FormData();
    fd.set("userId", grantDialog.userId);
    fd.set("amount", grantAmount);
    if (grantDescription) fd.set("description", grantDescription);

    startTransition(async () => {
      const result = await grantCreditsAction(
        { success: false, message: "" },
        fd,
      );
      if (result?.success) {
        setFeedback({ type: "success", message: result.message || "Done" });
        setGrantDialog({ open: false, userId: "", email: "" });
        setGrantAmount("");
        setGrantDescription("");
        router.refresh();
      } else {
        setFeedback({ type: "error", message: result?.message || "Failed" });
      }
    });
  };

  const handleUpdateSubscription = () => {
    const fd = new FormData();
    fd.set("userId", subDialog.userId);
    fd.set("plan", subPlan);
    if (subCredits) fd.set("monthlyCredits", subCredits);

    startTransition(async () => {
      const result = await updateSubscriptionAction(
        { success: false, message: "" },
        fd,
      );
      if (result?.success) {
        setFeedback({ type: "success", message: result.message || "Done" });
        setSubDialog({
          open: false,
          userId: "",
          email: "",
          currentPlan: "free",
        });
        router.refresh();
      } else {
        setFeedback({ type: "error", message: result?.message || "Failed" });
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href="/admin/billing">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
        </Link>
        <h2 className="text-xl font-semibold">User Credits</h2>
      </div>

      {feedback && (
        <div
          className={`p-3 rounded text-sm ${
            feedback.type === "success"
              ? "bg-green-500/10 text-green-600"
              : "bg-red-500/10 text-red-600"
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch} variant="secondary">
          Search
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Balance</TableHead>
                <TableHead>Used</TableHead>
                <TableHead>Granted</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Monthly Usage</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-8 text-muted-foreground"
                  >
                    {search
                      ? "No users match your search"
                      : "No users with credit records found"}
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.credits.userId}>
                    <TableCell>
                      <div>
                        <div className="font-medium">
                          {u.userName || "No name"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {u.userEmail}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCredits(u.credits.balance)}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {formatCredits(u.credits.totalCreditsUsed)}
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {formatCredits(u.credits.totalCreditsGranted)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          u.subscription?.plan === "enterprise"
                            ? "destructive"
                            : u.subscription?.plan === "plus"
                              ? "default"
                              : u.subscription?.plan === "pro"
                                ? "default"
                                : "secondary"
                        }
                      >
                        {u.subscription?.plan || "free"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-muted-foreground">
                      {formatCredits(u.credits.monthlyCreditsUsed)}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setGrantDialog({
                              open: true,
                              userId: u.credits.userId,
                              email: u.userEmail,
                            });
                            setGrantAmount("");
                            setGrantDescription("");
                          }}
                        >
                          <Coins className="h-4 w-4 mr-1" />
                          Grant
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setSubDialog({
                              open: true,
                              userId: u.credits.userId,
                              email: u.userEmail,
                              currentPlan: u.subscription?.plan || "free",
                            });
                            setSubPlan((u.subscription?.plan as any) || "free");
                            setSubCredits(u.subscription?.monthlyCredits || "");
                          }}
                        >
                          <UserCog className="h-4 w-4 mr-1" />
                          Plan
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {total} user{total !== 1 ? "s" : ""} total
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Grant Credits Dialog */}
      <Dialog
        open={grantDialog.open}
        onOpenChange={(open) => setGrantDialog({ ...grantDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Credits</DialogTitle>
            <DialogDescription>
              Grant credits to {grantDialog.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Amount *</Label>
              <Input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(e.target.value)}
                placeholder="e.g. 1000"
              />
              <p className="text-xs text-muted-foreground">
                1000 credits = $1 USD
              </p>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input
                value={grantDescription}
                onChange={(e) => setGrantDescription(e.target.value)}
                placeholder="Reason for granting credits"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setGrantDialog({ open: false, userId: "", email: "" })
              }
            >
              Cancel
            </Button>
            <Button
              onClick={handleGrantCredits}
              disabled={isPending || !grantAmount}
            >
              {isPending ? "Granting..." : "Grant Credits"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Update Subscription Dialog */}
      <Dialog
        open={subDialog.open}
        onOpenChange={(open) => setSubDialog({ ...subDialog, open })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Subscription</DialogTitle>
            <DialogDescription>
              Update subscription plan for {subDialog.email}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Plan</Label>
              <Select
                value={subPlan}
                onValueChange={(v) =>
                  setSubPlan(v as "free" | "pro" | "plus" | "enterprise")
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="free">Free</SelectItem>
                  <SelectItem value="pro">Pro</SelectItem>
                  <SelectItem value="plus">Plus</SelectItem>
                  <SelectItem value="enterprise">Enterprise</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Monthly Credits</Label>
              <Input
                type="number"
                value={subCredits}
                onChange={(e) => setSubCredits(e.target.value)}
                placeholder="Leave empty for plan default"
              />
              <p className="text-xs text-muted-foreground">
                Free: 1,000 | Premium: 20,000 | Enterprise: 100,000
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() =>
                setSubDialog({
                  open: false,
                  userId: "",
                  email: "",
                  currentPlan: "free",
                })
              }
            >
              Cancel
            </Button>
            <Button onClick={handleUpdateSubscription} disabled={isPending}>
              {isPending ? "Updating..." : "Update Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
