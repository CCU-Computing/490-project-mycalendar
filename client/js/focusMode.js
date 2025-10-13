import { api } from "./apiClient.js";

// Get URL parameters
const urlParams = new URLSearchParams(window.location.search);
const itemId = urlParams.get('id');
const itemType = urlParams.get('type');

// DOM elements
const focusHub = document.getElementById('focusHub');
const focusSession = document.getElementById('focusSession');

// Auto-save interval for notes
let notesAutoSaveInterval = null;

// Current item data
let currentItem = null;

/**
 * Initialize the page based on URL parameters
 */
async function init() {
  // Check if user is logged in
  const userName = sessionStorage.getItem("mc_userName");
  const userChip = document.getElementById("userChip");

  if (!userName) {
    window.location.href = "./login.html";
    return;
  }

  if (userChip) {
    userChip.textContent = "Hi, " + userName;
  }

  if (!itemId || !itemType) {
    // Show today's focus hub
    focusHub.classList.remove('hidden');
    await loadTodaysFocus();
  } else {
    // Show individual focus session
    focusSession.classList.remove('hidden');
    await loadFocusSession(itemId, itemType);
  }
}

/**
 * Load today's items (assignments, quizzes, study blocks)
 */
async function loadTodaysFocus() {
  try {
    const data = await api.focusMode.getToday();

    const { assignments, quizzes, studyBlocks } = data;
    const hasItems = assignments.length > 0 || quizzes.length > 0 || studyBlocks.length > 0;

    if (!hasItems) {
      document.getElementById('emptyState').classList.remove('hidden');
      return;
    }

    // Render assignments
    if (assignments.length > 0) {
      document.getElementById('assignmentsSection').classList.remove('hidden');
      renderItemCards(assignments, 'assignment', document.getElementById('assignmentsList'));
    }

    // Render quizzes
    if (quizzes.length > 0) {
      document.getElementById('quizzesSection').classList.remove('hidden');
      renderItemCards(quizzes, 'quiz', document.getElementById('quizzesList'));
    }

    // Render study blocks
    if (studyBlocks.length > 0) {
      document.getElementById('studyBlocksSection').classList.remove('hidden');
      renderStudyBlockCards(studyBlocks, document.getElementById('studyBlocksList'));
    }

  } catch (error) {
    console.error('Error loading today\'s focus:', error);
    alert('Failed to load today\'s items. Please try again.');
  }
}

/**
 * Render item cards (assignments/quizzes)
 */
function renderItemCards(items, type, container) {
  container.innerHTML = items.map(item => {
    const dueDate = new Date(item.dueAt * 1000);
    const timeStr = dueDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const typeColor = type === 'assignment' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700';
    const typeLabel = type === 'assignment' ? '📝 Assignment' : '📊 Quiz';

    return `
      <button
        onclick="window.location.href='./focusMode.html?id=${encodeURIComponent(item.id)}&type=${encodeURIComponent(type)}'"
        class="text-left w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
      >
        <div class="flex items-start justify-between mb-3">
          <h3 class="text-base font-semibold text-slate-900 pr-2">${escapeHtml(item.title)}</h3>
          <span class="inline-flex items-center gap-1 rounded-lg ${typeColor} px-2 py-1 text-xs font-medium whitespace-nowrap">
            ${typeLabel}
          </span>
        </div>
        <div class="space-y-1 text-sm text-slate-600">
          <div class="flex items-center gap-2">
            <span>⏰</span>
            <span>Due today at ${timeStr}</span>
          </div>
        </div>
      </button>
    `;
  }).join('');
}

/**
 * Render study block cards
 */
