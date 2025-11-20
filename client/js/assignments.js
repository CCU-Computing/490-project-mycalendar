// assignments.js - Starred assignments display
import { api } from './apiClient.js';
import { openAssignmentDetailsModal } from '../components/AssignmentDetailsModal.js';

// get document elements
const userName = sessionStorage.getItem("mc_userName");
const userChip = document.getElementById("userChip");

// determine if user is logged in
if (!userName) {
  // dashboard.html is in /pages, so go to login in the same folder
  window.location.href = "./login.html";
}

// update user chip
if (userChip) {
  userChip.textContent = "Hi, " + userName;
}

class AssignmentManager {
    constructor() {
        this.assignments = [];
        this.courses = new Map();
        this.starredAssignmentIds = [];
        this.courseColors = {};
        this.typeColors = {};
        this.init();
    }

    async init() {
        await this.loadCourses();
        await this.loadColorPreferences();
        await this.loadAssignments();
        await this.loadStarredAssignments();
        await this.renderAllAssignments();
    }

    async loadCourses() {
        try {
            const { courses } = await api.courses();
            courses.forEach(course => {
                this.courses.set(course.id, {
                    id: course.id,
                    name: course.name,
                    shortname: course.shortname || course.name
                });
            });
        } catch (error) {
            console.error('Error loading courses:', error);
        }
    }

    async loadColorPreferences() {
        try {
            const { prefs } = await api.prefs.get();
            this.courseColors = prefs?.calendar?.courseColors || {};
            this.typeColors = prefs?.calendar?.assignmentTypeColors || {};
        } catch (error) {
            console.error('Error loading color preferences:', error);
            this.courseColors = {};
            this.typeColors = {};
        }
    }

    async loadAssignments() {
        try {
            const { courses } = await api.work();
            const flatAssignments = [];

            console.log('[AssignmentManager] api.work() returned:', {
                courseCount: courses?.length,
                courses: courses?.map(c => ({
                    courseId: c.courseId,
                    assignmentCount: c.assignments?.length,
                    quizCount: c.quizzes?.length
                }))
            });

            for (const courseData of courses) {
                const course = this.courses.get(courseData.courseId);
                const courseName = course?.name || 'Unknown Course';
                const courseShortname = course?.shortname || `Course ${courseData.courseId}`;

                // Process assignments
                for (const assignment of courseData.assignments || []) {
                    flatAssignments.push({
                        id: `${assignment.type}:${assignment.id}`,  // Composite ID for display
                        numericId: assignment.id,  // Real numeric ID for backend operations
                        type: assignment.type,
                        title: assignment.name,
                        course: courseShortname,
                        courseName: courseName,
                        courseId: courseData.courseId,
                        dueDate: assignment.dueAt ? new Date(assignment.dueAt * 1000).toISOString() : null,
                        status: assignment.status || 'pending',
                        gradeFormatted: assignment.gradeFormatted ?? null,
                        gradeMax: assignment.gradeMax ?? null,
                        gradePercent: assignment.gradePercent ?? null
                    });
                }

                // Process quizzes
                for (const quiz of courseData.quizzes || []) {
                    flatAssignments.push({
                        id: `${quiz.type}:${quiz.id}`,  // Composite ID for display
                        numericId: quiz.id,  // Real numeric ID for backend operations
                        type: quiz.type,
                        title: quiz.name,
                        course: courseShortname,
                        courseName: courseName,
                        courseId: courseData.courseId,
                        dueDate: quiz.dueAt ? new Date(quiz.dueAt * 1000).toISOString() : null,
                        status: quiz.status || 'pending',
                        gradeFormatted: quiz.gradeFormatted ?? null,
                        gradeMax: quiz.gradeMax ?? null,
                        gradePercent: quiz.gradePercent ?? null
                    });
                }
            }

            console.log('[AssignmentManager] loadAssignments complete:', {
                totalAssignments: flatAssignments.length,
                assignments: flatAssignments.map(a => ({ id: a.id, numericId: a.numericId, title: a.title }))
            });

            this.assignments = flatAssignments;
            this.processAssignments();
        } catch (error) {
            console.error('Error loading assignments:', error);
            this.assignments = [];
        }
    }

