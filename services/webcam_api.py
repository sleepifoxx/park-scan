from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic_settings import BaseSettings
import cv2
import torch
import time
import collections
import numpy as np
import base64
import datetime
import asyncio
from function import helper, utils_rotate
import requests

# ====== CONFIG ======


class Settings(BaseSettings):
    frames_per_process: int = 5  # Process every Nth frame instead of using fps
    motion_thresh: int = 1000
    no_motion_time: float = 1.0
    min_detect_cnt: int = 3
    standard_width: int = 640
    standard_height: int = 480
    no_signal_timeout: int = 10


settings = Settings()

# ====== APPLICATION ======
app = FastAPI(title="License Plate Recognition API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====== RECOGNIZER CLASS ======


class LicensePlateRecognizer:
    def __init__(self, cfg: Settings):
        self.cfg = cfg
        self.device = 'cpu'
        # model placeholders
        self.detector = None
        self.reader = None
        self.last_gray = None
        self.motion_start = 0
        self.last_motion = 0
        self.frame_counter = 0  # Counter for frames to determine when to process
        self.counter = collections.Counter()
        self.session_active = False
        self.latest_frame = self._create_no_signal()
        self.latest_plate = None
        self.last_boxes = []
        self.history = []
        self.current_plate = None
        self.last_frame_time = datetime.datetime.now()

    def _create_no_signal(self):
        f = np.zeros((self.cfg.standard_height,
                     self.cfg.standard_width, 3), np.uint8)
        cv2.putText(f, "No video signal", (180, 240),
                    cv2.FONT_HERSHEY_COMPLEX, 1, (255, 255, 255), 2)
        return f

    def load_models(self):
        self.detector = torch.hub.load(
            'yolov5', 'custom', path='model/LP_detector_nano_61.pt', source='local')
        self.reader = torch.hub.load(
            'yolov5', 'custom', path='model/LP_ocr_nano_62.pt', source='local')
        self.reader.conf = 0.6

    def normalize(self, frame):
        h, w = frame.shape[:2]
        if (w, h) != (self.cfg.standard_width, self.cfg.standard_height):
            return cv2.resize(frame, (self.cfg.standard_width, self.cfg.standard_height))
        return frame

    def _read_plate(self, img):
        # try rotations
        for cc in range(2):
            for ct in range(2):
                txt = helper.read_plate(
                    self.reader, utils_rotate.deskew(img, cc, ct))
                if txt != 'unknown':
                    return txt
        return 'unknown'

    def _motion_check(self, frame_gray):
        if self.last_gray is None:
            self.last_gray = frame_gray
            return False
        if self.last_gray.shape != frame_gray.shape:
            self.last_gray = frame_gray
            return False
        delta = cv2.absdiff(self.last_gray, frame_gray)
        thresh = cv2.threshold(delta, 25, 255, cv2.THRESH_BINARY)[1]
        cnts, _ = cv2.findContours(cv2.dilate(
            thresh, None, iterations=2), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        self.last_gray = frame_gray
        return any(cv2.contourArea(c) > self.cfg.motion_thresh for c in cnts)

    def process(self, frame):
        frame = self.normalize(frame)
        now = time.time()
        gray = cv2.GaussianBlur(cv2.cvtColor(
            frame, cv2.COLOR_BGR2GRAY), (21, 21), 0)
        motion = self._motion_check(gray)

        # manage session
        if motion:
            if not self.session_active:
                self.session_active = True
                self.counter.clear()
                self.current_plate = None
                self.last_motion = now
            self.last_motion = now
        else:
            if self.session_active and now-self.last_motion > self.cfg.no_motion_time:
                self.session_active = False
                if self.counter:
                    plate, count = self.counter.most_common(1)[0]
                    if count >= self.cfg.min_detect_cnt and plate != 'unknown':
                        # Chỉ gửi auto_check nếu biển số mới khác với lần trước đã gửi
                        if plate != self.latest_plate:
                            self.latest_plate = plate
                            try:
                                requests.post(
                                    "http://backend:8000/auto_check",
                                    json={"license_plate": self.latest_plate}
                                )
                            except Exception as e:
                                print(f"Failed to call auto_check API: {e}")
                            self.history.append(plate)
                self.counter.clear()
                self.current_plate = None

        boxes = []
        # Increment frame counter and process only every Nth frame
        self.frame_counter += 1
        if not self.session_active:
            self.last_boxes = []

        if self.session_active and self.frame_counter >= self.cfg.frames_per_process:
            self.frame_counter = 0  # Reset counter
            results = self.detector(frame, size=self.cfg.standard_width)
            for b in results.pandas().xyxy[0].values.tolist():
                # b is [x1, y1, x2, y2, confidence, class, name]
                x1, y1, x2, y2 = map(int, b[:4])
                # optional: conf = b[4]; cls = b[5]
                crop = frame[y1:y2, x1:x2]
                plate = self._read_plate(crop)
                self.counter[plate] += 1
                if self.counter[plate] >= self.cfg.min_detect_cnt:
                    self.current_plate = plate
                boxes.append({
                    "x": x1, "y": y1,
                    "w": x2 - x1, "h": y2 - y1,
                    "plate": plate
                })
            if boxes:
                self.last_boxes = boxes

        # Always draw the last detected boxes on every frame
        for box in self.last_boxes:
            x, y, w, h = box["x"], box["y"], box["w"], box["h"]
            cv2.rectangle(frame, (x, y), (x+w, y+h),
                          (0, 255, 0), 2)
            cv2.putText(frame, box["plate"], (x+5, y-10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 255, 0), 2)

        self.latest_frame = frame
        self.last_frame_time = datetime.datetime.now()
        return frame, self.latest_plate or "No plate detected", self.last_boxes


recognizer = LicensePlateRecognizer(settings)


@app.on_event("startup")
def startup_event():
    recognizer.load_models()

# ====== VIDEO STREAM ======


def frame_generator():
    while True:
        frame, plate, boxes = recognizer.latest_frame, recognizer.latest_plate, recognizer.last_boxes
        buf = cv2.imencode('.jpg', frame)[1].tobytes()
        yield (b'--frame\r\nContent-Type: image/jpeg\r\n\r\n'+buf+b'\r\n')
        time.sleep(0.04)


@app.get("/video_feed")
async def video_feed():
    return StreamingResponse(frame_generator(), media_type='multipart/x-mixed-replace; boundary=frame')


@app.get("/get_plate")
async def get_plate():
    return {"plate": recognizer.latest_plate or "No plate detected", "boxes": recognizer.last_boxes}


@app.websocket("/ws/stream")
async def ws_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            data = await websocket.receive_text()
            if data.startswith("data:image/jpeg;base64,"):
                img = base64.b64decode(data.split(',', 1)[1])
                arr = np.frombuffer(img, np.uint8)
                frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
                if frame is not None:
                    recognizer.process(frame)
            await asyncio.sleep(0)
    except WebSocketDisconnect:
        pass