function renderStudyBlockCards(studyBlocks, container) {
  container.innerHTML = studyBlocks.map(block => {
    const startDate = new Date(block.startTime);
    const endDate = block.endTime ? new Date(block.endTime) : null;

    const startTimeStr = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    const endTimeStr = endDate ? endDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }) : '';

    return `
      <button
        onclick="window.location.href='./focusMode.html?id=${encodeURIComponent(block.id)}&type=study-block'"
        class="text-left w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-indigo-300 transition-all"
      >
        <div class="flex items-start justify-between mb-3">
          <h3 class="text-base font-semibold text-slate-900 pr-2">${escapeHtml(block.title)}</h3>
          <span class="inline-flex items-center gap-1 rounded-lg bg-green-100 text-green-700 px-2 py-1 text-xs font-medium whitespace-nowrap">
            📚 Study Block
          </span>
        </div>
        <div class="space-y-1 text-sm text-slate-600">
          <div class="flex items-center gap-2">
            <span>⏰</span>
            <span>${startTimeStr}${endTimeStr ? ' - ' + endTimeStr : ''}</span>
          </div>
          ${block.description ? `
            <div class="flex items-start gap-2 mt-2">
              <span>📋</span>
              <span class="text-xs">${escapeHtml(block.description)}</span>
            </div>
          ` : ''}
        </div>
      </button>
    `;
  }).join('');
}

/**
 * Load individual focus session
 */
async function loadFocusSession(id, type) {
  try {
    // Get item details
    const { item } = await api.focusMode.getItem(id, type);
    currentItem = { ...item, id, type };

    // Render item details
    await renderItemDetails(item, type);

    // Load notes
    await loadNotes(id, type);

    // Load session history
    await loadSessionHistory(id, type);

    // Setup notes auto-save
    setupNotesAutoSave();

    // Setup markdown preview
    setupMarkdownPreview();

    // Setup markdown toolbar
    setupMarkdownToolbar();

  } catch (error) {
    console.error('Error loading focus session:', error);
    alert('Failed to load item details. Please try again.');
  }
}

/**
 * Render item details header
 */
async function renderItemDetails(item, type) {
  const titleEl = document.getElementById('itemTitle');
  const metaEl = document.getElementById('itemMeta');
  const badgeEl = document.getElementById('itemTypeBadge');
  const descEl = document.getElementById('itemDescription');
  const starBtn = document.getElementById('itemStarButton');

  titleEl.textContent = item.title;

  // Type badge
  let badgeClass = '';
  let badgeText = '';
  if (type === 'assignment' || type === 'assign') {
    badgeClass = 'bg-blue-100 text-blue-700';
    badgeText = '📝 Assignment';
  } else if (type === 'quiz') {
    badgeClass = 'bg-purple-100 text-purple-700';
    badgeText = '📊 Quiz';
  } else if (type === 'study-block') {
    badgeClass = 'bg-green-100 text-green-700';
    badgeText = '📚 Study Block';
  }
  badgeEl.className = `inline-flex items-center gap-1 rounded-lg ${badgeClass} px-3 py-1 text-sm font-medium`;
  badgeEl.textContent = badgeText;

  // Show star button only for assignments and quizzes
  if ((type === 'assignment' || type === 'assign' || type === 'quiz') && starBtn) {
    starBtn.classList.remove('hidden');

    // Check and set star status
    try {
      const { isStarred } = await api.starredAssignments.check(item.id);
      starBtn.textContent = isStarred ? '⭐' : '☆';
      starBtn.title = isStarred ? 'Unstar assignment' : 'Star assignment';
    } catch (error) {
      console.error('Error checking star status:', error);
      starBtn.textContent = '☆';
      starBtn.title = 'Star assignment';
    }

    // Add click handler
    starBtn.addEventListener('click', handleStarToggle);
  }

  // Meta information
  const metaItems = [];

  if (item.dueAt) {
    const dueDate = new Date(item.dueAt * 1000);
    const dateStr = dueDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const timeStr = dueDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    metaItems.push(`<span>⏰ Due: ${dateStr} at ${timeStr}</span>`);
  }

  if (item.startTime) {
    const startDate = new Date(item.startTime);
    const timeStr = startDate.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    metaItems.push(`<span>⏰ Starts: ${timeStr}</span>`);
  }

  if (item.courseId) {
    metaItems.push(`<span>📚 Course ID: ${item.courseId}</span>`);
  }

  metaEl.innerHTML = metaItems.join('<span class="text-slate-300">•</span>');

  // Description
  if (item.description) {
    descEl.textContent = item.description;
    descEl.classList.remove('hidden');
  }
}

