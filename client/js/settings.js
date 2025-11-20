import { mountCalendarCustomizer } from "../components/CalendarTypesCustomizer.js";
import { mountClassCustomizer } from "../components/CourseCustomizerModal.js";
import { exportCalendarICSFile } from "../components/ExportICSFile.js";


const settingsContainer = document.getElementById("settingsContainer");

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

    document.addEventListener("DOMContentLoaded", async function () {
        await mountCalendarCustomizer({ containerId: "calendarTypes" }); 
        mountClassCustomizer({ containerId: "semesterClasses" });


        // COLOR PICKER
        // API Calls
        try {
            // let calendarColorDeck = document.getElementById("calendarColorDeck");
            let icsButton = document.getElementById("exportICS");

            // add loading states
            addLoadingStates();
            
            
            let icsContent = await getICSFile();

            // IMPORT/EXPORT SECTION

            // EXPORT FUNCTIONS

            // ICS
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
            
            // remove loading states
            removeLoadingStates();


            // CALENDAR SECTION
            

            

            // getTypeColorPickers();
            // // END OF CALENDAR SECTION

            // // COURSE SECTION
            // let courseColorDeck = document.getElementById("courseColorDeck");
            
            // // Go through and populate course settings
            // // NOTE: Talk about this: How we could make it load faster? Session, etc..
           

            // courseColorPickers();
        
            // END OF COURSE SECTION

            

        } catch (error) {
            console.error(error);
        }
    
    });
    
})();

// Function to generate a ICS File
async function getICSFile() {
    return await exportCalendarICSFile();
}

// function for adding loading states
function addLoadingStates() {

    // add loading states
    settingsContainer.classList.add("animate-pulse", "cursor-progress");
}

// function for removing loading states
function removeLoadingStates() {

    // remove loading states
    settingsContainer.classList.remove("animate-pulse", "cursor-progress");
}
