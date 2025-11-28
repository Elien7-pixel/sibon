# WARP.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Development Commands

### Frontend
- **Install Dependencies**: `npm install`
- **Start Dev Server**: `npm run dev` (Runs on `http://localhost:8080`)
- **Build for Production**: `npm run build`
- **Preview Production Build**: `npm run preview`
- **Lint**: `npm run lint`

### Backend (Convex)
- **Start Backend Dev**: `npm run convex:dev`
- **Deploy Backend**: `npm run convex:deploy`
- **Push Schema/Functions**: `npm run convex:push`
- **Generate Types**: `npm run convex:codegen`

## Architecture & Structure

### High-Level Overview
This is a full-stack booking application for "Sibon" accommodation. It uses a React frontend (Vite) and a Convex backend. The project was initialized with Lovable.

### Frontend (`src/`)
- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS + shadcn/ui components.
- **State Management**: React Query (`@tanstack/react-query`) for server state.
- **Routing**: React Router v6.
- **Key Directories**:
    - `src/components/`: React components. `ui/` contains shadcn primitives.
    - `src/pages/`: Route components (`Index.tsx` is the main booking page).
    - `src/hooks/`: Custom React hooks.
    - `src/lib/`: Utilities (e.g., `cn` for class merging).

### Backend (`convex/`)
- **Platform**: Convex (Backend-as-a-Service).
- **Key Files**:
    - `schema.ts`: Defines the database schema (bookings, availability).
    - `bookings.ts`: Business logic for booking requests, status updates, and cooldowns.
    - `availability.ts`: Manages calendar availability, blocking dates, and seasonal pricing.
    - `admin.ts`: Administrative functions.

### Domain Logic (Booking System)
See `BOOKING_SYSTEM_GUIDE.md` for detailed business rules. Key rules include:
1.  **Once-Per-Year Rule**: Users can only book once every 365 days (calculated from `stayCompletedAt`).
2.  **Booking Workflow**: Request -> Approve -> Payment Request -> Payment Received -> Confirm -> Complete Stay.
3.  **Calendar**: Displays availability with seasonal color coding (Pink=Peak, Orange=Off-Peak). Dates are only blocked when status is "Confirmed".

## Coding Standards & Conventions

- **TypeScript**: The project uses a loose configuration (`noImplicitAny: false`, `strictNullChecks: false`).
- **Component Imports**: Use the `@/` alias which maps to `./src/`.
- **Styling**: Use Tailwind utility classes. For conditional classes, use the `cn()` utility.
- **Icons**: Use `lucide-react`.

## Important Files
- `BOOKING_SYSTEM_GUIDE.md`: **CRITICAL**. Contains the source of truth for business logic and workflows.
- `convex/schema.ts`: Database schema definitions.
- `src/App.tsx`: Main application entry point and routing.
- `vite.config.ts`: Vite configuration (server port 8080).
