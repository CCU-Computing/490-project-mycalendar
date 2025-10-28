import { api } from './apiClient.js';

(async function() {
  const userName = sessionStorage.getItem("mc_userName");
  const userChip = document.getElementById("userChip");

  if (!userName) {
    // dashboard.html is in /pages, so go to login in the same folder
    window.location.href = "./login.html";
    return;
  }

  if (userChip) {
    userChip.textContent = "Hi, " + userName;
  }

  const gpaElement = document.getElementById('gpa');
  const coursesElement = document.getElementById('courses');
  gpaElement.textContent = 'Loading GPA...';

  try {
    const { courses } = await api.courses();

    // Parse grade string to number
    function parseGrade(gradeString) {
      // "95.00 %" -> 95.0
      return parseFloat(gradeString.replace('%', '').trim());
    }

    // Convert percentage grade to 4.0 scale
    function percentageTo4Scale(percentage) {
      if (percentage >= 93) return 4.0;
      if (percentage >= 90) return 3.7;
      if (percentage >= 87) return 3.3;
      if (percentage >= 83) return 3.0;
      if (percentage >= 80) return 2.7;
      if (percentage >= 77) return 2.3;
      if (percentage >= 73) return 2.0;
      if (percentage >= 70) return 1.7;
      if (percentage >= 67) return 1.3;
      if (percentage >= 65) return 1.0;
      return 0.0;
    }

    // Calculate GPA (assumes 3 credits per course)
    function calculateGPA(courses, creditsPerCourse = 3) {
      let totalPoints = 0;
      let totalCredits = 0;

      courses.forEach(course => {
        const percentage = parseGrade(course.grade);
        if (!isNaN(percentage)) {
          const gradePoint = percentageTo4Scale(percentage);
          totalPoints += gradePoint * creditsPerCourse;
          totalCredits += creditsPerCourse;
        }
      });

      return totalCredits > 0 ? totalPoints / totalCredits : 0;
    }

    // Calculate GPA (assuming 3 credits per course)
    const gpa = calculateGPA(courses, 3);

    gpaElement.textContent = `Overall GPA: ${gpa.toFixed(2)}`;

    // Display individual course grades
    courses.forEach(course => {
      const percentage = parseGrade(course.grade);
      const gradePoint = percentageTo4Scale(percentage);
      const courseElement = document.createElement('p');
      courseElement.textContent = `${course.name}: ${percentage}% (${gradePoint} GPA)`;
      coursesElement.appendChild(courseElement);
    });
  } catch (error) {
    console.error('Failed to load courses:', error);
  }
})();
