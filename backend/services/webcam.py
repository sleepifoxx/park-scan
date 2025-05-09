import cv2
import torch
import time
import collections
import function.utils_rotate as utils_rotate
import function.helper as helper

# ====== CẤU HÌNH ======
CAM_INDEX = 0         # chỉ định camera hoặc file video
WIDTH, HEIGHT = 640, 480  # độ phân giải capture
FPS_YOLO = 3         # số lần gọi YOLO trên mỗi giây khi có chuyển động
MOTION_THRESH = 5000      # ngưỡng diện tích contour để coi là chuyển động
# nếu không có chuyển động liên tiếp trong bao nhiêu giây => kết thúc phiên
NO_MOTION_TIME = 1.0
MIN_DETECT_CNT = 3         # số lần tối thiểu để coi là “xác thực” biển

# ====== NẠP MODEL YOLO ======
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


# ====== KHỞI TẠO ======
vid = cv2.VideoCapture(CAM_INDEX)
vid.set(cv2.CAP_PROP_FRAME_WIDTH,  WIDTH)
vid.set(cv2.CAP_PROP_FRAME_HEIGHT, HEIGHT)

last_gray = None
motion_start = 0
last_motion = 0
yolo_last_time = 0
plate_counter = collections.Counter()
session_active = False

print("Bắt đầu ghi nhận... Nhấn 'q' để thoát.")

while True:
    ret, frame = vid.read()
    if not ret:
        break
    t0 = time.time()

    # --- 1. Phát hiện chuyển động ---
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
        # nếu mới bắt đầu session
        if not session_active:
            session_active = True
            motion_start = now
            plate_counter.clear()
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
                    print(
                        f"[{time.strftime('%H:%M:%S')}] Kết thúc session. Biển số xác thực: {plate} ({cnt} lần).")
            else:
                print(
                    f"[{time.strftime('%H:%M:%S')}] Kết thúc session. Không đọc được biển hợp lệ.")
            plate_counter.clear()

    # --- 2. Nếu đang session (có motion), chạy YOLO ở FPS cố định ---
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

            # Vẽ
            cv2.rectangle(frame, (x, y), (x+w, y+h), (0, 255, 0), 2)
            cv2.putText(
                frame, f"{plate}", (x, y-10),
                cv2.FONT_HERSHEY_SIMPLEX, 0.9, (36, 255, 12), 2
            )

    # --- 3. Hiển thị FPS & frame ---
    fps = int(1.0 / (time.time() - t0 + 1e-6))
    cv2.putText(frame, f"FPS: {fps}", (7, 30),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (100, 255, 0), 2)
    cv2.imshow("License Plate Recognition", frame)

    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

vid.release()
cv2.destroyAllWindows()
