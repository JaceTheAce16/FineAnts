import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscriptionStatus } from "@/components/subscription-status";

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

        <div className="mt-8">
          <Card>
            <CardHeader>
              <CardTitle>Getting Started</CardTitle>
              <CardDescription>Complete these steps to set up your financial dashboard</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <h3 className="font-semibold">Connect your accounts</h3>
                  <p className="text-sm text-muted-foreground">Link bank accounts, credit cards, and investments</p>
                </div>
                <Button>Get Started</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg opacity-50">
                <div>
                  <h3 className="font-semibold">Set up your budget</h3>
                  <p className="text-sm text-muted-foreground">Create a budget that works for your lifestyle</p>
                </div>
                <Button disabled>Coming Soon</Button>
              </div>
              <div className="flex items-center justify-between p-4 border rounded-lg opacity-50">
                <div>
                  <h3 className="font-semibold">Add savings goals</h3>
                  <p className="text-sm text-muted-foreground">Track progress toward your financial goals</p>
                </div>
                <Button disabled>Coming Soon</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
  );
}
