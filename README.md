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
## Features

* AI-based assignment parsing
* Automatic task extraction from pasted text
* Calendar-based study planner
* Deadline tracking
* Smart scheduling suggestions
* Conflict detection for overlapping deadlines
* Responsive modern UI
* Local task management

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
# Preview

## Dashboard

<img width="990" height="600" alt="Screenshot 2026-05-17 213853" src="https://github.com/user-attachments/assets/59060fd2-218e-4e25-badc-7653bf528542" />


## Calendar View

<img width="1257" height="549" alt="image" src="https://github.com/user-attachments/assets/39517342-0e94-492e-9103-64ae8359d207" />


## AI Assignment Parsing

<img width="354" height="525" alt="image" src="https://github.com/user-attachments/assets/422b2c1e-4312-4653-b9b6-12aba9b27ced" />

## Focus Mode
<img width="1230" height="588" alt="image" src="https://github.com/user-attachments/assets/808a86f5-c2ee-45cb-a448-fd566c209a19" />

---

# Tech Stack

### Frontend

* HTML
* CSS
* JavaScript

### Backend

* Node.js
* Express.js

### Database

* MongoDB

### AI Integration

* Gemini API / OpenAI API

---

# Installation

## 1. Clone the Repository

```bash
git clone https://github.com/charushi06/studyplan.git
cd studyplan
```

## 2. Install Dependencies

```bash
npm install
```

## 3. Configure Environment Variables

Create a `.env` file in the root directory:

```env
PORT=5000
MONGODB_URI=your_mongodb_connection_string
API_KEY=your_ai_api_key
```

---

# Running the Project

## Development Mode

```bash
npm run dev
```

## Production Mode

```bash
npm start
```

Open in browser:

```text
http://localhost:5000
```

---

# Project Structure

```text
studyplan/
│
├── client/
│   ├── assets/
│   ├── components/
│   ├── pages/
│   └── styles/
│
├── server/
│   ├── routes/
│   ├── controllers/
│   ├── models/
│   └── config/
│
├── .env
├── package.json
└── README.md
```

---

# How It Works

1. Paste assignment or syllabus text
2. AI extracts:

   * subjects
   * deadlines
   * tasks
   * exam dates
3. Tasks are automatically added to the planner
4. Students can track progress and upcoming deadlines

---

# Example Input

```text
Math Assignment due on 20 May
Physics Lab Report due next Friday
Prepare for Chemistry Quiz on Monday
```

# Example Output

* Math Assignment → 20 May
* Physics Lab Report → Next Friday
* Chemistry Quiz Preparation → Monday

---

# Roadmap

## Planned Features

* Dark mode
* Push notifications
* Mobile optimization
* Drag-and-drop calendar
* Export study plans as PDF
* Multi-language assignment parsing
* Study analytics dashboard
* Pomodoro timer integration

---

# Contribution Guide

Contributions are welcome.

## Steps

1. Fork the repository
2. Create a feature branch

```bash
git checkout -b feature/your-feature-name
```

3. Commit your changes

```bash
git commit -m "Add your message"
```

4. Push to your branch

```bash
git push origin feature/your-feature-name
```

5. Open a Pull Request

---

# Good First Issues

These are beginner-friendly contributions:

* Improve mobile responsiveness
* Add dark mode
* Improve calendar UI
* Add task filtering
* Improve accessibility
* Add loading animations
* Add empty-state illustrations
* Improve form validation

---

# License

This project is licensed under the MIT License.

---

# Acknowledgements

* OpenAI / Gemini APIs
* MongoDB
* Express.js
* Student developer community

---

# Maintainer

Created by Charushi and contributors.

If you like this project, consider giving it a ⭐ on GitHub.

---
