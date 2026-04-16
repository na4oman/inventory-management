# Inventory Management App

A comprehensive inventory management system for mobile parts built with Next.js 14, TypeScript, Supabase, and Clerk.

## Features

- User authentication with Clerk
- Product inventory management with booking/available quantity tracking
- Order creation with inventory reservation
- Order-to-sale conversion with automatic inventory deduction
- Client management
- Excel import for bulk product uploads
- Analytics dashboard with revenue, profit, and sales trends

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript
- **Authentication**: Clerk
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **UI Components**: Radix UI

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- A Clerk account (for authentication)
- A Supabase account (for database)

### Installation

1. Clone the repository and install dependencies:

```bash
npm install
```

2. Set up environment variables:

Create a `.env.local` file in the root directory with the following variables:

```env
# Clerk Authentication
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key

# Clerk URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/dashboard
```

3. Get your Clerk keys:
   - Go to [Clerk Dashboard](https://dashboard.clerk.com/)
   - Create a new application or select an existing one
   - Copy the publishable key and secret key from the API Keys section
   - Note: This project uses Clerk v5 with the new middleware API

4. Set up Clerk application settings:
   - In your Clerk dashboard, go to "Paths" settings
   - Set Sign-in URL to `/sign-in`
   - Set Sign-up URL to `/sign-up`
   - Set After sign-in URL to `/dashboard`
   - Set After sign-up URL to `/dashboard`

5. Run the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser

## Project Structure

```
├── app/
│   ├── (auth)/
│   │   └── sign-in/          # Authentication pages
│   ├── (dashboard)/           # Protected dashboard routes
│   │   ├── layout.tsx         # Dashboard layout with sidebar
│   │   └── page.tsx           # Dashboard home
│   ├── api/                   # API routes (to be implemented)
│   ├── globals.css            # Global styles
│   └── layout.tsx             # Root layout
├── components/
│   └── ui/                    # Reusable UI components
├── lib/
│   └── utils.ts               # Utility functions
├── middleware.ts              # Clerk authentication middleware
└── README.md
```

## Authentication

The app uses Clerk for authentication with the following features:

- Protected routes via middleware
- Sign-in page at `/sign-in`
- Automatic redirect to dashboard after authentication
- User button with sign-out functionality

## Next Steps

The following features need to be implemented:

1. Supabase database setup and schema
2. Products API and UI
3. Orders API and UI
4. Sales API and UI
5. Clients API and UI
6. Analytics dashboard
7. Excel import functionality

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Run linter
npm run lint
```

## License

Private - All rights reserved
