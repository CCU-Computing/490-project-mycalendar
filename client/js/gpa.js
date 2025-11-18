import { api } from './apiClient.js';

(async function() {
  const userName = sessionStorage.getItem("mc_userName");
  const userChip = document.getElementById("userChip");

  if (!userName) {
    window.location.href = "./login.html";
    return;
  }

  if (userChip) {
    userChip.textContent = "Hi, " + userName;
  }

  const gpaElement = document.getElementById('gpa');
  const reportedCoursesElement = document.getElementById('reportedCourses');
  const manualGradeSection = document.getElementById('manualGradeSection');
  const manualGradeCoursesElement = document.getElementById('manualGradeCourses');

  gpaElement.textContent = 'Loading GPA...';

  // Store manual grades entered by user
  const manualGrades = {};

  // Parse grade string to number
  function parseGrade(gradeString) {
    // "95.00 %" -> 95.0
    if (!gradeString) return NaN;
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

  // Calculate GPA from courses (both reported and manual)
  function calculateGPA(reportedCourses, creditsPerCourse = 3) {
    let totalPoints = 0;
    let totalCredits = 0;

    // Add reported grades
    reportedCourses.forEach(course => {
      const percentage = parseGrade(course.grade);
      if (!isNaN(percentage)) {
        const gradePoint = percentageTo4Scale(percentage);
        totalPoints += gradePoint * creditsPerCourse;
        totalCredits += creditsPerCourse;
      }
    });

    // Add manually entered grades
    Object.values(manualGrades).forEach(percentage => {
      if (!isNaN(percentage) && percentage !== null && percentage !== '') {
        const gradePoint = percentageTo4Scale(percentage);
        totalPoints += gradePoint * creditsPerCourse;
        totalCredits += creditsPerCourse;
      }
    });

    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  }

  // Update the GPA display
  function updateGPADisplay(reportedCourses) {
    const gpa = calculateGPA(reportedCourses, 3);
    gpaElement.textContent = gpa.toFixed(2);
  }

  // Create a course card element
  function createCourseCard(course, isManual = false) {
    const cardDiv = document.createElement('div');
    cardDiv.className = 'rounded-xl border border-slate-200 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-800 p-4';

    if (isManual) {
      cardDiv.innerHTML = `
        <div class="flex items-end gap-3">
          <div class="flex-grow">
            <p class="font-medium text-slate-900 dark:text-slate-100">${course.name}</p>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">Enter final grade percentage (0-100)</p>
          </div>
          <div class="flex items-center gap-2">
            <input
              type="number"
              data-course-id="${course.id}"
              min="0"
              max="100"
              step="0.01"
              placeholder="0"
              class="w-20 rounded-lg border border-slate-300 dark:border-neutral-500 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <span class="text-sm text-slate-600 dark:text-slate-400">%</span>
          </div>
        </div>
      `;

      // Add event listener for manual grade input
      const input = cardDiv.querySelector('input');
      input.addEventListener('input', (e) => {
        const value = e.target.value;
        const courseId = e.target.dataset.courseId;

        if (value === '' || value === null) {
          delete manualGrades[courseId];
        } else {
          const numValue = parseFloat(value);
          if (!isNaN(numValue) && numValue >= 0 && numValue <= 100) {
            manualGrades[courseId] = numValue;
          }
        }
      });
    } else {
      const percentage = parseGrade(course.grade);
      const gradePoint = percentageTo4Scale(percentage);

      cardDiv.innerHTML = `
        <div class="flex items-center justify-between">
          <div>
            <p class="font-medium text-slate-900 dark:text-slate-100">${course.name}</p>
            <p class="text-sm text-slate-600 dark:text-slate-400 mt-1">${percentage.toFixed(2)}% grade</p>
          </div>
          <div class="text-right">
            <p class="font-semibold text-indigo-600 dark:text-indigo-400">${gradePoint.toFixed(2)}</p>
            <p class="text-xs text-slate-600 dark:text-slate-400">GPA</p>
          </div>
        </div>
      `;
    }

    return cardDiv;
  }

  try {
    const { courses } = await api.courses();

    // Separate courses into reported and missing grades
    const reportedGrades = [];
    const missingGrades = [];

    courses.forEach(course => {
      const percentage = parseGrade(course.grade);
      if (!isNaN(percentage)) {
        reportedGrades.push(course);
      } else {
        missingGrades.push(course);
      }
    });

    // Display reported grades
    reportedCoursesElement.innerHTML = '';
    if (reportedGrades.length > 0) {
      reportedGrades.forEach(course => {
        reportedCoursesElement.appendChild(createCourseCard(course, false));
      });
    } else {
      reportedCoursesElement.innerHTML = `
        <div class="rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 bg-slate-50 dark:bg-neutral-800 p-4 text-sm text-slate-500 dark:text-slate-400">
          No courses with reported grades yet
        </div>
      `;
    }

    // Display manual grade entry section if there are courses without grades
    if (missingGrades.length > 0) {
      manualGradeSection.classList.remove('hidden');
      manualGradeCoursesElement.innerHTML = '';
      missingGrades.forEach(course => {
        manualGradeCoursesElement.appendChild(createCourseCard(course, true));
      });

      // Add a Calculate button to update GPA with manual entries
      const calculateButton = document.createElement('button');
      calculateButton.className = 'mt-6 w-full rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-4 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-900';
      calculateButton.textContent = 'Calculate GPA with Manual Grades';
      calculateButton.addEventListener('click', () => {
        updateGPADisplay(reportedGrades);
      });
      manualGradeCoursesElement.appendChild(calculateButton);
    }

    // Update GPA display
    updateGPADisplay(reportedGrades);

  } catch (error) {
    console.error('Failed to load courses:', error);
    gpaElement.textContent = 'Error loading GPA';
    reportedCoursesElement.innerHTML = `
      <div class="rounded-xl border border-dashed border-slate-300 dark:border-neutral-600 bg-red-50 dark:bg-red-900/20 p-4 text-sm text-red-600 dark:text-red-400">
        Failed to load courses. Please refresh the page.
      </div>
    `;
  }
})();
