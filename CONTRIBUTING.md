# Contributing to StudyPlan 📚
Thank you for your interest in contributing to **StudyPlan** — an application designed to automatically organize tasks, schedules, and study plans. We welcome contributions from the community, especially **GSSoC contributors**!

---

## 🗺️ Table of Contents
- [GSSoC Contributors — Start Here](#-gssoc-contributors--start-here)
- [Getting Started](#-getting-started)
- [System Architecture](#-system-architecture)
- [Branch Naming Convention](#-branch-naming-convention)
- [Commit Message Format](#-commit-message-format)
- [Pull Request Guidelines](#-pull-request-guidelines)
- [Reporting Issues](#-reporting-issues)
- [Code of Conduct](#-code-of-conduct)

---

## 🏅 GSSoC/NSoC Contributors — Start Here

Welcome to GSSoC! Here's how the contribution flow works for this project:

1. **Fork** the repository to your own GitHub account (button at top-right of the repo page).
2. **Clone your fork** locally — never clone the upstream repo directly.
3. Work on a **feature branch** (not `main`) in your fork.
4. Open a **Pull Request from your fork's branch → `StudyPlan/StudyPlan:main`**.
5. A maintainer will review and approve your PR.

---

## 🚀 Getting Started
1. **Fork** the repository on GitHub.
2. **Clone** your fork:
    ```bash
   git clone https://github.com/<your-username>/StudyPlan.git
   cd StudyPlan
   ```
3. **Add upstream remote** so you can stay in sync:
   ```bash
   git remote add upstream https://github.com/Charushi06/StudyPlan
   git fetch upstream
   ```
4. **Create a feature branch** from `main`:
   ```bash
   git checkout -b your-feature-name
   ```

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

## 🌿 Branch Naming Convention

Use the following prefixes:

| Prefix      | Use for                  |
| ----------- | ------------------------ |
| `feat/`     | New features             |
| `fix/`      | Bug fixes                |
| `docs/`     | Documentation changes    |
| `refactor/` | Code refactoring         |
| `chore/`    | Maintenance tasks        |

---

## 📝 Commit Message Format

```
<scope>: <short clear action in present tense>.
```

### Rules
- **Scope**: a module or feature name
- Use concise but descriptive language
- Start action with a capital letter (`Fix`, `Add`, `Update`, `Remove`, `Improve`)
- No emojis in commit messages
- One sentence only, ending with a period
- Keep under 80 characters

### Examples

```
feat: ai automatically adds tasks to the dates
```

---

## 🔀 Pull Request Guidelines

> ⚠️ **Before starting work, sync your fork with upstream `main`.**
> Opening a PR from a stale fork causes unnecessary merge conflicts.
> Run these steps before creating your feature branch:
>
> ```bash
> # Step 1 — Sync your fork with upstream before starting work
> git fetch upstream
> git checkout main
> git rebase upstream/main
> git push origin main
>
> # Step 2 — Then create your feature branch
> git checkout -b your-feature-name
> ```

1. **One PR = One Purpose**: fix one bug, add one feature, or improve documentation.
2. Keep PRs **small and focused** — large PRs are harder to review.
3. **Link the relevant issue** using `Fixes #<issue-number>`.
4. Update **documentation** (README, docstrings, comments) as needed.

### Keeping Your Fork Up to Date

```bash
git fetch upstream
git checkout main
git merge upstream/main
git push origin main
git checkout feat/your-feature-name
git rebase main
```

---

## 🐛 Reporting Issues

   When reporting issues, please include:
   
   - A clear description of the problem
   - Steps to reproduce
   - Expected vs. actual behavior
   - Relevant error messages or stack traces
      
---

## 📋 Code of Conduct

Please be respectful and considerate in all interactions. We are committed to providing a welcoming and inclusive environment for everyone.

Unacceptable behavior includes harassment, discrimination, or any form of personal attack.
Violations can be reported to the project maintainers.

---

## ❓ Questions?

- Open an **issue** for project-related questions.
- For GSSoC-specific questions, join our Discord community: [Discord-Link](#)

Thank you for contributing! 📚🏫
