// ── Tasks Due Today (left-col, above status-report) ──────────────────────────
// Depends on: js/config.js (githubFetch, esc)
//
// Fetches my_home_page/runtime/due_today.json from the agent repository via
// GitHub Contents API and renders it as a collapsible section styled
// identically to the status report (mr-body / mr-list / mr-item classes).
//
// Each task row includes an @ mention button (when the task has an issue
// number extracted from "(#N)" in the task text). Clicking it invokes
// window.setMention() from note.js to open the mention + Done flow.

(function () {
  const DT_PATH = 'my_home_page/runtime/due_today.json';

  async function fetchDueToday() {
    const text = await githubFetch(DT_PATH);
    return JSON.parse(text);
  }

  // Extract issue number from "(#N)" pattern in task text.
  // Returns null if not found.
  function extractIssueNumber(taskText) {
    const m = taskText.match(/\(#(\d+)\)/);
    return m ? parseInt(m[1], 10) : null;
  }

  // Clean task text for display:
  //   - Remove leading YYYY-MM-DD date prefix
  //   - Remove [Role] tags like [Todo], [Memo], etc.
  //   - Remove "(#N)" issue reference suffix
  function cleanTaskText(taskText) {
    return taskText
      .replace(/^\d{4}-\d{2}-\d{2}\s+/, '')   // leading date
      .replace(/\[[\w\s]+\]\s*/g, '')           // [Role] tags
      .replace(/\s*\(#\d+\)\s*$/, '')           // trailing (#N)
      .trim();
  }

  function renderDueToday(data) {
    const section = document.getElementById('due-today');
    if (!section) return;

    const today = new Date().toISOString().slice(0, 10);
    // Ignore stale files (generated for a different date)
    if (data.date && data.date !== today) {
      section.style.display = 'none';
      return;
    }

    const tasks = (data.tasks || []);
    if (tasks.length === 0) {
      section.style.display = 'none';
      return;
    }

    const count = tasks.length;

    // ── Build the section shell (same structure as status report) ──────────────
    const wrapper = document.createElement('div');
    wrapper.className = 'mr-body dt-body-wrap';

    // Header row (collapsible, same look as mr-cat but with badge + arrow)
    const header = document.createElement('div');
    header.className = 'dt-header';
    header.innerHTML = `
      <span class="dt-title">Tasks Due Today</span>
      <span class="dt-badge">${count}</span>
      <span class="dt-arrow">&#9660;</span>
    `;
    wrapper.appendChild(header);

    // Task list — reuse mr-list / mr-item exactly as status report does
    const ul = document.createElement('ul');
    ul.className = 'mr-list dt-task-list';

    tasks.forEach(t => {
      const issueNum = t.issue_number ?? extractIssueNumber(t.task);
      const cleanText = cleanTaskText(t.task);
      const displayText = issueNum != null ? `${cleanText} (#${issueNum})` : cleanText;
      const isOverdue = !!t.overdue;

      const li = document.createElement('li');
      li.className = 'mr-item dt-task-item' + (isOverdue ? ' dt-task--overdue' : '');

      const bullet = document.createElement('span');
      bullet.className = 'mr-bullet';
      bullet.textContent = '-';
      li.appendChild(bullet);

      const badge = document.createElement('span');
      badge.className = 'dt-label-badge';
      badge.textContent = (t.label || t.key || '').replace(/_/g, ' ');
      li.appendChild(badge);

      const textSpan = document.createElement('span');
      textSpan.className = 'mr-item-text';
      textSpan.textContent = displayText;
      li.appendChild(textSpan);

      if (issueNum != null) {
        const mentionBtn = document.createElement('button');
        mentionBtn.className = 'mr-mention-btn';
        mentionBtn.textContent = '@';
        mentionBtn.title = 'メンションしてメモを書く';
        mentionBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (typeof window.setMention === 'function') {
            window.setMention({
              title: displayText,
              section: t.label || t.key || '',
              number: issueNum,
              sourceLabel: null,
            });
          }
        });
        li.appendChild(mentionBtn);
      }

      ul.appendChild(li);
    });

    wrapper.appendChild(ul);
    section.innerHTML = '';
    section.appendChild(wrapper);
    section.style.display = '';

    // Toggle collapse on header click
    header.addEventListener('click', () => {
      section.classList.toggle('dt-collapsed');
    });
  }

  async function initDueToday() {
    const section = document.getElementById('due-today');
    if (!section) return;
    try {
      const data = await fetchDueToday();
      renderDueToday(data);
    } catch (_) {
      // Silently hide on any error
      section.style.display = 'none';
    }
  }

  document.addEventListener('DOMContentLoaded', initDueToday);
})();
