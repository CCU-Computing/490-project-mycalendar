import { api } from "../js/apiClient.js";
import toastNotification  from "../components/ToastNotification.js";


export function modifyCourseIMG(mCardImg, mImg, courseId, imgURL, ogImg) {
    const imageURLRegex = /^(https?:\/\/(?:[\w-]+\.)+[a-z]{2,})(\/[\w\-.,@?^=%&:\/~+#]*)?\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i;
    let urlInputFelid = document.createElement("input");
    urlInputFelid.type = "text";
    urlInputFelid.className = "pl-2 mt-1 block w-full rounded-xl dark:bg-neutral-700 border-slate-300 focus:border-indigo-500 focus:ring-indigo-500";
    urlInputFelid.placeholder = "Insert Image URL";
    urlInputFelid.value = (imgURL != null) ? imgURL : null;

    // Save when user is done picking
    urlInputFelid.addEventListener("blur", async (e) => {
        const urlValue = e.target.value;

        if (urlValue.match(imageURLRegex)) {
            toastNotification("Added Image URL", "success");
            await api.courseMetadata.update(courseId, { customImageUrl: urlValue });
            mImg.src = urlValue;
            mCardImg.src = urlValue;
        } else if (urlValue == '') {
            toastNotification("Removed Image URL", "success");
            await api.courseMetadata.update(courseId, { customImageUrl: null });
            mImg.src = ogImg;
            mCardImg.src = ogImg;
        } else {
            toastNotification("Not a valid Image URL", "error");
        }
    });

    return urlInputFelid;
}