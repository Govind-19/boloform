# BoloForms Assignment

This is a full-stack application featuring a React-based PDF viewer client and a Node.js/Express server.

## Features

- **PDF Viewer**: Interactive PDF viewing capabilities on the frontend.
- **Full Stack**: Separate client and server architecture.
- **TypeScript**: built with TypeScript for type safety.

## Project Structure

- `client/`: React application (Vite + TypeScript)
- `server/`: Node.js backend (TypeScript)

## Getting Started

### Prerequisites

- Node.js installed on your machine.
- MongoDB (locally or Atlas URI) if required by the server.

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Govind-19/boloform.git
    cd boloform
    ```

2.  Install dependencies for both client and server:
    ```bash
    npm run install:all
    ```
    *(This runs `npm install` in the root, client, and server directories)*

### Running the App

To start both the client and server concurrently:

```bash
npm run dev
```

- **Client** will run on: `http://localhost:5173` (default Vite port)
- **Server** will run on: `http://localhost:5000` (typical server port, check logs)

## Deployment

The client is configured for deployment on **Netlify**.
- A `netlify.toml` file is included to handle the build settings (`base = "client"`, `publish = "dist"`).

## Technologies

- **Frontend**: React, Vite, TypeScript, PDF.js (via react-pdf)
- **Backend**: Node.js, Express, TypeScript, Mongoose (MongoDB)
