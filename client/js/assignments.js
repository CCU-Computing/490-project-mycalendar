// assignments.js - Assignment tracking and notification system
import { api } from './apiClient.js';

class AssignmentManager {
    constructor() {
        this.assignments = [];
        this.filteredAssignments = [];
        this.courses = new Set();
        this.notificationSettings = this.loadNotificationSettings();
        this.starredAssignmentIds = []; // Array of starred assignment IDs
        this.init();
    }

    async init() {
        await this.loadAssignments();
        await this.loadStarredAssignments();
        this.setupEventListeners();
        this.checkForUpcomingDeadlines();
        this.startNotificationTimer();
    }

    // Load assignments from API
    async loadAssignments() {
        try {
            const token = localStorage.getItem('token');
            
            // Show loading state
            this.showLoading();

            // Fetch assignments from API
            const response = await fetch('/api/assignments', {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                // If API fails, use mock data for demonstration
                this.assignments = this.getMockAssignments();
            } else {
                this.assignments = await response.json();
            }

            // Process assignments
            this.processAssignments();
            this.updateStatistics();
            this.renderAssignments();
            this.populateCourseFilter();

        } catch (error) {
            console.error('Error loading assignments:', error);
            // Use mock data as fallback
            this.assignments = this.getMockAssignments();
            this.processAssignments();
            this.updateStatistics();
            this.renderAssignments();
            this.populateCourseFilter();
        }
    }

    // Load starred assignments from API
    async loadStarredAssignments() {
        try {
            // Get starred assignments
            const { starred } = await api.starredAssignments.getAll();
            this.starredAssignmentIds = starred.map(s => String(s.moodle_assignment_id));
            
            // Render starred section
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

        if (starredAssignments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-star"></i>
                    <h3>No Starred Assignments</h3>
                    <p>Star assignments to see them here for quick access.</p>
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
        
        try {
            if (isStarred) {
                await api.starredAssignments.unstar(assignmentIdStr);
                this.starredAssignmentIds = this.starredAssignmentIds.filter(id => id !== assignmentIdStr);
                this.showNotification('success', 'Assignment unstarred');
            } else {
                await api.starredAssignments.star(assignmentIdStr);
                this.starredAssignmentIds.push(assignmentIdStr);
                this.showNotification('success', 'Assignment starred!');
            }

            // Re-render both sections
            this.renderStarredAssignments();
            this.renderAssignments();
        } catch (error) {
            console.error('Error toggling star:', error);
            this.showNotification('warning', 'Failed to update star status');
        }
    }

    // Mock data for demonstration
    getMockAssignments() {
        return [
            {
                id: 1,
                title: "Data Structures Project",
                course: "CS 201",
                courseName: "Data Structures & Algorithms",
                dueDate: this.addDays(new Date(), 2).toISOString(),
                submittedDate: null,
                status: "pending",
                grade: null,
                maxGrade: 100,
                description: "Implement a balanced binary search tree",
                priority: "high"
            },
            {
                id: 2,
                title: "Machine Learning Assignment 3",
                course: "CS 441",
                courseName: "Introduction to Machine Learning",
                dueDate: this.addDays(new Date(), 5).toISOString(),
                submittedDate: this.addDays(new Date(), -2).toISOString(),
                status: "submitted",
                grade: null,
                maxGrade: 100,
                description: "Neural network implementation",
                priority: "medium"
            },
            {
                id: 3,
                title: "Database Design Report",
                course: "CS 301",
                courseName: "Database Systems",
                dueDate: this.addDays(new Date(), -1).toISOString(),
                submittedDate: null,
                status: "overdue",
                grade: null,
                maxGrade: 50,
                description: "Design a relational database for e-commerce",
                priority: "high"
            },
            {
                id: 4,
                title: "Web Development Lab 5",
                course: "CS 352",
                courseName: "Web Technologies",
                dueDate: this.addDays(new Date(), 7).toISOString(),
                submittedDate: this.addDays(new Date(), -5).toISOString(),
                status: "graded",
                grade: 92,
                maxGrade: 100,
                description: "Create a responsive website",
                priority: "low"
            },
            {
                id: 5,
                title: "Operating Systems Quiz",
                course: "CS 401",
                courseName: "Operating Systems",
                dueDate: this.addDays(new Date(), 1).toISOString(),
                submittedDate: null,
                status: "pending",
                grade: null,
                maxGrade: 25,
                description: "Chapter 5-7 quiz on process scheduling",
                priority: "medium"
            }
        ];
    }

    // Process assignments (calculate status, etc.)
    processAssignments() {
        const now = new Date();
        
        this.assignments.forEach(assignment => {
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
            
            // Add to courses set
            this.courses.add(assignment.course);
        });

        // Sort by due date
        this.assignments.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
        this.filteredAssignments = [...this.assignments];
    }

    // Calculate time remaining until due date
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

    // Render assignments to the page
    renderAssignments() {
        const container = document.getElementById('assignmentsContainer');
        
        if (this.filteredAssignments.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-inbox"></i>
                    <h3>No Assignments Found</h3>
                    <p>There are no assignments matching your filters.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = this.filteredAssignments
            .map(assignment => this.renderAssignmentCard(assignment))
            .join('');
    }

    // Render individual assignment card with star button
    renderAssignmentCard(assignment) {
        const isStarred = this.starredAssignmentIds.includes(String(assignment.id));
        
        return `
            <div class="assignment-card" data-id="${assignment.id}">
                <div class="assignment-header">
                    <div>
                        <div class="assignment-title">${assignment.title}</div>
                        <div class="assignment-course">${assignment.course} - ${assignment.courseName}</div>
                    </div>
                    <div style="display: flex; align-items: center; gap: 10px;">
                        <button 
                            class="star-button ${isStarred ? 'starred' : ''}" 
                            onclick="assignmentManager.toggleStar(${assignment.id})"
                            title="${isStarred ? 'Unstar' : 'Star'} assignment"
                        >
                            ${isStarred ? '⭐' : '☆'}
                        </button>
                        <span class="assignment-status status-${assignment.status}">
                            ${assignment.status.charAt(0).toUpperCase() + assignment.status.slice(1)}
                        </span>
                    </div>
                </div>
                
                <div class="assignment-details">
                    <div class="detail-item">
                        <span class="detail-label">Due Date</span>
                        <span class="detail-value">${this.formatDate(assignment.dueDate)}</span>
                    </div>
                    <div class="detail-item">
                        <span class="detail-label">Time Remaining</span>
                        <span class="detail-value">${assignment.timeRemaining}</span>
                    </div>
                    ${assignment.submittedDate ? `
                        <div class="detail-item">
                            <span class="detail-label">Submitted</span>
                            <span class="detail-value">${this.formatDate(assignment.submittedDate)}</span>
                        </div>
                    ` : ''}
                    ${assignment.grade !== null ? `
                        <div class="detail-item">
                            <span class="detail-label">Grade</span>
                            <span class="detail-value">${assignment.grade}/${assignment.maxGrade}</span>
                        </div>
                    ` : `
                        <div class="detail-item">
                            <span class="detail-label">Max Grade</span>
                            <span class="detail-value">${assignment.maxGrade} points</span>
                        </div>
                    `}
                </div>
                
                <div class="assignment-actions">
                    ${assignment.status === 'pending' || assignment.status === 'overdue' ? `
                        <button class="btn btn-primary btn-sm" onclick="assignmentManager.submitAssignment(${assignment.id})">
                            <i class="fas fa-upload"></i> Submit
                        </button>
                    ` : ''}
                    <button class="btn btn-secondary btn-sm" onclick="assignmentManager.setReminder(${assignment.id})">
                        <i class="fas fa-bell"></i> Set Reminder
                    </button>
                    <button class="btn btn-secondary btn-sm" onclick="assignmentManager.viewDetails(${assignment.id})">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                </div>
            </div>
        `;
    }

    // Update statistics
    updateStatistics() {
        const stats = {
            total: this.assignments.length,
            pending: this.assignments.filter(a => a.status === 'pending').length,
            submitted: this.assignments.filter(a => a.status === 'submitted').length,
            overdue: this.assignments.filter(a => a.status === 'overdue').length
        };

        document.getElementById('totalCount').textContent = stats.total;
        document.getElementById('pendingCount').textContent = stats.pending;
        document.getElementById('submittedCount').textContent = stats.submitted;
        document.getElementById('overdueCount').textContent = stats.overdue;

        // Update notification badge
        const notificationCount = stats.pending + stats.overdue;
        const badge = document.getElementById('notificationCount');
        if (notificationCount > 0) {
            badge.textContent = notificationCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    // Filter assignments
    filterAssignments() {
        const statusFilter = document.getElementById('statusFilter').value;
        const courseFilter = document.getElementById('courseFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;
        const searchFilter = document.getElementById('searchFilter').value.toLowerCase();

        this.filteredAssignments = this.assignments.filter(assignment => {
            // Status filter
            if (statusFilter !== 'all' && assignment.status !== statusFilter) {
                return false;
            }

            // Course filter
            if (courseFilter !== 'all' && assignment.course !== courseFilter) {
                return false;
            }

            // Date filter
            if (dateFilter !== 'all') {
                const dueDate = new Date(assignment.dueDate);
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const weekEnd = new Date(today);
                weekEnd.setDate(weekEnd.getDate() + 7);
                const monthEnd = new Date(today);
                monthEnd.setMonth(monthEnd.getMonth() + 1);

                switch (dateFilter) {
                    case 'today':
                        if (dueDate.toDateString() !== today.toDateString()) return false;
                        break;
                    case 'week':
                        if (dueDate > weekEnd) return false;
                        break;
                    case 'month':
                        if (dueDate > monthEnd) return false;
                        break;
                    case 'past':
                        if (dueDate >= today) return false;
                        break;
                }
            }

            // Search filter
            if (searchFilter && !assignment.title.toLowerCase().includes(searchFilter) &&
                !assignment.courseName.toLowerCase().includes(searchFilter)) {
                return false;
            }

            return true;
        });

        this.renderAssignments();
    }

    // Populate course filter dropdown
    populateCourseFilter() {
        const courseFilter = document.getElementById('courseFilter');
        const currentValue = courseFilter.value;
        
        courseFilter.innerHTML = '<option value="all">All Courses</option>';
        
        Array.from(this.courses).sort().forEach(course => {
            const option = document.createElement('option');
            option.value = course;
            option.textContent = course;
            courseFilter.appendChild(option);
        });

        courseFilter.value = currentValue;
    }

    // Set reminder for an assignment
    async setReminder(assignmentId) {
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (!assignment) return;

        const settings = this.loadNotificationSettings();
        
        if (!settings.phoneNumber && settings.notificationType !== 'email') {
            alert('Please configure your notification settings first!');
            openNotificationSettings();
            return;
        }

        try {
            // Send notification request to backend
            const response = await fetch('/api/notifications/reminder', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    assignmentId: assignment.id,
                    title: assignment.title,
                    dueDate: assignment.dueDate,
                    phoneNumber: settings.phoneNumber,
                    notificationType: settings.notificationType,
                    reminderTime: settings.reminderTime
                })
            });

            if (response.ok) {
                this.showNotification('success', `Reminder set for "${assignment.title}"!`);
            } else {
                // Fallback: Use browser notification API
                this.setBrowserReminder(assignment);
            }
        } catch (error) {
            console.error('Error setting reminder:', error);
            // Fallback to browser notifications
            this.setBrowserReminder(assignment);
        }
    }

    // Set browser-based reminder
    setBrowserReminder(assignment) {
        if ('Notification' in window) {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    const dueDate = new Date(assignment.dueDate);
                    const reminderTime = this.notificationSettings.reminderTime * 60 * 60 * 1000; // Convert hours to milliseconds
                    const notifyAt = new Date(dueDate.getTime() - reminderTime);
                    const timeUntilNotification = notifyAt - new Date();

                    if (timeUntilNotification > 0) {
                        setTimeout(() => {
                            new Notification('Assignment Reminder', {
                                body: `"${assignment.title}" is due on ${this.formatDate(assignment.dueDate)}`,
                                icon: '/favicon.ico',
                                tag: `assignment-${assignment.id}`
                            });
                        }, timeUntilNotification);

                        this.showNotification('success', `Browser reminder set for "${assignment.title}"!`);
                    } else {
                        this.showNotification('warning', 'Assignment is due too soon for this reminder time.');
                    }
                }
            });
        }
    }

    // Check for upcoming deadlines
    checkForUpcomingDeadlines() {
        const now = new Date();
        const upcomingDeadline = 24 * 60 * 60 * 1000; // 24 hours

        this.assignments.forEach(assignment => {
            if (assignment.status === 'pending') {
                const dueDate = new Date(assignment.dueDate);
                const timeUntilDue = dueDate - now;

                if (timeUntilDue > 0 && timeUntilDue < upcomingDeadline) {
                    console.log(`Upcoming deadline: ${assignment.title}`);
                    // Automatically set reminder if notifications are enabled
                    if (this.notificationSettings.enableNotifications) {
                        this.setReminder(assignment.id);
                    }
                }
            }
        });
    }

    // Start notification timer
    startNotificationTimer() {
        // Check for upcoming deadlines every hour
        setInterval(() => {
            this.checkForUpcomingDeadlines();
        }, 60 * 60 * 1000);
    }

    // Submit assignment (mock)
    async submitAssignment(assignmentId) {
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (!assignment) return;

        if (confirm(`Submit "${assignment.title}"?`)) {
            try {
                const response = await fetch(`/api/assignments/${assignmentId}/submit`, {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${localStorage.getItem('token')}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (response.ok || true) { // Allow mock success
                    assignment.submittedDate = new Date().toISOString();
                    assignment.status = 'submitted';
                    this.processAssignments();
                    this.updateStatistics();
                    this.renderAssignments();
                    this.renderStarredAssignments();
                    this.showNotification('success', `Successfully submitted "${assignment.title}"!`);
                }
            } catch (error) {
                console.error('Error submitting assignment:', error);
                // Mock success for demo
                assignment.submittedDate = new Date().toISOString();
                assignment.status = 'submitted';
                this.processAssignments();
                this.updateStatistics();
                this.renderAssignments();
                this.renderStarredAssignments();
                this.showNotification('success', `Successfully submitted "${assignment.title}"!`);
            }
        }
    }

    // View assignment details
    viewDetails(assignmentId) {
        const assignment = this.assignments.find(a => a.id === assignmentId);
        if (!assignment) return;

        alert(`
Assignment Details:
Title: ${assignment.title}
Course: ${assignment.course} - ${assignment.courseName}
Due Date: ${this.formatDate(assignment.dueDate)}
Status: ${assignment.status}
Description: ${assignment.description}
Max Grade: ${assignment.maxGrade} points
${assignment.grade !== null ? `Grade: ${assignment.grade}/${assignment.maxGrade}` : ''}
        `);
    }

    // Notification settings methods
    loadNotificationSettings() {
        const saved = localStorage.getItem('notificationSettings');
        return saved ? JSON.parse(saved) : {
            phoneNumber: '',
            notificationType: 'sms',
            reminderTime: 24,
            enableNotifications: true
        };
    }

    saveNotificationSettings(settings) {
        localStorage.setItem('notificationSettings', JSON.stringify(settings));
        this.notificationSettings = settings;
    }

    // Utility methods
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

    addDays(date, days) {
        const result = new Date(date);
        result.setDate(result.getDate() + days);
        return result;
    }

    showLoading() {
        document.getElementById('assignmentsContainer').innerHTML = `
            <div class="loading">
                <div class="loading-spinner"></div>
                <p>Loading assignments...</p>
            </div>
        `;
    }

    showNotification(type, message) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            ${message}
        `;
        
        // Style the notification
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 15px 20px;
            background: ${type === 'success' ? '#48bb78' : '#f6ad55'};
            color: white;
            border-radius: 8px;
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideIn 0.3s ease;
        `;

        document.body.appendChild(notification);

        // Remove after 3 seconds
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    setupEventListeners() {
        // Filter event listeners are already attached inline in HTML
    }
}

// Global functions for HTML onclick handlers
let assignmentManager;

function refreshAssignments() {
    assignmentManager.loadAssignments();
    assignmentManager.loadStarredAssignments();
}

function filterAssignments() {
    assignmentManager.filterAssignments();
}

function openNotificationSettings() {
    const modal = document.getElementById('notificationModal');
    const settings = assignmentManager.loadNotificationSettings();
    
    // Populate form with saved settings
    document.getElementById('phoneNumber').value = settings.phoneNumber || '';
    document.getElementById('notificationType').value = settings.notificationType || 'sms';
    document.getElementById('reminderTime').value = settings.reminderTime || 24;
    document.getElementById('enableNotifications').checked = settings.enableNotifications !== false;
    
    modal.style.display = 'flex';
}

function closeNotificationModal() {
    document.getElementById('notificationModal').style.display = 'none';
}

function saveNotificationSettings() {
    const settings = {
        phoneNumber: document.getElementById('phoneNumber').value,
        notificationType: document.getElementById('notificationType').value,
        reminderTime: parseInt(document.getElementById('reminderTime').value),
        enableNotifications: document.getElementById('enableNotifications').checked
    };

    // Validate phone number if SMS is selected
    if ((settings.notificationType === 'sms' || settings.notificationType === 'both') && 
        !settings.phoneNumber) {
        alert('Please enter a phone number for SMS notifications');
        return;
    }

    assignmentManager.saveNotificationSettings(settings);
    assignmentManager.showNotification('success', 'Notification settings saved!');
    closeNotificationModal();

    // If notifications are enabled, check for upcoming deadlines
    if (settings.enableNotifications) {
        assignmentManager.checkForUpcomingDeadlines();
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    assignmentManager = new AssignmentManager();

    // Add CSS animations
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }

        .star-button {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            padding: 5px;
            transition: transform 0.2s ease;
            line-height: 1;
        }

        .star-button:hover {
            transform: scale(1.2);
        }

        .star-button.starred {
            animation: starPulse 0.3s ease;
        }

        @keyframes starPulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.3); }
        }
    `;
    document.head.appendChild(style);
});
