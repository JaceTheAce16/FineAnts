# FineAnts - Financial Wellness Platform

A comprehensive financial wellness platform built with Next.js, TypeScript, and Supabase.

## Features

### Current Features
- ✅ User authentication (email/password) with Supabase Auth
- ✅ Dashboard with financial overview
- ✅ Bank account aggregation via Plaid integration
- ✅ Automated transaction syncing from connected banks
- ✅ Budget tracking with income and expense management
- ✅ Subscription billing with Stripe (Free, Basic, Premium tiers)
- ✅ Database schema with Row Level Security (RLS)
- ✅ Comprehensive error logging and webhook event tracking
- ✅ Progressive Web App (PWA) support
- ✅ Responsive design with Tailwind CSS and shadcn/ui
- ✅ 100% test coverage for critical features

### Planned Features
- 🔄 Savings goal tracker
- 🔄 Debt reduction planner
- 🔄 Net worth dashboard
- 🔄 Cash flow forecasting
- 🔄 Retirement readiness score
- 🔄 Financial wellness insights and recommendations
- 🔄 Embedded education modules
- 🔄 Receipt and document storage
- 🔄 Data export (CSV, PDF reports)

## Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Storage, Realtime)
- **Banking**: Plaid API for account aggregation and transaction sync
- **Payments**: Stripe for subscription billing
- **Testing**: Jest, React Testing Library (100% coverage on critical paths)
- **Deployment**: Vercel (recommended) or any Next.js-compatible host

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

1. Clone the repository
\`\`\`bash
git clone <repository-url>
cd fineanants-app
\`\`\`

2. Install dependencies
\`\`\`bash
npm install
\`\`\`

3. Set up environment variables
\`\`\`bash
cp .env.local.example .env.local
\`\`\`

4. Run the development server
\`\`\`bash
npm run dev
\`\`\`

5. Open [http://localhost:3000](http://localhost:3000) in your browser

### Supabase Setup

#### Quick Setup
1. Copy the environment example file:
```bash
cp .env.local.example .env.local
```

2. Add your Supabase credentials to `.env.local`:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

3. Apply database migrations:
```bash
# Using Supabase CLI (recommended)
npx supabase link --project-ref your-project-ref
npx supabase db push

# Or manually in Supabase SQL Editor
# Run each migration file from supabase/migrations/ in order
```

4. Set up storage buckets:
```bash
# Run in Supabase SQL Editor
# File: supabase/setup/storage-buckets.sql
```

#### Comprehensive Documentation
For detailed setup instructions, see:
- **[Supabase Setup Guide](docs/SUPABASE_SETUP.md)** - Complete integration guide
- **[Deployment Checklist](supabase/setup/DEPLOYMENT_CHECKLIST.md)** - Production deployment steps
- **[Quick Reference](supabase/setup/QUICK_REFERENCE.md)** - Common operations reference

### Other Integrations

#### Stripe (Subscription Billing)
```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_BASIC_PRICE_ID=price_...
STRIPE_PREMIUM_PRICE_ID=price_...
```

#### Plaid (Bank Connections)
```bash
NEXT_PUBLIC_PLAID_CLIENT_ID=your_client_id
PLAID_SECRET_KEY=your_secret_key
PLAID_ENV=sandbox  # or development, production
PLAID_ENCRYPTION_KEY=your_32_byte_hex_key
```

## Project Structure

\`\`\`
fineanants-app/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # Dashboard and main app pages
│   └── page.tsx           # Landing page
├── components/            # React components
│   └── ui/               # shadcn/ui components
├── lib/                   # Utility functions and types
│   ├── supabase/         # Supabase client configuration
│   └── types/            # TypeScript type definitions
├── supabase/             # Supabase configuration and migrations
│   └── migrations/       # Database migrations
└── public/               # Static assets
\`\`\`

## Development Roadmap

1. ✅ Initial setup and authentication (Supabase Auth)
2. ✅ Database schema with Row Level Security
3. ✅ Plaid integration for bank account connections
4. ✅ Automated transaction syncing
5. ✅ Budget tracking with income/expense management
6. ✅ Stripe subscription billing (Free/Basic/Premium tiers)
7. ✅ Comprehensive test coverage (100% on critical paths)
8. 🔄 Savings goals tracking and visualization
9. 🔄 Document storage for receipts and statements
10. 🔄 Data export features (CSV, PDF reports)
11. 🔄 Advanced analytics and insights
12. 🔄 Retirement planning tools
13. 🔄 Financial education modules

## Contributing

This is a private project. For questions or suggestions, please contact the project owner.

## License

Proprietary - All rights reserved
