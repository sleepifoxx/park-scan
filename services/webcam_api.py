from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
import uvicorn
import cv2
import numpy as np
import time
from webcam import PlateProcessor

app = FastAPI()

# CORS cho phép gọi từ frontend (Next.js)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hoặc thay bằng ["http://localhost:3000"]
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Khởi tạo processor
processor = PlateProcessor()

# Route test


@app.get("/")
def root():
    return {"message": "License Plate Recognition API đang chạy"}

# Nhận frame từ camera frontend (POST)


@app.post("/upload_frame")
async def upload_frame(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        processor.process_frame(frame)
        return {"status": "ok"}
    except Exception as e:
        return JSONResponse(status_code=500, content={"error": str(e)})

# Trả về biển số đã nhận diện gần nhất (GET)


@app.get("/plate_feed")
def plate_feed():
    return {"plate": processor.get_last_plate()}

# Trả về video stream đã annotate (GET)


@app.get("/video_feed")
def video_feed():
    def generate():
        while True:
            frame = processor.get_annotated_frame()
            if frame is not None:
                _, buffer = cv2.imencode(".jpg", frame)
                yield (b"--frame\r\n"
                       b"Content-Type: image/jpeg\r\n\r\n" +
                       buffer.tobytes() + b"\r\n")
            time.sleep(0.1)

    return StreamingResponse(generate(), media_type="multipart/x-mixed-replace; boundary=frame")


# Run server
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
