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
    
})();


