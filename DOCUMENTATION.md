## 1. Getting Started

### 1.1 Prerequisites

* Node.js v14 or higher (npm included)
* Internet connection (needed for Moodle integration)
* Moodle token / login hash provided by a team member

### 1.2 Setup and Run

1. **Clone the repository:**

   ```bash
   git clone https://github.com/CCU-Computing/490-project-mycalendar.git
   cd MyCalander
   ```

2. **Install dependencies:**

   ```bash
   npm install
   ```

3. **Start the development server:**

   ```bash
   npm run dev
   ```

   The app will run at:
   [http://localhost:3000](http://localhost:3000)

4. **Log in:**

   * Ask a developer for your Moodle token or account hash.
   * Use that token on the login page.
   * Sessions currently last about **8 hours** before you need to log in again.

### 1.3 How Authentication Works (High Level)

1. The user logs in using a Moodle token.
2. The backend sends that token to the Moodle REST API and checks that it is valid.
3. If it is valid, the backend creates a session with basic user info (ID, name, email, token).
4. That session is used for future Moodle API calls until it expires.

---

## 2. Code Organization and Architecture

The project uses a **Node/Express backend**, a **JavaScript + Tailwind frontend**, and a small **SQLite** database.

### 2.1 Top-Level Structure

```text
MyCalander/
├── server/      (Express server entry point and configuration)
├── src/         (Backend application logic)
├── client/      (Frontend pages, JavaScript, and components)
├── package.json
```

### 2.2 Backend (Node/Express + SQLite)

**`server/server.js`**

* Starts the Express server.
* Sets up JSON parsing, sessions, and static file serving.
* Connects route modules and initializes the database.

**`src/config.js`**

* Stores Moodle API configuration (base URL, response format, etc.).

**`src/lib/moodleClient.js` and `src/moodle/api.js`**

* Wrap Moodle REST API calls in functions such as:

  * `getSiteInfo`
  * `getInProgressCourses`
  * `getAssignments`
  * `getQuizzes`
  * and others.
* Handle HTTP requests, parameters, and basic error handling.

**`src/services/`**

* `aggregator.js`

  * Turns raw Moodle data into:

    * Course cards
    * Calendar events
    * Grouped work items by course

* `cacheManager.js`

  * Handles in-memory caching so we do not call Moodle more than necessary.

**`src/routes/`**

* `api.js`: Main API endpoints like:

  * `/api/login`
  * `/api/calendar`
  * `/api/courses`
  * etc.
* Other route files handle:

  * Preferences
  * Custom events
  * Time blocks
  * Focus mode
  * Analytics
  * User assignments and starred assignments

**`src/db/`**

* `schema.sql`: SQLite schema for users, preferences, events, and related data.
* `init.js`: Sets up the database and runs the schema.
* `users.js`: Helper functions for user records and Moodle tokens.

**`src/prefs/store.js`**

* Helper functions for getting and setting user preferences (colors, overrides, etc.).

### 2.3 Frontend (JavaScript + Tailwind + FullCalendar)

**`client/pages/`**

Contains the HTML pages such as:

* Dashboard
* Calendar
* Assignments
* Classes
* Focus Mode
* Analytics
* Settings
* GPA
* Todo
* Notifications

Each main page usually has a matching JavaScript file in `client/js/`.

**`client/js/`**

* `apiClient.js`: Central file for making API calls to the backend, with simple caching.
* `dashboard.js`, `calendar.js`, `assignments.js`, etc.: Page-specific logic.
* `nav.js`, `partials.js`, `theme.js`: Navigation, loading shared partials, and theme (dark/light mode).

**`client/components/`**

Reusable UI parts, including:

* `Calendar.js` (FullCalendar integration)
* `ClassList.js`, `AssignmentList.js`, `UpcomingAssignments.js`
* Modals for assignment details, study blocks, and personal events
* Utility pieces like a timer, stopwatch, toast messages, and ICS export

### 2.4 Typical Request Flow (Example: Calendar)

1. The user opens the Dashboard or Calendar page in the browser.
2. The frontend calls `GET /api/calendar` (among others).
3. The backend uses the Moodle client and aggregator service to pull and transform Moodle data plus personal preference/custom event data.
4. The backend returns calendar events and preferences.
5. The frontend renders the FullCalendar instance using that data.

---

## 3. Backlog – Unassigned User Stories

These features are planned but not yet implemented or fully finished. They are not assigned to any specific developer yet.

1. **To-Do / Notes Page**
   As a user, I want a dedicated to-do/notes page where I can take bullet notes so I can remember tasks I want to complete.

2. **Assignment Tags or Labels**
   As a user, I want to tag assignments (for example: “Exam,” “Reading,” “Group Work”) so I can organize and filter my workload beyond just course grouping.

3. **Dedicated Exams Page**
   As a user, I want a page that only shows quizzes and exams so I can quickly see major assessments coming up.

4. **Health / Status Indicator Page**
   As a student, I want a health/status page that checks whether MyCalendar or Moodle is down so I can tell if the problem is on my side or with the system.

---

## 4. Completed User Stories

> **Note:** If a feature lists Evan together with another developer, that usually means Evan helped fix bugs or finish the final implementation steps for that feature, not that it is his user story.

* Moodle Backend Integration and Aggregation Service – **Evan**
* Data Caching System – **Evan**
* Calendar Custom Colors (changing the calendar component to correctly apply set colors, another team member created the actual functionality) – **Evan**
* FullCalendar Component Migration – **Evan**
* Classes / Course Management Page – **Evan**
* ClassList Component (course list display) – **Evan**
* Assignments Page – **Zach / Evan**
* Adding grade viewing and comment viewing to backend routes – **Evan**
* Analytics / Grade Analytics Page – **Evan**
* Focus Mode Page – **Evan**
* Study Time Scheduling – **Evan**
* GPA Calculator – **Josh, Evan**
* Event Adder (Personal Events) – **Josh, Evan**
* To-Do Page (Placeholder page, awaiting API backend logic) – **Zach**
* Upcoming Assignments Display – **Zach, Evan**
* Calendar Holidays Display – **Zach**
* Calendar Export (.ics format) – **Trent**
* Dark Mode Theme – **Trent**
* Course Progress Bar – **Trent**
* Color Coding by Assignment Type – **Trent**
* Custom Course Images – **Trent**
* Custom Colors for Classes – **Trent**
* Loading States / Skeleton Screens – **Daniel Argoe**
* Toast Notifications – **Daniel Argoe**
* Assignment Type and Course Filtering – **Daniel Argoe**
* Filter by Course – **Daniel Argoe**
* Stopwatch and Timer (for Focus Mode page) – **Zach**
* Assignment Difficulty Rating – **Zach**
* Notifications Page – **Zach**

---

## 5. Test Plan

Right now there are **no automated unit tests** in the project. All testing is done manually through the web interface. Below is the current test plan.

### 5.1 Core Smoke Tests

* Log in with a valid Moodle token and confirm that a session is created.
* Make sure the dashboard loads with the calendar and course cards.
* Navigate between the main pages (Dashboard, Calendar, Assignments, Classes, Focus Mode, Settings) and confirm there are no major errors.

### 5.2 Calendar and Assignment Tests

* Check that all assignments and quizzes appear on the calendar with the correct dates and times.
* Click a calendar event and confirm that the assignment details modal shows the correct information.
* Confirm that course and event colors match the saved user preferences.
* On the Assignments page, test that sorting and filtering options work as expected.

### 5.3 Focus Mode and Analytics

* Open Focus Mode and confirm it shows today’s items and any existing study blocks.
* Start a focus timer and make sure it counts down correctly.
* Open the analytics page and check that summary numbers and charts render without obvious errors.

### 5.4 Preferences and Theme

* Change course colors in settings and confirm the changes are still there after reloading the page.
* Toggle dark/light mode and make sure the theme applies across all main pages.

### 5.5 Moodle Integration

* After updating assignments in Moodle (for example, adding or changing a due date), confirm that MyCalendar pulls the updated data.
* For at least one course, compare grades and submission statuses between Moodle and MyCalendar to make sure they match.

---

## 6. Limitations, Known Issues, and Bugs

### 6.1 Limitations

1. **Moodle-Only Data**
   If a course uses outside tools (like Cengage) and those tools do not sync back to Moodle, those assignments will not show up in MyCalendar.

2. **Instructor Data Dependency**
   If an instructor does not put assignments, quizzes, or grades into Moodle, MyCalendar cannot display them. We depend completely on what is in Moodle.

3. **Session Expiration**
   User sessions expire after about 8 hours. After that, the user needs to log in again with a valid Moodle token.

4. **Cached Data**
   To reduce the number of Moodle API calls, some data is cached. This means the app may show slightly older data for a short time until the cache refreshes.

### 6.2 Known Issues / Bugs

* At this time, there are **no specific bugs**.