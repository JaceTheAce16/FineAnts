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

  // Fetch financial accounts
  const { data: accounts } = await supabase
    .from('financial_accounts')
    .select('*')
    .eq('user_id', user.id);

  // Fetch savings goals
  const { data: savingsGoals } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user.id);

  // Fetch financial goals (from budget tracking)
  const { data: financialGoals } = await supabase
    .from('financial_goals')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_completed', false);

  // Fetch expense items for budget calculation
  const { data: expenses } = await supabase
    .from('expense_items')
    .select('*')
    .eq('user_id', user.id)
    .eq('is_active', true);

  // Fetch this month's transactions for actual spending
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const { data: monthlyTransactions } = await supabase
    .from('transactions')
    .select('amount')
    .eq('user_id', user.id)
    .gte('transaction_date', startOfMonth.toISOString().split('T')[0])
    .gt('amount', 0); // Only count expenses (positive amounts)

  // Calculate metrics
  const totalAccounts = accounts?.length || 0;

  // Calculate net worth (assets - liabilities)
  const netWorth = accounts?.reduce((total, account) => {
    const balance = Number(account.current_balance || 0);
    // Debt accounts (credit cards, loans, mortgages) are liabilities
    if (['credit_card', 'loan', 'mortgage'].includes(account.account_type)) {
      return total - balance;
    }
    return total + balance;
  }, 0) || 0;

  // Calculate total debt
  const totalDebt = accounts?.reduce((total, account) => {
    if (['credit_card', 'loan', 'mortgage'].includes(account.account_type)) {
      return total + Number(account.current_balance || 0);
    }
    return total;
  }, 0) || 0;

  // Calculate total active savings goals
  const activeSavingsGoals = (savingsGoals?.length || 0) + (financialGoals?.length || 0);

  // Calculate monthly budget (sum of all monthly expenses)
  const monthlyBudget = expenses?.reduce((total, expense) => {
    const amount = Number(expense.amount || 0);
    // Normalize to monthly amount based on frequency
    if (expense.frequency === 'weekly') return total + (amount * 4.33);
    if (expense.frequency === 'biweekly') return total + (amount * 2.17);
    if (expense.frequency === 'yearly') return total + (amount / 12);
    return total + amount; // monthly by default
  }, 0) || 0;

  // Calculate actual spending this month
  const actualSpending = monthlyTransactions?.reduce((total, transaction) => {
    return total + Number(transaction.amount || 0);
  }, 0) || 0;

  // Count retirement accounts
  const retirementAccounts = accounts?.filter(acc => acc.account_type === 'retirement') || [];
  const hasRetirementAccounts = retirementAccounts.length > 0;

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

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
              <div className={`text-3xl font-bold ${netWorth < 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(netWorth)}
              </div>
              {totalAccounts === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Connect your accounts to see your net worth
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  Based on {totalAccounts} account{totalAccounts !== 1 ? 's' : ''}
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Monthly Budget</CardTitle>
              <CardDescription>Spending vs. budget this month</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {formatCurrency(actualSpending)} / {formatCurrency(monthlyBudget)}
              </div>
              {monthlyBudget === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Set up your budget to start tracking
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  {actualSpending > monthlyBudget ? (
                    <span className="text-red-600">Over budget by {formatCurrency(actualSpending - monthlyBudget)}</span>
                  ) : (
                    <span className="text-green-600">
                      {formatCurrency(monthlyBudget - actualSpending)} remaining
                    </span>
                  )}
                </p>
              )}
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
              <div className={`text-3xl font-bold ${totalDebt > 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(totalDebt)}
              </div>
              {totalDebt === 0 ? (
                <p className="text-sm text-muted-foreground mt-2">
                  No debts tracked - great job!
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  Add your debts to create a payoff plan
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retirement Score</CardTitle>
              <CardDescription>Your retirement readiness</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {hasRetirementAccounts ? '75' : '--'}
              </div>
              {!hasRetirementAccounts ? (
                <p className="text-sm text-muted-foreground mt-2">
                  Add retirement accounts to calculate
                </p>
              ) : (
                <p className="text-sm text-muted-foreground mt-2">
                  {retirementAccounts.length} retirement account{retirementAccounts.length !== 1 ? 's' : ''} tracked
                </p>
              )}
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
              <Link href="/dashboard/accounts">
                <Button variant="outline">Add Manual Account</Button>
              </Link>
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
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border rounded-lg gap-4">
                <div className="flex-1">
                  <h3 className="font-semibold">Set up your budget</h3>
                  <p className="text-sm text-muted-foreground">Create a budget that works for your lifestyle</p>
                </div>
                <div className="sm:flex-shrink-0">
                  <Link href="/dashboard/budget">
                    <Button size="sm">Manage Budget</Button>
                  </Link>
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
