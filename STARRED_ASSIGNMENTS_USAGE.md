# Starred Assignments Feature - Usage Guide

## Overview
The starred assignments feature allows users to "favorite" assignments for quick access. Starred assignments appear at the top of the assignments page.

## Database
A new `starred_assignments` table tracks which assignments each user has starred. The table uses a simple design:
- If a row exists for `(user_id, moodle_assignment_id)`, the assignment is starred
- If no row exists, it's not starred
- UNIQUE constraint prevents duplicate stars

## Migration (For Existing Databases)
If you already have a database running, you need to add the new table:

```bash
node src/db/migrations/add_starred_assignments.js
```

New databases will automatically get the table from `schema.sql`.

## API Endpoints

### Get All Starred Assignments
```javascript
GET /api/starred-assignments
```
Returns array of starred assignments for the current user.

**Response:**
```json
{
  "starred": [
    {
      "id": 1,
      "moodle_assignment_id": "12345",
      "created_at": "2025-10-05T10:30:00.000Z"
    }
  ]
}
```

### Star an Assignment
```javascript
POST /api/starred-assignments
Content-Type: application/json

{
  "moodleAssignmentId": "12345"
}
```

**Response:**
```json
{
  "ok": true,
  "id": 1,
  "moodleAssignmentId": "12345"
}
```

### Unstar an Assignment
```javascript
DELETE /api/starred-assignments/:moodleAssignmentId
```

**Response:**
```json
{
  "ok": true
}
```

### Check if Assignment is Starred
```javascript
GET /api/starred-assignments/check/:moodleAssignmentId
```

**Response:**
```json
{
  "isStarred": true
}
```

## Frontend Usage

### Import the API Client
```javascript
import { api } from '../js/apiClient.js';
```

### Example: Star an Assignment
```javascript
async function starAssignment(assignmentId) {
  try {
    const result = await api.starredAssignments.star(assignmentId);
    console.log('Assignment starred!', result);
  } catch (error) {
    console.error('Failed to star assignment:', error);
  }
}
```

### Example: Unstar an Assignment
```javascript
async function unstarAssignment(assignmentId) {
  try {
    await api.starredAssignments.unstar(assignmentId);
    console.log('Assignment unstarred!');
  } catch (error) {
    console.error('Failed to unstar assignment:', error);
  }
}
```

### Example: Get All Starred Assignments
```javascript
async function loadStarredAssignments() {
  try {
    const { starred } = await api.starredAssignments.getAll();
    console.log('Starred assignments:', starred);

    // Extract just the IDs for easy lookup
    const starredIds = starred.map(s => s.moodle_assignment_id);
    return starredIds;
  } catch (error) {
    console.error('Failed to load starred assignments:', error);
    return [];
  }
}
```

### Example: Check if Assignment is Starred
```javascript
async function isAssignmentStarred(assignmentId) {
  try {
    const { isStarred } = await api.starredAssignments.check(assignmentId);
    return isStarred;
  } catch (error) {
    console.error('Failed to check starred status:', error);
    return false;
  }
}
```

### Example: Toggle Star (Star/Unstar)
```javascript
async function toggleStarAssignment(assignmentId, isCurrentlyStarred) {
  try {
    if (isCurrentlyStarred) {
      await api.starredAssignments.unstar(assignmentId);
      return false; // now unstarred
    } else {
      await api.starredAssignments.star(assignmentId);
      return true; // now starred
    }
  } catch (error) {
    console.error('Failed to toggle star:', error);
    throw error;
  }
}
```

## UI Implementation Tips

### Adding a Star Button to Assignment Cards
```javascript
// In your assignment rendering code
function renderAssignment(assignment) {
  const isStarred = starredIds.includes(assignment.id);

  return `
    <div class="assignment-card">
      <h3>${assignment.title}</h3>
      <button
        onclick="handleStarClick('${assignment.id}')"
        class="star-button ${isStarred ? 'starred' : ''}"
      >
        ${isStarred ? '⭐' : '☆'}
      </button>
    </div>
  `;
}

async function handleStarClick(assignmentId) {
  const isStarred = starredIds.includes(assignmentId);

  try {
    const newStarState = await toggleStarAssignment(assignmentId, isStarred);

    // Update local state
    if (newStarState) {
      starredIds.push(assignmentId);
    } else {
      const index = starredIds.indexOf(assignmentId);
      if (index > -1) starredIds.splice(index, 1);
    }

    // Re-render the page
    renderAssignments();
  } catch (error) {
    alert('Failed to update starred status');
  }
}
```

### Displaying Starred Assignments Section
```javascript
async function renderStarredSection() {
  const { starred } = await api.starredAssignments.getAll();
  const starredIds = starred.map(s => s.moodle_assignment_id);

  // Get full assignment details from your work items
  const { workItems } = await api.work(); // or however you fetch assignments

  // Filter to get only starred assignments
  const starredAssignments = workItems.filter(item =>
    starredIds.includes(item.id)
  );

  // Render them in the starred section
  const container = document.getElementById('starredAssignments');
  if (starredAssignments.length === 0) {
    container.innerHTML = '<p>No starred assignments yet</p>';
  } else {
    container.innerHTML = starredAssignments.map(renderAssignmentCard).join('');
  }
}
```

## Notes
- All endpoints require authentication (user must be logged in)
- Starred status is per-user (User A's stars don't affect User B)
- Deleting a user automatically removes all their starred assignments (CASCADE)
- Trying to star an already-starred assignment returns success (idempotent)
- Trying to unstar a non-starred assignment returns 404

## Next Steps for Implementation
1. Add star button UI to assignment cards
2. Load starred assignments on page load
3. Display starred section at top of assignments page
4. Add visual indication (filled/unfilled star icon)
5. Consider adding keyboard shortcuts (e.g., 'S' to star selected assignment)
