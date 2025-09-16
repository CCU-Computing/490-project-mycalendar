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

    // API Calls
    // Get Courses and Database(JSON)
    const [{ courses }, { prefs }] = await Promise.all([
        fetch('/api/courses').then(r => r.json()),
        fetch('/api/prefs').then(r => r.json())
    ]);
    const courseColors = prefs?.calendar?.courseColors || {};
    
    let cardDeck = document.getElementById("cardDeck");
    
    // Go through and populate course settings
    courses.forEach(course => {
        // COURSE CARD LAYOUT
        let courseCard = document.createElement("div");
        courseCard.id = "courseCard";
        courseCard.dataset.courseId = course.id;
        courseCard.className = "flex justify-between items-center rounded-xl border border-b border-slate-300 bg-slate-50 p-4 text-sm";

        let courseName = document.createElement("span");
        courseName.id = "courseName";
        courseName.innerHTML = course.name;
        courseName.className = "text-sm text-slate-500 mt-1";

        let colorInput = document.createElement("input");
        colorInput.id = "colorInput";
        colorInput.type = "color";
        colorInput.className = "w-10 h-8 rounded-full border-2 border-gray-300 appearance-none cursor-pointer color-picker";

        // Update local state (visual only)
        colorInput.addEventListener("change", (e) => {
            colorInput.value = e.target.value;
        });

        // Save when user is done picking
        colorInput.addEventListener("blur", async (e) => {
            const newColor = e.target.value;

            await fetch('/api/prefs/courseColor', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ courseId: course.id, color: newColor })
            });

            console.log(`Saved ${newColor} for course ${course.id}`);
        });
        
        // Append 
        courseCard.appendChild(courseName);
        courseCard.appendChild(colorInput);

        cardDeck.appendChild(courseCard);

        colorInput.value = courseColors[String(course.id)] || '#4F46E5';
    });


    // EXPORT FUNCTION
    let icsButton = document.getElementById("exportICS");
    // ICS

    icsButton.addEventListener("click", () => {
        window.alert("Downloading...");

        // OUTLINE FOR EACH EVENT
        const icsCONTENT = `
            BEGIN:VCALENDAR
            VERSION:2.0
            CALSCALE:GREGORIAN
            METHOD:PUBLISH

            BEGIN:VEVENT
            UID:${Date.now()}@example.com
            DTSTAMP:${formatDate(new Date())}
            SUMMARY:My Custom Event
            DESCRIPTION:This is an example event
            DTSTART:20250915T090000Z
            DTEND:20250915T100000Z
            LOCATION:Online
            END:VEVENT

            END:VCALENDAR`;

        // helper to format dates into iCalendar UTC format
        function formatDate(date) {
        return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
        }

        // Place download file into button
        const blob = new Blob([icsCONTENT], {type:"text/calendar;charset=utf-8"})
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = "sample.ics";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

    })
})();


