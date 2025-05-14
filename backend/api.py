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
    config = db.query(ParkingConfig).filter(
        ParkingConfig.vehicle_type == session.vehicle_type).first()
    if not config:
        raise HTTPException(status_code=404, detail="Parking config not found")

    active_sessions = db.query(ParkingSession).filter(
        ParkingSession.vehicle_type == session.vehicle_type, ParkingSession.status == "active").count()
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
    session = db.query(ParkingSession).filter(
        ParkingSession.license_plate == license_plate, ParkingSession.status == "active").first()
    if not session:
        raise HTTPException(
            status_code=404, detail="Active parking session not found")

    session.status = "closed"
    session.time_out = func.now()
    db.commit()
    return {"message": "Check-out successful"}


@app.get("/parking_session/{license_plate}")
def get_parking_session(license_plate: str, db: Session = Depends(get_db)):
    session = db.query(ParkingSession).filter(
        ParkingSession.license_plate == license_plate).first()
    if not session:
        raise HTTPException(
            status_code=404, detail="Parking session not found")
    return session


@app.put("/parking_session/{license_plate}")
def update_parking_session(license_plate: str, session_update: ParkingSessionUpdate, db: Session = Depends(get_db)):
    session = db.query(ParkingSession).filter(
        ParkingSession.license_plate == license_plate).first()
    if not session:
        raise HTTPException(
            status_code=404, detail="Parking session not found")

    if session_update.status:
        session.status = session_update.status
    if session_update.time_out:
        session.time_out = session_update.time_out

    db.commit()
    return {"message": "Parking session updated successfully"}


@app.delete("/parking_session/{license_plate}")
def delete_parking_session(license_plate: str, db: Session = Depends(get_db)):
    session = db.query(ParkingSession).filter(
        ParkingSession.license_plate == license_plate).first()
    if not session:
        raise HTTPException(
            status_code=404, detail="Parking session not found")

    db.delete(session)
    db.commit()
    return {"message": "Parking session deleted successfully"}
