package aggregator

import (
	"fmt"
	"strings"
)

// extractCourseTotal extracts course total grade with fallback logic
// First tries Moodle's course total, then calculates average from graded assignments/quizzes
func extractCourseTotal(gradeItemsPayload map[string]interface{}) CourseTotals {
	defer func() {
		if r := recover(); r != nil {
			// Return empty totals on any panic
		}
	}()

	// Navigate to usergrades[0].gradeitems
	usergrades, ok := gradeItemsPayload["usergrades"].([]interface{})
	if !ok || len(usergrades) == 0 {
		return CourseTotals{}
	}

	usergrade, ok := usergrades[0].(map[string]interface{})
	if !ok {
		return CourseTotals{}
	}

	gradeitems, ok := usergrade["gradeitems"].([]interface{})
	if !ok {
		return CourseTotals{}
	}

	// Find the course total item
	var courseTotal map[string]interface{}
	for _, item := range gradeitems {
		gradeItem, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if itemtype, ok := gradeItem["itemtype"].(string); ok && itemtype == "course" {
			courseTotal = gradeItem
			break
		}
	}

	// Extract Moodle's course total values
	var moodleTotal *string
	var moodleRaw *float64
	var moodleMax *float64

	if courseTotal != nil {
		if pctFormatted, ok := courseTotal["percentageformatted"].(string); ok && pctFormatted != "" {
			moodleTotal = &pctFormatted
		} else if gradeFormatted, ok := courseTotal["gradeformatted"].(string); ok && gradeFormatted != "" {
			moodleTotal = &gradeFormatted
		}

		if raw, ok := courseTotal["graderaw"].(float64); ok {
			moodleRaw = &raw
		}
		if max, ok := courseTotal["grademax"].(float64); ok {
			moodleMax = &max
		}
	}

	// If Moodle has a valid grade, use it
	if moodleTotal != nil && moodleRaw != nil && *moodleRaw != 0 {
		return CourseTotals{
			CourseTotalFormatted: moodleTotal,
			CourseTotalRaw:       moodleRaw,
			CourseTotalMax:       moodleMax,
		}
	}

	// Otherwise, calculate from graded module items (assignments and quizzes)
	var gradedItems []map[string]interface{}
	for _, item := range gradeitems {
		gradeItem, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		itemtype, _ := gradeItem["itemtype"].(string)
		itemmodule, _ := gradeItem["itemmodule"].(string)

		if itemtype == "mod" && (itemmodule == "assign" || itemmodule == "quiz") {
			// Check if it has valid grade data
			raw, hasRaw := gradeItem["graderaw"].(float64)
			max, hasMax := gradeItem["grademax"].(float64)

			if hasRaw && hasMax && max > 0 {
				gradedItems = append(gradedItems, gradeItem)
			}
		}
	}

	if len(gradedItems) == 0 {
		// No graded items yet, return Moodle's value even if null/0
		return CourseTotals{
			CourseTotalFormatted: moodleTotal,
			CourseTotalRaw:       moodleRaw,
			CourseTotalMax:       moodleMax,
		}
	}

	// Calculate average percentage from graded items
	totalPercentage := 0.0
	for _, item := range gradedItems {
		raw := item["graderaw"].(float64)
		max := item["grademax"].(float64)
		percentage := (raw / max) * 100
		totalPercentage += percentage
	}
	averagePercentage := totalPercentage / float64(len(gradedItems))

	// Format as percentage string to match Moodle's format
	calculatedFormatted := fmt.Sprintf("%.2f %%", averagePercentage)
	maxVal := 100.0

	return CourseTotals{
		CourseTotalFormatted: &calculatedFormatted,
		CourseTotalRaw:       &averagePercentage,
		CourseTotalMax:       &maxVal,
	}
}

// indexAssignmentsByCourse organizes assignments by course ID
func indexAssignmentsByCourse(assignPayload map[string]interface{}) map[int][]WorkItem {
	byCourse := make(map[int][]WorkItem)

	courses, ok := assignPayload["courses"].([]interface{})
	if !ok {
		return byCourse
	}

	for _, c := range courses {
		course, ok := c.(map[string]interface{})
		if !ok {
			continue
		}

		courseID, ok := course["id"].(float64)
		if !ok {
			continue
		}

		assignments, ok := course["assignments"].([]interface{})
		if !ok {
			continue
		}

		var workItems []WorkItem
		for _, a := range assignments {
			assign, ok := a.(map[string]interface{})
			if !ok {
				continue
			}

			item := WorkItem{
				Type:     "assign",
				CourseID: int(courseID),
			}

			if id, ok := assign["id"].(float64); ok {
				item.ID = int(id)
			}
			if cmid, ok := assign["cmid"].(float64); ok {
				cmidInt := int(cmid)
				item.CMID = &cmidInt
			}
			if name, ok := assign["name"].(string); ok {
				item.Name = name
			}
			if duedate, ok := assign["duedate"].(float64); ok && duedate > 0 {
				duedateInt := int64(duedate)
				item.DueAt = &duedateInt
			}
			if cutoff, ok := assign["cutoffdate"].(float64); ok && cutoff > 0 {
				cutoffInt := int64(cutoff)
				item.CutoffAt = &cutoffInt
			}

			workItems = append(workItems, item)
		}

		byCourse[int(courseID)] = workItems
	}

	return byCourse
}

