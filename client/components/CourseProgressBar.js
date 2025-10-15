// Create a progress bar for courses
// Card
export function courseProgressBar(progress) {
    // Create Container/Outline (Gray)
    let progressBarContainer = document.createElement("div");
    progressBarContainer.className = "w-full h-2 mt-4 justify-self-center bg-[#e0e0e0] rounded-full overflow-hidden";
    // Create the Bar itself
    progressBarContainer.innerHTML = 
        `<div class='h-full w-[${(progress != null ? progress : 0)}%] bg-[#4CAF50] rounded-s transition-all duration-500 ease-in-out'></div>`;

    return progressBarContainer;
}
