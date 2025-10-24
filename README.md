# FineAnts - Financial Wellness Platform

A comprehensive financial wellness platform built with Next.js, TypeScript, and Supabase.

## Features

### Current Features
- ✅ User authentication (email/password)
- ✅ Dashboard with financial overview
- ✅ Database schema for accounts, transactions, budgets, and goals
- ✅ Progressive Web App (PWA) support for Apple devices
- ✅ Responsive design with Tailwind CSS and shadcn/ui

### Planned Features
- 🔄 Bank account aggregation (via Plaid)
- 🔄 Manual expense entry
- 🔄 Automated expense categorization
- 🔄 Customizable budgeting tools
- 🔄 Savings goal tracker
- 🔄 Debt reduction planner
- 🔄 Net worth dashboard
- 🔄 Cash flow forecasting
- 🔄 Retirement readiness score
- 🔄 Financial wellness insights
- 🔄 Embedded education modules

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript
- **Styling**: Tailwind CSS, shadcn/ui components
- **Backend**: Supabase (PostgreSQL, Auth, Row Level Security)
- **Development**: Local Supabase instance
- **Deployment**: Vercel

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

### Database Setup

For local development, Supabase credentials are already configured in `.env.local` for the local instance.

For production:
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Update `.env.local` with your project credentials
3. Run migrations in the Supabase dashboard or using the CLI

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

1. ✅ Initial setup and authentication
2. 🔄 Account management (add, view, edit manual accounts)
3. 🔄 Transaction viewing and categorization
4. 🔄 Budgeting tools
5. 🔄 Savings goals tracking
6. 🔄 Plaid integration for bank connections
7. 🔄 Advanced features (retirement planning, insights, etc.)

## Contributing

This is a private project. For questions or suggestions, please contact the project owner.

## License

Proprietary - All rights reserved