    async loadStarredAssignments() {
        try {
            const { starred } = await api.starredAssignments.getAll();
            // Normalize all IDs to numeric format
            // Handle both new format (numeric) and old format (composite like "assign:123")
            this.starredAssignmentIds = starred.map(s => {
                let id = s.moodle_assignment_id;

                // If it's a composite ID like "assign:123", extract the numeric part
                if (typeof id === 'string' && id.includes(':')) {
                    id = id.split(':')[1];
                }

                // Convert to number if possible, otherwise keep as string
                return typeof id === 'number' ? id : (isNaN(id) ? String(id) : Number(id));
            });

            console.log('[AssignmentManager] Loaded starred assignments:', {
                count: this.starredAssignmentIds.length,
                ids: this.starredAssignmentIds,
                raw: starred.map(s => ({ id: s.id, moodle_assignment_id: s.moodle_assignment_id, type: typeof s.moodle_assignment_id }))
            });
            this.renderStarredAssignments();
        } catch (error) {
            console.error('Error loading starred assignments:', error);
            this.starredAssignmentIds = [];
            this.renderStarredAssignments();
        }
    }

    // Render starred assignments section
    renderStarredAssignments() {
        const container = document.getElementById('starredAssignmentsContainer');
        if (!container) return;

        const starredAssignments = this.assignments.filter(assignment => {
            // Extract numeric ID from composite ID and compare
            const numericId = assignment.numericId || (assignment.id.includes(':') ? assignment.id.split(':')[1] : assignment.id);
            const isStarred = this.starredAssignmentIds.includes(Number(numericId)) || this.starredAssignmentIds.includes(String(numericId));
            if (isStarred) {
                console.log('[AssignmentManager] Found starred assignment:', {
                    composite: assignment.id,
                    numeric: numericId,
                    type: typeof numericId,
                    starredIds: this.starredAssignmentIds
                });
            }
            return isStarred;
        });

        console.log('[AssignmentManager] renderStarredAssignments:', {
            totalAssignments: this.assignments.length,
            starredCount: starredAssignments.length,
            starredIds: this.starredAssignmentIds,
            assignments: this.assignments.map(a => ({ id: a.id, numericId: a.numericId }))
        });

        // Calculate dynamic grid columns based on number of starred assignments
        const count = starredAssignments.length;
        let gridClass = 'grid gap-3';

        if (count === 0) {
            gridClass += ' grid-cols-1';
        } else if (count === 1) {
            gridClass += ' grid-cols-1';
        } else if (count === 2) {
            gridClass += ' grid-cols-1 sm:grid-cols-2';
        } else if (count === 3) {
            gridClass += ' grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
        } else if (count === 4) {
            gridClass += ' grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4';
        } else if (count <= 6) {
            gridClass += ' grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5';
        } else if (count <= 9) {
            gridClass += ' grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
        } else {
            gridClass += ' grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6';
        }

        // Apply the dynamic grid class
        container.className = gridClass;

        if (starredAssignments.length === 0) {
            container.innerHTML = `
                <div class="col-span-full rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-800 p-8 text-center">
                    <div class="text-4xl mb-3">⭐</div>
                    <h3 class="text-base font-medium text-slate-700 dark:text-slate-200 mb-1">No Starred Assignments</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400">Star assignments to see them here for quick access.</p>
                </div>
            `;
        } else {
            container.innerHTML = starredAssignments
                .map(assignment => this.renderAssignmentCard(assignment))
                .join('');
        }
    }

