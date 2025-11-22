import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Target, TrendingUp, Award, Clock, Plus, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default async function GoalsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch savings goals
  const { data: goals } = await supabase
    .from('savings_goals')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  // Calculate statistics
  const totalGoals = goals?.length || 0;
  const activeGoals = goals?.filter(goal => {
    const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
    return progress < 100;
  }) || [];
  const completedGoals = goals?.filter(goal => {
    const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
    return progress >= 100;
  }) || [];

  const totalTargetAmount = goals?.reduce((sum, goal) => sum + Number(goal.target_amount), 0) || 0;
  const totalSavedAmount = goals?.reduce((sum, goal) => sum + Number(goal.current_amount), 0) || 0;
  const overallProgress = totalTargetAmount > 0 ? (totalSavedAmount / totalTargetAmount) * 100 : 0;

  // Find goals close to completion (80-99% complete)
  const nearlyCompleteGoals = activeGoals.filter(goal => {
    const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
    return progress >= 80 && progress < 100;
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'No deadline';

    const date = new Date(dateString);
    const now = new Date();
    const diffTime = date.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return `Past due by ${Math.abs(diffDays)} days`;
    } else if (diffDays === 0) {
      return 'Due today';
    } else if (diffDays <= 30) {
      return `${diffDays} days left`;
    } else {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
    }
  };

  const getProgressColor = (progress: number) => {
    if (progress >= 100) return 'bg-green-500';
    if (progress >= 75) return 'bg-blue-500';
    if (progress >= 50) return 'bg-yellow-500';
    if (progress >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const isOverdue = (targetDate: string | null) => {
    if (!targetDate) return false;
    return new Date(targetDate) < new Date();
  };

  return (
    <div className="container mx-auto p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Savings Goals</h1>
          <p className="text-muted-foreground">Track your progress toward financial goals</p>
        </div>
        <Button disabled size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Add New Goal (Coming Soon)
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Goals
            </CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGoals}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {activeGoals.length} active, {completedGoals.length} completed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Target
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalTargetAmount)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Across all goals
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Saved
            </CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {formatCurrency(totalSavedAmount)}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {overallProgress.toFixed(1)}% of total target
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Nearly Complete
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{nearlyCompleteGoals.length}</div>
            <p className="text-xs text-muted-foreground mt-1">
              80%+ progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Overall Progress */}
      {totalGoals > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Overall Progress</CardTitle>
            <CardDescription>
              Combined progress across all savings goals
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {formatCurrency(totalSavedAmount)} of {formatCurrency(totalTargetAmount)}
                </span>
                <span className="text-sm font-semibold">
                  {overallProgress.toFixed(1)}%
                </span>
              </div>
              <Progress value={overallProgress} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Goals */}
      {activeGoals.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Active Goals</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {activeGoals.map((goal) => {
              const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
              const remaining = Number(goal.target_amount) - Number(goal.current_amount);

              return (
                <Card key={goal.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="flex items-center gap-2">
                          {goal.name}
                          {goal.target_date && isOverdue(goal.target_date) && (
                            <Badge variant="destructive">Overdue</Badge>
                          )}
                        </CardTitle>
                        {goal.description && (
                          <CardDescription className="mt-2">
                            {goal.description}
                          </CardDescription>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium">
                          {formatCurrency(Number(goal.current_amount))} of {formatCurrency(Number(goal.target_amount))}
                        </span>
                        <span className="text-sm font-semibold">
                          {progress.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Remaining</p>
                        <p className="font-semibold">{formatCurrency(remaining)}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Target Date</p>
                        <p className="font-semibold">{formatDate(goal.target_date)}</p>
                      </div>
                    </div>

                    <div className="pt-4 border-t flex gap-2">
                      <Button variant="outline" size="sm" disabled className="flex-1">
                        Update Progress
                      </Button>
                      <Button variant="ghost" size="sm" disabled className="flex-1">
                        Edit Goal
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Completed Goals */}
      {completedGoals.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Completed Goals</h2>
          <div className="grid md:grid-cols-2 gap-6">
            {completedGoals.map((goal) => (
              <Card key={goal.id} className="border-green-200 dark:border-green-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                    {goal.name}
                    <Badge variant="outline" className="ml-auto">Completed</Badge>
                  </CardTitle>
                  {goal.description && (
                    <CardDescription>{goal.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">
                        {formatCurrency(Number(goal.current_amount))} of {formatCurrency(Number(goal.target_amount))}
                      </span>
                      <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                        100%
                      </span>
                    </div>
                    <Progress value={100} className="h-2 bg-green-100 dark:bg-green-950">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: '100%' }} />
                    </Progress>
                  </div>

                  <div className="text-sm text-center py-2 bg-green-50 dark:bg-green-950/30 rounded-md">
                    <p className="font-semibold text-green-700 dark:text-green-300">
                      Goal Achieved! 🎉
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {totalGoals === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Target className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-semibold mb-2">No Savings Goals Yet</h3>
            <p className="text-muted-foreground text-center mb-6 max-w-md">
              Set savings goals to track your progress toward important financial milestones like
              emergency funds, vacations, or major purchases.
            </p>
            <Button disabled size="lg">
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Goal (Coming Soon)
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
