/**
 * A function for generating toast notifications
 * @param message - a message with the contents of the toast notification
 * @param type - determines the type of the toast notification and its associated classes/styling
 */
export default function ToastNotification(message, type) {

    // get container toast notification container if it already exists
    let container = document.getElementById('toastNotificationContainer');

    // determine if container already exists
    if (!container) {

        // create container
        document.body.insertAdjacentHTML('beforeend', `<div id="toastNotificationContainer" class="flex justify-center items-center z-50"></div>`.trim())
        container = document.getElementById('toastNotificationContainer');
    }

    // get classes depending on the type
    const typeClasses = {
        success: "bg-green-800 border-green-500 text-green-100",
        info: "bg-blue-800 border-blue-500 text-blue-100",
        warning: "bg-yellow-800 border-yellow-500 text-yellow-100",
        error: "bg-red-800 border-red-500 text-red-100",
    }

    // get svg depending on the type
    const typeSVG = {
        success:
            `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
            `,
        info:
            `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
            </svg>
            `,
        warning:
            `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6"> 
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" /> 
            </svg>
            `,
        error:
            `
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
                <path stroke-linecap="round" stroke-linejoin="round" d="m9.75 9.75 4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"/>
            </svg>
            `
    }

    // create toast notification
    container.insertAdjacentHTML('beforeend', `
        <div class="opacity-0 fixed w-80 h-16 flex items-center gap-2 border rounded-md px-6 py-4 top-0 transition-all duration-150 ease-in-out shadow z-50 ${typeClasses[type]}">
            <div>${typeSVG[type]}</div>
            <div class="flex items-center text-xs font-medium">
                <p>${type[0].toUpperCase() + type.slice(1)}: ${message}</p>
            </div>
        </div>
    `.trim())

    // grab the newly created toast notification
    const toast = container.lastElementChild;

    // fade in toast notification
    setTimeout(() => toast.classList.remove("opacity-0"), 150);

    // fade out toast notification and remove after three seconds
    setTimeout(() => {
        toast.classList.add("opacity-0");
        setTimeout(() => toast.remove(), 150);
    }, 3000)

    // set max toasts and counter variable (need to go back and fix this mess, but for now, it works)
    const maxToasts = 3;
    let count = 0;

    // iterate through each toast
    for (let i = container.children.length - 1; i >= 0; i--) {

        // get current node
        let node = container.children[i];

        // apply conditional classes
        if (maxToasts - count === 3) {

            // update classes
            node.classList.add("z-50", "translate-y-8", "scale-100")
        } else if (maxToasts - count === 2) {

            // update classes
            node.classList.remove("z-50", "translate-y-8", "scale-100")
            node.classList.add("z-40", "translate-y-11", "scale-95")
        } else if (maxToasts - count === 1) {

            // update classes
            node.classList.remove("z-40", "translate-y-11", "scale-95")
            node.classList.add("z-30", "translate-y-14", "scale-90")
        } else {

            // remove oldest element
            container.firstElementChild.remove();
        }

        // increment count
        count++;
    }
}
