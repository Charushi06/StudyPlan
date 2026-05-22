/************************************************************
 * STUDY ANALYTICS DASHBOARD
 * Productivity Insights Dashboard (Vanilla JS + Chart.js)
 *
 * FEATURES:
 * ✅ Productivity Insights
 * ✅ Study Streak Tracking
 * ✅ Weekly Progress
 * ✅ Subject-wise Analytics
 * ✅ Completion Percentage
 * ✅ Most Active Subject
 * ✅ Progress Cards
 * ✅ Charts & Graphs
 ************************************************************/

/* =========================================================
   SAMPLE TASK DATA
========================================================= */

const tasks = [
  {
    title: "DSA Assignment",
    subject: "DSA",
    status: "completed",
    completed_at: "2026-05-01"
  },

  {
    title: "DBMS Lab",
    subject: "DBMS",
    status: "completed",
    completed_at: "2026-05-02"
  },

  {
    title: "OS Notes",
    subject: "OS",
    status: "pending",
    completed_at: ""
  },

  {
    title: "React Practice",
    subject: "Web Dev",
    status: "completed",
    completed_at: "2026-05-03"
  },

  {
    title: "CN Assignment",
    subject: "CN",
    status: "completed",
    completed_at: "2026-05-04"
  },

  {
    title: "AI Research",
    subject: "AI",
    status: "pending",
    completed_at: ""
  }
];

/* =========================================================
   DASHBOARD CLASS
========================================================= */

class ProductivityDashboard {
  constructor(tasks) {
    this.tasks = tasks;

    this.totalTasks = 0;
    this.completedTasks = 0;
    this.pendingTasks = 0;
    this.completionRate = 0;
    this.currentStreak = 0;
    this.mostActiveSubject = "";

    this.subjectStats = {};
    this.weeklyStats = {};

    this.init();
  }

  /* =====================================================
     INITIALIZE
  ===================================================== */

  init() {
    this.calculateStats();
    this.renderDashboard();
    this.renderCharts();
  }

  /* =====================================================
     CALCULATE ANALYTICS
  ===================================================== */

  calculateStats() {
    this.totalTasks = this.tasks.length;

    this.completedTasks = this.tasks.filter(
      task => task.status === "completed"
    ).length;

    this.pendingTasks =
      this.totalTasks - this.completedTasks;

    this.completionRate = Math.round(
      (this.completedTasks / this.totalTasks) * 100
    );

    this.calculateSubjectStats();
    this.calculateWeeklyStats();
    this.calculateStudyStreak();
  }

  /* =====================================================
     SUBJECT ANALYTICS
  ===================================================== */

  calculateSubjectStats() {
    const stats = {};

    this.tasks.forEach(task => {
      const subject = task.subject;

      if (!stats[subject]) {
        stats[subject] = 0;
      }

      if (task.status === "completed") {
        stats[subject]++;
      }
    });

    this.subjectStats = stats;

    // MOST ACTIVE SUBJECT
    let max = 0;

    Object.entries(stats).forEach(([subject, count]) => {
      if (count > max) {
        max = count;
        this.mostActiveSubject = subject;
      }
    });
  }

  /* =====================================================
     WEEKLY PRODUCTIVITY
  ===================================================== */

  calculateWeeklyStats() {
    const weekly = {};

    this.tasks.forEach(task => {
      if (
        task.status === "completed" &&
        task.completed_at
      ) {
        const date = new Date(task.completed_at);

        const day = date.toLocaleDateString("en-US", {
          weekday: "short"
        });

        if (!weekly[day]) {
          weekly[day] = 0;
        }

        weekly[day]++;
      }
    });

    this.weeklyStats = weekly;
  }

  /* =====================================================
     STUDY STREAK
  ===================================================== */

  calculateStudyStreak() {
    const completedDates = this.tasks
      .filter(task => task.status === "completed")
      .map(task =>
        new Date(task.completed_at).toDateString()
      );

    const uniqueDates = [...new Set(completedDates)];

    this.currentStreak = uniqueDates.length;
  }

  /* =====================================================
     DASHBOARD UI
  ===================================================== */

