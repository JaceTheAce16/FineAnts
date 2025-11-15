import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlaidTransactionsList } from "@/components/plaid-transactions-list";
import { ArrowUpCircle, ArrowDownCircle, DollarSign, Calendar } from "lucide-react";

export default async function TransactionsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch transactions for summary
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('transaction_date', { ascending: false });

  // Calculate current month transactions
  const now = new Date();
  const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentMonthTransactions = transactions?.filter(txn => {
    const txnDate = new Date(txn.transaction_date);
    return txnDate >= firstDayOfMonth;
  }) || [];

  // Calculate totals
  const totalTransactions = transactions?.length || 0;

  // Income (negative amounts in Plaid are positive for the user)
  const monthlyIncome = currentMonthTransactions
    .filter(txn => txn.amount < 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

  // Expenses (positive amounts in Plaid are negative for the user)
  const monthlyExpenses = currentMonthTransactions
    .filter(txn => txn.amount > 0)
    .reduce((sum, txn) => sum + Math.abs(txn.amount), 0);

  const netChange = monthlyIncome - monthlyExpenses;

  // Get spending by category for current month
  const spendingByCategory = currentMonthTransactions
    .filter(txn => txn.amount > 0) // Only expenses
    .reduce((acc, txn) => {
      const category = txn.category || 'other';
      acc[category] = (acc[category] || 0) + Math.abs(txn.amount);
      return acc;
    }, {} as Record<string, number>);

  const topCategories = Object.entries(spendingByCategory)
    .sort(([, a], [, b]) => (b as number) - (a as number))
    .slice(0, 5);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      income: 'Income',
      housing: 'Housing',
      transportation: 'Transportation',
      food: 'Food',
      utilities: 'Utilities',
      healthcare: 'Healthcare',
      entertainment: 'Entertainment',
      shopping: 'Shopping',
      debt_payment: 'Debt Payment',
      savings: 'Savings',
      other: 'Other',
    };
    return labels[category] || category;
  };

  const currentMonthName = new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
  }).format(now);

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Transactions</h1>
        <p className="text-muted-foreground">View and analyze your spending patterns</p>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Transactions
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalTransactions}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {currentMonthTransactions.length} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Income ({currentMonthName})
            </CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(monthlyIncome)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Money received
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Expenses ({currentMonthName})
            </CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(monthlyExpenses)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Money spent
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Net Change
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${
              netChange >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {netChange >= 0 ? '+' : ''}{formatCurrency(netChange)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Income minus expenses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Spending by Category */}
      {topCategories.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Top Spending Categories</CardTitle>
            <CardDescription>
              Your highest expense categories for {currentMonthName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCategories.map(([category, amount]) => {
                const percentage = ((amount as number) / monthlyExpenses) * 100;
                return (
                  <div key={category}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {getCategoryLabel(category as string)}
                      </span>
                      <span className="text-sm font-semibold">
                        {formatCurrency(amount as number)}
                      </span>
                    </div>
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {percentage.toFixed(1)}% of total expenses
                    </p>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All Transactions with Filters */}
      <Card>
        <CardHeader>
          <CardTitle>All Transactions</CardTitle>
          <CardDescription>
            Filter and search through all your transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <PlaidTransactionsList />
        </CardContent>
      </Card>
    </div>
  );
}
