# 📚 StudyPlan — Turn Chaos into Clarity

> ⚡ Paste anything. Get a structured study plan instantly.
> No manual entry. No missed deadlines.

🌍 **Live App:**
[StudyPlan Live Demo](https://studyplan-jvgd.onrender.com/?utm_source=chatgpt.com)

🌱 **NSoC 2026 Project**
Built with AI, code, and a mission to simplify student life.

---

# 🧠 The Idea

Students don’t lack information.
They lack **organization**.

Assignments are scattered across:

* 📧 Emails
* 💬 WhatsApp groups
* 📄 PDFs & portals
* 📝 Classroom announcements
* 📅 College dashboards

And the biggest problem?

> ❌ You still have to manually re-enter everything into a planner.

---

# 💡 Solution

**StudyPlan removes manual planning completely.**

Just:

1. Paste messy text
2. AI extracts tasks
3. Review & edit instantly
4. Everything becomes structured automatically

> 🎯 From chaos → clean study plan in seconds.

---

# ⚙️ How It Works

```text
User Paste
↓
AI Extraction (Gemini API)
↓
Heuristic NLP Fallback (Offline Support)
↓
Structured Tasks + Subjects
↓
User Review & Inline Editing
↓
Planner + Calendar + Focus Mode
↓
Persistent SQLite Storage
```

---

# ✨ Features

## 🤖 AI-Powered Task Extraction

* Extracts tasks from unstructured text
* Detects:

  * deadlines
  * subjects
  * priorities
  * notes
* Supports natural language dates:

  * “tomorrow”
  * “next Friday”
  * “end of month”
* Confidence scoring for extracted tasks
* Intelligent fallback NLP parser when AI is unavailable

---

## 📊 Smart Planning System

Automatically organizes tasks into:

* 📌 Due Soon
* 📅 This Week
* ✅ Completed
* 🗃 Archived

Includes:

* Deadline clustering alerts
* Priority management
* Subject-based grouping
* Task deduplication detection

---

## 📅 Interactive Calendar

* Global monthly calendar view
* Click a date → instantly filter tasks
* Color-coded deadlines
* Dynamic task indicators
* Quick navigation between months

---

## 🧩 Seamless Editing Experience

* Inline task editing
* Modify extracted data before saving
* Create custom subjects dynamically
* No disruptive popups for workflow changes

---

## ⏳ Focus Mode (Pomodoro System)

Built-in productivity dashboard with:

* Custom focus timer
* Task-based focus sessions
* Pause/reset controls
* Visual progress ring
* Active task tracking

---

## 🌗 Personalization & Settings

* Dark mode support
* Compact view toggle
* Persistent user preferences using localStorage

---

## 🔐 Authentication System

* Login & signup UI
* Persistent session handling
* Local authentication flow

---

## 💾 Persistent Storage

SQLite-powered database system with:

* Subject management
* Task relationships
* Archived task storage
* Confidence & priority persistence

---

## 📤 CSV Export System

Export all study data directly as CSV.

Useful for:

* backups
* analytics
* spreadsheet workflows
* reporting

---

# 🧠 System Architecture

```text
Frontend (Vanilla JS + Glassmorphism UI)
↓
Custom State Management Layer
↓
Node.js + Express API
↓
AI Layer (Gemini API)
↓
Fallback NLP Extraction Engine
↓
SQLite Database
↓
CSV Export + UI Synchronization
```

---

# 🛠 Tech Stack

| Layer            | Technology            |
| ---------------- | --------------------- |
| Frontend         | HTML, CSS, Vanilla JS |
| UI Style         | Glassmorphism         |
| Backend          | Node.js + Express     |
| Database         | SQLite                |
| AI               | Google Gemini API     |
| State Management | Custom Pub/Sub Store  |
| Export System    | CSV Download API      |

---

# 🚀 Key Differentiators

| Feature                | StudyPlan | Typical Planners |
| ---------------------- | --------- | ---------------- |
| AI Extraction          | ✅         | ❌                |
| Zero Manual Entry      | ✅         | ❌                |
| NLP Fallback Parser    | ✅         | ❌                |
| Conflict Detection     | ✅         | ❌                |
| Inline Editing         | ✅         | ❌                |
| Built-in Focus Mode    | ✅         | ❌                |
| CSV Export             | ✅         | ❌                |
| Subject Auto-Detection | ✅         | ❌                |

---

# 📦 Installation

```bash
git clone https://github.com/Charushi06/StudyPlan.git
cd StudyPlan
npm install
```

---

# 🔑 Environment Setup

Create a `.env` file:

```env
GEMINI_API_KEY=your_gemini_api_key_here
```

---

# ▶️ Run Locally

```bash
node server.js
```

Open:

```text
http://localhost:3000
```

---

# 📁 Project Structure

```text
StudyPlan
├── backend
│   ├── controllers
│   │   └── csvDownload.controller.js
│   └── routers
│       └── csvDownload.router.js
│
├── css
│   └── index.css
│
├── js
│   ├── utils
│   │   ├── aiMock.js
│   │   ├── api.js
│   │   ├── errorBoundary.js
│   │   └── scheduler.js
│   │
│   ├── app.js
│   └── store.js
│
├── database.js
├── server.js
├── index.html
├── 404.html
├── error.html
├── package.json
├── .env.example
├── README.md
└── CONTRIBUTING.md
```

---

# 🔥 Advanced Engineering Highlights

* Intelligent heuristic NLP fallback parser
* Dynamic date parsing engine
* Subject keyword classification
* Custom frontend state manager
* Global UI synchronization
* Express REST API architecture
* Modular router/controller separation
* Graceful error boundaries
* Dynamic theming system

---

# 🔮 Future Roadmap

* 🤖 Multi-language AI parsing
* 📊 Study analytics dashboard
* 🔔 Smart notifications & reminders
* 📱 Mobile-first responsive app
* ☁️ Cloud sync
* 🧠 AI study assistant
* 👥 Collaborative study groups
* 📈 Productivity insights

---

# 🤝 Contributing

Contributions are welcome 🚀

### High-impact areas

* AI parsing improvements
* Calendar enhancements
* UI/UX upgrades
* Notification system
* Accessibility improvements
* Mobile responsiveness

### Contribution Flow

```bash
git checkout -b feature/your-feature
git commit -m "feat: add feature"
git push origin feature/your-feature
```

Then open a Pull Request with:

* Clear description
* Screenshots (if UI changes)

---

# 🐛 Issues

Found a bug?

Open an issue on GitHub with:

* Steps to reproduce
* Expected behavior
* Screenshots/logs if possible

---

# 💡 Why This Project?

Because planning should not feel like work.

It should feel:

* ⚡ Instant
* 🧠 Intelligent
* 🎯 Effortless

---

# ⭐ Support

If you like this project:

* ⭐ Star the repository
* 🍴 Fork it
* 📢 Share it

---

# 📄 License

MIT License

---

# ⚡ Author

GitHub:
[Charushi06 GitHub Profile](https://github.com/Charushi06)

---

# 🌱 Nexus Spring of Code 2026

This project is part of **NSoC 2026**.
