// notificationService.js - Backend service for SMS notifications and assignment management
const express = require('express');
const router = express.Router();

// Import required packages (install these with npm)
let twilio, nodemailer;

try {
    twilio = require('twilio');
    nodemailer = require('nodemailer');
} catch (error) {
    console.log('Twilio or Nodemailer not installed. SMS/Email features will be disabled.');
}

// Environment variables (create .env file)
const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client (only if credentials are provided)
let twilioClient = null;
if (accountSid && authToken && twilio) {
    try {
        twilioClient = twilio(accountSid, authToken);
        console.log('Twilio client initialized successfully');
    } catch (error) {
        console.log('Failed to initialize Twilio client:', error.message);
    }
}

// Initialize email transporter (only if credentials are provided)
let emailTransporter = null;
if (process.env.EMAIL_USER && process.env.EMAIL_PASS && nodemailer) {
    try {
        emailTransporter = nodemailer.createTransporter({
            service: 'gmail',
            auth: {
                user: process.env.EMAIL_USER,
                pass: process.env.EMAIL_PASS
            }
        });
        console.log('Email transporter initialized successfully');
    } catch (error) {
        console.log('Failed to initialize email transporter:', error.message);
    }
}

// Mock database (replace with your actual database)
const mockAssignments = [
    {
        id: 1,
        user_id: 1,
        title: "Data Structures Project",
        course: "CS 201",
        courseName: "Data Structures & Algorithms",
        due_date: addDays(new Date(), 2).toISOString(),
        submitted_date: null,
        status: "pending",
        grade: null,
        max_grade: 100,
        description: "Implement a balanced binary search tree",
        priority: "high"
    },
    {
        id: 2,
        user_id: 1,
        title: "Machine Learning Assignment 3",
        course: "CS 441",
        courseName: "Introduction to Machine Learning",
        due_date: addDays(new Date(), 5).toISOString(),
        submitted_date: addDays(new Date(), -2).toISOString(),
        status: "submitted",
        grade: null,
        max_grade: 100,
        description: "Neural network implementation",
        priority: "medium"
    },
    {
        id: 3,
        user_id: 1,
        title: "Database Design Report",
        course: "CS 301",
        courseName: "Database Systems",
        due_date: addDays(new Date(), -1).toISOString(),
        submitted_date: null,
        status: "overdue",
        grade: null,
        max_grade: 50,
        description: "Design a relational database for e-commerce",
        priority: "high"
    },
    {
        id: 4,
        user_id: 1,
        title: "Web Development Lab 5",
        course: "CS 352",
        courseName: "Web Technologies",
        due_date: addDays(new Date(), 7).toISOString(),
        submitted_date: addDays(new Date(), -5).toISOString(),
        status: "graded",
        grade: 92,
        max_grade: 100,
        description: "Create a responsive website",
        priority: "low"
    },
    {
        id: 5,
        user_id: 1,
        title: "Operating Systems Quiz",
        course: "CS 401",
        courseName: "Operating Systems",
        due_date: addDays(new Date(), 1).toISOString(),
        submitted_date: null,
        status: "pending",
        grade: null,
        max_grade: 25,
        description: "Chapter 5-7 quiz on process scheduling",
        priority: "medium"
    }
];

// Mock reminders storage (replace with database)
let reminders = [];

// Helper function to add days to date
function addDays(date, days) {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
}

// Middleware to authenticate user (replace with your auth middleware)
const authenticateUser = (req, res, next) => {
    // For now, just add a mock user
    // In real app, verify JWT token and get user from database
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No authorization token provided' });
    }

    // Mock user (replace with actual token verification)
    req.user = { id: 1, email: 'student@example.com' };
    next();
};

// Get all assignments for authenticated user
router.get('/api/assignments', authenticateUser, (req, res) => {
    try {
        // In real app, fetch from database:
        // const assignments = await db.query('SELECT * FROM assignments WHERE user_id = ?', [req.user.id]);
        
        // Return mock data for now
        const userAssignments = mockAssignments.filter(a => a.user_id === req.user.id);
        
        // Process status based on current date
        const now = new Date();
        userAssignments.forEach(assignment => {
            const dueDate = new Date(assignment.due_date);
            
            if (assignment.grade !== null) {
                assignment.status = 'graded';
            } else if (assignment.submitted_date) {
                assignment.status = 'submitted';
            } else if (dueDate < now) {
                assignment.status = 'overdue';
            } else {
                assignment.status = 'pending';
            }
        });

        res.json(userAssignments);
    } catch (error) {
        console.error('Error fetching assignments:', error);
        res.status(500).json({ error: 'Failed to fetch assignments' });
    }
});

// Submit assignment
router.post('/api/assignments/:id/submit', authenticateUser, (req, res) => {
    try {
        const assignmentId = parseInt(req.params.id);
        const assignment = mockAssignments.find(a => a.id === assignmentId && a.user_id === req.user.id);
        
        if (!assignment) {
            return res.status(404).json({ error: 'Assignment not found' });
        }

        // Update assignment
        assignment.submitted_date = new Date().toISOString();
        assignment.status = 'submitted';

        // In real app:
        // await db.query('UPDATE assignments SET submitted_date = NOW(), status = ? WHERE id = ? AND user_id = ?',
        //     ['submitted', assignmentId, req.user.id]);

        res.json({ 
            success: true, 
            message: 'Assignment submitted successfully',
            assignment: assignment
        });
    } catch (error) {
        console.error('Error submitting assignment:', error);
        res.status(500).json({ error: 'Failed to submit assignment' });
    }
});