/**
 * Load and display notes
 */
async function loadNotes(id, type) {
  try {
    const { notes } = await api.focusMode.notes.get(id, type);
    document.getElementById('notesTextarea').value = notes || '';
  } catch (error) {
    console.error('Error loading notes:', error);
  }
}

/**
 * Save notes
 */
async function saveNotes() {
  if (!currentItem) return;

  const notesTextarea = document.getElementById('notesTextarea');
  const notesStatus = document.getElementById('notesStatus');
  const notes = notesTextarea.value;

  try {
    notesStatus.textContent = 'Saving...';
    await api.focusMode.notes.save(currentItem.id, currentItem.type, notes);
    notesStatus.textContent = 'Saved ✓';
    setTimeout(() => {
      notesStatus.textContent = 'Notes will auto-save';
    }, 2000);
  } catch (error) {
    console.error('Error saving notes:', error);
    notesStatus.textContent = 'Failed to save';
    setTimeout(() => {
      notesStatus.textContent = 'Notes will auto-save';
    }, 2000);
  }
}

/**
 * Setup notes auto-save (every 30 seconds)
 */
function setupNotesAutoSave() {
  // Save button click
  document.getElementById('saveNotesBtn').addEventListener('click', saveNotes);

  // Auto-save every 30 seconds
  notesAutoSaveInterval = setInterval(() => {
    saveNotes();
  }, 30000);
}

/**
 * Load session history
 */
