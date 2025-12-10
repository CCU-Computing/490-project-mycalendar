package aggregator

// CourseTotals represents the calculated course grade totals
type CourseTotals struct {
	CourseTotalFormatted *string  `json:"courseTotalFormatted"`
	CourseTotalRaw       *float64 `json:"courseTotalRaw"`
	CourseTotalMax       *float64 `json:"courseTotalMax"`
}

// WorkItem represents an assignment or quiz
type WorkItem struct {
	Type               string                  `json:"type"` // "assign" or "quiz"
	ID                 int                     `json:"id"`
	CMID               *int                    `json:"cmid"`
	CourseID           int                     `json:"courseId"`
	Name               string                  `json:"name"`
	DueAt              *int64                  `json:"dueAt"`
	CutoffAt           *int64                  `json:"cutoffAt,omitempty"`
	OpenAt             *int64                  `json:"openAt,omitempty"`
	GradeRaw           *float64                `json:"gradeRaw"`
	GradeFormatted     *string                 `json:"gradeFormatted"`
	GradeMax           *float64                `json:"gradeMax"`
	GradePercent       *string                 `json:"gradePercent"`
	GradeLetter        *string                 `json:"gradeLetter"`
	GradingStatus      *string                 `json:"gradingStatus"`
	GradedAt           *int64                  `json:"gradedAt"`
	Status             string                  `json:"status"`
	InstructorComments *InstructorComments `json:"instructorComments"`
}

// InstructorComments represents feedback comments from instructor
type InstructorComments struct {
	Text   string `json:"text"`
	Format int    `json:"format"`
}

// CourseWorkItems represents work items grouped by course
type CourseWorkItems struct {
	CourseID    int        `json:"courseId"`
	Assignments []WorkItem `json:"assignments"`
	Quizzes     []WorkItem `json:"quizzes"`
}

// CourseCard represents a course card for the dashboard
type CourseCard struct {
	ID        int     `json:"id"`
	Name      string  `json:"name"`
	Image     *string `json:"image"`
	StartDate *int64  `json:"startdate"`
	EndDate   *int64  `json:"enddate"`
	Progress  *int    `json:"progress"`
	Grade     *string `json:"grade"`
}

// CalendarEvent represents an event in the due calendar
type CalendarEvent struct {
	ID                 string              `json:"id"`
	CourseID           int                 `json:"courseId"`
	Title              string              `json:"title"`
	Type               string              `json:"type"`
	DueAt              int64               `json:"dueAt"`
	GradeFormatted     *string             `json:"gradeFormatted"`
	GradeMax           *float64            `json:"gradeMax"`
	GradePercent       *string             `json:"gradePercent"`
	InstructorComments *InstructorComments `json:"instructorComments"`
}

// SessionData represents bootstrapped session data
type SessionData struct {
	UserID   int                      `json:"userid"`
	Username *string                  `json:"username"`
	SiteName *string                  `json:"sitename"`
	Courses  []map[string]interface{} `json:"courses"`
}
