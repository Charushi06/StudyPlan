# StudyPlan Setup Guide

---

# Backend Setup

Navigate to backend directory:

```bash
cd backend
```

Install dependencies:

```bash
npm install
```

Run backend server:

```bash
npm start
```

Development mode:

```bash
npm run dev
```

Backend will run on:

```text
http://localhost:3000
```

(or the configured port)

---

# Frontend Setup

Navigate to frontend directory:

```bash
cd frontend
```

Install dependencies:

```bash
npm install
```

If using a static HTML/CSS/JS frontend:

Install live-server globally:

```bash
npm install -g live-server
```

Run frontend:

```bash
cd public
live-server
```

Frontend will open automatically in the browser.

---

# Testing

Navigate to backend:

```bash
cd backend
```

Run all tests:

```bash
npm test
```

Run a specific test:

```bash
node --test tests/exportIcs.test.js
```

---

# Project Structure

```text
StudyPlan/
├── backend/
│   ├── config/
│   ├── controllers/
│   ├── routes/
│   ├── tests/
│   ├── package.json
│   └── server.js
│
├── frontend/
│   ├── public/
│   ├── src/
│   └── package.json
│
├── README.md
├── CONTRIBUTING.md
└── SETUP.md
```

---

# Common Commands

Install backend dependencies:

```bash
cd backend
npm install
```

Install frontend dependencies:

```bash
cd frontend
npm install
```

Run backend:

```bash
cd backend
npm start
```

Run frontend:

```bash
cd frontend/public
live-server
```

Run tests:

```bash
cd backend
npm test
```
