# 🚀 Beginner's Guide to Contributing to StudyPlan (GSSoC '26)

Welcome! If this is your first time contributing to open source, you're in the right place.
This guide will take you from zero to your first Pull Request, step by step.

---

## Stage 1: The Absolute Basics

### Fork & Clone the Repository

1. Go to https://github.com/charushi06/studyplan
2. Click the **Fork** button (top right)
3. Click **Create Fork**

Now clone YOUR fork:
```bash
git clone https://github.com/YOUR-USERNAME/studyplan.git
cd studyplan
```

### Connect to the Original Repo
```bash
git remote add upstream https://github.com/charushi06/studyplan.git
```

Verify it worked:
```bash
git remote -v
```
You should see both `origin` (your fork) and `upstream` (original).

---

## Stage 2: Setting Up Locally

### Install Dependencies
```bash
npm install
```

### Run the App
```bash
npm start
```

Open your browser at `http://localhost:3000` — you should see StudyPlan running!

---

## Stage 3: Making Your First Contribution

### Finding the Right Issues

- Go to the **Issues** tab on GitHub
- Filter by labels: `good first issue`, `beginner-friendly`, `documentation`, `bug`
- Pick one with **0-1 comments** and **no assignee**

### The Golden Rule — Never Work on Main!

Always create a new branch:
```bash
git checkout -b fix/your-issue-description-123
```

### Making Your Changes

1. Make your fix or improvement
2. Test it locally at `http://localhost:3000`
3. Stage your changes:
```bash
git add .
```
4. Commit with a clear message:
```bash
git commit -m "fix: describe what you fixed (#issue-number)"
```
5. Push to your fork:
```bash
git push origin fix/your-issue-description-123
```

### Opening a Pull Request

1. Go to your fork on GitHub
2. Click **"Compare & pull request"**
3. Write a clear title and description
4. Add `Fixes #issue-number` in the description
5. Click **Create Pull Request** ✅

---

## Stage 4: Core Technologies Used

| Technology | Resource |
|---|---|
| JavaScript | https://javascript.info |
| Node.js | https://nodejs.dev/learn |
| SQLite | https://www.sqlitetutorial.net |
| CSS | https://web.dev/learn/css |
| Git & GitHub | https://skills.github.com |

---

## 🔧 Troubleshooting

### My branch is behind main
```bash
git checkout main
git pull upstream main
git checkout your-branch
git merge main
```

### I accidentally committed to main
```bash
git checkout -b fix/my-actual-branch
git checkout main
git reset --hard upstream/main
```

### Merge conflict
Open the conflicting file, look for `<<<<<<`, `======`, `>>>>>>` markers,
keep the correct code, delete the markers, then:
```bash
git add .
git commit -m "fix: resolve merge conflict"
```

### npm install fails
Make sure you have Node.js installed:
```bash
node --version
npm --version
```
If not installed, download from https://nodejs.org

---

## ✅ First PR Checklist

- [ ] I created a new branch (not working on main)
- [ ] I tested my changes locally
- [ ] My commit message is clear and descriptive
- [ ] I linked the issue in my PR description
- [ ] My PR does one thing only

---

## 💬 Need Help?

- Join the GSSoC Discord and ask in the project channel
- Comment on the GitHub issue — maintainers are friendly!
- Tag a mentor listed on the GSSoC project page

**You've got this. Every expert was once a beginner. 🌟**