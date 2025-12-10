package aggregator

import (
	"fmt"
	"mycalendar/internal/services/moodle"
	"strings"
	"time"
)

// enrichWithGrades enriches work items (assignments/quizzes) with grade data
// Matches grade items by cmid, iteminstance, or name
func enrichWithGrades(workItems []WorkItem, gradeItemsPayload map[string]interface{}, itemType string) []WorkItem {
	defer func() {
		if r := recover(); r != nil {
			fmt.Printf("Error enriching %ss with grades: %v\n", itemType, r)
		}
	}()

	// Extract grade items
	usergrades, ok := gradeItemsPayload["usergrades"].([]interface{})
	if !ok || len(usergrades) == 0 {
		return workItems
	}

	usergrade, ok := usergrades[0].(map[string]interface{})
	if !ok {
		return workItems
	}

	gradeitems, ok := usergrade["gradeitems"].([]interface{})
	if !ok {
		return workItems
	}

	// Build lookup maps for efficient matching
	gradeMapByCmid := make(map[int]map[string]interface{})
	gradeMapByInstance := make(map[int]map[string]interface{})
	gradeMapByName := make(map[string]map[string]interface{})

	for _, item := range gradeitems {
		gradeItem, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		// Only process grade items of matching type
		gItemType, _ := gradeItem["itemtype"].(string)
		gItemModule, _ := gradeItem["itemmodule"].(string)

		if gItemType == "mod" && gItemModule == itemType {
			if cmid, ok := gradeItem["cmid"].(float64); ok {
				gradeMapByCmid[int(cmid)] = gradeItem
			}
			if iteminstance, ok := gradeItem["iteminstance"].(float64); ok {
				gradeMapByInstance[int(iteminstance)] = gradeItem
			}
			if itemname, ok := gradeItem["itemname"].(string); ok {
				gradeMapByName[strings.ToLower(itemname)] = gradeItem
			}
		}
	}

	// Enrich each work item with grade data
	enriched := make([]WorkItem, len(workItems))
	for i, work := range workItems {
		var grade map[string]interface{}

		// Try matching in order of specificity:
		// 1. First try matching by cmid (most reliable)
		if work.CMID != nil {
			if g, ok := gradeMapByCmid[*work.CMID]; ok {
				grade = g
			}
		}

		// 2. Fallback to matching by iteminstance (assignment ID)
		if grade == nil {
			if g, ok := gradeMapByInstance[work.ID]; ok {
				grade = g
			}
		}

		// 3. Final fallback: try matching by name (case-insensitive)
		if grade == nil && work.Name != "" {
			if g, ok := gradeMapByName[strings.ToLower(work.Name)]; ok {
				grade = g
			}
		}

		// Derive status based on grade presence and due date
		status := "pending"
		if grade != nil {
			if graderaw, ok := grade["graderaw"].(float64); ok && graderaw >= 0 {
				status = "graded"
			}
		}
		if status != "graded" && work.DueAt != nil {
			now := time.Now().Unix()
			if *work.DueAt < now {
				status = "overdue"
			}
		}

		// Build enriched work item
		enriched[i] = work
		enriched[i].Status = status

		if grade != nil {
			if graderaw, ok := grade["graderaw"].(float64); ok {
				enriched[i].GradeRaw = &graderaw
			}
			if gradeformatted, ok := grade["gradeformatted"].(string); ok {
				enriched[i].GradeFormatted = &gradeformatted
			}
			if grademax, ok := grade["grademax"].(float64); ok {
				enriched[i].GradeMax = &grademax
			}
			if percentformatted, ok := grade["percentageformatted"].(string); ok {
				enriched[i].GradePercent = &percentformatted
			}
			if lettergrade, ok := grade["lettergradeformatted"].(string); ok {
				enriched[i].GradeLetter = &lettergrade
			}
			if graderaw, ok := grade["graderaw"].(float64); ok && graderaw >= 0 {
				gradingStatus := "graded"
				enriched[i].GradingStatus = &gradingStatus
			}
			if gradeddate, ok := grade["gradeddate"].(float64); ok {
				gradeddateInt := int64(gradeddate)
				enriched[i].GradedAt = &gradeddateInt
			}
		}
	}

	return enriched
}

// enrichAssignmentsWithComments enriches assignments with instructor comments
func enrichAssignmentsWithComments(assignments []WorkItem, token string, userID int) []WorkItem {
	if len(assignments) == 0 {
		return assignments
	}

	// Fetch comments for each assignment
	type commentResult struct {
		ID       int
		Comments *InstructorComments
	}

	results := make(chan commentResult, len(assignments))

	// Fetch comments in parallel (with reasonable limit)
	for _, assignment := range assignments {
		go func(a WorkItem) {
			defer func() {
				if r := recover(); r != nil {
					results <- commentResult{ID: a.ID, Comments: nil}
				}
			}()

			submissionStatus, err := moodle.GetAssignSubmissionStatus(token, a.ID, userID)
			if err != nil {
				results <- commentResult{ID: a.ID, Comments: nil}
				return
			}

			// Feedback is at the root level of the submission status response
			var feedback map[string]interface{}
			if fb, ok := submissionStatus["feedback"].(map[string]interface{}); ok {
				feedback = fb
			}

			comments := extractInstructorComments(feedback)
			results <- commentResult{ID: a.ID, Comments: comments}
		}(assignment)
	}

	// Collect results
	commentMap := make(map[int]*InstructorComments)
	for i := 0; i < len(assignments); i++ {
		result := <-results
		commentMap[result.ID] = result.Comments
	}
	close(results)

	// Merge comments back into assignments
	enriched := make([]WorkItem, len(assignments))
	for i, assignment := range assignments {
		enriched[i] = assignment
		enriched[i].InstructorComments = commentMap[assignment.ID]
	}

	return enriched
}