    // Render all upcoming assignments with calendar-style colors
    async renderAllAssignments() {
        // Add loading state at the start
        this.addAllAssignmentsLoadingState();

        const container = document.getElementById('assignmentsContainer');
        if (!container) return;

        const now = new Date();

        // Filter to show only upcoming assignments (not overdue, has due date)
        const upcomingAssignments = this.assignments.filter(assignment => {
            if (!assignment.dueDate) return false;
            const dueDate = new Date(assignment.dueDate);
            return dueDate >= now;
        });

        if (upcomingAssignments.length === 0) {
            container.innerHTML = `
                <div class="rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-800 p-8 text-center">
                    <div class="text-4xl mb-3">🎉</div>
                    <h3 class="text-base font-medium text-slate-700 dark:text-slate-300 mb-1">All Caught Up!</h3>
                    <p class="text-sm text-slate-500 dark:text-slate-400">No upcoming assignments at the moment.</p>
                </div>
            `;
            // Remove loading state after rendering
            this.removeAllAssignmentsLoadingState();
            return;
        }

        // Render each assignment with calendar-style colors
        container.innerHTML = upcomingAssignments
            .map(assignment => this.renderAssignmentCardWithColors(assignment))
            .join('');

        // Remove loading state after rendering
        this.removeAllAssignmentsLoadingState();
    }

    // Toggle star status for an assignment
    async toggleStar(compositeAssignmentId) {
        // compositeAssignmentId is in format "type:numericId" (e.g., "assign:12345")
        const assignment = this.assignments.find(a => a.id === compositeAssignmentId);
        if (!assignment) {
            console.error('Assignment not found:', compositeAssignmentId);
            return;
        }

        const numericId = assignment.numericId || Number(compositeAssignmentId.split(':')[1]);
        const numericIdStr = String(numericId);
        const isStarred = this.starredAssignmentIds.includes(numericId) || this.starredAssignmentIds.includes(numericIdStr);

        // If unstarring, show confirmation prompt
        if (isStarred) {
            const assignmentName = assignment.title || 'this assignment';

            const confirmed = confirm(`Are you sure you want to unstar "${assignmentName}"?`);
            if (!confirmed) {
                return; // User cancelled
            }
        }

        try {
            if (isStarred) {
                await api.starredAssignments.unstar(numericIdStr);
                // Remove from starred list (handle both number and string formats)
                this.starredAssignmentIds = this.starredAssignmentIds.filter(id =>
                    id !== numericId && id !== numericIdStr
                );
                this.showNotification('Assignment unstarred');
            } else {
                await api.starredAssignments.star(numericIdStr);
                // Add to starred list as number
                if (!this.starredAssignmentIds.includes(numericId)) {
                    this.starredAssignmentIds.push(numericId);
                }
                this.showNotification('Assignment starred!');
            }

            // Re-render both sections to update star display
            this.renderStarredAssignments();
            this.renderAllAssignments();
        } catch (error) {
            console.error('Error toggling star:', error);
            this.showNotification('Failed to update star status');
        }
    }

    renderAssignmentCard(assignment) {
        // Extract numeric ID from composite ID
        const numericId = assignment.numericId || (assignment.id.includes(':') ? assignment.id.split(':')[1] : assignment.id);
        const isStarred = this.starredAssignmentIds.includes(Number(numericId)) || this.starredAssignmentIds.includes(String(numericId));
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800',
            graded: 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800',
            submitted: 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800',
            overdue: 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800'
        };
        const typeLabel = assignment.type === 'quiz' ? '📝 Quiz' : '📄 Assignment';
        const gradeDisplay = assignment.gradeFormatted && assignment.gradeMax
            ? `${assignment.gradeFormatted} / ${assignment.gradeMax}${assignment.gradePercent ? ` (${assignment.gradePercent})` : ''}`
            : '—';

