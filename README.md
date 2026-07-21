# Timetable & Grade Predictor

A single-page web app for students to visually manage a weekly timetable and predict their UK exam grades based on study hours and work/life balance.

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or later (includes npm)

### Install & Run

```bash
# Install dependencies
npm install

# Start the development server
npm run dev

# Build for production
npm run build

# Preview the production build
npm run preview
```

## Project Structure

```
src/
├── App.tsx              # Root component with 3-tab layout shell
├── index.css            # Global CSS reset + CSS variables
├── main.tsx             # React entry point
├── components/          # UI components (Sub-Tasks 2–6)
├── hooks/
│   └── useLocalStorage.ts  # Generic localStorage ↔ React state hook
├── store/               # Shared React context / reducers (Sub-Task 7)
├── types/
│   └── index.ts         # All shared TypeScript types
└── utils/               # Pure utility functions (Sub-Task 6)
```

## Implementation Plan

See [`timetable-grade-predictor-plan.md`](./timetable-grade-predictor-plan.md) for the full plan and remaining sub-tasks.
