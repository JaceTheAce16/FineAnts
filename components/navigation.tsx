"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/accounts", label: "Accounts" },
  { href: "/transactions", label: "Transactions" },
  { href: "/budgets", label: "Budgets" },
  { href: "/goals", label: "Goals" },
];

export function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/dashboard" className="text-xl font-bold">
              FineAnts
            </Link>
            <div className="hidden md:flex gap-1">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      pathname === item.href && "bg-muted"
                    )}
                  >
                    {item.label}
                  </Button>
                </Link>
              ))}
            </div>
          </div>
          <form action="/auth/signout" method="post">
            <Button variant="ghost" type="submit">
              Sign out
            </Button>
          </form>
        </div>
      </div>
    </nav>
  );
}
