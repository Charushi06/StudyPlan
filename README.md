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


---

## ✨ Features

### 🤖 AI Intelligence
- Smart extraction from unstructured text
- Detects **deadlines, subjects, tasks, notes**
- Handles ambiguous dates with user confirmation

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

---

## 🧠 System Architecture

```text
Frontend (Vanilla JS UI)
↓
Node.js Express API
↓
AI Layer (Gemini API)
↓
SQLite Database
↓
State Management + UI Sync
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

Create `.env`:

```env
GEMINI_API_KEY=your_gen_ai_key_here
```

---

## ▶️ Run Locally

```bash
node server.js
```
Open → http://localhost:3000

---
 
## Project Structure
 
```
 StudyPlan
├──  css
│   └──  index.css           # Contains all styling rules, variables, and animations
├──  js
│   ├──  utils
│   │   ├──  aiMock.js       # The original mock UI extraction hook (deprecated)
│   │   └──  api.js          # The live fetch logic communicating with our Express API
│   ├──  app.js              # The main controller (handles DOM UI, event bindings, and Calendar)
│   └──  store.js            # The Custom State Manager handling our frontend Pub/Sub state
├──  .env.example            # Template file for setting the GEMINI_API_KEY
├──  .gitignore              # Tells git to ignore databases, environments, and node packages
├──  database.js             # Initializes the SQLite database and executes DB table schemas
├──  index.html              # The frontend structural entry point
├──  package.json            # Node project configuration and backend dependencies
├──  README.md               # The comprehensive project documentation
├──  server.js               # The primary Node.js & Express REST Backend logic
└──  studyplan.db
```

---

## 🔮 Future Roadmap
- 🤖 Smarter AI parsing (multi-language)
- 📊 Study analytics dashboard
- 🔔 Smart reminders & notifications
- 📱 Mobile version
- 🧠 AI study assistant
- 🤝 Contributing

---

## Want to improve StudyPlan? 🚀

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
