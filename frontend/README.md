# Justice Watch Network - Frontend

A React + TypeScript frontend for the Justice Watch Network platform.

## Tech Stack

- **React 18** - UI library
- **TypeScript** - Type safety
- **Vite** - Build tool and dev server
- **React Router** - Client-side routing

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

The app will be available at `http://localhost:3000`.

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |
| `npm run type-check` | Run TypeScript type checking |

## Project Structure

```
src/
├── api/          # API client and fetch wrappers
├── assets/       # Static assets (bundled)
├── components/   # Reusable UI components
├── layouts/      # Page wrappers, nav, footer
├── pages/        # Page-level components
├── styles/       # Global CSS
└── utils/        # Helper functions and constants
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `/api` |
| `VITE_ENV` | Environment name | `development` |
