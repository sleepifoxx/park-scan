import cv2

cap = cv2.VideoCapture(0)
ret, frame = cap.read()
if not ret:
    print("❌ Không thể truy cập webcam.")
else:
    print("✅ Webcam hoạt động.")
cap.release()
