# MyCalendar Backend API Documentation

## Overview
This document provides a comprehensive guide to the MyCalendar backend API structure and endpoints. The backend integrates with Moodle LMS to provide course data, assignments, quizzes, and calendar events for building educational applications.

## Architecture Overview

### Backend Structure
```
src/
├── routes/api.js          # Main API endpoints
├── services/aggregator.js # Data aggregation and business logic
├── moodle/api.js         # Moodle API integration layer
├── lib/moodleClient.js   # HTTP client for Moodle REST API
├── middleware/sessionAuth.js # Session authentication middleware
└── config.js             # Configuration settings
```

### Key Components
- **Express.js Server**: RESTful API server with session management
- **Moodle Integration**: Connects to Moodle LMS via REST API
- **Session Management**: User authentication and data caching
- **Data Aggregation**: Combines multiple Moodle endpoints into useful data structures

## API Endpoints

### Base URL
```
http://localhost:3000/api
```

### Authentication
All endpoints (except login) require a valid session. Sessions are managed via cookies and include a Moodle token.

---

## 1. Authentication Endpoints

### POST `/api/login`
**Purpose**: Authenticate user and initialize session with Moodle token

**Request Body**:
```json
{
  "name": "Student Name",
  "token": "your_moodle_token_here"
}
```

**Response**:
```json
{
  "ok": true,
  "me": {
    "name": "Student Name",
    "userid": 12345,
    "sitename": "Coastal Carolina University",
    "username": "student_username"
  }
}
```

**Use Cases for User Stories**:
- User login flow
- Session initialization
- User profile setup

---

### POST `/api/logout`
**Purpose**: Destroy user session

**Response**:
```json
{
  "ok": true
}
```

---

### GET `/api/me`
**Purpose**: Get current user information and refresh session data

**Response**:
```json
{
  "name": "Student Name",
  "userid": 12345,
  "sitename": "Coastal Carolina University",
  "username": "student_username"
}
```

**Use Cases for User Stories**:
- User profile display
- Session validation
- Dashboard header information

---

## 2. Course Data Endpoints

### GET `/api/courses`
**Purpose**: Get all enrolled courses with progress and grades

**Response**:
```json
{
  "courses": [
    {
      "id": 9267,
      "name": "Introduction to Computer Science",
      "image": "https://moodle.example.com/pluginfile.php/123/course/overviewfiles/courseimage.jpg",
      "startdate": 1693526400,
      "enddate": 1701388800,
      "progress": 75,
      "grade": "95.00 %"
    }
  ]
}
```

**Data Fields**:
- `id`: Course ID (use for filtering other endpoints)
- `name`: Full course name
- `image`: Course thumbnail URL
- `startdate`/`enddate`: Unix timestamps
- `progress`: Completion percentage (0-100)
- `grade`: Formatted grade string

**Use Cases for User Stories**:
- Course dashboard/cards view
- Progress tracking
- Grade monitoring
- Course selection for detailed views

---

## 3. Work Items Endpoints

### GET `/api/work`
**Purpose**: Get all assignments and quizzes across all courses

**Response**:
```json
{
  "courses": [
    {
      "courseId": 9267,
      "assignments": [
        {
          "type": "assign",
          "id": 60890,
          "cmid": 12345,
          "courseId": 9267,
          "name": "Programming Assignment 1",
          "dueAt": 1696128000,
          "cutoffAt": 1696214400
        }
      ],
      "quizzes": [
        {
          "type": "quiz",
          "id": 29431,
          "courseId": 9267,
          "name": "Midterm Exam",
          "dueAt": 1696723200,
          "openAt": 1696636800
        }
      ]
    }
  ]
}
```

### GET `/api/work?courseId=9267`
**Purpose**: Get work items for a specific course

**Response**:
```json
{
  "courseId": 9267,
  "assignments": [...],
  "quizzes": [...]
}
```

**Data Fields**:
- `type`: "assign" or "quiz"
- `id`: Assignment/Quiz ID
- `cmid`: Course module ID
- `courseId`: Parent course ID
- `name`: Assignment/Quiz title
- `dueAt`: Due date (Unix timestamp)
- `cutoffAt`: Late submission cutoff (assignments only)
- `openAt`: Open date (quizzes only)

**Use Cases for User Stories**:
- Assignment lists
- Quiz schedules
- Due date tracking
- Course-specific work views
- To-do list generation
- Progress tracking

---

## 4. Calendar Endpoints

