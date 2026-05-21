# 📚 StudyPlan — Turn Chaos into Clarity

> ⚡ Paste anything. Get a structured study plan instantly.  
> No manual entry. No missed deadlines.

🌍 **Live App:** https://studyplan-jvgd.onrender.com/

---

## 🧠 The Idea

Students don’t lack information.  
They lack **organization**.

Assignments live in:
- 📧 Emails  
- 💬 WhatsApp groups  
- 📄 PDFs & portals  

And the biggest problem?
> ❌ You have to manually re-enter everything into a planner  

---

## 💡 Solution

**StudyPlan removes manual planning completely.**

Just:
1. Paste messy text  
2. AI extracts tasks  
3. Everything becomes structured  

> 🎯 From chaos → clean plan in seconds

---

## ⚙️ How It Works

```text
User Paste
↓
AI Extraction (Gemini)
↓
Structured Tasks (Dates, Subjects)
↓
User Review + Edit
↓
Planner + Calendar Update
```

> **Note:** If `GEMINI_API_KEY` is not set (or the API call fails), the server falls back to built-in NLP heuristics in `server.js` so extraction still works locally.

---

## ✨ Features

### 🤖 AI Intelligence
- Smart extraction from unstructured text
- Detects **deadlines, subjects, tasks, notes**
- Review and edit extracted tasks before saving
- Gemini-powered extraction with NLP fallback when the API is unavailable

### 📊 Smart Planning System
- Auto-categorized boards:
  - Due Soon
  - This Week
  - Completed
- Conflict detection (deadline clustering alerts)

### 📅 Interactive Calendar
- Global calendar view
- Click a date → filter tasks instantly
- Color-coded deadlines

### 🧩 Seamless Editing
- Inline editing (no popups)
- Modify extracted data before saving

### 💾 Persistent Storage
- SQLite-based local database
- Structured task + subject mapping

### 📥 More in the app
- **Focus mode** — Pomodoro-style timer with a selected task
- **Archived tasks** — Archive and restore without deleting
- **CSV export** — Download tasks via `GET /api/download`
- **Support page** — `/support-page/` for help and contact info
- **Auth UI** — Sign up / sign in (in-memory demo store; resets on server restart)

---

## 🧠 System Architecture

```text
Frontend (Vanilla JS UI)
↓
Node.js Express API
↓
AI Layer (Gemini API → NLP fallback)
↓
SQLite Database
↓
State Management + UI Sync (store.js)
```


---

## 🛠 Tech Stack

| Layer | Technology |
|------|-----------|
| Frontend | HTML, CSS (Glassmorphism), Vanilla JS |
| Backend | Node.js + Express |
| Database | SQLite |
| AI | Google Gemini (GenAI SDK) |

---

## 🚀 Key Differentiators

| Feature | StudyPlan | Typical Planners |
|--------|----------|-----------------|
| AI Extraction | ✅ | ❌ |
| Zero Manual Entry | ✅ | ❌ |
| Conflict Detection | ✅ | ❌ |
| Inline Editing | ✅ | ❌ |

---

## 📦 Installation

```bash
git clone https://github.com/Charushi06/StudyPlan.git
cd StudyPlan
npm install
```

---

## 🔑 Environment Setup

Copy `.env.example` to `.env` (optional — the app runs without it using NLP fallback):

```env
GEMINI_API_KEY=your_gen_ai_key_here   # optional; enables Gemini extraction
PORT=3000                             # optional; defaults to 3000
```

---

## ▶️ Run Locally

```bash
npm start
# or: node server.js
```

Open → http://localhost:3000

**Deploy (Render):** Set `GEMINI_API_KEY` and `PORT` in the dashboard; build uses `.render-build.sh`.

---

## 📡 API Overview

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/subjects` | List subjects |
| `POST` | `/api/subjects` | Create a subject |
| `GET` | `/api/tasks` | List tasks |
| `POST` | `/api/tasks` | Add task(s) (duplicate detection) |
| `PUT` | `/api/tasks/:id` | Update task fields |
| `DELETE` | `/api/tasks/:id` | Delete a task |
| `POST` | `/api/extract` | Extract tasks from pasted text |
| `GET` | `/api/download` | Export tasks as CSV |
| `POST` | `/api/auth/signup` | Sign up (in-memory) |
| `POST` | `/api/auth/login` | Sign in (in-memory) |

---
 
## Project Structure
 
```
StudyPlan/
├── css/
│   └── index.css              # Styling, variables, animations
├── js/
│   ├── utils/
│   │   ├── api.js             # Live fetch logic for the Express API
│   │   ├── scheduler.js       # Workload / deadline clustering analysis
│   │   ├── errorBoundary.js   # Frontend crash screen
│   │   ├── nlpDateExtractor.js    # Client-side date parsing (aiMock)
│   │   ├── nlpSubjectExtractor.js # Client-side subject detection (aiMock)
│   │   └── aiMock.js          # Original mock extraction hook (deprecated)
│   ├── app.js                 # Main UI controller (DOM, calendar, boards)
│   └── store.js               # Pub/Sub state manager + API calls
├── backend/
│   ├── controllers/
│   │   └── csvDownload.controller.js
│   └── routers/
│       └── csvDownload.router.js
├── support-page/              # Support / contact page
│   ├── index.html
│   ├── support.css
│   └── support.js
├── .github/                   # Issue and PR templates
├── .env.example               # Template for GEMINI_API_KEY
├── .gitignore
├── .render-build.sh           # Render deploy script (sqlite3 rebuild)
├── CONTRIBUTING.md            # Contributor guide (GSSoC / NSoC)
├── database.js                # SQLite init and schema
├── index.html                 # Main app entry point
├── 404.html / error.html      # Custom error pages
├── package.json
├── README.md
├── server.js                  # Express API, AI extraction, NLP fallback
└── studyplan.db               # Created at runtime (not committed)
```

---

## 🔮 Future Roadmap
- 🤖 Smarter AI parsing (multi-language)
- 📊 Study analytics dashboard
- 🔔 Smart reminders & notifications
- 📱 Mobile version
- 🧠 AI study assistant

---

## Want to improve StudyPlan? 🚀

See **[CONTRIBUTING.md](CONTRIBUTING.md)** for the full GSSoC/NSoC workflow, branch naming, and PR guidelines.

### 🔥 High-impact contributions:
- Improve AI parsing accuracy
- Add calendar enhancements
- UI/UX upgrades
- Notification system

#### Steps:

```bash
git checkout -b feature/your-feature
git commit -m "feat: add feature"
git push origin feature/your-feature
```

Open a PR with:

- Clear description
- Screenshots (if UI changes)

---

## 🐛 Issues

Found a bug? Open an issue!

---

## 💡 Why This Project?

Because planning should not feel like work.

It should feel like:

- ⚡ Instant
- 🧠 Intelligent
- 🎯 Effortless

---

## ⭐ Support

If you like this project:
👉 Star ⭐ the repo
👉 Share it

---

## 📄 License

MIT License

---

## ⚡ Author

Charushi
GitHub: https://github.com/Charushi06

---

## 🌱 Nexus Spring of Code 2026

This project is part of NSoC 2026

---

Built with AI, code, and a mission to simplify student life.

---
