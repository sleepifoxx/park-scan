from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from database import get_db
from datetime import datetime
import uuid
import os

from models.models import ParkingConfig, ParkingSession, LPRLog, User, UserRole

app = FastAPI(
    title="Parking System API",
    description="API for Parking Management",
    openapi_tags=[
        {"name": "default", "description": "API endpoints"}
    ],
    openapi_url="/openapi.json"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------- AUTH HELPERS --------------------
async def get_current_user(request: Request, db: AsyncSession = Depends(get_db)):
    auth_header = request.headers.get("Authorization")
    if not auth_header:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        if not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid token format")

        token_value = auth_header.split(" ")[1]
        try:
            user_id = int(token_value)
        except ValueError:
            raise HTTPException(status_code=401, detail="Invalid token value")

        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid authorization header")

# -------------------- USER API --------------------
@app.post("/admin/create-user", tags=["User"])
async def create_user(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        username=username,
        email=email,
        hashed_password=password,
        role=UserRole.USER,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@app.delete("/admin/delete-user/{user_id}", tags=["User"])
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.delete(user)
    await db.commit()
    return {"status": "success", "message": "User deleted"}

@app.post("/login", tags=["User"])
async def login(
    username: str = Form(...),
    password: str = Form(...),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(
        User.username == username,
        User.hashed_password == password
    ))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return user

# -------------------- PARKING API --------------------
@app.post("/parking/check-in", tags=["Parking"])
async def check_in(
    image: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    image_path = f"uploads/{uuid.uuid4()}_{image.filename}"
    os.makedirs("uploads", exist_ok=True)
    with open(image_path, "wb") as f:
        f.write(await image.read())

    license_plate = "DEMO1234"
    confidence = 0.95

    session = ParkingSession(
        license_plate=license_plate,
        vehicle_type="car",
        user_id=user.id,
        status="active"
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    log = LPRLog(
        session_id=session.id,
        image_path=image_path,
        detected_plate=license_plate,
        confidence=confidence
    )
    db.add(log)
    await db.commit()

    return session

@app.post("/parking/check-out", tags=["Parking"])
async def check_out(
    session_id: int = Form(...),
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user)
):
    result = await db.execute(select(ParkingSession).where(
        ParkingSession.id == session_id,
        ParkingSession.status == "active"
    ))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.time_out = datetime.utcnow()
    duration = (session.time_out - session.time_in).total_seconds() / 3600

    config = await db.execute(select(ParkingConfig).where(ParkingConfig.hour_range == "1-2"))
    rate = config.scalars().first()
    session.fee = rate.price if rate else 10000
    session.status = "closed"
    await db.commit()

    return session