### GET `/api/calendar`
**Purpose**: Get all due dates as calendar events

**Response**:
```json
{
  "events": [
    {
      "id": "assign:60890",
      "courseId": 9267,
      "title": "Programming Assignment 1",
      "type": "assign",
      "dueAt": 1696128000
    },
    {
      "id": "quiz:29431",
      "courseId": 9267,
      "title": "Midterm Exam",
      "type": "quiz",
      "dueAt": 1696723200
    }
  ]
}
```

**Data Fields**:
- `id`: Unique event ID (format: "type:id")
- `courseId`: Parent course ID
- `title`: Event title
- `type`: "assign" or "quiz"
- `dueAt`: Due date (Unix timestamp)

**Use Cases for User Stories**:
- Calendar views (monthly, weekly, daily)
- Due date notifications
- Event scheduling
- Deadline tracking
- Timeline views

---

## Data Integration Patterns

### Course Color Mapping
The system supports course-specific color coding via the preferences system:

```json
{
  "courseColors": {
    "9267": "#4F46E5",
    "8186": "#16A34A",
    "7302": "#DB2777"
  }
}
```

### Event Customization
Individual events can be customized:

```json
{
  "eventOverrides": {
    "assign:60890": { 
      "color": "#2563EB", 
      "textColor": "#FFFFFF" 
    }
  }
}
```

---

## User Story Development Guide

### 1. Calendar Features
**Data Sources**: `/api/calendar`, `/api/courses`
**Example Stories**:
- "As a student, I want to see all my assignment due dates in a monthly calendar view"
- "As a student, I want to color-code calendar events by course"
- "As a student, I want to see upcoming deadlines in the next 7 days"

### 2. Assignment Management
**Data Sources**: `/api/work`, `/api/courses`
**Example Stories**:
- "As a student, I want to see all my assignments sorted by due date"
- "As a student, I want to filter assignments by course"
- "As a student, I want to see which assignments are overdue"

### 3. Progress Tracking
**Data Sources**: `/api/courses`, `/api/work`
**Example Stories**:
- "As a student, I want to see my overall progress across all courses"
- "As a student, I want to track completion of assignments and quizzes"
- "As a student, I want to see my grades for each course"

### 4. Course Management
**Data Sources**: `/api/courses`, `/api/me`
**Example Stories**:
- "As a student, I want to see all my enrolled courses with key information"
- "As a student, I want to access course materials and assignments"
- "As a student, I want to see course start and end dates"

### 5. Notification Systems
**Data Sources**: `/api/calendar`, `/api/work`
**Example Stories**:
- "As a student, I want to receive notifications for upcoming due dates"
- "As a student, I want to see a count of pending assignments"
- "As a student, I want to be reminded of quiz opening times"

---

## Technical Implementation Notes

### Session Management
- Sessions are stored server-side with 8-hour expiration
- Moodle tokens are cached in sessions to reduce API calls
- Course data is cached after initial bootstrap

### Error Handling
- All endpoints return consistent error format: `{"error": "message"}`
- HTTP status codes: 400 (client error), 401 (unauthorized), 500 (server error)
- Moodle API errors are wrapped and returned as user-friendly messages

### Performance Considerations
- Course data is cached in session after bootstrap
- Multiple Moodle API calls are batched where possible
- Grade data is fetched per course to avoid large payloads

### Data Freshness
- Session data is refreshed on `/api/me` calls
- Course data is cached but can be refreshed by re-bootstrapping
- Real-time data (assignments, quizzes) is fetched fresh on each request

---

## Example Frontend Integration

### Fetching Course Data
```javascript
// Get all courses
const response = await fetch('/api/courses');
const { courses } = await response.json();

// Display course cards
courses.forEach(course => {
  console.log(`${course.name}: ${course.grade} (${course.progress}% complete)`);
});
```

### Building a Calendar
```javascript
// Get calendar events
const response = await fetch('/api/calendar');
const { events } = await response.json();

// Convert to calendar format
const calendarEvents = events.map(event => ({
  id: event.id,
  title: event.title,
  start: new Date(event.dueAt * 1000),
  color: getCourseColor(event.courseId)
}));
```

### Creating a To-Do List
```javascript
// Get work items
const response = await fetch('/api/work');
const { courses } = await response.json();

// Flatten and sort by due date
const allWork = courses.flatMap(course => [
  ...course.assignments,
  ...course.quizzes
]).sort((a, b) => (a.dueAt || 0) - (b.dueAt || 0));
```