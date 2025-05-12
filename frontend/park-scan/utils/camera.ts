// Lấy và bắt đầu camera
export const startCamera = async (videoRef: React.RefObject<HTMLVideoElement>) => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        if (videoRef.current) {
            videoRef.current.srcObject = stream;
        }
    } catch (err) {
        console.error("Không thể truy cập camera", err);
    }
};

// Dừng camera khi không cần nữa
export const stopCamera = (videoRef: React.RefObject<HTMLVideoElement>) => {
    const stream = videoRef.current?.srcObject as MediaStream;
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        videoRef.current!.srcObject = null;
    }
};

// Chuyển video thành frame và gửi tới backend
export const captureAndSendFrame = async (videoRef: React.RefObject<HTMLVideoElement>) => {
    if (videoRef.current) {
        const canvas = document.createElement("canvas");
        canvas.width = videoRef.current.videoWidth;
        canvas.height = videoRef.current.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            canvas.toBlob(async (blob) => {
                if (blob) {
                    await uploadFrame(blob);
                }
            }, "image/jpeg");
        }
    }
};

// Gửi frame tới API
export const uploadFrame = async (blob: Blob) => {
    const formData = new FormData();
    formData.append("file", blob, "frame.jpg");

    try {
        const response = await fetch("http://localhost:8000/upload_frame", {
            method: "POST",
            body: formData,
        });

        if (response.ok) {
            console.log("Frame đã được gửi thành công!");
        } else {
            console.log("Gửi frame thất bại!");
        }
    } catch (err) {
        console.error("Lỗi khi gửi frame:", err);
    }
};

// Lấy video feed (video stream đã annotate) từ API
// Lấy video feed (video stream đã annotate) từ API
export const getVideoFeed = async () => {
    const response = await fetch("http://localhost:8000/video_feed");
    if (response.ok) {
        return response.blob(); // Trả về dữ liệu dạng blob cho video
    }
    return null;
};

// Lấy biển số đã nhận diện từ API
export const getPlateFeed = async () => {
    const response = await fetch("http://localhost:8000/plate_feed");
    if (response.ok) {
        const data = await response.json();
        return data.plate;
    }
    return null;
};
