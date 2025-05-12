import cv2
import torch
import time
import collections
import numpy as np
import function.utils_rotate as utils_rotate
import function.helper as helper
from threading import Lock


class PlateProcessor:
    def __init__(self, cam_index=0, width=640, height=480, fps_yolo=3, motion_thresh=5000,
                 no_motion_time=1.0, min_detect_cnt=3):

        # Cấu hình
        self.cam_index = cam_index
        self.width = width
        self.height = height
        self.fps_yolo = fps_yolo
        self.motion_thresh = motion_thresh
        self.no_motion_time = no_motion_time
        self.min_detect_cnt = min_detect_cnt

        # Khởi tạo model
        self.yolo_LP_detect = torch.hub.load(
            'yolov5', 'custom',
            path='model/LP_detector_nano_61.pt',
            force_reload=True, source='local'
        )
        self.yolo_license_plate = torch.hub.load(
            'yolov5', 'custom',
            path='model/LP_ocr_nano_62.pt',
            force_reload=True, source='local'
        )
        self.yolo_license_plate.conf = 0.60

        # Biến trạng thái
        self.last_gray = None
        self.motion_start = 0
        self.last_motion = 0
        self.yolo_last_time = 0
        self.plate_counter = collections.Counter()
        self.session_active = False
        self.last_plate = "unknown"
        self.lock = Lock()

        # Lưu frame đã annotate
        self.annotated_frame = None

    def read_license_plate(self, img):
        """Deskew nhiều hướng, đọc biển."""
        for cc in range(2):
            for ct in range(2):
                txt = helper.read_plate(
                    self.yolo_license_plate,
                    utils_rotate.deskew(img, cc, ct)
                )
                if txt != "unknown":
                    return txt
        return "unknown"

    def process_frame(self, frame):
        t0 = time.time()

        with self.lock:
            # 1. Phát hiện chuyển động
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.GaussianBlur(gray, (21, 21), 0)

            if self.last_gray is None:
                self.last_gray = gray
                return frame

            delta = cv2.absdiff(self.last_gray, gray)
            thresh = cv2.threshold(delta, 25, 255, cv2.THRESH_BINARY)[1]
            thresh = cv2.dilate(thresh, None, iterations=2)
            cnts, _ = cv2.findContours(
                thresh, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
            self.last_gray = gray

            motion = any(cv2.contourArea(c) > self.motion_thresh for c in cnts)
            now = time.time()

            if motion:
                if not self.session_active:
                    self.session_active = True
                    self.motion_start = now
                    self.plate_counter.clear()
                self.last_motion = now
            else:
                if self.session_active and (now - self.last_motion) > self.no_motion_time:
                    self.session_active = False
                    if self.plate_counter:
                        plate, cnt = self.plate_counter.most_common(1)[0]
                        if cnt >= self.min_detect_cnt and plate != "unknown":
                            self.last_plate = plate
                    self.plate_counter.clear()

            # 2. Nhận diện nếu có chuyển động
            if self.session_active and (now - self.yolo_last_time) >= 1.0 / self.fps_yolo:
                self.yolo_last_time = now

                results = self.yolo_LP_detect(frame, size=640)
                boxes = results.pandas().xyxy[0].values.tolist()

                for b in boxes:
                    x1, y1, x2, y2, _, _, _ = b
                    x, y, w, h = int(x1), int(y1), int(x2 - x1), int(y2 - y1)
                    crop = frame[y:y + h, x:x + w]
                    plate = self.read_license_plate(crop)
                    self.plate_counter[plate] += 1

                    # Vẽ kết quả
                    cv2.rectangle(frame, (x, y), (x + w, y + h),
                                  (0, 255, 0), 2)
                    cv2.putText(frame, f"{plate}", (x, y - 10),
                                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2)

            # 3. Annotate frame
            fps = int(1.0 / (time.time() - t0 + 1e-6))
            cv2.putText(frame, f"FPS: {fps}", (7, 30),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 255, 0), 2)

            self.annotated_frame = frame.copy()

        return frame

    def get_last_plate(self):
        with self.lock:
            return self.last_plate

    def get_annotated_frame(self):
        with self.lock:
            return self.annotated_frame.copy() if self.annotated_frame is not None else None
