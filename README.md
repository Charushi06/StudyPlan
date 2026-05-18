# 📚 StudyPlan — Turn Chaos into Clarity

⚡ Paste anything. Get a structured study plan instantly.  
No manual entry. No missed deadlines.

🌍 Live App: https://studyplan-jvgd.onrender.com/

---

## 🧠 The Idea

Students don’t lack information.  
They lack organization.

Assignments live in:
- 📧 Emails  
- 💬 WhatsApp groups  
- 📄 PDFs & portals  

And the biggest problem:

❌ Everything must be manually added into planners

---

## 💡 Solution

StudyPlan removes manual planning completely.

Just:
- Paste messy text
- AI extracts tasks
- Everything becomes structured

🎯 Chaos → Clean plan in seconds

---

## ⚙️ How It Works

User Input  
↓  
AI Extraction (Gemini)  
↓  
Structured Tasks (dates, subjects, priorities)  
↓  
User Review + Edit  
↓  
Planner + Calendar Update  

---

## ✨ Features

### 🤖 AI Intelligence
- Smart extraction from unstructured text  
- Detects deadlines, subjects, tasks, notes  
- Handles ambiguous dates with confirmation  

### 📊 Smart Planning System
- Auto-categorized boards:
  - Due Soon  
  - This Week  
  - Completed  
- Conflict detection (deadline clustering alerts)

### 📅 Interactive Calendar
- Global calendar view  
- Click a date → filter tasks  
- Color-coded deadlines  

### 🧩 Seamless Editing
- Inline editing (no popups)  
- Modify extracted data before saving  

### 💾 Persistent Storage
- SQLite-based database  
- Structured task + subject mapping  

---

## 🧠 System Architecture

Frontend (Vanilla JS UI)  
↓  
Node.js + Express API  
↓  
Google Gemini AI Layer  
↓  
SQLite Database  
↓  
State Management + UI Sync  

---

## 🛠 Tech Stack

| Layer     | Technology |
|----------|------------|
| Frontend | HTML, CSS (Glassmorphism), Vanilla JS |
| Backend  | Node.js + Express |
| Database | SQLite |
| AI       | Google Gemini (GenAI SDK) |

---

## 🚀 Key Differentiators

| Feature | StudyPlan | Typical Planners |
|--------|-----------|------------------|
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