async function loadSessionHistory(id, type) {
  try {
    const { sessions } = await api.focusMode.sessions.getHistory(id, type);

    const sessionsList = document.getElementById('sessionsList');
    const noSessionsMsg = document.getElementById('noSessionsMsg');

    if (sessions.length === 0) {
      noSessionsMsg.classList.remove('hidden');
      return;
    }

    noSessionsMsg.classList.add('hidden');

    sessionsList.innerHTML = sessions.map(session => {
      const startDate = new Date(session.started_at);
      const duration = Math.floor(session.actual_duration_seconds / 60);
      const hours = Math.floor(duration / 60);
      const minutes = duration % 60;

      let durationStr = '';
      if (hours > 0) {
        durationStr = `${hours}h ${minutes}m`;
      } else {
        durationStr = `${minutes}m`;
      }

      const typeLabel = session.session_type === 'countdown' ? '⏱️ Countdown' : '⏲️ Timer';
      const completedLabel = session.completed ? '✅ Completed' : '⏸️ Stopped Early';

      return `
        <div class="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
          <div class="flex items-center gap-3">
            <span class="text-xs font-medium text-slate-600">${typeLabel}</span>
            <span class="text-sm text-slate-700">${durationStr}</span>
            <span class="text-xs text-slate-500">${completedLabel}</span>
          </div>
          <span class="text-xs text-slate-500">
            ${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${startDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
          </span>
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Error loading session history:', error);
  }
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Handle star toggle for assignments/quizzes
 */
async function handleStarToggle() {
  if (!currentItem || !currentItem.id) {
    console.error('[FocusMode] No item data available for starring');
    return;
  }

  const starBtn = document.getElementById('itemStarButton');
  if (!starBtn) return;

  try {
    // Check current star status
    const { isStarred } = await api.starredAssignments.check(currentItem.id);

    if (isStarred) {
      // Unstar
      await api.starredAssignments.unstar(currentItem.id);
      starBtn.textContent = '☆';
      starBtn.title = 'Star assignment';
      showNotification('Assignment unstarred');
    } else {
      // Star
      await api.starredAssignments.star(currentItem.id);
      starBtn.textContent = '⭐';
      starBtn.title = 'Unstar assignment';
      showNotification('Assignment starred!');
    }
  } catch (error) {
    console.error('Error toggling star:', error);
    showNotification('Failed to update star status');
  }
}

/**
 * Show a notification message
 */
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 px-4 py-3 rounded-lg bg-indigo-600 text-white shadow-lg z-50 transition-opacity';
  notification.textContent = message;

  document.body.appendChild(notification);

  setTimeout(() => {
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

/**
 * Setup markdown preview toggle
 */
function setupMarkdownPreview() {
  const toggleBtn = document.getElementById('togglePreviewBtn');
  const editMode = document.getElementById('notesEditMode');
  const previewMode = document.getElementById('notesPreviewMode');
  const preview = document.getElementById('notesPreview');
  const textarea = document.getElementById('notesTextarea');

  if (!toggleBtn || !editMode || !previewMode || !preview || !textarea) return;

  let isPreviewMode = false;

  toggleBtn.addEventListener('click', () => {
    isPreviewMode = !isPreviewMode;

    if (isPreviewMode) {
      // Show preview
      const markdownText = textarea.value;
      if (markdownText.trim()) {
        // Render markdown using marked.js
        preview.innerHTML = marked.parse(markdownText);
      } else {
        preview.innerHTML = '<p class="text-slate-400 italic">No notes yet. Start typing to see your markdown rendered here!</p>';
      }

      editMode.classList.add('hidden');
      previewMode.classList.remove('hidden');
      toggleBtn.textContent = '✏️ Edit';
    } else {
      // Show edit mode
      editMode.classList.remove('hidden');
      previewMode.classList.add('hidden');
      toggleBtn.textContent = '👁️ Preview';
    }
  });
}

/**
 * Setup markdown toolbar buttons
 */
function setupMarkdownToolbar() {
  const textarea = document.getElementById('notesTextarea');
  if (!textarea) return;

  // Helper function to insert markdown syntax
  const insertMarkdown = (before, after = '', placeholder = 'text') => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);
    const textToInsert = selectedText || placeholder;
    const newText = before + textToInsert + after;

    textarea.setRangeText(newText, start, end, 'end');
    textarea.focus();

    // Select the inserted text (or placeholder)
    if (!selectedText) {
      textarea.setSelectionRange(start + before.length, start + before.length + placeholder.length);
    }
  };

  // Bold
  document.getElementById('mdBold')?.addEventListener('click', () => {
    insertMarkdown('**', '**', 'bold text');
  });

  // Italic
  document.getElementById('mdItalic')?.addEventListener('click', () => {
    insertMarkdown('_', '_', 'italic text');
  });

  // Heading
  document.getElementById('mdHeading')?.addEventListener('click', () => {
    const start = textarea.selectionStart;
    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
    textarea.setSelectionRange(lineStart, lineStart);
    insertMarkdown('## ', '', 'Heading');
  });

  // Bullet List
  document.getElementById('mdList')?.addEventListener('click', () => {
    const start = textarea.selectionStart;
    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
    textarea.setSelectionRange(lineStart, lineStart);
    insertMarkdown('- ', '', 'List item');
  });

  // Numbered List
  document.getElementById('mdNumberList')?.addEventListener('click', () => {
    const start = textarea.selectionStart;
    const lineStart = textarea.value.lastIndexOf('\n', start - 1) + 1;
    textarea.setSelectionRange(lineStart, lineStart);
    insertMarkdown('1. ', '', 'List item');
  });

  // Code
  document.getElementById('mdCode')?.addEventListener('click', () => {
    insertMarkdown('`', '`', 'code');
  });

  // Link
  document.getElementById('mdLink')?.addEventListener('click', () => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = textarea.value.substring(start, end);

    if (selectedText) {
      insertMarkdown('[', '](url)', '');
    } else {
      insertMarkdown('[', '](url)', 'link text');
    }
  });

  // Keyboard shortcuts
  textarea.addEventListener('keydown', (e) => {
    // Ctrl+B or Cmd+B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault();
      insertMarkdown('**', '**', 'bold text');
    }

    // Ctrl+I or Cmd+I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault();
      insertMarkdown('_', '_', 'italic text');
    }
  });
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', init);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
  if (notesAutoSaveInterval) {
    clearInterval(notesAutoSaveInterval);
  }
});