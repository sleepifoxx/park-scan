<<<<<<< HEAD
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Request, Form
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
from database import get_db
from datetime import datetime
import uuid
import os
import bcrypt
from email_validator import validate_email, EmailNotValidError

from backend.models import ParkingConfig, ParkingSession, LPRLog, User, UserRole

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
        raise HTTPException(
            status_code=401, detail="Invalid authorization header")

# -------------------- USER API --------------------


@app.post("/admin/create-user", tags=["Admin"])
async def create_user(
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: UserRole = Form(...),
    db: AsyncSession = Depends(get_db),
):
    # Validate email
    try:
        valid = validate_email(email)
        email = valid.email
    except EmailNotValidError as e:
        return {"status": "fail", "message": f"Email không hợp lệ: {str(e)}"}

    # Kiểm tra username đã tồn tại chưa
    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalars().first():
        return {"status": "fail", "message": "Username đã tồn tại"}

    # Hash password
    hashed_password = bcrypt.hashpw(password.encode(
        'utf-8'), bcrypt.gensalt()).decode('utf-8')

    new_user = User(
        username=username,
        email=email,
        hashed_password=hashed_password,
        role=role,
        is_active=True
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return {"status": "success", "message": f"Tạo user {username} thành công"}


@app.delete("/admin/delete-user/{user_id}", tags=["Admin"])
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
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
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if not user or not bcrypt.checkpw(password.encode('utf-8'), user.hashed_password.encode('utf-8')):
        return {"status": "fail", "message": "Sai tài khoản hoặc mật khẩu"}

    return {
        "status": "success",
        "username": user.username,
        "role": user.role
    }


@app.get("/get-all-users", tags=["Admin"])
async def get_all_users(
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return {"status": "success", "users": [user.username for user in users]}


@app.get("/get-user/{user_id}", tags=["User"])
async def get_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return {
        "status": "success",
        "user": {
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }


@app.put("/update-user/{user_id}", tags=["Admin"])
async def update_user(
    user_id: int,
    username: str = Form(...),
    email: str = Form(...),
    password: str = Form(...),
    role: UserRole = Form(...),
    db: AsyncSession = Depends(get_db),
):
    # Validate email
    try:
        valid = validate_email(email)
        email = valid.email
    except EmailNotValidError as e:
        return {"status": "fail", "message": f"Email không hợp lệ: {str(e)}"}

    # Kiểm tra username đã tồn tại chưa
    existing = await db.execute(select(User).where(User.username == username))
    if existing.scalars().first():
        return {"status": "fail", "message": "Username đã tồn tại"}

    # Hash password
    hashed_password = bcrypt.hashpw(password.encode(
        'utf-8'), bcrypt.gensalt()).decode('utf-8')

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.username = username
    user.email = email
    user.hashed_password = hashed_password
    user.role = role

    await db.commit()
    await db.refresh(user)
    return {"status": "success", "message": f"Cập nhật user {username} thành công"}
=======
from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.orm import Session
from sqlalchemy.sql import func
from models import User, ParkingConfig, ParkingSession, UserRole
from database import get_db
from pydantic import BaseModel
from typing import Optional

app = FastAPI()

# User Management Models
class UserCreate(BaseModel):
    username: str
    password: str
    role: Optional[UserRole] = UserRole.USER

class UserUpdate(BaseModel):
    password: Optional[str]
    role: Optional[UserRole]
    is_active: Optional[bool]

# Parking Config Models
class ParkingConfigUpdate(BaseModel):
    max_capacity: Optional[int]
    price_per_hour: Optional[float]

# Parking Session Models
class ParkingSessionCreate(BaseModel):
    license_plate: str
    vehicle_type: str

class ParkingSessionUpdate(BaseModel):
    status: Optional[str]
    time_out: Optional[str]

# User Management APIs
@app.post("/admin/create_user")
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    if db.query(User).filter(User.username == user.username).first():
        raise HTTPException(status_code=400, detail="Username already exists")

    new_user = User(
        username=user.username,
        hashed_password=user.password,  # Hash password in production
        role=user.role
    )
    db.add(new_user)
    db.commit()
    return {"message": "User created successfully"}

@app.post("/login")
def login(username: str, password: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user or user.hashed_password != password:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    return {"message": "Login successful"}

@app.put("/admin/modify_user_info/{username}")
def modify_user_info(username: str, user_update: UserUpdate, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user_update.password:
        user.hashed_password = user_update.password
    if user_update.role:
        user.role = user_update.role
    if user_update.is_active is not None:
        user.is_active = user_update.is_active

    db.commit()
    return {"message": "User updated successfully"}

@app.get("/get_user_info/{username}")
def get_user_info(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

@app.delete("/admin/delete_user/{username}")
def delete_user(username: str, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"message": "User deleted successfully"}

# Parking Config APIs
@app.get("/admin/parking_config")
def get_parking_config(db: Session = Depends(get_db)):
    config = db.query(ParkingConfig).all()
    return config

@app.put("/admin/parking_config")
def update_parking_config(config_update: ParkingConfigUpdate, db: Session = Depends(get_db)):
    config = db.query(ParkingConfig).first()
    if not config:
        raise HTTPException(status_code=404, detail="Parking config not found")

    if config_update.max_capacity:
        config.max_capacity = config_update.max_capacity
    if config_update.price_per_hour:
        config.price_per_hour = config_update.price_per_hour

    db.commit()
    return {"message": "Parking config updated successfully"}

# Parking Session APIs
@app.post("/parking_session/checkin")
def checkin(session: ParkingSessionCreate, db: Session = Depends(get_db)):
    config = db.query(ParkingConfig).filter(ParkingConfig.vehicle_type == session.vehicle_type).first()
    if not config:
        raise HTTPException(status_code=404, detail="Parking config not found")

    active_sessions = db.query(ParkingSession).filter(ParkingSession.vehicle_type == session.vehicle_type, ParkingSession.status == "active").count()
    if active_sessions >= config.max_capacity:
        raise HTTPException(status_code=400, detail="Parking lot is full")

    new_session = ParkingSession(
        license_plate=session.license_plate,
        vehicle_type=session.vehicle_type
    )
    db.add(new_session)
    db.commit()
    return {"message": "Check-in successful"}

@app.put("/parking_session/checkout/{license_plate}")
def checkout(license_plate: str, db: Session = Depends(get_db)):
    session = db.query(ParkingSession).filter(ParkingSession.license_plate == license_plate, ParkingSession.status == "active").first()
    if not session:
        raise HTTPException(status_code=404, detail="Active parking session not found")

    session.status = "closed"
    session.time_out = func.now()
    db.commit()
    return {"message": "Check-out successful"}

@app.get("/parking_session/{license_plate}")
def get_parking_session(license_plate: str, db: Session = Depends(get_db)):
    session = db.query(ParkingSession).filter(ParkingSession.license_plate == license_plate).first()
    if not session:
        raise HTTPException(status_code=404, detail="Parking session not found")
    return session

@app.put("/parking_session/{license_plate}")
def update_parking_session(license_plate: str, session_update: ParkingSessionUpdate, db: Session = Depends(get_db)):
    session = db.query(ParkingSession).filter(ParkingSession.license_plate == license_plate).first()
    if not session:
        raise HTTPException(status_code=404, detail="Parking session not found")

    if session_update.status:
        session.status = session_update.status
    if session_update.time_out:
        session.time_out = session_update.time_out

    db.commit()
    return {"message": "Parking session updated successfully"}

@app.delete("/parking_session/{license_plate}")
def delete_parking_session(license_plate: str, db: Session = Depends(get_db)):
    session = db.query(ParkingSession).filter(ParkingSession.license_plate == license_plate).first()
    if not session:
        raise HTTPException(status_code=404, detail="Parking session not found")

    db.delete(session)
    db.commit()
    return {"message": "Parking session deleted successfully"}
>>>>>>> 239d8b8daf52835275c764c09eb4f7f8e5690ed1