        return `
            <div class="rounded-xl border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 p-4 dark:shadow-neutral-200 hover:shadow-md transition-shadow cursor-pointer"
                 data-id="${assignment.id}"
                 onclick="assignmentManager.openModal('${assignment.id}')">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-sm">${typeLabel}</span>
                            <h3 class="text-base font-semibold text-slate-900 dark:text-slate-200">${assignment.title}</h3>
                        </div>
                        <p class="text-sm text-slate-600 dark:text-slate-400">${assignment.course} - ${assignment.courseName}</p>
                    </div>
                    <div class="flex items-center gap-2 ml-3">
                        <button
                            class="text-2xl hover:scale-110 transition-transform cursor-pointer z-10"
                            onclick="event.stopPropagation(); assignmentManager.toggleStar('${assignment.id}')"
                            title="${isStarred ? 'Unstar' : 'Star'} assignment"
                        >
                            ${isStarred ? '⭐' : '☆'}
                        </button>
                        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusColors[assignment.status] || statusColors.pending}">
                            ${assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                        </span>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-sm">
                    ${assignment.dueDate ? `
                        <div>
                            <span class="text-slate-500 dark:text-slate-400">Due Date:</span>
                            <p class="text-slate-900 dark:text-slate-200 font-medium">${this.formatDate(assignment.dueDate)}</p>
                        </div>
                        <div>
                            <span class="text-slate-500 dark:text-slate-400">Time Remaining:</span>
                            <p class="text-slate-900 dark:text-slate-200 font-medium">${assignment.timeRemaining}</p>
                        </div>
                        <div>
                            <span class="text-slate-500 dark:text-slate-400">Grade:</span>
                            <p class="text-slate-900 dark:text-slate-200 font-medium">${gradeDisplay}</p>
                        </div>
                    ` : `
                        <div class="col-span-2">
                            <span class="text-slate-500 dark:text-slate-400">No due date set</span>
                        </div>
                        <div>
                            <span class="text-slate-500 dark:text-slate-400">Grade:</span>
                            <p class="text-slate-900 dark:text-slate-200 font-medium">${gradeDisplay}</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // Render assignment card with calendar-style colors (border = course, background = type)
    renderAssignmentCardWithColors(assignment) {
        // Extract numeric ID from composite ID
        const numericId = assignment.numericId || (assignment.id.includes(':') ? assignment.id.split(':')[1] : assignment.id);
        const isStarred = this.starredAssignmentIds.includes(Number(numericId)) || this.starredAssignmentIds.includes(String(numericId));
        const typeLabel = assignment.type === 'quiz' ? '📝 Quiz' : '📄 Assignment';
        const gradeDisplay = assignment.gradeFormatted && assignment.gradeMax
            ? `${assignment.gradeFormatted} / ${assignment.gradeMax}${assignment.gradePercent ? ` (${assignment.gradePercent})` : ''}`
            : '—';

        // Get colors: border = course color, background = type color with transparency
        const courseColor = this.courseColors[String(assignment.courseId)] || '#6366f1';
        const typeColor = this.typeColors[assignment.type] || '#8b5cf6';
        const backgroundColor = typeColor + '66'; // Add 40% opacity

        return `
            <div class="rounded-xl p-4 hover:shadow-md transition-all cursor-pointer"
                 style="border: 3px solid ${courseColor}; background-color: ${backgroundColor};"
                 data-id="${assignment.id}"
                 onclick="assignmentManager.openModal('${assignment.id}')">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-sm text-slate-900 dark:text-slate-100">${typeLabel}</span>
                        </div>
                        <h3 class="text-base font-semibold text-slate-900 dark:text-slate-100 mb-1">${assignment.title}</h3>
                        <p class="text-sm text-slate-700 dark:text-slate-200">${assignment.course} - ${assignment.courseName}</p>
                    </div>
                    <div class="flex items-center gap-2 ml-3">
                        <button
                            class="text-2xl hover:scale-110 transition-transform cursor-pointer z-10"
                            onclick="event.stopPropagation(); assignmentManager.toggleStar('${assignment.id}')"
                            title="${isStarred ? 'Unstar' : 'Star'} assignment"
                        >
                            ${isStarred ? '⭐' : '☆'}
                        </button>
                    </div>
                </div>

                <div class="grid grid-cols-2 gap-3 text-sm">
                    ${assignment.dueDate ? `
                        <div>
                            <span class="text-slate-700 dark:text-slate-200">Due Date:</span>
                            <p class="text-slate-900 dark:text-slate-100 font-medium">${this.formatDate(assignment.dueDate)}</p>
                        </div>
                        <div>
                            <span class="text-slate-700 dark:text-slate-200">Time Remaining:</span>
                            <p class="text-slate-900 dark:text-slate-100 font-medium">${assignment.timeRemaining}</p>
                        </div>
                        <div>
                            <span class="text-slate-700 dark:text-slate-200">Grade:</span>
                            <p class="text-slate-900 dark:text-slate-100 font-medium">${gradeDisplay}</p>
                        </div>
                    ` : `
                        <div class="col-span-2">
                            <span class="text-slate-700 dark:text-slate-200">No due date set</span>
                        </div>
                        <div>
                            <span class="text-slate-700 dark:text-slate-200">Grade:</span>
                            <p class="text-slate-900 dark:text-slate-100 font-medium">${gradeDisplay}</p>
                        </div>
                    `}
                </div>
            </div>
        `;
    }

