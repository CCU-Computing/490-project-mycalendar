# Migration Plan: MyCalendar to React + Go
ENSURE THAT ON FIRST READ OF THIS FILE IN NEW CONVERSTIONS OR RESUMED ONES, THAT YOU REVIEW ALL FILES IN /SRC AAND /CLIENT AS THOSE ARE THE ONES THAT HOLD THE EXISTING WORKING LOGIC, YOU HAD AN ERROR WHEREB YOU USED AN INCORRECT BASE URL INA  CONFIG FILE FOR THIS GO CONVERSOIN WHEN IT WAS NOT THAT IN THE ACTUAL WORKING ORIGINAL BACKEND. 

## Project Overview
Converting MyCalendar application from:
- **Current**: Express.js + SQLite + Vanilla JS/React Components
- **Target**: Go Backend (React Frontend migration deferred)

## Phase 1: Understanding Current Architecture

### Current Stack Analysis
- **Backend**: Node.js/Express.js with 11 route modules, SQLite database (12 tables)
- **Frontend**: 12 HTML pages, 39 JS files, 22 React components (UMD builds)
- **External Integration**: Moodle REST API for course/assignment data
- **Authentication**: Session-based with express-session, bcrypt password hashing

### Key Components Identified
1. **11 API Route Modules** serving RESTful endpoints
2. **12 Frontend Pages** with navigation
3. **SQLite Schema** with foreign key constraints, indexes
4. **Moodle API Client** for external data fetching
5. **Caching Strategy** (server-side + client-side with TTL)
6. **Session Management** (8-hour cookie TTL)

## Phase 2: Backend Migration to Go

### Recommended Tech Stack

**Framework:** Chi Router (lightweight, idiomatic Go, excellent middleware composition)
**Database:** sqlx (direct SQL control, better for migration from existing queries)
**Sessions:** gorilla/sessions with SQLite store
**Password:** golang.org/x/crypto/bcrypt (same algorithm, compatible)
**Caching:** go-cache (simple in-memory TTL cache)
**HTTP Client:** net/http stdlib with custom Moodle wrapper

### Go Project Structure
```
mycalendar-go/
├── cmd/server/main.go              # Entry point
├── internal/
│   ├── config/config.go            # Environment config
│   ├── models/                     # Data models (12 tables)
│   ├── database/
│   │   ├── db.go                   # DB initialization
│   │   └── schema.sql              # SQLite schema (copy from src/db/)
│   ├── repository/                 # Database access layer
│   │   ├── user_repo.go
│   │   ├── preference_repo.go
│   │   ├── custom_event_repo.go
│   │   └── [8 more repos...]
│   ├── services/
│   │   ├── aggregator.go           # Data transformation (CRITICAL)
│   │   ├── cache.go                # Cache manager
│   │   └── moodle/
│   │       ├── client.go           # HTTP client
│   │       └── api.go              # Moodle API wrapper
│   ├── middleware/
│   │   └── auth.go                 # Session validation
│   └── handlers/                   # HTTP handlers (11 route files)
│       ├── auth.go
│       ├── api.go
│       └── [9 more handlers...]
└── data/mycalendar.db              # Shared SQLite database
```

### Migration Phases (11-week timeline)

**Phase 1: Foundation** (Week 1)
- Initialize Go project with dependencies
- Database layer with schema migration
- Configuration management
- Define all 12 model structs

**Phase 2: Authentication** (Week 2)
- User repository (migrate db/users.js)
- Session management with gorilla/sessions
- Auth handlers (register, login, logout, session)
- Auth middleware (session validation)

**Phase 3: Moodle Integration** (Week 3)
- HTTP client with array parameter support
- 8 Moodle API functions (GetCourses, GetAssignments, etc.)
- Cache manager with user-scoped TTL

**Phase 4: Data Aggregator** (Week 4) - MOST COMPLEX
- BootstrapSession, BuildCourseCards, BuildDueCalendar
- Grade enrichment logic
- Parallel Moodle API calls with goroutines
- Cache invalidation strategies

**Phase 5: Core API Routes** (Week 5)
- /api/login, /api/me, /api/courses, /api/calendar, /api/work
- Response format compatibility with frontend

