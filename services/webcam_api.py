from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import torch
import time
import collections
import numpy as np
import base64
import function.utils_rotate as utils_rotate
import function.helper as helper
import datetime

app = FastAPI(title="License Plate Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====== CẤU HÌNH ======
FPS_YOLO = 3
MOTION_THRESH = 5000
NO_MOTION_TIME = 1.0
MIN_DETECT_CNT = 3

# ====== LOAD YOLO MODEL ======
print("Loading YOLO models...")
yolo_LP_detect = torch.hub.load('yolov5', 'custom', path='model/LP_detector_nano_61.pt',
                                force_reload=True, source='local')
yolo_license_plate = torch.hub.load('yolov5', 'custom', path='model/LP_ocr_nano_62.pt',
                                    force_reload=True, source='local')
yolo_license_plate.conf = 0.60

# ====== BIẾN TOÀN CỤC ======
last_gray = None
motion_start = 0
last_motion = 0
yolo_last_time = 0
plate_counter = collections.Counter()
session_active = False
latest_frame = None
latest_plate = None
plate_history = []
current_session_plate = None
latest_boxes = []
last_frame_time = datetime.datetime.now()
no_signal_timeout = 10  # seconds before showing no signal

# Create a default "No Signal" frame to display when no frames are available


def create_no_signal_frame():
    # Create a black image with text
    frame = np.zeros((480, 640, 3), np.uint8)
    cv2.putText(frame, "No video signal", (180, 240),
                cv2.FONT_HERSHEY_COMPLEX, 1, (255, 255, 255), 2)
    cv2.putText(frame, "Waiting for camera connection...", (120, 270),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
    return frame


# Initialize with a no signal frame
latest_frame = create_no_signal_frame()

# ====== HÀM HỖ TRỢ ======


def read_license_plate(img):
    for cc in range(2):
        for ct in range(2):
            txt = helper.read_plate(
                yolo_license_plate,
                utils_rotate.deskew(img, cc, ct)
            )
            if txt != "unknown":
                return txt
    return "unknown"


def get_display_plate():
    if current_session_plate and current_session_plate != "unknown":
        return current_session_plate
    elif latest_plate and latest_plate != "unknown":
        return latest_plate
    else:
        return "No plate detected"


def process_frame(frame):
    global last_gray, motion_start, last_motion, yolo_last_time
    global plate_counter, session_active, latest_frame
    global latest_plate, latest_boxes, current_session_plate

    if frame is None:
        return None, get_display_plate(), []

    t0 = time.time()
    latest_frame = frame.copy()

    # Motion detection
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (21, 21), 0)
    if last_gray is None:
        last_gray = gray
        return frame, get_display_plate(), []

    delta = cv2.absdiff(last_gray, gray)
    thresh = cv2.threshold(delta, 25, 255, cv2.THRESH_BINARY)[1]
    thresh = cv2.dilate(thresh, None, iterations=2)
    cnts, _ = cv2.findContours(
        thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    last_gray = gray

    motion = any(cv2.contourArea(c) > MOTION_THRESH for c in cnts)
    now = time.time()

    if motion:
        if not session_active:
            session_active = True
            motion_start = now
            plate_counter.clear()
            current_session_plate = None
            print(f"[{time.strftime('%H:%M:%S')}] Motion detected. Start session.")
        last_motion = now
    else:
        if session_active and (now - last_motion) > NO_MOTION_TIME:
            session_active = False
            if plate_counter:
                plate, cnt = plate_counter.most_common(1)[0]
                if cnt >= MIN_DETECT_CNT and plate != "unknown":
                    latest_plate = plate
                    with open("plate.txt", "a") as f:
                        f.write(f"{plate}\n")
                    if not plate_history or plate_history[-1] != plate:
                        plate_history.append(plate)
                        if len(plate_history) > 10:
                            plate_history.pop(0)
                    print(
                        f"[{time.strftime('%H:%M:%S')}] Session ended. Plate: {plate} ({cnt} times).")
            else:
                print(
                    f"[{time.strftime('%H:%M:%S')}] Session ended. No valid plate.")

            plate_counter.clear()
            current_session_plate = None

    boxes = []

    if session_active and (now - yolo_last_time) >= 1.0 / FPS_YOLO:
        yolo_last_time = now
        results = yolo_LP_detect(frame, size=640)
        detection_boxes = results.pandas().xyxy[0].values.tolist()

        for b in detection_boxes:
            x1, y1, x2, y2, _, _, _ = b
            x, y, w, h = int(x1), int(y1), int(x2 - x1), int(y2 - y1)
            crop = frame[y:y + h, x:x + w]
            plate = read_license_plate(crop)
            plate_counter[plate] += 1

            if plate != "unknown":
                if plate_counter[plate] >= MIN_DETECT_CNT:
                    current_session_plate = plate

            cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)
            cv2.putText(frame, f"{plate}", (x, y - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2)

            boxes.append({
                "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                "plate": plate
            })

        if boxes:
            latest_boxes = boxes

    fps = int(1.0 / (time.time() - t0 + 1e-6))
    cv2.putText(frame, f"FPS: {fps}", (7, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 255, 0), 2)

    return frame, get_display_plate(), boxes


# ====== STREAM MJPEG VIDEO ======
def generate_frames():
    global latest_frame, last_frame_time

    while True:
        current_time = datetime.datetime.now()
        time_diff = (current_time - last_frame_time).total_seconds()

        if latest_frame is not None:
            # Only show no signal if we've had no frames for a while
            if time_diff > no_signal_timeout and np.array_equal(latest_frame, create_no_signal_frame()):
                frame_to_show = create_no_signal_frame()
                # Add text to indicate no active cameras
                cv2.putText(frame_to_show, "No active cameras connected", (120, 300),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (200, 200, 200), 1)
            else:
                frame_to_show = latest_frame.copy()

            # Add timestamp and info to the frame
            timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
            cv2.putText(frame_to_show, timestamp, (10, frame_to_show.shape[0] - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)

            # Add info about when the last frame was received
            if time_diff > 3:  # Only show staleness warning after 3 seconds
                status_text = f"Last frame: {int(time_diff)}s ago"
                cv2.putText(frame_to_show, status_text, (10, 50),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255), 2)

            success, buffer = cv2.imencode('.jpg', frame_to_show)
            if success:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        else:
            # If somehow latest_frame is None, provide the no signal frame
            no_signal = create_no_signal_frame()
            success, buffer = cv2.imencode('.jpg', no_signal)
            if success:
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

        time.sleep(0.05)


@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(
        generate_frames(),
        media_type='multipart/x-mixed-replace; boundary=frame'
    )


@app.get("/get_plate")
async def get_plate():
    if latest_plate is None:
        raise HTTPException(status_code=404, detail="No frame processed yet")
    return {
        "plate": latest_plate,
        "boxes": latest_boxes
    }


# ====== WEBSOCKET NHẬN FRAME BASE64 ======
@app.websocket("/ws/stream")
async def websocket_endpoint(websocket: WebSocket):
    global latest_frame, last_frame_time
    await websocket.accept()
    print("[WS] WebSocket connected.")

    # Reset to the default frame when a new connection is established
    if latest_frame is None:
        latest_frame = create_no_signal_frame()

    try:
        while True:
            data = await websocket.receive_text()
            # Check if it's a heartbeat message
            if data == "ping" or data == "heartbeat":
                await websocket.send_text("pong")
                continue

            if data.startswith("data:image/jpeg;base64,"):
                data = data.split(",", 1)[1]

            try:
                img_data = base64.b64decode(data)
                nparr = np.frombuffer(img_data, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

                if frame is not None:
                    process_frame(frame)
                    last_frame_time = datetime.datetime.now()  # Update the last frame time
                    # Add a message to indicate frames are coming from WebSocket
                    cv2.putText(latest_frame, "Live WebSocket Stream",
                                (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
                else:
                    print("[WS] Frame decode failed.")
            except Exception as e:
                print(f"[WS] Error processing frame: {e}")

    except WebSocketDisconnect:
        print("[WS] WebSocket disconnected.")
        # Don't reset the frame here - keep the last frame for other viewers


# ====== CHẠY SERVER ======
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
