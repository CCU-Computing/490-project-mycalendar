(async function () {
    // USER STATUS
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


    // COLOR PICKER
    // API Calls
    // Get Courses and Database(JSON)
    try {
        const [{ courses }, { prefs }] = await Promise.all([
            fetch('/api/courses').then(r => r.json()),
            fetch('/api/prefs').then(r => r.json())
        ]);

        const courseColors = prefs?.calendar?.courseColors || {};
        
        let cardDeck = document.getElementById("cardDeck");
        
        // Go through and populate course settings
        // NOTE: Talk about this: How we could make it load faster? Session, etc..
        courses.forEach(course => {
            // COURSE CARD LAYOUT
            let courseCard = document.createElement("div");
            courseCard.id = "courseCard";
            courseCard.dataset.courseId = course.id;
            courseCard.className = `flex justify-between items-center rounded-xl border bg-slate-50 p-4 text-sm`;

            let courseName = document.createElement("span");
            courseName.id = "courseName";
            courseName.innerHTML = course.name;
            courseName.className = "pr-2 text-sm text-slate-500 mt-1";

            let colorInput = document.createElement("input");
            colorInput.id = "colorInput";
            colorInput.type = "color";
            colorInput.className = "w-10 aspect-square rounded-full border-2 border-gray-300 appearance-none cursor-pointer color-picker shrink-0";

            // Update local state (visual only)
            colorInput.addEventListener("change", (e) => {
                colorInput.value = e.target.value;
            });

            colorInput.addEventListener("input", (e) => {
                courseCard.style.borderColor = e.target.value;
            });

            // Save when user is done picking
            colorInput.addEventListener("blur", async (e) => {
                const newColor = e.target.value;

                await fetch('/api/prefs/courseColor', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ courseId: course.id, color: newColor })
                });

            });
            
            // Append 
            courseCard.appendChild(courseName);
            courseCard.appendChild(colorInput);

            cardDeck.appendChild(courseCard);

            colorInput.value = courseColors[String(course.id)] || '#4F46E5';
            courseCard.style.borderColor = colorInput.value;
        });
    } catch (error) {
        console.error(error);
    }

    // EXPORT FUNCTION
    try {
        // API Calls
        const [{ courses }, { prefs }, { events }] = await Promise.all([
            fetch('/api/courses').then(r => r.json()),
            fetch('/api/prefs').then(r => r.json()),
            fetch('/api/calendar').then(r => r.json())
        ]);

        // Get Colors from Database (JSON)
        const courseColors = prefs?.calendar?.courseColors || {};

        // ICS
        let icsButton = document.getElementById("exportICS");

        // Declare Header, Foot, and Body
        // I know it looks weird, but it works :)
        let icsHeader = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//MyCalendar//EN
CALSCALE:GREGORIAN
`;
        let icsFooter = `END:VCALENDAR`;
    
    
        // Store each icsEvent into icsContainer
        let icsContainer = ""; 
        

        // Format date to ICS (UTC)
        function toICSDate(date) {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        }

        // Go thorugh each Course Event
        // Find the Event that matches the Course Id
        // Set a event for it 
        courses.forEach(course => {
            // Get Course Id and Name
            let courseId = course.id;
            let courseName = course.name;
            events.forEach(event => {
                // Get assignment info
                let assignmentCourseId = event.courseId;
                let assignmentId = event.id;
                let assignmentType = event.type;
                let assignmentName = event.title;
                let assignmentDue = new Date(event.dueAt * 1000);
                let assignmentLocation = "Moodle"
                let courseColor = courseColors[String(course.id)] || '#4F46E5';
                
                
                // Check to see if courseId matches with assignmentCourseId
                if (courseId ===  assignmentCourseId) {
                    // Set convert UNIX to UTC
                    let dtpStamp = toICSDate(new Date());
                    let dtpStart = toICSDate(assignmentDue);
                    let dtpEnd = toICSDate(new Date(assignmentDue.getTime() + 30*60*1000));

                    // Each event will follow this structure. (No spaces/tabs)
                    // I know it looks weird, but it works :)
                    let icsBody = `BEGIN:VEVENT
UID:${assignmentId}@mycalendar
DTSTAMP:${dtpStamp}
DTSTART:${dtpStart}
DTEND:${dtpEnd}
SUMMARY:${assignmentName}
DESCRIPTION:This is a ${assignmentType} for ${courseName}.
LOCATION:${assignmentLocation}
COLOR:${courseColor}
X-APPLE-CALENDAR-COLOR:${courseColor}
END:VEVENT
`;

                    // Append to container
                    icsContainer += icsBody;
                }
            });
        });

        // Assemble file
        let icsContent = icsHeader +  icsContainer + icsFooter;   
        
        console.log(JSON.stringify(icsContent));

        icsButton.addEventListener("click", () => {
            // Place download file into button
            const blob = new Blob([icsContent], {type:"text/calendar;charset=utf-8"})
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.href = url;
            link.download = "MyCalendar.ics";
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

        })

    } catch (error) {
        console.error(error);
    }
    
})();


