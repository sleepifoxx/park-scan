from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from models import User, ParkingConfig, ParkingSession, UserRole, VehicleType
from database import get_db
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext
from datetime import datetime
import re

app = FastAPI()

# User Management Models


class UserCreate(BaseModel):
    username: str
    password: str
    email: str
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

class LicensePlateInput(BaseModel):
    license_plate: str

# User Management APIs

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)

@app.post("/admin/create_user")
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    result = await db.execute(select(User).filter(User.username == user.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Người dùng đã tồn tại")
    
    result = await db.execute(select(User).filter(User.email == user.email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email đã được đăng ký")
    hashed_password = hash_password(user.password)
    new_user = User(
        username=user.username,
        hashed_password=hashed_password,  # Hash password in production
        role=user.role
    )
    db.add(new_user)
    await db.commit()
    return {"message": "Tạo người dùng thành công"}


@app.post("/login")
async def login(username: str, password: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Thông tin đăng nhập không hợp lệ")
    return {"message": "Đăng nhập thành công"}


@app.put("/admin/modify_user_info/{username}")
async def modify_user_info(username: str, user_update: UserUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    if user_update.password:
        user.hashed_password = hash_password(user_update.password)
    if user_update.role:
        user.role = user_update.role
    if user_update.is_active is not None:
        user.is_active = user_update.is_active

    await db.commit()
    return {"message": "Cập nhật thông tin thành công"}


@app.get("/get_user_info/{username}")
async def get_user_info(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    
    return user


@app.delete("/admin/delete_user/{username}")
async def delete_user(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")

    await db.delete(user)
    await db.commit()
    return {"message": "Xóa người dùng thành công"}

# Parking Config APIs


@app.get("/admin/parking_config")
async def get_parking_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingConfig))
    config = result.scalars().all()
    return config


@app.put("/admin/parking_config")
async def update_parking_config(config_update: ParkingConfigUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingConfig))
    config = result.scalars().first()
    if not config:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin bãi đỗ")

    if config_update.max_capacity:
        config.max_capacity = config_update.max_capacity
    if config_update.price_per_hour:
        config.price_per_hour = config_update.price_per_hour

    await db.commit()
    return {"message": "Cập nhật thông tin bãi đỗ thành công"}

# Parking Session APIs
def detect_vehicle_type(license_plate: str) -> str:
    plate = license_plate.strip().upper()
    match = re.match(r"^\d{2}[A-Z]{1,2}", plate)
    
    if not match:
        raise ValueError("Biển số không hợp lệ")
    prefix = match.group()
    letters = prefix[2:]
    if len(letters) == 1:
        return "car"
    elif len(letters) == 2:
        return "motorbike"
    else:
        return "unknown"

async def checkin(db: AsyncSession, license_plate: str):
    vehicle_type = detect_vehicle_type(license_plate)
    result = await db.execute(select(ParkingConfig).filter(ParkingConfig.vehicle_type == vehicle_type))
    config = result.scalars().first()

    if not config:
        raise HTTPException(status_code=404, detail="Không tìm thấy thông tin bãi đỗ")

    result = await db.execute(select(func.count(ParkingSession.id)).filter(
        ParkingSession.vehicle_type == vehicle_type,
        ParkingSession.status == "active"
    ))
    active_sessions = await result.scalar()

    if active_sessions >= config.max_capacity:
        raise HTTPException(status_code=400, detail="Bãi đỗ đã đầy")
    
    result = await db.execute(select(ParkingSession).filter(
        ParkingSession.license_plate == license_plate,
        ParkingSession.status == "active"
    ))
    existing_session = result.scalars().first()

    if existing_session:
        raise HTTPException(status_code=400, detail="Xe chưa ra khỏi bãi")


    new_session = ParkingSession(
        license_plate=license_plate,
        vehicle_type=vehicle_type
    )
    db.add(new_session)
    await db.commit()
    return {"message": "Check-in thành công"}

async def checkout(db: AsyncSession, session: ParkingSession):
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên đỗ xe")

    if session.status != "active":
        raise HTTPException(status_code=400, detail="Xe đã được check-out")
    session.status = "closed"
    session.time_out = datetime.utcnow()

    result = await db.execute(select(ParkingConfig).filter(ParkingConfig.vehicle_type == session.vehicle_type))
    config = result.scalars().first()
    if config:
        duration = (session.time_out - session.time_in).total_seconds() / 3600
        session.fee = config.price_per_hour * duration

    await db.commit()
    return {
    "message": "Check-out thành công",
    "fee": round(session.fee, 2),
    "time_out": session.time_out
}


@app.post("/auto_check")
async def auto_check(data: LicensePlateInput, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingSession).filter(
        ParkingSession.license_plate == data.license_plate
    ).order_by(ParkingSession.time_in.desc()))
    session = result.scalars().first()

    if session and session.status == "active":
        return await checkout(db, session)
    else:
        return await checkin(db, data.license_plate, data.vehicle_type)


@app.get("/parking_session/{license_plate}")
async def get_parking_session(license_plate: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingSession).filter(ParkingSession.license_plate == license_plate))
    session = result.scalars().first()
    if not session:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy phiên đỗ xe")
    return session


@app.put("/parking_session/{license_plate}")
async def update_parking_session(license_plate: str, session_update: ParkingSessionUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingSession).filter(ParkingSession.license_plate == license_plate))
    session = result.scalars().first()
    if not session:
        raise HTTPException(
            status_code=404, detail="Không tìm thấy phiên đỗ xe")

    if session_update.status:
        session.status = session_update.status
    if session_update.time_out:
        session.time_out = session_update.time_out

    await db.commit()

    return {"message": "Cập nhật phiên đỗ xe thành công"}


@app.delete("/parking_session/{license_plate}")
async def delete_parking_session(license_plate: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingSession).filter(ParkingSession.license_plate == license_plate))
    session = result.scalars().first()
    if not session:
        raise HTTPException(status_code=404, detail="Không tìm thấy phiên đỗ xe")

    await db.delete(session)
    await db.commit()
    return {"message": "Xóa phiên đỗ xe thành công"}