**Phase 6: Preferences** (Week 6)
- Preference repository
- GET/PUT /api/prefs/* handlers

**Phase 7: Custom Events** (Week 7)
- Custom event repository
- Full CRUD for /api/custom-events

**Phase 8: Remaining Routes** (Week 8-9)
- User assignments, course metadata, time blocks
- Starred assignments, focus mode, ratings, analytics

**Phase 9: Static Serving** (Week 9)
- Serve React frontend from /client
- SPA fallback routing

**Phase 10: Testing** (Week 10)
- Unit tests (repository, service, handler layers)
- Integration tests (full API flows)
- Performance benchmarking vs Node.js

**Phase 11: Deployment** (Week 11)
- Docker containerization
- Logging, health checks, graceful shutdown

### Critical File Mapping

| Priority | Express File | Go File | Notes |
|----------|-------------|---------|-------|
| 1 | src/services/aggregator.js | services/aggregator.go | Most complex - 500+ lines |
| 2 | src/db/schema.sql | database/schema.sql | Copy as-is |
| 3 | server/server.js | cmd/server/main.go | Entry point, middleware stack |
| 4 | src/lib/moodleClient.js | services/moodle/client.go | Array param handling |
| 5 | src/routes/api.js | handlers/api.go | Main API routes |

### Migration Strategy: Incremental Rollout

1. **Parallel Deployment** - Run Go on port 3001, Node on 3000
2. **Shadow Traffic** - Route read-only endpoints to Go
3. **Write Operations** - Migrate auth and writes
4. **Full Migration** - All traffic to Go
5. **Decommission** - Remove Node.js server

### Performance Expectations
- 5x faster cached responses (10ms vs 50ms)
- 25-33% faster uncached responses (better HTTP client, parallel goroutines)
- 60% memory reduction (20MB vs 100MB idle)

## Scope: Go Backend Migration Only

**Frontend:** Keep existing vanilla JS + React components unchanged - fully stable and working
**Backend:** Migrate Express.js → Go, maintaining 100% API compatibility with current frontend

## Current Frontend Issues & Potential Improvements

Based on codebase analysis, the current frontend is stable but has a few areas that could be improved (optional):

1. **Cache Management Complexity** - `apiClient.js` (576 lines) has manual localStorage caching
   - Could benefit from simpler cache invalidation strategy
   - Current revalidation manager adds complexity
   - **Impact:** Low priority - works fine, just complex to maintain

2. **UMD Component Loading** - 22 React components use UMD builds loaded via CDN
   - Works but not optimal for bundle size
   - No tree-shaking benefits
   - **Impact:** Low priority - functional, just not optimized

3. **Theme Flash Prevention** - Complex `handle-theme-flash.js` to prevent flash on load
   - Could be simplified with better theme initialization
   - **Impact:** Very low priority - cosmetic only

4. **Error Handling** - Some pages lack comprehensive error boundaries
   - Could add global error handling for better UX
   - **Impact:** Medium priority if users report issues

**Recommendation:** Leave frontend as-is for now. Focus on Go backend migration. Address frontend improvements later if needed.

## Implementation Approach

**Database:** Keep SQLite (shared between Node.js and Go during migration)
**Migration Strategy:** Incremental rollout with parallel deployment
**Testing:** Comprehensive testing with existing frontend before full cutover

## Critical Implementation Details from Code Review

### 1. Moodle API Client - Array Parameter Handling
**Source:** [moodleClient.js:6-16](src/lib/moodleClient.js#L6-L16)

The Moodle client has special array parameter handling that MUST be replicated exactly:
```js
// Arrays become: key[0]=value1, key[1]=value2
if (Array.isArray(val)) {
  val.forEach((item, idx) => usp.append(`${key}[${idx}]`, String(item)));
}
```

**Go Implementation:**
```go
// services/moodle/client.go
func buildParams(params map[string]interface{}) url.Values {
    values := url.Values{}
    for key, val := range params {
        switch v := val.(type) {
        case []interface{}:
            for idx, item := range v {
                values.Add(fmt.Sprintf("%s[%d]", key, idx), fmt.Sprint(item))
            }
        case []string:
            for idx, item := range v {
                values.Add(fmt.Sprintf("%s[%d]", key, idx), item)
            }
        case []int:
            for idx, item := range v {
                values.Add(fmt.Sprintf("%s[%d]", key, idx), strconv.Itoa(item))
            }
        default:
            if val != nil {
                values.Add(key, fmt.Sprint(val))
            }
        }
    }
    return values
}
```

### 2. Course Grade Calculation Logic
**Source:** [aggregator.js:12-72](src/services/aggregator.js#L12-L72)

Complex grade calculation with fallback logic:
1. First try Moodle's course total (if valid, non-zero)
2. If invalid, calculate average from graded assignments/quizzes
3. Handle edge cases (no grades, null values)

**Critical:** This exact logic must be preserved in Go to match frontend expectations.

### 3. Database Schema
**Source:** [schema.sql](src/db/schema.sql)

- 12 tables with CASCADE DELETE on foreign keys
- 15 indexes for performance
- UNIQUE constraints on composite keys
- PRAGMA user_version = 1 for schema versioning

**Go Migration:** Use golang-migrate with exact SQL, enable foreign keys:
```go
db.Exec("PRAGMA foreign_keys = ON")
```

### 4. Session Cookie Configuration
**Source:** [server.js](server/server.js)

Current Express session config:
- httpOnly: true
- sameSite: "lax"
- maxAge: 28800000 (8 hours)
- secure: based on COOKIE_SECURE env var

**Go gorilla/sessions must match exactly** to maintain session compatibility during migration.

### 5. Error Response Format
All API errors return:
```json
{ "error": "Human-readable message" }
```

Go handlers must use identical format for frontend compatibility.

## Detailed Implementation Plan

### Week 1: Foundation & Setup

**Day 1-2: Project Initialization** ✅ COMPLETED
- [x] Create `mycalendar-go/` directory at project root
- [x] Initialize Go module: `go mod init mycalendar`
- [x] Install dependencies:
  ```bash
  go get github.com/go-chi/chi/v5
  go get github.com/jmoiron/sqlx
  go get github.com/mattn/go-sqlite3
  go get github.com/gorilla/sessions
  go get golang.org/x/crypto/bcrypt
  go get github.com/patrickmn/go-cache
  go get github.com/go-chi/cors
  ```
- [x] Create directory structure (see "Go Project Structure" above)

**Day 3-4: Database Layer** ✅ COMPLETED
- [x] Copy [schema.sql](src/db/schema.sql) to `internal/database/schema.sql`
- [x] Create `internal/database/db.go` with:
  - GetDB() singleton function
  - Connection pooling configuration
  - `PRAGMA foreign_keys = ON` enforcement
- [x] Define all 12 model structs in `internal/models/`:
  - User, UserPreference, CourseColor, EventOverride
  - AssignmentTypeColor, CustomEvent, UserAssignment
  - CourseMetadata, TimeBlock, StarredAssignment
  - FocusSession, FocusNote
- [x] Add struct tags: `db:"column_name" json:"jsonKey"`

**Day 5: Configuration** ✅ COMPLETED
- [x] Create `internal/config/config.go`:
  - MOODLE_BASE_URL from env
  - MOODLE_FORMAT (default: "json")
  - PORT (default: 3001 for parallel deployment)
  - SESSION_SECRET
  - COOKIE_SECURE flag
- [x] Use `godotenv` to load `.env` file
- [x] Create basic `cmd/server/main.go` with health check endpoint
- [x] Test server build and startup

**Week 1 Status:** ✅ COMPLETED - Foundation setup is complete. Server builds and runs successfully on port 3001.

### Week 2: Authentication & Sessions ✅ COMPLETED

**Day 1-2: User Repository** ✅ COMPLETED
- [x] Create `internal/repository/user_repo.go`
- [x] Migrate functions from [db/users.js](src/db/users.js):
  - CreateUser(email, firstName, lastName, passwordHash) → user ID
  - GetUserByEmail(email) → User struct
  - GetUserByID(id) → User struct
  - UpdateMoodleToken(userID, token) → error
  - VerifyPassword(hashedPassword, plainPassword) → bool
  - UpdateUser, ChangePassword, DeleteUser, GetAllUsers
- [x] Use bcrypt.GenerateFromPassword with cost 10
- [x] Use bcrypt.CompareHashAndPassword for verification

**Day 3-4: Session Management** ✅ COMPLETED
- [x] Configure gorilla/sessions in `cmd/server/main.go`
- [x] Created `internal/session/session.go` with session store initialization
- [x] Create session helper functions:
  - GetSession(r *http.Request) → session
  - SetUserSession(w, r, userID, email, token)
  - ClearSession(w, r)
  - GetUserID, GetMoodleToken, IsAuthenticated

**Day 5: Auth Handlers & Middleware** ✅ COMPLETED
- [x] Create `internal/handlers/auth.go`:
  - POST /auth/register → create user, set session
  - POST /auth/login → verify password, set session
  - POST /auth/logout → clear session
  - GET /auth/session → return session info
  - PUT /auth/moodle-token → update token
- [x] Create `internal/middleware/auth.go`:
  - RequireAuth() middleware
  - Check session.Values["moodleToken"] OR session.Values["userId"]
  - Return 401 with `{"error": "Not logged in"}` if missing
- [x] Wire up auth routes in main.go

**Week 2 Status:** ✅ COMPLETED - Authentication system is fully implemented. All auth endpoints are working, session management configured correctly.

### Week 3: Moodle Integration ✅ COMPLETED

**Day 1-2: HTTP Client** ✅ COMPLETED
- [x] Create `internal/services/moodle/client.go`
- [x] Implement `buildParams()` with array syntax for []interface{}, []string, []int, []int64
- [x] Implement `MoodleGet(token, wsfunction, params)`:
  - Build URL with query params
  - Add wstoken, moodlewsrestformat, wsfunction
  - Handle Moodle error responses: check for `json.exception`
  - Return error if response contains exception
- [x] Implement `MoodleGetArray()` for endpoints that return arrays

**Day 3-5: Moodle API Functions** ✅ COMPLETED
- [x] Create `internal/services/moodle/api.go`
- [x] Migrate 8 functions from [moodle/api.js](src/moodle/api.js):
  - GetSiteInfo(token) - core_webservice_get_site_info
  - GetInProgressCourses(token, limit, offset) - core_course_get_enrolled_courses_by_timeline_classification
  - GetAssignments(token, courseids) - mod_assign_get_assignments
  - GetQuizzes(token, courseids) - mod_quiz_get_quizzes_by_courses
  - GetUserGradeItems(token, courseid, userid) - gradereport_user_get_grade_items
  - GetAssignSubmissionStatus(token, assignid, userid) - mod_assign_get_submission_status
  - GetCourseContents(token, courseid) - core_course_get_contents
  - GetCourseCompletionStatuses(token, courseid, userid) - core_completion_get_activities_completion_status
- [x] Match exact wsfunction names and parameter structures

**Week 3 Status:** ✅ COMPLETED - Moodle HTTP client and all 8 API functions implemented with proper array parameter handling.

### Week 4: Data Aggregator (Most Critical)

**Day 1-2: Helper Functions**
- [ ] Create `internal/services/aggregator.go`
- [ ] Port `extractCourseTotal()` from [aggregator.js:12-72](src/services/aggregator.js#L12-L72)
  - Exact same logic: try Moodle total, fallback to calculated average
  - Return struct with CourseTotal, CourseTotalRaw, CourseTotalMax
- [ ] Port `indexAssignmentsByCourse()` and `indexQuizzesByCourse()`
  - Map course ID → assignment/quiz list
- [ ] Port `enrichWithGrades()`, `enrichAssignmentsWithComments()`

**Day 3-5: Core Aggregation Functions**
- [ ] Implement `BootstrapSession(token)`:
  - GetSiteInfo for user ID
  - GetInProgressCourses
  - Store in cache
- [ ] Implement `BuildCourseCards(token, userid)`:
  - Parallel API calls with errgroup
  - GetInProgressCourses, GetUserGradeItems for each course
  - Apply extractCourseTotal logic
  - Fetch user preferences (colors, metadata)
  - Return array matching frontend expected format
- [ ] Implement `BuildDueCalendar(token, userid)`:
  - GetAssignments, GetQuizzes
  - Transform to calendar events
  - Apply user color preferences
  - Return events array
- [ ] Implement `GetWorkItemsByCourse(token, userid, courseId?)`:
  - GetAssignments, GetQuizzes
  - Filter by course if provided
  - Enrich with grades and submission status
  - Group by course

### Week 5: Core API Routes

**Day 1: Core Endpoints**
- [ ] Create `internal/handlers/api.go`
- [ ] POST /api/login:
  - Accept {name, moodleToken} (backward compat)
  - Call BootstrapSession(token)
  - Set session with moodleToken
  - Return user info
- [ ] POST /api/logout:
  - Clear user cache
  - Clear session
- [ ] GET /api/me:
  - Call BootstrapSession to refresh
  - Return user session info

**Day 2-3: Data Endpoints**
- [ ] GET /api/courses:
  - Check cache first
  - Call BuildCourseCards
  - Cache for 24 hours
  - Return courses array
- [ ] GET /api/calendar:
  - Check cache first
  - Call BuildDueCalendar
  - Cache for 15 minutes
  - Return events array
- [ ] GET /api/work:
  - Parse optional ?courseId query param
  - Check cache (key based on courseId)
  - Call GetWorkItemsByCourse
  - Cache for 15 minutes
  - Return work items grouped by course

**Day 4-5: Cache Manager**
- [ ] Create `internal/services/cache.go`
- [ ] Use go-cache with user-scoped keys
- [ ] Methods:
  - Get(userId, key) → value, found
  - Set(userId, key, value, ttl)
  - Invalidate(userId, key)
  - Clear(userId)
- [ ] TTLs match current system:
  - courses: 24 hours
  - calendar: 15 minutes
  - work: 15 minutes

### Week 6: Preferences Routes

**Day 1-2: Preference Repository**
- [ ] Create `internal/repository/preference_repo.go`
- [ ] Methods:
  - GetAllPrefs(userId) → map of all prefs
  - GetCourseColors(userId) → []CourseColor
  - SetCourseColor(userId, courseId, color)
  - GetEventOverrides(userId) → []EventOverride
  - SetEventOverride(userId, eventId, override)
  - GetAssignmentTypeColors(userId) → []AssignmentTypeColor
  - SetAssignmentTypeColor(userId, assignType, color)

**Day 3-5: Preference Handlers**
- [ ] Create `internal/handlers/preferences.go`
- [ ] GET /api/prefs:
  - Fetch all user preferences
  - Return JSON matching frontend format
- [ ] PUT /api/prefs/courseColor:
  - Accept {courseId, color}
  - Update course_colors table
  - Invalidate calendar cache
- [ ] PUT /api/prefs/eventOverride:
  - Accept {eventId, color, textColor, hidden, notes}
  - Update event_overrides table
  - Invalidate calendar cache
- [ ] PUT /api/prefs/assignmentTypeColor:
  - Accept {assignmentType, color}
  - Update assignment_type_colors table
  - Invalidate calendar cache

### Week 7: Custom Events Routes

**Day 1-2: Custom Event Repository**
- [ ] Create `internal/repository/custom_event_repo.go`
- [ ] CRUD operations:
  - GetAll(userId, moodleAssignmentId?) → []CustomEvent
  - GetByID(eventId, userId) → CustomEvent
  - Create(event) → ID
  - Update(eventId, userId, event) → error
  - Delete(eventId, userId) → error

**Day 3-5: Custom Event Handlers**
- [ ] Create `internal/handlers/custom_events.go`
- [ ] GET /api/custom-events:
  - Optional ?moodleAssignmentId filter
  - Return all user events
- [ ] GET /api/custom-events/:id
- [ ] POST /api/custom-events:
  - Validate required fields (title, startTime)
  - Create event
  - Invalidate calendar cache
- [ ] PUT /api/custom-events/:id
- [ ] DELETE /api/custom-events/:id

### Week 8-9: Remaining Routes

**User Assignments** (2 days)
- [ ] Repository: `internal/repository/assignment_repo.go`
- [ ] Handlers: `internal/handlers/user_assignments.go`
- [ ] Routes: GET/POST/PUT/DELETE /api/user-assignments

**Course Metadata** (2 days)
- [ ] Repository: `internal/repository/course_metadata_repo.go`
- [ ] Handlers: `internal/handlers/course_metadata.go`
- [ ] Routes: GET/PUT/DELETE /api/course-metadata/:courseId

**Time Blocks** (2 days)
- [ ] Repository: `internal/repository/time_block_repo.go`
- [ ] Handlers: `internal/handlers/time_blocks.go`
- [ ] Routes: GET/POST/PUT/DELETE /api/time-blocks

**Starred Assignments** (1 day)
- [ ] Repository: `internal/repository/starred_repo.go`
- [ ] Handlers: `internal/handlers/starred.go`
- [ ] Routes: GET/POST/DELETE /api/starred-assignments

**Focus Mode** (2 days)
- [ ] Repository: `internal/repository/focus_mode_repo.go`
- [ ] Handlers: `internal/handlers/focus_mode.go`
- [ ] Routes: /api/focus-mode/* (today, item, notes, sessions)

**Assignment Ratings** (1 day)
- [ ] Repository: part of assignment_repo.go
- [ ] Handlers: `internal/handlers/ratings.go`
- [ ] Routes: GET/PUT/DELETE /api/assignment-ratings

**Analytics** (2 days)
- [ ] Repository: `internal/repository/analytics_repo.go`
- [ ] Handlers: `internal/handlers/analytics.go`
- [ ] Routes: /api/analytics/* (summary, study-time, trends, etc.)

### Week 9: Static File Serving

**Day 1-2: File Server**
- [ ] Configure Chi FileServer middleware
- [ ] Serve from `../client` directory
- [ ] SPA fallback for client-side routing:
  ```go
  r.Get("/*", func(w http.ResponseWriter, r *http.Request) {
      http.ServeFile(w, r, "../client/index.html")
  })
  ```

**Day 3-5: Integration Testing**
- [ ] Test all endpoints with existing frontend
- [ ] Verify session cookies work
- [ ] Verify cache invalidation works
- [ ] Compare JSON responses with Node.js version

### Week 10: Testing & Validation

**Day 1-3: Unit Tests**
- [ ] Repository tests (use :memory: SQLite)
- [ ] Service tests (mock Moodle API)
- [ ] Handler tests (httptest.NewRecorder)

**Day 4-5: Integration Tests**
- [ ] Full API flow tests
- [ ] Session persistence tests
- [ ] Cache invalidation tests

### Week 11: Deployment

**Day 1-2: Docker**
- [ ] Create Dockerfile (multi-stage build)
- [ ] Alpine Linux base image
- [ ] Volume for SQLite database

**Day 3-4: Logging & Monitoring**
- [ ] Structured logging with zap/zerolog
- [ ] Health check endpoint: GET /health
- [ ] Graceful shutdown handling

**Day 5: Production Deployment**
- [ ] Deploy Go backend on port 3001
- [ ] Keep Node.js on port 3000
- [ ] Test with feature flag routing
- [ ] Monitor error rates and performance

## Rollout Strategy

1. **Parallel Deployment** (Week 11)
   - Run Go on port 3001, Node.js on 3000
   - Frontend connects to Node.js initially

2. **Shadow Testing** (Week 12)
   - Route read-only endpoints to Go (courses, calendar, work)
   - Monitor for response discrepancies
   - Keep writes on Node.js

3. **Write Migration** (Week 13)
   - Migrate auth routes to Go
   - Migrate preference updates to Go
   - Dual-write to verify consistency

4. **Full Cutover** (Week 14)
   - Route all traffic to Go backend
   - Keep Node.js as fallback
   - Monitor closely for issues

5. **Decommission** (Week 15)
   - Remove Node.js server after stability confirmed
   - Clean up feature flags

## Success Criteria

- [ ] All 50+ API endpoints working identically to Node.js version
- [ ] Existing frontend works without any changes
- [ ] Session cookies compatible between backends
- [ ] Database shared successfully between both backends
- [ ] Performance meets or exceeds Node.js (target: 5x faster cached, 25% faster uncached)
- [ ] All tests passing (unit + integration)
- [ ] Zero data loss during migration
