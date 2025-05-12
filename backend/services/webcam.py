from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse, StreamingResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

import cv2
import threading
import time
import torch
import collections
import numpy as np
import io
from function import utils_rotate, helper

# === Setup FastAPI ===
app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000",
                   "http://127.0.0.1:5500"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# === Global Variables ===
frame_lock = threading.Lock()
latest_frame = None
latest_plate = "unknown"

# === Load YOLO Models ===
yolo_LP_detect = torch.hub.load(
    'yolov5', 'custom', path='model/LP_detector_nano_61.pt', force_reload=True, source='local')
yolo_license_plate = torch.hub.load(
    'yolov5', 'custom', path='model/LP_ocr_nano_62.pt', force_reload=True, source='local')
yolo_license_plate.conf = 0.60

# === Constants ===
CAM_INDEX = 0
WIDTH, HEIGHT = 640, 480
FPS_YOLO = 3
MOTION_THRESH = 5000
NO_MOTION_TIME = 1.0
MIN_DETECT_CNT = 3

# === Helper ===


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

# === Background camera thread ===


def camera_worker():
    global latest_frame, latest_plate
    vid = cv2.VideoCapture(CAM_INDEX)
    vid.set(cv2.CAP_PROP_FRAME_WIDTH, WIDTH)
    vid.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)

    last_gray = None
    motion_start = 0
    last_motion = 0
    yolo_last_time = 0
    plate_counter = collections.Counter()
    session_active = False

    while True:
        ret, frame = vid.read()
        if not ret:
            continue
        t0 = time.time()

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)
        if last_gray is None:
            last_gray = gray
            continue

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
            last_motion = now
        else:
            if session_active and (now - last_motion) > NO_MOTION_TIME:
                session_active = False
                if plate_counter:
                    plate, cnt = plate_counter.most_common(1)[0]
                    if cnt >= MIN_DETECT_CNT and plate != "unknown":
                        latest_plate = plate
                plate_counter.clear()

        if session_active and (now - yolo_last_time) >= 1.0 / FPS_YOLO:
            yolo_last_time = now
            results = yolo_LP_detect(frame, size=640)
            boxes = results.pandas().xyxy[0].values.tolist()

            for b in boxes:
                x1, y1, x2, y2, _, _, _ = b
                x, y, w, h = int(x1), int(y1), int(x2-x1), int(y2-y1)
                crop = frame[y:y+h, x:x+w]
                plate = read_license_plate(crop)
                plate_counter[plate] += 1
                cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
                cv2.putText(frame, plate, (x, y-10),
                            cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2)

        cv2.putText(frame, f"Plate: {latest_plate}", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 255, 0), 2)

        # Save latest frame
        with frame_lock:
            latest_frame = frame.copy()

        time.sleep(0.01)


@app.get("/video_feed")
def video_feed():
    def gen():
        while True:
            with frame_lock:
                if latest_frame is None:
                    continue
                ret, jpeg = cv2.imencode('.jpg', latest_frame)
            frame_bytes = jpeg.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            time.sleep(0.05)
    return StreamingResponse(gen(), media_type='multipart/x-mixed-replace; boundary=frame')


@app.get("/plate")
def get_plate():
    return JSONResponse({"plate": latest_plate})


# Start background thread
threading.Thread(target=camera_worker, daemon=True).start()
