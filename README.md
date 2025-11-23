# J-nex Holdings Sales Management System

A comprehensive sales management system built with Next.js for managing leads, orders, inventory, and shipping operations.

## Features

- Lead management from Facebook ads
- Order processing and tracking
- Inventory management
- Shipping integration with Farda Express, Trans Express, and Royal Express
- QR code-based returns system
- Automatic tracking updates for delivered and returned orders
- Role-based access control
- Reporting and analytics
- Invoice generation with QR codes

## Tech Stack

- Frontend: Next.js 14, TypeScript, Tailwind CSS
- Backend: Next.js API Routes
- Database: PostgreSQL with Prisma ORM
- Authentication: NextAuth.js
- File Processing: PapaParse (CSV)
- PDF Generation: react-pdf
- QR Codes: qrcode.react

## Setup Instructions

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the database URL and API keys
   - Set up shipping provider API keys:
     - `FARDA_EXPRESS_API_KEY` and `FARDA_EXPRESS_CLIENT_ID` for Farda Express
     - `TRANS_EXPRESS_API_KEY` and `NEXT_PUBLIC_TRANS_EXPRESS_API_KEY` for Trans Express
     - For Royal Express (Curfox DMS):
       - `ROYAL_EXPRESS_API_KEY` (format: "email:password") 
       - `NEXT_PUBLIC_ROYAL_EXPRESS_EMAIL` and `NEXT_PUBLIC_ROYAL_EXPRESS_PASSWORD` (alternative to above)
       - `NEXT_PUBLIC_ROYAL_EXPRESS_TENANT` (default: "developers")
       - `NEXT_PUBLIC_ROYAL_EXPRESS_API_URL` (default: "https://v1.api.curfox.com/api/public")

3. Initialize the database:
   ```bash
   npx prisma db push
   npx prisma generate
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

5. Access the application at `http://localhost:3000`

## Environment Variables Example

Create a `.env.local` file in the root directory with the following variables:

```
# Database
DATABASE_URL="your_database_url_here"

# Farda Express
FARDA_EXPRESS_API_KEY=your_farda_api_key
FARDA_EXPRESS_CLIENT_ID=your_farda_client_id

# Trans Express
TRANS_EXPRESS_API_KEY=your_trans_express_api_key
NEXT_PUBLIC_TRANS_EXPRESS_API_KEY=your_trans_express_api_key
NEXT_PUBLIC_TRANS_EXPRESS_API_URL=https://portal.transexpress.lk/api

# Royal Express (Curfox DMS)
ROYAL_EXPRESS_API_KEY=janithbh123@gmail.com:905611623
NEXT_PUBLIC_ROYAL_EXPRESS_EMAIL=janithbh123@gmail.com
NEXT_PUBLIC_ROYAL_EXPRESS_PASSWORD=905611623
NEXT_PUBLIC_ROYAL_EXPRESS_TENANT=developers
NEXT_PUBLIC_ROYAL_EXPRESS_API_URL=https://v1.api.curfox.com/api/public

# Cron job secret key for tracking updates
CRON_SECRET_KEY=your_cron_secret_key_here
```

**Note:** See [docs/CRON_SETUP.md](./docs/CRON_SETUP.md) for complete cron job configuration instructions.


## Cron Jobs

The system uses automated cron jobs to check for order tracking updates (delivered and returned orders).

**Setup:** See [docs/CRON_SETUP.md](./docs/CRON_SETUP.md) for detailed configuration instructions using cron-job.org.

## Project Structure

```
src/
├── app/                 # Next.js 14 App Router
├── components/         # Reusable UI components
├── lib/               # Utility functions and configurations
├── types/            # TypeScript type definitions
└── prisma/           # Database schema and migrations
```

## Development Guidelines

1. Follow TypeScript best practices
2. Use Tailwind CSS for styling
3. Implement proper error handling
4. Write tests for critical functionality
5. Follow the Git branching strategy

## API Documentation

API documentation will be available at `/api-docs` when running the development server.

## License

Private - J-nex Holdings
