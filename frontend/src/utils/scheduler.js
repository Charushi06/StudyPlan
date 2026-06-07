export function analyzeWorkload(tasks) {
  const workloadMap = {};

  // Group tasks by date
  tasks.forEach(task => {
    if (!task.due_at || task.archived || task.status === 'Done') return;

    const date = new Date(task.due_at).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });

    if (!workloadMap[date]) {
      workloadMap[date] = {
        tasks: [],
        score: 0,
        highPriorityCount: 0
      };
    }

    workloadMap[date].tasks.push(task);

    // Base score
    workloadMap[date].score += 2;

    // High priority adds more weight
    if (task.priority === 'high') {
      workloadMap[date].score += 3;
      workloadMap[date].highPriorityCount += 1;
    }
  });

  const suggestions = [];

  Object.entries(workloadMap).forEach(([date, data]) => {
    if (data.score >= 8) {
      const firstTaskTitle = data.tasks[0]?.title || 'this task';

      const smartSuggestions = [];

      // Suggest starting early
      smartSuggestions.push(
        `Start "${firstTaskTitle}" earlier to reduce last-minute pressure`
      );

      // Suggest redistribution
      if (data.tasks.length >= 3) {
        const lowPriorityTask = data.tasks.find(
          t =>
            t.priority !== 'high' &&
            t.title !== firstTaskTitle
      );

      if (lowPriorityTask) {
        const nextDay = new Date(data.tasks[0].due_at);
        nextDay.setDate(nextDay.getDate() + 1);

        smartSuggestions.push(
          `Suggested reschedule: Move "${lowPriorityTask.title}" to ${nextDay.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric'
          })}`
        );
      }
      }

      // Suggest task splitting
      if (data.highPriorityCount >= 2) {
        smartSuggestions.push(
          `Break large tasks into smaller study sessions`
        );
      }

      suggestions.push({
        date,
        level: data.score >= 12 ? 'high' : 'medium',
        score: data.score,
        taskCount: data.tasks.length,
        suggestions: smartSuggestions
      });
    }
  });

  return suggestions;
}