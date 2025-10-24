import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-background to-muted">
      <div className="max-w-4xl w-full space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold tracking-tight">Welcome to FineAnts</h1>
          <p className="text-xl text-muted-foreground">
            Your Financial Wellness Platform
          </p>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Take control of your financial future with personalized budgeting, savings goals,
            debt reduction planning, and retirement readiness insights.
          </p>
        </div>

        <div className="flex gap-4 justify-center">
          <Button asChild size="lg">
            <Link href="/auth/signup">Get Started</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/about">Learn More</Link>
          </Button>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mt-12">
          <Card>
            <CardHeader>
              <CardTitle>Track Everything</CardTitle>
              <CardDescription>
                Connect your accounts and see your complete financial picture
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Bank accounts, credit cards, loans, and retirement accounts all in one place.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Smart Budgeting</CardTitle>
              <CardDescription>
                Customizable budgets that adapt to your lifestyle
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                AI-powered categorization and personalized insights to help you save more.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Retirement Ready</CardTitle>
              <CardDescription>
                Plan for your future with confidence
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Get a retirement readiness score and actionable recommendations.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}
