# StudyPlan
 
**AI-powered study planner and deadline manager.** Paste any text, an email, assignment brief, or WhatsApp message and StudyPlan extracts deadlines, subjects, and tasks, then automatically adds them to your calendar and to-do list.
 
---
 
## The Problem
 
Students already have all the information they need. It's buried in emails, group chats, and course portals. Re-entering it manually into a planner is tedious, error-prone, and where things get missed.
 
StudyPlan eliminates that step entirely.
 
---
 
## How It Works
 
1. Paste any text into the Smart Paste panel
2. The AI extracts tasks, deadlines, subjects, and notes
3. Review extracted items, edit anything, confirm ambiguous dates
4. Hit **Add to planner**, calendar and to-do list update instantly


## Features

- **Smart AI Extraction**: Powered by Google Gen AI (Gemini), instantly map chaotic, unstructured messages into structured task definitions.
- **Dynamic Task Board**: Categorizes tasks intuitively into 'Due Soon', 'This Week', and 'Completed'.
- **Inline Editing Workspace**: Fast, modal-free inline viewing allows you to adjust dates, subjects, titles, and notes natively within the extraction view before saving.
- **Interactive Global Calendar**: Cycle seamlessly through months, automatically tracks color-coded deadlines, and click on any specific date to natively filter your live task board.
- **Conflict Notifications**: Automatically detects deadline clustering and visually warns you to spread out your study load.
- **Persistent Local DB**: Lightweight, local SQLite tracking for full relational entity mapping (Tasks + Subjects).

## Tech Stack

- **Frontend**: Custom Vanilla HTML, CSS, & Javascript. Engineered with extreme attention to aesthetic detail (Glassmorphism, CSS variable themes, smooth transition animations).
- **Backend API**: Node.js & Express REST architecture.
- **Database**: SQLite3.
- **AI Engine**: `@google/genai` (Google Gemini 2.5 Flash model).

## Deployed Link
https://studyplan-jvgd.onrender.com/

## Getting Started Locally

### Prerequisites
- [Node.js](https://nodejs.org/) installed on your machine.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/Charushi06/StudyPlan.git
   cd "StudyPlan"
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Enable Full AI Extraction Capabilities:
   Copy `.env.example` to a new file named `.env` in the root directory and paste your Google Gemini API key:
   ```text
   GEMINI_API_KEY=your_gen_ai_key_here
   ```
   *Note: Without a key, the backend utilizes an internally built heuristic fallback mock capable of parsing dates/subjects but lacking complete NLP flexibility.*

4. Boot up the local server:
   ```bash
   node server.js
   ```

5. Launch the application:
   Head perfectly local to [http://localhost:3000](http://localhost:3000) in your modern browser of choice.

 
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
 
Included as a project for Nexus Spring of Code open source