    // Open assignment details modal
    openModal(assignmentId) {
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (!assignment) {
            console.error('Assignment not found:', assignmentId);
            return;
        }

        // Use the composite ID (e.g., "assign:123") to match dashboard calendar format
        // This ensures focus mode can find the assignment in the calendar data
        const compositeId = assignment.id;

        // Prepare assignment data in the format expected by the modal
        const assignmentData = {
            id: compositeId,        // Use composite ID for consistency with dashboard (e.g., "assign:123")
            type: assignment.type,
            title: assignment.title,
            courseName: assignment.courseName,
            dueAt: assignment.dueDate ? Math.floor(new Date(assignment.dueDate).getTime() / 1000) : null,
            gradeFormatted: assignment.gradeFormatted ?? null,
            gradeMax: assignment.gradeMax ?? null,
            gradePercent: assignment.gradePercent ?? null,
            instructorComments: assignment.instructorComments ?? null
        };

        // Provide callback to refresh starred assignments after modal closes
        const self = this;
        openAssignmentDetailsModal(assignmentData, async () => {
            // Refresh starred assignments in case star status changed
            await self.loadStarredAssignments();
            // Also re-render the all assignments list to update star icons
            self.renderAllAssignments();
        });
    }

    // Process assignments (calculate time remaining, trust backend status)
    processAssignments() {
        this.assignments.forEach(assignment => {
            if (!assignment.dueDate) {
                assignment.timeRemaining = 'No due date';
                return;
            }

            const dueDate = new Date(assignment.dueDate);

            // Trust the status from the backend (already calculated by enrichWithGrades)
            // Status values: 'pending', 'graded', 'submitted', 'overdue'
            // If not set, default to 'pending'
            if (!assignment.status) {
                assignment.status = 'pending';
            }

            // Calculate time remaining
            assignment.timeRemaining = this.calculateTimeRemaining(dueDate);
        });

        // Sort by due date (nulls last)
        this.assignments.sort((a, b) => {
            if (!a.dueDate) return 1;
            if (!b.dueDate) return -1;
            return new Date(a.dueDate) - new Date(b.dueDate);
        });
    }

    calculateTimeRemaining(dueDate) {
        const now = new Date();
        const diff = dueDate - now;

        if (diff < 0) return 'Overdue';

        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

        if (days > 0) {
            return `${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'}`;
        } else if (hours > 0) {
            return `${hours} hour${hours === 1 ? '' : 's'}`;
        } else {
            const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
            return `${minutes} minute${minutes === 1 ? '' : 's'}`;
        }
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    showNotification(message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = 'fixed top-4 right-4 px-4 py-3 rounded-lg bg-indigo-600 text-white shadow-lg z-50 transition-opacity';
        notification.textContent = message;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.opacity = '0';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    // Add loading state to all assignments container
    addAllAssignmentsLoadingState() {
        const container = document.getElementById('assignmentsContainer');
        if (container) {
            container.classList.add("animate-pulse", "cursor-progress");
        }
    }

    // Remove loading state from all assignments container
    removeAllAssignmentsLoadingState() {
        const container = document.getElementById('assignmentsContainer');
        if (container) {
            container.classList.remove("animate-pulse", "cursor-progress");
        }
    }
}

// Global instance - make it accessible from inline onclick handlers
window.assignmentManager = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.assignmentManager = new AssignmentManager();
});