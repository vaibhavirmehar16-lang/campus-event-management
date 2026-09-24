# Campus Event Management System (B4)

A lightweight campus event management system with real-time capacity enforcement, atomic seat allocation, and personal schedule clash prevention.

## Features
- **Event Discovery & Listing**: Displays live registration ratios (`Registered: X / Capacity: Y`).
- **Schedule Clash Prevention**: Enforces interval overlap validation on identical dates (`eventA.start < eventB.end && eventB.start < eventA.end`).
- **Strict Boundary Handling**: Allows contiguous events (e.g., 10:00–11:00 and 11:00–12:00) without false-positive conflict rejection.
- **Atomic Registration**: Executed inside an SQLite database transaction to prevent overbooking and race conditions.
- **Validation**: Enforces positive capacities and prevents start-time/end-time inversion.

## Tech Stack
- **Backend**: Node.js, Express.js
- **Database**: SQLite (`better-sqlite3`) with ACID transactions
- **Frontend**: Responsive Single Page Interface (Vanilla HTML5 / Modern CSS / ES6 Fetch)

## Setup & Running Locally
```bash
git clone <repo-url>
cd event-hub
npm install
npm start