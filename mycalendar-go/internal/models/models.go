package models

import (
	"database/sql"
	"time"
)

// User represents a user account
type User struct {
	ID           int64          `db:"id" json:"id"`
	Email        string         `db:"email" json:"email"`
	FirstName    string         `db:"first_name" json:"firstName"`
	LastName     string         `db:"last_name" json:"lastName"`
	PasswordHash string         `db:"password_hash" json:"-"` // Never send to client
	MoodleToken  sql.NullString `db:"moodle_token" json:"moodleToken,omitempty"`
	CreatedAt    time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt    time.Time      `db:"updated_at" json:"updatedAt"`
}

// UserPreference represents a user preference (key-value store)
type UserPreference struct {
	ID        int64     `db:"id" json:"id"`
	UserID    int64     `db:"user_id" json:"userId"`
	PrefKey   string    `db:"pref_key" json:"key"`
	PrefValue string    `db:"pref_value" json:"value"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// CourseColor represents a user's color preference for a course
type CourseColor struct {
	ID        int64     `db:"id" json:"id"`
	UserID    int64     `db:"user_id" json:"userId"`
	CourseID  string    `db:"course_id" json:"courseId"`
	Color     string    `db:"color" json:"color"`
	CreatedAt time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time `db:"updated_at" json:"updatedAt"`
}

// EventOverride represents customizations for a Moodle event
type EventOverride struct {
	ID        int64          `db:"id" json:"id"`
	UserID    int64          `db:"user_id" json:"userId"`
	EventID   string         `db:"event_id" json:"eventId"`
	Color     sql.NullString `db:"color" json:"color,omitempty"`
	TextColor sql.NullString `db:"text_color" json:"textColor,omitempty"`
	Hidden    bool           `db:"hidden" json:"hidden"`
	Notes     sql.NullString `db:"notes" json:"notes,omitempty"`
	CreatedAt time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt time.Time      `db:"updated_at" json:"updatedAt"`
}

// AssignmentTypeColor represents a color preference for assignment types
type AssignmentTypeColor struct {
	ID             int64     `db:"id" json:"id"`
	UserID         int64     `db:"user_id" json:"userId"`
	AssignmentType string    `db:"assignment_type" json:"assignmentType"`
	Color          string    `db:"color" json:"color"`
	CreatedAt      time.Time `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time `db:"updated_at" json:"updatedAt"`
}

// CustomEvent represents a user-created calendar event
type CustomEvent struct {
	ID                  int64          `db:"id" json:"id"`
	UserID              int64          `db:"user_id" json:"userId"`
	CourseID            sql.NullString `db:"course_id" json:"courseId,omitempty"`
	Title               string         `db:"title" json:"title"`
	Description         sql.NullString `db:"description" json:"description,omitempty"`
	EventType           string         `db:"event_type" json:"eventType"`
	StartTime           time.Time      `db:"start_time" json:"startTime"`
	EndTime             sql.NullTime   `db:"end_time" json:"endTime,omitempty"`
	AllDay              bool           `db:"all_day" json:"allDay"`
	Color               sql.NullString `db:"color" json:"color,omitempty"`
	RecurrenceRule      sql.NullString `db:"recurrence_rule" json:"recurrenceRule,omitempty"`
	MoodleAssignmentID  sql.NullString `db:"moodle_assignment_id" json:"moodleAssignmentId,omitempty"`
	CreatedAt           time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt           time.Time      `db:"updated_at" json:"updatedAt"`
}

// UserAssignment represents user-submitted assignment data
type UserAssignment struct {
	ID                int64           `db:"id" json:"id"`
	UserID            int64           `db:"user_id" json:"userId"`
	CourseID          string          `db:"course_id" json:"courseId"`
	MoodleAssignmentID sql.NullString `db:"moodle_assignment_id" json:"moodleAssignmentId,omitempty"`
	Title             string          `db:"title" json:"title"`
	Description       sql.NullString  `db:"description" json:"description,omitempty"`
	DueDate           sql.NullTime    `db:"due_date" json:"dueDate,omitempty"`
	PredictedDueDate  sql.NullTime    `db:"predicted_due_date" json:"predictedDueDate,omitempty"`
	EstimatedHours    sql.NullFloat64 `db:"estimated_hours" json:"estimatedHours,omitempty"`
	Priority          string          `db:"priority" json:"priority"`
	Status            string          `db:"status" json:"status"`
	CompletedAt       sql.NullTime    `db:"completed_at" json:"completedAt,omitempty"`
	Notes             sql.NullString  `db:"notes" json:"notes,omitempty"`
	DifficultyRating  sql.NullInt64   `db:"difficulty_rating" json:"difficultyRating,omitempty"`
	CreatedAt         time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt         time.Time       `db:"updated_at" json:"updatedAt"`
}

