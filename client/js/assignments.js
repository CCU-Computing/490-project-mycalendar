// assignments.js - Starred assignments display
import { api } from './apiClient.js';
import { openAssignmentDetailsModal } from '../components/AssignmentDetailsModal.js';

class AssignmentManager {
    constructor() {
        this.assignments = [];
        this.courses = new Map();
        this.starredAssignmentIds = [];
        this.init();
    }

    async init() {
        await this.loadCourses();
        await this.loadAssignments();
        await this.loadStarredAssignments();
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

    async loadAssignments() {
        try {
            const { courses } = await api.work();
            const flatAssignments = [];

            for (const courseData of courses) {
                const course = this.courses.get(courseData.courseId);
                const courseName = course?.name || 'Unknown Course';
                const courseShortname = course?.shortname || `Course ${courseData.courseId}`;

                // Process assignments
                for (const assignment of courseData.assignments || []) {
                    flatAssignments.push({
                        id: `${assignment.type}:${assignment.id}`,
                        type: assignment.type,
                        title: assignment.name,
                        course: courseShortname,
                        courseName: courseName,
                        dueDate: assignment.dueAt ? new Date(assignment.dueAt * 1000).toISOString() : null,
                        status: 'pending'
                    });
                }

                // Process quizzes
                for (const quiz of courseData.quizzes || []) {
                    flatAssignments.push({
                        id: `${quiz.type}:${quiz.id}`,
                        type: quiz.type,
                        title: quiz.name,
                        course: courseShortname,
                        courseName: courseName,
                        dueDate: quiz.dueAt ? new Date(quiz.dueAt * 1000).toISOString() : null,
                        status: 'pending'
                    });
                }
            }

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
            this.starredAssignmentIds = starred.map(s => String(s.moodle_assignment_id));
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

        const starredAssignments = this.assignments.filter(assignment =>
            this.starredAssignmentIds.includes(String(assignment.id))
        );

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
                <div class="col-span-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <div class="text-4xl mb-3">⭐</div>
                    <h3 class="text-base font-medium text-slate-700 mb-1">No Starred Assignments</h3>
                    <p class="text-sm text-slate-500">Star assignments to see them here for quick access.</p>
                </div>
            `;
        } else {
            container.innerHTML = starredAssignments
                .map(assignment => this.renderAssignmentCard(assignment))
                .join('');
        }
    }

    // Toggle star status for an assignment
    async toggleStar(assignmentId) {
        const assignmentIdStr = String(assignmentId);
        const isStarred = this.starredAssignmentIds.includes(assignmentIdStr);

        // If unstarring, show confirmation prompt
        if (isStarred) {
            const assignment = this.assignments.find(a => a.id === assignmentIdStr);
            const assignmentName = assignment ? assignment.title : 'this assignment';

            const confirmed = confirm(`Are you sure you want to unstar "${assignmentName}"?`);
            if (!confirmed) {
                return; // User cancelled
            }
        }

        try {
            if (isStarred) {
                await api.starredAssignments.unstar(assignmentIdStr);
                this.starredAssignmentIds = this.starredAssignmentIds.filter(id => id !== assignmentIdStr);
                this.showNotification('Assignment unstarred');
            } else {
                await api.starredAssignments.star(assignmentIdStr);
                this.starredAssignmentIds.push(assignmentIdStr);
                this.showNotification('Assignment starred!');
            }

            // Re-render starred section
            this.renderStarredAssignments();
        } catch (error) {
            console.error('Error toggling star:', error);
            this.showNotification('Failed to update star status');
        }
    }

    renderAssignmentCard(assignment) {
        const isStarred = this.starredAssignmentIds.includes(String(assignment.id));
        const statusColors = {
            pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
            overdue: 'bg-red-100 text-red-800 border-red-200'
        };
        const typeLabel = assignment.type === 'quiz' ? '📝 Quiz' : '📄 Assignment';

        return `
            <div class="rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow cursor-pointer"
                 data-id="${assignment.id}"
                 onclick="assignmentManager.openModal('${assignment.id}')">
                <div class="flex items-start justify-between mb-3">
                    <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                            <span class="text-sm">${typeLabel}</span>
                            <h3 class="text-base font-semibold text-slate-900">${assignment.title}</h3>
                        </div>
                        <p class="text-sm text-slate-600">${assignment.course} - ${assignment.courseName}</p>
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
                            <span class="text-slate-500">Due Date:</span>
                            <p class="text-slate-900 font-medium">${this.formatDate(assignment.dueDate)}</p>
                        </div>
                        <div>
                            <span class="text-slate-500">Time Remaining:</span>
                            <p class="text-slate-900 font-medium">${assignment.timeRemaining}</p>
                        </div>
                    ` : `
                        <div class="col-span-2">
                            <span class="text-slate-500">No due date set</span>
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

        // Extract the numeric ID from the prefixed ID (e.g., "assign:123" -> "123")
        const numericId = assignment.id.split(':')[1];

        // Prepare assignment data in the format expected by the modal
        const assignmentData = {
            id: numericId,
            type: assignment.type,
            title: assignment.title,
            courseName: assignment.courseName,
            dueAt: assignment.dueDate ? Math.floor(new Date(assignment.dueDate).getTime() / 1000) : null,
        };

        openAssignmentDetailsModal(assignmentData);
    }

    // Process assignments (calculate status, etc.)
    processAssignments() {
        const now = new Date();

        this.assignments.forEach(assignment => {
            if (!assignment.dueDate) {
                assignment.timeRemaining = 'No due date';
                return;
            }

            const dueDate = new Date(assignment.dueDate);

            // Update status based on dates
            if (assignment.grade !== null) {
                assignment.status = 'graded';
            } else if (assignment.submittedDate) {
                assignment.status = 'submitted';
            } else if (dueDate < now) {
                assignment.status = 'overdue';
            } else {
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
}

// Global instance - make it accessible from inline onclick handlers
window.assignmentManager = null;

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.assignmentManager = new AssignmentManager();
});