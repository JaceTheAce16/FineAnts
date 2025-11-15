import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlaidLinkButton } from "@/components/plaid-link-button";
import { PlaidAccountsList } from "@/components/plaid-accounts-list";
import { Wallet, TrendingUp, CreditCard, DollarSign } from "lucide-react";

export default async function AccountsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch account summary data
  const { data: accounts } = await supabase
    .from('financial_accounts')
    .select('*')
    .eq('user_id', user.id);

  // Calculate totals
  const totalAccounts = accounts?.length || 0;
  const totalBalance = accounts?.reduce((sum, acc) => sum + Number(acc.current_balance || 0), 0) || 0;

  // Separate by type for insights
  const checkingSavings = accounts?.filter(acc =>
    acc.account_type === 'checking' || acc.account_type === 'savings'
  ) || [];
  const creditAccounts = accounts?.filter(acc =>
    acc.account_type === 'credit_card'
  ) || [];
  const investmentAccounts = accounts?.filter(acc =>
    acc.account_type === 'investment' || acc.account_type === 'retirement'
  ) || [];

  const checkingSavingsBalance = checkingSavings.reduce((sum, acc) => sum + Number(acc.current_balance || 0), 0);
  const creditBalance = creditAccounts.reduce((sum, acc) => sum + Number(acc.current_balance || 0), 0);
  const investmentBalance = investmentAccounts.reduce((sum, acc) => sum + Number(acc.current_balance || 0), 0);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Accounts</h1>
        <p className="text-muted-foreground">Manage your financial accounts and view balances</p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Accounts
            </CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalAccounts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {accounts?.filter(a => !a.is_manual).length || 0} connected via Plaid
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Balance
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all accounts
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Cash & Savings
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(checkingSavingsBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {checkingSavings.length} account{checkingSavings.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Investments
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(investmentBalance)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {investmentAccounts.length} account{investmentAccounts.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Add Account Section */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Add Accounts</CardTitle>
          <CardDescription>
            Connect your bank accounts, credit cards, and investment accounts to track your finances
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

      {/* All Accounts List */}
      <Card>
        <CardHeader>
          <CardTitle>All Accounts</CardTitle>
          <CardDescription>
            View and manage all your connected financial accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaidAccountsList />
        </CardContent>
      </Card>

      {/* Credit Card Debt (if any) */}
      {creditAccounts.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              <CardTitle>Credit Card Balances</CardTitle>
            </div>
            <CardDescription>
              Track your credit card balances and available credit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {creditAccounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex-1">
                    <p className="font-medium">{account.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {account.institution_name}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-red-600 dark:text-red-400">
                      {formatCurrency(Math.abs(Number(account.current_balance || 0)))}
                    </p>
                    {account.available_balance !== null && (
                      <p className="text-sm text-muted-foreground">
                        {formatCurrency(account.available_balance)} available
                      </p>
                    )}
                  </div>
                </div>
              ))}
              <div className="pt-4 border-t">
                <div className="flex items-center justify-between font-semibold">
                  <span>Total Credit Card Debt</span>
                  <span className="text-red-600 dark:text-red-400">
                    {formatCurrency(Math.abs(creditBalance))}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