// CourseMetadata represents user-submitted course metadata
type CourseMetadata struct {
	ID                    int64           `db:"id" json:"id"`
	UserID                int64           `db:"user_id" json:"userId"`
	CourseID              string          `db:"course_id" json:"courseId"`
	CourseName            sql.NullString  `db:"course_name" json:"courseName,omitempty"`
	CustomImageURL        sql.NullString  `db:"custom_image_url" json:"customImageUrl,omitempty"`
	InstructorName        sql.NullString  `db:"instructor_name" json:"instructorName,omitempty"`
	OfficeHours           sql.NullString  `db:"office_hours" json:"officeHours,omitempty"`
	ExternalURL           sql.NullString  `db:"external_url" json:"externalUrl,omitempty"`
	Notes                 sql.NullString  `db:"notes" json:"notes,omitempty"`
	AvgAssignmentsPerWeek sql.NullFloat64 `db:"avg_assignments_per_week" json:"avgAssignmentsPerWeek,omitempty"`
	TypicalDueDay         sql.NullString  `db:"typical_due_day" json:"typicalDueDay,omitempty"`
	TypicalDueTime        sql.NullString  `db:"typical_due_time" json:"typicalDueTime,omitempty"`
	CreatedAt             time.Time       `db:"created_at" json:"createdAt"`
	UpdatedAt             time.Time       `db:"updated_at" json:"updatedAt"`
}

// TimeBlock represents a recurring time block
type TimeBlock struct {
	ID             int64          `db:"id" json:"id"`
	UserID         int64          `db:"user_id" json:"userId"`
	Title          string         `db:"title" json:"title"`
	BlockType      string         `db:"block_type" json:"blockType"`
	DayOfWeek      sql.NullInt64  `db:"day_of_week" json:"dayOfWeek,omitempty"`
	StartTime      string         `db:"start_time" json:"startTime"`
	EndTime        string         `db:"end_time" json:"endTime"`
	SpecificDate   sql.NullString `db:"specific_date" json:"specificDate,omitempty"`
	RecurrenceRule sql.NullString `db:"recurrence_rule" json:"recurrenceRule,omitempty"`
	Color          sql.NullString `db:"color" json:"color,omitempty"`
	Location       sql.NullString `db:"location" json:"location,omitempty"`
	Notes          sql.NullString `db:"notes" json:"notes,omitempty"`
	CreatedAt      time.Time      `db:"created_at" json:"createdAt"`
	UpdatedAt      time.Time      `db:"updated_at" json:"updatedAt"`
}

// StarredAssignment represents a starred/favorited assignment
type StarredAssignment struct {
	ID                 int64     `db:"id" json:"id"`
	UserID             int64     `db:"user_id" json:"userId"`
	MoodleAssignmentID string    `db:"moodle_assignment_id" json:"moodleAssignmentId"`
	CreatedAt          time.Time `db:"created_at" json:"createdAt"`
}

// FocusSession represents a study session
type FocusSession struct {
	ID                    int64          `db:"id" json:"id"`
	UserID                int64          `db:"user_id" json:"userId"`
	ItemID                string         `db:"item_id" json:"itemId"`
	ItemType              string         `db:"item_type" json:"itemType"`
	SessionType           string         `db:"session_type" json:"sessionType"`
	TargetDurationSeconds sql.NullInt64  `db:"target_duration_seconds" json:"targetDurationSeconds,omitempty"`
	ActualDurationSeconds int64          `db:"actual_duration_seconds" json:"actualDurationSeconds"`
	Completed             bool           `db:"completed" json:"completed"`
	StartedAt             time.Time      `db:"started_at" json:"startedAt"`
	EndedAt               sql.NullTime   `db:"ended_at" json:"endedAt,omitempty"`
	CreatedAt             time.Time      `db:"created_at" json:"createdAt"`
}

// FocusNote represents notes taken during a focus session
type FocusNote struct {
	ID        int64          `db:"id" json:"id"`
	UserID    int64          `db:"user_id" json:"userId"`
	ItemID    string         `db:"item_id" json:"itemId"`
	ItemType  string         `db:"item_type" json:"itemType"`
	Notes     sql.NullString `db:"notes" json:"notes,omitempty"`
	UpdatedAt time.Time      `db:"updated_at" json:"updatedAt"`
	CreatedAt time.Time      `db:"created_at" json:"createdAt"`
}
