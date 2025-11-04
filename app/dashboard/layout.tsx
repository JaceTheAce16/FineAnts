import { Navigation } from "@/components/navigation";
import { PlaidAutoSync } from "@/components/plaid-auto-sync";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted">
      <Navigation />
      {children}
      <PlaidAutoSync />
    </div>
  );
}
