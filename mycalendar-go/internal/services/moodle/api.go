package moodle

import "fmt"

// GetSiteInfo gets the current user's site info (including userid)
// Calls: core_webservice_get_site_info
func GetSiteInfo(token string) (map[string]interface{}, error) {
	return MoodleGet(token, "core_webservice_get_site_info", nil)
}

// GetInProgressCourses gets courses that are currently in progress for the user
// Calls: core_course_get_enrolled_courses_by_timeline_classification
func GetInProgressCourses(token string, limit, offset int) ([]interface{}, error) {
	params := map[string]interface{}{
		"classification": "inprogress",
		"limit":          limit,
		"offset":         offset,
	}

	result, err := MoodleGet(token, "core_course_get_enrolled_courses_by_timeline_classification", params)
	if err != nil {
		return nil, err
	}

	// The result should have a "courses" key containing the array
	if courses, ok := result["courses"].([]interface{}); ok {
		return courses, nil
	}

	return []interface{}{}, nil
}

// GetAssignments gets assignments for the given course IDs
// Calls: mod_assign_get_assignments
func GetAssignments(token string, courseIDs []int) (map[string]interface{}, error) {
	params := map[string]interface{}{}

	if len(courseIDs) > 0 {
		params["courseids"] = courseIDs
	}

	return MoodleGet(token, "mod_assign_get_assignments", params)
}

// GetQuizzes gets quizzes for the given course IDs
// Calls: mod_quiz_get_quizzes_by_courses
func GetQuizzes(token string, courseIDs []int) (map[string]interface{}, error) {
	params := map[string]interface{}{}

	if len(courseIDs) > 0 {
		params["courseids"] = courseIDs
	}

	return MoodleGet(token, "mod_quiz_get_quizzes_by_courses", params)
}

// GetAssignSubmissionStatus gets the submission status for a specific assignment
// Calls: mod_assign_get_submission_status
// userid is optional - if 0, will not be included (uses the token's user)
func GetAssignSubmissionStatus(token string, assignID int, userID int) (map[string]interface{}, error) {
	params := map[string]interface{}{
		"assignid": assignID,
	}

	if userID > 0 {
		params["userid"] = userID
	}

	return MoodleGet(token, "mod_assign_get_submission_status", params)
}

// GetCourseCompletionStatuses gets activity completion status for a course
// Calls: core_completion_get_activities_completion_status
func GetCourseCompletionStatuses(token string, courseID, userID int) (map[string]interface{}, error) {
	params := map[string]interface{}{
		"courseid": courseID,
		"userid":   userID,
	}

	return MoodleGet(token, "core_completion_get_activities_completion_status", params)
}

// GetUserGradeItems gets gradebook items for a specific course and user
// Calls: gradereport_user_get_grade_items
func GetUserGradeItems(token string, courseID, userID int) (map[string]interface{}, error) {
	params := map[string]interface{}{
		"courseid": courseID,
		"userid":   userID,
	}

	return MoodleGet(token, "gradereport_user_get_grade_items", params)
}

// GetCourseContents gets the contents/structure of a course
// Calls: core_course_get_contents
func GetCourseContents(token string, courseID int) ([]interface{}, error) {
	params := map[string]interface{}{
		"courseid": courseID,
	}

	result, err := MoodleGet(token, "core_course_get_contents", params)
	if err != nil {
		return nil, err
	}

	// This endpoint typically returns an array directly
	if data, ok := result["data"].([]interface{}); ok {
		return data, nil
	}

	// If result is already structured as we expect, return empty array
	return []interface{}{}, fmt.Errorf("unexpected response format from core_course_get_contents")
}