// Send reminder notification
router.post('/api/notifications/reminder', authenticateUser, async (req, res) => {
    try {
        const {
            assignmentId,
            title,
            dueDate,
            phoneNumber,
            notificationType,
            reminderTime
        } = req.body;

        console.log('Reminder request received:', { assignmentId, title, phoneNumber, notificationType });

        // Validate required fields
        if (!assignmentId || !title || !dueDate) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const formattedDueDate = new Date(dueDate).toLocaleString();
        const message = `📚 Assignment Reminder: "${title}" is due on ${formattedDueDate}. Don't forget to submit! - MyCalendar`;

        let smsResult = null;
        let emailResult = null;
        let reminderScheduled = false;

        // Send SMS
        if ((notificationType === 'sms' || notificationType === 'both') && phoneNumber) {
            if (twilioClient) {
                try {
                    smsResult = await twilioClient.messages.create({
                        body: message,
                        from: twilioPhoneNumber,
                        to: phoneNumber
                    });
                    console.log('SMS sent successfully:', smsResult.sid);
                } catch (smsError) {
                    console.error('Error sending SMS:', smsError);
                    // Don't fail the entire request if SMS fails
                }
            } else {
                console.log('SMS would be sent to:', phoneNumber, 'Message:', message);
                smsResult = { sid: 'mock_sms_' + Date.now() }; // Mock success for demo
            }
        }

        // Send Email
        if ((notificationType === 'email' || notificationType === 'both') && req.user.email) {
            if (emailTransporter) {
                try {
                    emailResult = await emailTransporter.sendMail({
                        from: process.env.EMAIL_USER,
                        to: req.user.email,
                        subject: `📚 Assignment Reminder: ${title}`,
                        html: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #667eea;">📚 Assignment Reminder</h2>
                                <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
                                    <p><strong>Assignment:</strong> ${title}</p>
                                    <p><strong>Due Date:</strong> ${formattedDueDate}</p>
                                    <p style="color: #e74c3c; font-weight: bold;">⏰ This is your scheduled reminder!</p>
                                </div>
                                <p>This is a friendly reminder to complete and submit your assignment on time.</p>
                                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
                                <p style="color: #666; font-size: 12px;">
                                    You received this email because you have notifications enabled in MyCalendar.
                                    <br>Assignment ID: ${assignmentId}
                                </p>
                            </div>
                        `
                    });
                    console.log('Email sent successfully:', emailResult.messageId);
                } catch (emailError) {
                    console.error('Error sending email:', emailError);
                    // Don't fail the entire request if email fails
                }
            } else {
                console.log('Email would be sent to:', req.user.email);
                emailResult = { messageId: 'mock_email_' + Date.now() }; // Mock success for demo
            }
        }

        // Calculate reminder time
        const reminderDate = new Date(new Date(dueDate).getTime() - (reminderTime * 60 * 60 * 1000));
        const now = new Date();

        // Store reminder in mock database
        const reminder = {
            id: Date.now(),
            user_id: req.user.id,
            assignment_id: assignmentId,
            send_at: reminderDate,
            message: message,
            phone_number: phoneNumber,
            type: notificationType,
            status: reminderDate <= now ? 'sent' : 'scheduled',
            created_at: new Date(),
            sms_id: smsResult?.sid,
            email_id: emailResult?.messageId
        };

        reminders.push(reminder);
        reminderScheduled = true;

        // In real app, store in database:
        // await db.query(
        //     'INSERT INTO reminders (user_id, assignment_id, send_at, message, phone_number, type, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
        //     [req.user.id, assignmentId, reminderDate, message, phoneNumber, notificationType, reminder.status]
        // );

        console.log('Reminder stored:', reminder);

        res.json({
            success: true,
            message: `Reminder ${reminderDate <= now ? 'sent' : 'scheduled'} successfully`,
            reminderDate: reminderDate,
            smsId: smsResult?.sid,
            emailId: emailResult?.messageId,
            scheduled: reminderScheduled
        });

    } catch (error) {
        console.error('Error processing reminder:', error);
        res.status(500).json({
            success: false,
            error: error.message || 'Failed to process reminder'
        });
    }
});

// Get user's reminders
router.get('/api/notifications/reminders', authenticateUser, (req, res) => {
    try {
        const userReminders = reminders.filter(r => r.user_id === req.user.id);
        res.json(userReminders);
    } catch (error) {
        console.error('Error fetching reminders:', error);
        res.status(500).json({ error: 'Failed to fetch reminders' });
    }
});

// Delete a reminder
router.delete('/api/notifications/reminders/:id', authenticateUser, (req, res) => {
    try {
        const reminderId = parseInt(req.params.id);
        const index = reminders.findIndex(r => r.id === reminderId && r.user_id === req.user.id);
        
        if (index === -1) {
            return res.status(404).json({ error: 'Reminder not found' });
        }

        reminders.splice(index, 1);
        res.json({ success: true, message: 'Reminder deleted successfully' });
    } catch (error) {
        console.error('Error deleting reminder:', error);
        res.status(500).json({ error: 'Failed to delete reminder' });
    }
});

// Test endpoint to verify API is working
router.get('/api/test', (req, res) => {
    res.json({
        success: true,
        message: 'MyCalendar Assignment API is working!',
        timestamp: new Date().toISOString(),
        features: {
            sms: !!twilioClient,
            email: !!emailTransporter,
            assignments: true,
            reminders: true
        }
    });
});

module.exports = router;