// indexQuizzesByCourse organizes quizzes by course ID
func indexQuizzesByCourse(quizzesPayload map[string]interface{}) map[int][]WorkItem {
	byCourse := make(map[int][]WorkItem)

	// Handle both shapes: { quizzes: [...] } or { courses: [...] }
	var quizzes []interface{}

	if quizzesArray, ok := quizzesPayload["quizzes"].([]interface{}); ok {
		quizzes = quizzesArray
	} else if courses, ok := quizzesPayload["courses"].([]interface{}); ok {
		// Flatten courses[].quizzes
		for _, c := range courses {
			course, ok := c.(map[string]interface{})
			if !ok {
				continue
			}

			courseID, ok := course["id"].(float64)
			if !ok {
				continue
			}

			courseQuizzes, ok := course["quizzes"].([]interface{})
			if !ok {
				continue
			}

			for _, q := range courseQuizzes {
				quiz, ok := q.(map[string]interface{})
				if !ok {
					continue
				}
				// Add course ID to quiz
				quiz["course"] = courseID
				quizzes = append(quizzes, quiz)
			}
		}
	}

	for _, q := range quizzes {
		quiz, ok := q.(map[string]interface{})
		if !ok {
			continue
		}

		courseID, ok := quiz["course"].(float64)
		if !ok {
			continue
		}

		item := WorkItem{
			Type:     "quiz",
			CourseID: int(courseID),
		}

		if id, ok := quiz["id"].(float64); ok {
			item.ID = int(id)
		}
		if cmid, ok := quiz["coursemodule"].(float64); ok {
			cmidInt := int(cmid)
			item.CMID = &cmidInt
		} else if cmid, ok := quiz["cmid"].(float64); ok {
			cmidInt := int(cmid)
			item.CMID = &cmidInt
		}
		if name, ok := quiz["name"].(string); ok {
			item.Name = name
		}
		if timeclose, ok := quiz["timeclose"].(float64); ok && timeclose > 0 {
			timecloseInt := int64(timeclose)
			item.DueAt = &timecloseInt
		}
		if timeopen, ok := quiz["timeopen"].(float64); ok && timeopen > 0 {
			timeopenInt := int64(timeopen)
			item.OpenAt = &timeopenInt
		}

		list := byCourse[int(courseID)]
		list = append(list, item)
		byCourse[int(courseID)] = list
	}

	return byCourse
}

// synthesizeAssignmentsFromGrades creates assignment entries from gradebook when mod_assign returns none
func synthesizeAssignmentsFromGrades(gradeItemsPayload map[string]interface{}, existingAssignIDs map[int]bool) []WorkItem {
	var synth []WorkItem

	usergrades, ok := gradeItemsPayload["usergrades"].([]interface{})
	if !ok || len(usergrades) == 0 {
		return synth
	}

	usergrade, ok := usergrades[0].(map[string]interface{})
	if !ok {
		return synth
	}

	courseID := 0
	if cid, ok := usergrade["courseid"].(float64); ok {
		courseID = int(cid)
	}

	gradeitems, ok := usergrade["gradeitems"].([]interface{})
	if !ok {
		return synth
	}

	for _, item := range gradeitems {
		gradeItem, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		itemtype, _ := gradeItem["itemtype"].(string)
		itemmodule, _ := gradeItem["itemmodule"].(string)

		if itemtype == "mod" && itemmodule == "assign" {
			iteminstance, ok := gradeItem["iteminstance"].(float64)
			if !ok {
				continue
			}

			assignID := int(iteminstance)

			// Skip if we already have this assignment
			if existingAssignIDs[assignID] {
				continue
			}

			workItem := WorkItem{
				Type:     "assign",
				ID:       assignID,
				CourseID: courseID,
			}

			if cmid, ok := gradeItem["cmid"].(float64); ok {
				cmidInt := int(cmid)
				workItem.CMID = &cmidInt
			}
			if name, ok := gradeItem["itemname"].(string); ok {
				workItem.Name = name
			} else {
				workItem.Name = "Assignment"
			}

			synth = append(synth, workItem)
		}
	}

	return synth
}

// extractInstructorComments extracts feedback comments from submission status
func extractInstructorComments(feedbackData map[string]interface{}) *InstructorComments {
	if feedbackData == nil {
		return nil
	}

	plugins, ok := feedbackData["plugins"].([]interface{})
	if !ok {
		return nil
	}

	// Look for feedback comments plugin
	var commentsPlugin map[string]interface{}
	for _, p := range plugins {
		plugin, ok := p.(map[string]interface{})
		if !ok {
			continue
		}

		ptype, _ := plugin["type"].(string)
		name, _ := plugin["name"].(string)

		if ptype == "comments" && name == "Feedback comments" {
			commentsPlugin = plugin
			break
		}
	}

	if commentsPlugin == nil {
		return nil
	}

	// Extract comments from editorfields
	editorfields, ok := commentsPlugin["editorfields"].([]interface{})
	if !ok {
		return nil
	}

	for _, f := range editorfields {
		field, ok := f.(map[string]interface{})
		if !ok {
			continue
		}

		fname, _ := field["name"].(string)
		if fname == "comments" {
			text, _ := field["text"].(string)
			if text == "" {
				return nil
			}

			format := 1
			if fformat, ok := field["format"].(float64); ok {
				format = int(fformat)
			}

			return &InstructorComments{
				Text:   text,
				Format: format,
			}
		}
	}

	return nil
}

// toFloat64 safely converts interface{} to float64
func toFloat64(val interface{}) (*float64, bool) {
	if f, ok := val.(float64); ok {
		return &f, true
	}
	return nil, false
}

// toString safely converts interface{} to string
func toString(val interface{}) (*string, bool) {
	if s, ok := val.(string); ok && s != "" {
		return &s, true
	}
	return nil, false
}

// toLower safely converts string to lowercase
func toLower(s string) string {
	return strings.ToLower(s)
}