  renderDashboard() {
    const dashboard = document.getElementById(
      "analytics-dashboard"
    );

    dashboard.innerHTML = `
    
      <div class="dashboard">

        <h1 class="title">
          📊 Study Analytics Dashboard
        </h1>

        <div class="cards">

          ${this.createCard(
            "📚 Total Tasks",
            this.totalTasks
          )}

          ${this.createCard(
            "✅ Completed",
            this.completedTasks
          )}

          ${this.createCard(
            "⏳ Pending",
            this.pendingTasks
          )}

          ${this.createCard(
            "🎯 Completion",
            this.completionRate + "%"
          )}

          ${this.createCard(
            "🔥 Study Streak",
            this.currentStreak + " Days"
          )}

          ${this.createCard(
            "🧠 Active Subject",
            this.mostActiveSubject
          )}

        </div>

        <div class="progress-wrapper">

          <h2>📈 Overall Productivity</h2>

          <div class="progress-bar">

            <div 
              class="progress-fill"
              style="width:${this.completionRate}%"
            >
              ${this.completionRate}%
            </div>

          </div>

        </div>

        <div class="charts">

          <div class="chart-box">
            <h2>📅 Weekly Productivity</h2>
            <canvas id="weeklyChart"></canvas>
          </div>

          <div class="chart-box">
            <h2>📚 Subject Analytics</h2>
            <canvas id="subjectChart"></canvas>
          </div>

        </div>

      </div>
    `;
  }

  /* =====================================================
     CREATE CARD
  ===================================================== */

  createCard(title, value) {
    return `
      <div class="card">
        <h3>${title}</h3>
        <p>${value}</p>
      </div>
    `;
  }

  /* =====================================================
     CHARTS
  ===================================================== */

  renderCharts() {
    this.renderWeeklyChart();
    this.renderSubjectChart();
  }

  /* =====================================================
     WEEKLY CHART
  ===================================================== */

  renderWeeklyChart() {
    const ctx = document
      .getElementById("weeklyChart")
      .getContext("2d");

    new Chart(ctx, {
      type: "line",

      data: {
        labels: Object.keys(this.weeklyStats),

        datasets: [
          {
            label: "Tasks Completed",

            data: Object.values(
              this.weeklyStats
            ),

            borderWidth: 3,
            tension: 0.4
          }
        ]
      },

      options: {
        responsive: true
      }
    });
  }

  /* =====================================================
     SUBJECT CHART
  ===================================================== */

  renderSubjectChart() {
    const ctx = document
      .getElementById("subjectChart")
      .getContext("2d");

    new Chart(ctx, {
      type: "bar",

      data: {
        labels: Object.keys(this.subjectStats),

        datasets: [
          {
            label: "Completed Tasks",

            data: Object.values(
              this.subjectStats
            ),

            borderWidth: 2
          }
        ]
      },

      options: {
        responsive: true
      }
    });
  }
}

/* =========================================================
   INITIALIZE DASHBOARD
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  new ProductivityDashboard(tasks);
});

/* =========================================================
   REQUIRED HTML
========================================================= */

/*

ADD THIS TO HTML:

--------------------------------------------------

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>

<div id="analytics-dashboard"></div>

--------------------------------------------------

*/

/* =========================================================
   REQUIRED CSS
========================================================= */

/*

body{
  background:#0f172a;
  font-family:Arial;
  color:white;
}

.dashboard{
  padding:30px;
}

.title{
  text-align:center;
  margin-bottom:40px;
}

.cards{
  display:grid;
  grid-template-columns:repeat(auto-fit,minmax(220px,1fr));
  gap:20px;
}

.card{
  background:rgba(255,255,255,0.08);
  padding:25px;
  border-radius:20px;
  backdrop-filter:blur(12px);
  text-align:center;
}

.card h3{
  margin-bottom:10px;
}

.card p{
  font-size:28px;
  font-weight:bold;
}

.progress-wrapper{
  margin-top:40px;
}

.progress-bar{
  width:100%;
  height:30px;
  background:#1e293b;
  border-radius:30px;
  overflow:hidden;
}

.progress-fill{
  height:100%;
  background:linear-gradient(
    90deg,
    #00f5a0,
    #00d9f5
  );

  display:flex;
  align-items:center;
  justify-content:center;
  font-weight:bold;
}

.charts{
  margin-top:50px;
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:30px;
}

.chart-box{
  background:rgba(255,255,255,0.08);
  padding:25px;
  border-radius:20px;
}

canvas{
  margin-top:20px;
}

@media(max-width:768px){

  .charts{
    grid-template-columns:1fr;
  }

}

*/
