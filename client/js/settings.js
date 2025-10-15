import { api } from "./apiClient.js";

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
    try {
        // API Calls
        const [{ courses }, { prefs }, { events }] = await Promise.all([
            await api.courses(),
            await api.prefs.get(),
            await api.calendar()
        ]);

        // Get Colors 
        const typeColors = prefs.calendar.assignmentTypeColors;
        const courseColors = prefs.calendar.courseColors;

        // Set up Coloris with basic colors
        Coloris({
            alpha: false,
            swatches: [
                "#FF0000",
                "#FF9900",
                "#00FF00",
                "#0000FF",
                "#9900FF",
                "#FF00FF"
            ],
        });

        // CALENDAR SECTION
        let calendarColorDeck = document.getElementById("calendarColorDeck");

        function getTypeColorPickers() {

            // Get Different Types
            const types = {
                assign : 'Assignments',
                quiz : 'Quizzes',
                // custom : 'Custom Events'
            };

            // Return Color pickers
            return Object.entries(types).map(([type, label]) => {
                // TYPE CARD LAYOUT  
                let typeCard = document.createElement("div");
                typeCard.id = "typeCard";
                typeCard.dataset.courseId = type;
                typeCard.className = `min-w-[200px] flex justify-between items-center rounded-xl border-[3px] bg-slate-50 p-4 text-sm`;
        
                let typeName = document.createElement("label");
                typeName.id = "courseName";
                typeName.innerHTML = label;
                typeName.className = "pr-2 text-sm text-slate-500 mt-1";

                // NEW COLOR PICKER
                let colorInput = document.createElement("input");
                colorInput.id = "colorInput";
                colorInput.type = "text";
                colorInput.setAttribute("data-coloris", "")
                colorInput.className = "w-8 aspect-square rounded-full border-2 border-gray-300 appearance-none cursor-pointer color-picker shrink-0";
                colorInput.style.color = "transparent";
                colorInput.style.textShadow = "none";
                colorInput.style.background = typeColors[type] || '#4F46E5';

                colorInput.addEventListener("input", (e) => {
                    colorInput.style.background = e.target.value;
                    typeCard.style.borderColor = e.target.value;
                });

                // Save when user is done picking
                colorInput.addEventListener("blur", async (e) => {
                    const newColor = e.target.value;
                    await api.prefs.setAssignmentTypeColor(type, newColor)
                });
                
                // Append 
                typeCard.appendChild(typeName);
                typeCard.appendChild(colorInput);

                colorInput.value = typeColors[type] || '#4F46E5';
                typeCard.style.borderColor = colorInput.value;

                calendarColorDeck.append(typeCard);
            });
        }

        getTypeColorPickers();
        // END OF CALENDAR SECTION

        // COURSE SECTION
        let courseColorDeck = document.getElementById("courseColorDeck");
        
        // Go through and populate course settings
        // NOTE: Talk about this: How we could make it load faster? Session, etc..
        function courseColorPickers() {
            // Get Course Color pickers
            return Object.values(courses).map((course) => {
                // COURSE CARD LAYOUT  
                let courseCard = document.createElement("div");
                courseCard.id = "courseCard";
                courseCard.dataset.courseId = course.id;
                courseCard.className = `flex justify-between items-center rounded-xl border-[3px] bg-slate-50 p-4 text-sm`;

                let courseName = document.createElement("span");
                courseName.id = "courseName";
                courseName.innerHTML = course.name;
                courseName.className = "pr-2 text-sm text-slate-500 mt-1";

                // NEW COLOR PICKER
                let colorInput = document.createElement("input");
                colorInput.id = "colorInput";
                colorInput.type = "text";
                colorInput.setAttribute("data-coloris", "")
                colorInput.className = "w-8 aspect-square rounded-full border-2 border-gray-300 appearance-none cursor-pointer color-picker shrink-0";
                colorInput.style.color = "transparent";
                colorInput.style.textShadow = "none";
                colorInput.style.background = courseColors[course.id] || '#4F46E5';

                colorInput.addEventListener("input", (e) => {
                    colorInput.style.background = e.target.value;
                    courseCard.style.borderColor = e.target.value;
                });

                // Save when user is done picking
                colorInput.addEventListener("blur", async (e) => {
                    const newColor = e.target.value;
                    await api.prefs.setCourseColor(course.id, newColor)
                });
                
                // Append 
                courseCard.appendChild(courseName);
                courseCard.appendChild(colorInput);

                colorInput.value = courseColors[course.id] || '#4F46E5';
                courseCard.style.borderColor = colorInput.value;

                courseColorDeck.append(courseCard);
            });

        };

        courseColorPickers();
    
        // END OF COURSE SECTION

        // IMPORT/EXPORT SECTION

        // EXPORT FUNCTIONS
        // Function to create "safe" colors for other applications
        function adjustHexCode(hexCode) {
            // Safe colors that are commonly seen
            const palette = [
                {name:"Red", hex:"FF0000"},
                {name:"Orange", hex:"FF9900"},
                {name:"Yellow", hex:"FFFF00"},
                {name:"Green", hex:"00FF00"},
                {name:"Blue", hex:"0000FF"},
                {name:"Purple", hex:"9900FF"},
                {name:"Pink", hex:"FF00FF"},
            ];

            // Using Euclidearn distance in RGB find the closest value
            // Then reset hexcode to it for ICS
            const rgb = hexCode.match(/\w\w/g).map(c => parseInt(c, 16));
            let closest = palette[0], minDist = Infinity;
            for (let color of palette) {
                const prgb = color.hex.match(/\w\w/g).map(c => parseInt(c, 16));
                const dist = Math.sqrt(
                    (rgb[0]-prgb[0])**2 + 
                    (rgb[1]-prgb[1])**2 + 
                    (rgb[2]-prgb[2])**2
                );
                if (dist < minDist) { minDist = dist; closest = color; }
            }
            return closest.hex;
        }

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
        

        // Format date to UTC
        function toICSDate(date) {
            return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        }

        // Format date as is
        function toICSAllDayLocal(date) {
            const year = date.getFullYear();
            const month = String(date.getMonth()+1).padStart(2,'0');
            const day = String(date.getDate()).padStart(2,'0');
            return `${year}${month}${day}`;
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
                let assignmentLocation = "Moodle";
                let courseColor = courseColors[String(course.id)] || '#4F46E5';
                
                // ICS color format
                let icsColor = adjustHexCode(courseColor.replace("#", ""));
                
                
                // Check to see if courseId matches with assignmentCourseId
                if (courseId ===  assignmentCourseId) {
                    // Set convert UNIX to UTC for Stamp
                    let dtpStamp = toICSDate(new Date());

                    // Set other due dates as is
                    let dtpStart = toICSAllDayLocal(assignmentDue);
                    let dtpEnd = toICSAllDayLocal(new Date(assignmentDue.getTime() + 24*60*60*1000));

                    // Each event will follow this structure. (No spaces/tabs)
                    // I know it looks weird, but it works :)
                    let icsBody = `BEGIN:VEVENT
UID:${assignmentId}@mycalendar
DTSTAMP:${dtpStamp}
DTSTART;VALUE=DATE:${dtpStart}
DTEND;VALUE=DATE:${dtpEnd}
SUMMARY:${assignmentName}
DESCRIPTION:This is a ${assignmentType} for ${courseName}.
LOCATION:${assignmentLocation}
COLOR:${icsColor}
X-APPLE-CALENDAR-COLOR:${icsColor}
END:VEVENT
`;
                    // Append to container
                    icsContainer += icsBody;
                }
            });
        });

        // Assemble file
        let icsContent = icsHeader +  icsContainer + icsFooter;   
        
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

    // END OF IMPORT/EXPORT SECTION

    } catch (error) {
        console.error(error);
    }

    
})();


