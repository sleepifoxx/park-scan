from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import cv2
import torch
import time
import collections
import numpy as np
import base64
import io
from PIL import Image
import function.utils_rotate as utils_rotate
import function.helper as helper

app = FastAPI(title="License Plate Recognition API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ====== CẤU HÌNH ======
WIDTH, HEIGHT = 640, 480  # độ phân giải capture
FPS_YOLO = 3              # số lần gọi YOLO trên mỗi giây khi có chuyển động
MOTION_THRESH = 5000      # ngưỡng diện tích contour để coi là chuyển động
# nếu không có chuyển động liên tiếp trong bao nhiêu giây => kết thúc phiên
NO_MOTION_TIME = 1.0
MIN_DETECT_CNT = 3        # số lần tối thiểu để coi là "xác thực" biển

# ====== NẠP MODEL YOLO ======
print("Loading YOLO models...")
yolo_LP_detect = torch.hub.load(
    'yolov5', 'custom',
    path='model/LP_detector_nano_61.pt',
    force_reload=True, source='local'
)
yolo_license_plate = torch.hub.load(
    'yolov5', 'custom',
    path='model/LP_ocr_nano_62.pt',
    force_reload=True, source='local'
)
yolo_license_plate.conf = 0.60

# ====== BIẾN TOÀN CỤC ======
last_gray = None
motion_start = 0
last_motion = 0
yolo_last_time = 0
plate_counter = collections.Counter()
session_active = False
current_frame = None
latest_plate = None
latest_boxes = []
plate_history = []         # Lưu lịch sử các biển số đã xác thực
current_session_plate = None  # Biển số đang được theo dõi trong session hiện tại

# ====== HÀM HỖ TRỢ ======


def read_license_plate(img):
    """Thử deskew nhiều hướng, trả về lần đọc đầu tiên != 'unknown'"""
    for cc in range(2):
        for ct in range(2):
            txt = helper.read_plate(
                yolo_license_plate,
                utils_rotate.deskew(img, cc, ct)
            )
            if txt != "unknown":
                return txt
    return "unknown"


def calculate_iou(b1, b2):
    """Tính IoU giữa 2 box [x,y,w,h]"""
    x1, y1, w1, h1 = b1
    x2, y2, w2, h2 = b2
    xa = max(x1, x2)
    ya = max(y1, y2)
    xb = min(x1+w1, x2+w2)
    yb = min(y1+h1, y2+h2)
    if xb < xa or yb < ya:
        return 0.0
    inter = (xb-xa)*(yb-ya)
    return inter / float(w1*h1 + w2*h2 - inter)


def get_display_plate():
    """Lấy biển số ổn định nhất để hiển thị cho người dùng"""
    # Ưu tiên theo thứ tự:
    # 1. Biển số đã xác thực trong session hiện tại (current_session_plate)
    # 2. Biển số mới nhất đã xác thực (latest_plate)
    # 3. Biển số "No plate detected" nếu không có gì

    if current_session_plate and current_session_plate != "unknown":
        return current_session_plate
    elif latest_plate and latest_plate != "unknown":
        return latest_plate
    else:
        return "No plate detected"


def process_frame(frame):
    """Process a single frame for motion detection and license plate recognition"""
    global last_gray, motion_start, last_motion, yolo_last_time
    global plate_counter, session_active, current_frame
    global latest_plate, latest_boxes, current_session_plate

    if frame is None:
        return None, get_display_plate(), []

    t0 = time.time()
    current_frame = frame.copy()

    # --- 1. Phát hiện chuyển động ---
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
        # nếu mới bắt đầu session
        if not session_active:
            session_active = True
            motion_start = now
            plate_counter.clear()
            current_session_plate = None
            print(
                f"[{time.strftime('%H:%M:%S')}] Phát hiện chuyển động, bắt đầu phiên đọc biển số.")
        last_motion = now
    else:
        # nếu đã có session và quá NO_MOTION_TIME không có motion => kết thúc session
        if session_active and (now - last_motion) > NO_MOTION_TIME:
            session_active = False
            if plate_counter:
                plate, cnt = plate_counter.most_common(1)[0]
                if cnt >= MIN_DETECT_CNT and plate != "unknown":
                    latest_plate = plate
                    # Thêm vào lịch sử nếu chưa tồn tại hoặc khác với biển số cuối cùng
                    if not plate_history or plate_history[-1] != plate:
                        plate_history.append(plate)
                        # Giữ lịch sử ở mức tối đa 10 biển số
                        if len(plate_history) > 10:
                            plate_history.pop(0)

                    print(
                        f"[{time.strftime('%H:%M:%S')}] Kết thúc session. Biển số xác thực: {plate} ({cnt} lần).")
            else:
                print(
                    f"[{time.strftime('%H:%M:%S')}] Kết thúc session. Không đọc được biển hợp lệ.")

            # Reset các biến của session
            plate_counter.clear()
            current_session_plate = None

    # Khởi tạo boxes cho frame hiện tại
    boxes = []
    frame_plate = None  # Biển số được phát hiện trong frame hiện tại

    # --- 2. Nếu đang session (có motion), chạy YOLO ở FPS cố định ---
    if session_active and (now - yolo_last_time) >= 1.0 / FPS_YOLO:
        yolo_last_time = now

        results = yolo_LP_detect(frame, size=640)
        detection_boxes = results.pandas().xyxy[0].values.tolist()

        for b in detection_boxes:
            x1, y1, x2, y2, _, _, _ = b
            x, y, w, h = int(x1), int(y1), int(x2-x1), int(y2-y1)
            crop = frame[y:y+h, x:x+w]
            plate = read_license_plate(crop)
            plate_counter[plate] += 1

            # Nếu đọc được biển hợp lệ, cập nhật biển số hiện tại của session
            if plate != "unknown":
                frame_plate = plate
                # Nếu biển số hợp lệ và đã phát hiện >= MIN_DETECT_CNT lần
                # thì cập nhật current_session_plate
                if plate_counter[plate] >= MIN_DETECT_CNT:
                    current_session_plate = plate

            # Vẽ
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            cv2.putText(
                frame, f"{plate}", (x, y-10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2
            )

            boxes.append({
                "x": int(x), "y": int(y), "w": int(w), "h": int(h),
                "plate": plate
            })

        if boxes:  # Chỉ cập nhật latest_boxes nếu có phát hiện trong frame hiện tại
            latest_boxes = boxes

    # --- 3. Hiển thị FPS & frame ---
    fps = int(1.0 / (time.time() - t0 + 1e-6))
    cv2.putText(frame, f"FPS: {fps}", (7, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 255, 0), 2)

    # Trả về frame đã xử lý, biển số ổn định, và boxes phát hiện trong frame
    return frame, get_display_plate(), boxes


@app.post("/upload_frame")
async def upload_frame(file: UploadFile = File(...)):
    """Upload and process a single frame"""
    contents = await file.read()

    # Convert the uploaded image to OpenCV format
    nparr = np.frombuffer(contents, np.uint8)
    frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if frame is None:
        raise HTTPException(status_code=400, detail="Invalid image format")

    processed_frame, display_plate, boxes = process_frame(frame)

    _, img_encoded = cv2.imencode('.jpg', processed_frame)

    response = {
        "success": True,
        "plate": display_plate,
        "boxes": boxes if boxes else latest_boxes,
        "frame": base64.b64encode(img_encoded).decode('utf-8'),
        "history": plate_history  # Thêm lịch sử biển số vào response
    }

    return response


def generate_frames():
    """Generate frames for video streaming"""
    while True:
        if current_frame is not None:
            processed_frame, _, _ = process_frame(current_frame)
            if processed_frame is not None:
                _, buffer = cv2.imencode('.jpg', processed_frame)
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
        time.sleep(0.05)  # Add a small delay to reduce CPU usage


@app.get("/video_feed")
async def video_feed():
    """Video streaming endpoint"""
    return StreamingResponse(
        generate_frames(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )


@app.get("/get_plate")
async def get_plate():
    """Get the latest detected license plate"""
    return {
        "plate": get_display_plate(),
        "boxes": latest_boxes,
        "history": plate_history  # Thêm lịch sử biển số vào response
    }


if __name__ == "__main__":
    import uvicorn
    print("Starting License Plate Recognition API server...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
