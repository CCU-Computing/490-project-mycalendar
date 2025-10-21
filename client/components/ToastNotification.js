// toast creation located here to prevent excess code
export default function toastNotification(message, type) {
    return Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "bottom",
        position: "right",
        stopOnFocus: true,
        style: {
            "background": 
                type === "success" ? "oklch(72.3% 0.219 149.579)" :
                type === "info"    ? "oklch(62.3% 0.214 259.815)" :
                type === "warning" ? "oklch(79.5% 0.184 86.047)" :
                type === "error"   ? "oklch(63.7% 0.237 25.331)" :
                                     "",
            "color": "oklch(98.4% 0.003 247.858)",
            "font-size": "14px",
            "font-weight": "500",
        },
    }).showToast();
};
