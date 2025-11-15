import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscriptionStatus } from "@/components/subscription-status";
import { ReconnectAccountPrompt } from "@/components/reconnect-account-prompt";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { PlaidAccountsList } from "@/components/plaid-accounts-list";
import { PlaidTransactionsList } from "@/components/plaid-transactions-list";
import { ArrowRight } from "lucide-react";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back, {user.email}</p>
      </div>

      {/* Reconnect Account Prompt */}
      <ReconnectAccountPrompt />

      {/* Subscription Status */}
      <div className="mb-6">
        <SubscriptionStatus />
      </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Net Worth</CardTitle>
              <CardDescription>Your total assets minus liabilities</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">$0.00</div>
              <p className="text-sm text-muted-foreground mt-2">
                Connect your accounts to see your net worth
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Budget</CardTitle>
              <CardDescription>Spending vs. budget this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">$0 / $0</div>
              <p className="text-sm text-muted-foreground mt-2">
                Set up your budget to start tracking
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>Connected financial accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0</div>
              <p className="text-sm text-muted-foreground mt-2">
                No accounts connected yet
              </p>
              <Link href="/dashboard/accounts">
                <Button variant="link" className="mt-2 p-0 h-auto">
                  View All Accounts
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Savings Goals</CardTitle>
              <CardDescription>Track your progress</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">0 Active</div>
              <p className="text-sm text-muted-foreground mt-2">
                Create your first savings goal
              </p>
              <Link href="/dashboard/goals">
                <Button variant="link" className="mt-2 p-0 h-auto">
                  View All Goals
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Debt</CardTitle>
              <CardDescription>Total outstanding debt</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">$0.00</div>
              <p className="text-sm text-muted-foreground mt-2">
                Add your debts to create a payoff plan
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retirement Score</CardTitle>
              <CardDescription>Your retirement readiness</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">--</div>
              <p className="text-sm text-muted-foreground mt-2">
                Add retirement accounts to calculate
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Plaid Integration Section */}
        <div className="mt-8 space-y-6">
          {/* Connect Accounts */}
          <Card>
            <CardHeader>
              <CardTitle>Add Accounts</CardTitle>
              <CardDescription>
                Connect accounts via Plaid or add them manually
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row gap-4">
              <PlaidLinkButton
                onSuccess={() => window.location.reload()}
                onError={(error) => console.error('Plaid connection error:', error)}
              >
                Connect with Plaid
              </PlaidLinkButton>
              <Button variant="outline" disabled>
                Add Manual Account (Coming Soon)
              </Button>
            </CardContent>
          </Card>

          {/* All Accounts */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Your Accounts</CardTitle>
                <CardDescription>
                  All your financial accounts and their balances
                </CardDescription>
              </div>
              <Link href="/dashboard/accounts">
                <Button variant="outline" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <PlaidAccountsList />
            </CardContent>
          </Card>

          {/* Recent Transactions */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>
                  Your latest financial activity across all accounts
                </CardDescription>
              </div>
              <Link href="/dashboard/transactions">
                <Button variant="outline" size="sm">
                  View All
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent>
              <PlaidTransactionsList />
            </CardContent>
          </Card>

          {/* Getting Started */}
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Complete these steps to set up your financial dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Connect your accounts</h3>
                  <p className="text-sm text-muted-foreground">Link bank accounts, credit cards, and investments</p>
                </div>
                <div className="sm:flex-shrink-0">
                  <PlaidLinkButton
                    onSuccess={() => window.location.reload()}
                    size="sm"
                    showLimitInfo={false}
                  >
                    Get Started
                  </PlaidLinkButton>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg opacity-50 gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Set up your budget</h3>
                  <p className="text-sm text-muted-foreground">Create a budget that works for your lifestyle</p>
                </div>
                <div className="sm:flex-shrink-0">
                  <Button disabled size="sm">Coming Soon</Button>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Add savings goals</h3>
                  <p className="text-sm text-muted-foreground">Track progress toward your financial goals</p>
                </div>
                <div className="sm:flex-shrink-0">
                  <Link href="/dashboard/goals">
                    <Button size="sm">View Goals</Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
