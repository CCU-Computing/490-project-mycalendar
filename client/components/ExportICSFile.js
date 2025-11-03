import { api } from "../js/apiClient.js";

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

export async function exportCalendarICSFile() {
    try{
        const [{ courses }, { prefs }, { events }] = await gatherData();

        // Get Colors 
        const courseColors = prefs.calendar.courseColors;
        
        // Declare Header, Foot, and Body
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
    return icsContent;

    } catch (error) {
        console.error(`Export ICS File Failure: ${error}`);
    }
}

async function gatherData() {
    // API Calls
    try {
        const [{ courses }, { prefs }, { events }] = await Promise.all([
            api.courses(),
            api.prefs.get(),
            api.calendar()
        ]);

        return  [{ courses }, { prefs }, { events }];
    } catch (error) {
        console.error(`Export ICS API Failure: ${error}`);
    }
}