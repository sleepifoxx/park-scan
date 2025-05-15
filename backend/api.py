from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func
from models import User, ParkingConfig, ParkingSession, UserRole, VehicleType, StatusCode
from database import get_db
from pydantic import BaseModel
from typing import Optional
from passlib.context import CryptContext
from datetime import datetime, timedelta, timezone

import re

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # hoặc ["*"] nếu muốn cho phép tất cả
    allow_credentials=True,
    allow_methods=["*"],     # cho phép mọi phương thức, bao gồm OPTIONS
    allow_headers=["*"],
)

# User Management Models


class UserCreate(BaseModel):
    username: str
    password: str
    email: str
    role: Optional[UserRole] = UserRole.USER


class UserUpdate(BaseModel):
    password: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None

# Parking Config Models


class ParkingConfigUpdate(BaseModel):
    vehicle_type: Optional[VehicleType] = None
    max_capacity: Optional[int] = None
    price_per_hour: Optional[float] = None

# Parking Session Models


class ParkingSessionCreate(BaseModel):
    license_plate: str
    vehicle_type: VehicleType


class ParkingSessionUpdate(BaseModel):
    status: Optional[str] = None
    timeout: Optional[datetime] = None


class LicensePlateInput(BaseModel):
    license_plate: str


# User Management APIs
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str):
    return pwd_context.hash(password)


def verify_password(plain_password: str, hashed_password: str):
    return pwd_context.verify(plain_password, hashed_password)


@app.post("/admin/create_user", tags=["Admin"])
async def create_user(user: UserCreate, db: AsyncSession = Depends(get_db)):
    # Check if user already exists
    result = await db.execute(select(User).filter(User.username == user.username))
    if result.scalars().first():
        return {"status": StatusCode.ERROR, "message": "Tên người dùng đã tồn tại"}

    result = await db.execute(select(User).filter(User.email == user.email))
    if result.scalars().first():
        return {"status": StatusCode.ERROR, "message": "Email đã tồn tại"}
    hashed_password = hash_password(user.password)
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hashed_password,
        role=user.role
    )
    db.add(new_user)
    await db.commit()
    return {"status": StatusCode.SUCCESS, "message": "Tạo người dùng thành công"}


@app.post("/login", tags=["User"])
async def login(username: str, password: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()
    if not user or not verify_password(password, user.hashed_password):
        return {"status": StatusCode.ERROR, "message": "Tên người dùng hoặc mật khẩu không đúng"}
    if not user.is_active:
        return {"status": StatusCode.ERROR, "message": "Tài khoản đã bị khóa"}
    return {
        "status": StatusCode.SUCCESS,
        "message": "Đăng nhập thành công",
        "user": {
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active
        }
    }


@app.put("/admin/modify_user_info/{username}", tags=["Admin"])
async def modify_user_info(username: str, user_update: UserUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()

    if not user:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy người dùng"}

    if user_update.password:
        user.hashed_password = hash_password(user_update.password)
    if user_update.role:
        user.role = user_update.role
    if user_update.is_active is not None:
        user.is_active = user_update.is_active

    await db.commit()
    return {"status": StatusCode.SUCCESS, "message": "Cập nhật thông tin người dùng thành công"}


@app.get("/get_user_info/{username}", tags=["User"])
async def get_user_info(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()

    if not user:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy người dùng"}

    # Return user info without password hash
    return {
        "status": StatusCode.SUCCESS,
        "message": "Lấy thông tin người dùng thành công",
        "user": {
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at
        }
    }


@app.get("/admin/get_all_users", tags=["Admin"])
async def get_all_users(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User))
    users = result.scalars().all()
    return {
        "status": StatusCode.SUCCESS,
        "message": "Lấy danh sách người dùng thành công",
        "users": [
            {
                "username": user.username,
                "email": user.email,
                "role": user.role,
                "is_active": user.is_active,
                "created_at": user.created_at
            } for user in users
        ]
    }


@app.delete("/admin/delete_user/{username}", tags=["Admin"])
async def delete_user(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()

    if not user:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy người dùng"}

    await db.delete(user)
    await db.commit()
    return {"status": StatusCode.SUCCESS, "message": "Xóa người dùng thành công"}

# Parking Config APIs


@app.get("/admin/get_parking_config", tags=["Admin"])
async def get_parking_config(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingConfig))
    config = result.scalars().all()
    if not config:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy thông tin bãi đỗ"}
    return {
        "status": StatusCode.SUCCESS,
        "message": "Lấy thông tin bãi đỗ thành công",
        "config": [
            {
                "vehicle_type": item.vehicle_type,
                "max_capacity": item.max_capacity,
                "price_per_hour": item.price_per_hour
            } for item in config
        ]
    }


@app.put("/admin/update_parking_config/{id}", tags=["Admin"])
async def update_parking_config(id: int, config_update: ParkingConfigUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingConfig).filter(ParkingConfig.id == id))
    config = result.scalars().first()
    if not config:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy thông tin bãi đỗ"}

    if config_update.vehicle_type:
        config.vehicle_type = config_update.vehicle_type
    if config_update.max_capacity is not None:
        config.max_capacity = config_update.max_capacity
    if config_update.price_per_hour is not None:
        config.price_per_hour = config_update.price_per_hour

    await db.commit()
    return {"status": StatusCode.SUCCESS, "message": "Cập nhật thông tin bãi đỗ thành công"}


@app.delete("/admin/delete_parking_config/{id}", tags=["Admin"])
async def delete_parking_config(id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingConfig).filter(ParkingConfig.id == id))
    config = result.scalars().first()
    if not config:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy thông tin bãi đỗ"}

    await db.delete(config)
    await db.commit()
    return {"status": StatusCode.SUCCESS, "message": "Xóa thông tin bãi đỗ thành công"}

# Parking Session APIs


def detect_vehicle_type(license_plate: str) -> VehicleType:
    plate = license_plate.strip().upper()

    # Regex: bắt 2 số đầu và 1-2 ký tự sau đó, rồi là dấu gạch ngang
    match = re.match(r"^(\d{2})([A-Z0-9]{1,2})-", plate)
    if not match:
        raise ValueError("Biển số không hợp lệ")

    prefix = match.group(2)

    if len(prefix) == 1:
        return VehicleType.CAR
    elif len(prefix) == 2:
        return VehicleType.MOTORCYCLE
    else:
        raise ValueError("Không xác định được loại xe")


async def checkin(db: AsyncSession, license_plate: str):
    vehicle_type = detect_vehicle_type(license_plate)
    result = await db.execute(select(ParkingConfig).filter(ParkingConfig.vehicle_type == vehicle_type))
    config = result.scalars().first()

    if not config:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy cấu hình bãi đỗ cho loại xe này"}

    result = await db.execute(select(func.count(ParkingSession.license_plate)).filter(
        ParkingSession.vehicle_type == vehicle_type,
        ParkingSession.status == "active"
    ))

    active_sessions = result.scalars().first()
    if active_sessions >= config.max_capacity:
        return {"status": StatusCode.ERROR, "message": "Bãi đỗ đã đầy"}

    # result = await db.execute(select(ParkingSession).filter(
    #     ParkingSession.license_plate == license_plate,
    #     ParkingSession.status == "active"
    # ))
    # existing_session = result.scalars().first()

    # if existing_session:
    #     raise HTTPException(status_code=400, detail="Xe chưa ra khỏi bãi")

    new_session = ParkingSession(
        license_plate=license_plate,
        vehicle_type=vehicle_type
    )
    db.add(new_session)
    await db.commit()
    return {
        "status": StatusCode.SUCCESS,
        "message": "Check-in thành công",
        "license_plate": license_plate,
        "vehicle_type": vehicle_type,
        "time_in": new_session.time_in
    }


async def checkout(db: AsyncSession, session: ParkingSession):
    if not session:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy phiên đỗ xe"}

    if session.status != "active":
        return {"status": StatusCode.ERROR, "message": "Phiên đỗ xe đã được đóng"}
    session.status = "closed"
    session.time_out = datetime.now(
        timezone(timedelta(hours=7))).replace(tzinfo=None)
    result = await db.execute(select(ParkingConfig).filter(ParkingConfig.vehicle_type == session.vehicle_type))
    config = result.scalars().first()
    if config:
        duration = (session.time_out - session.time_in).total_seconds() / 3600
        session.fee = config.price_per_hour * duration

    await db.commit()
    return {
        "status": StatusCode.SUCCESS,
        "message": "Check-out thành công",
        "license_plate": session.license_plate,
        "vehicle_type": session.vehicle_type,
        "time_in": session.time_in,
        "time_out": session.time_out,
        "fee": session.fee
    }


@app.post("/auto_check", tags=["Parking"])
async def auto_check(data: LicensePlateInput, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingSession).filter(
        ParkingSession.license_plate == data.license_plate,
        ParkingSession.status == "active"
    ))
    session = result.scalars().first()
    if session:
        return await checkout(db, session)
    else:
        return await checkin(db, data.license_plate)


@app.get("/get_parking_session/{license_plate}", tags=["Parking"])
async def get_parking_session(license_plate: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingSession).filter(
        ParkingSession.license_plate == license_plate
    ).order_by(ParkingSession.time_in.desc()))
    session = result.scalars().first()
    if not session:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy phiên đỗ xe"}
    return {
        "status": StatusCode.SUCCESS,
        "message": "Lấy thông tin phiên đỗ xe thành công",
        "session": {
            "license_plate": session.license_plate,
            "vehicle_type": session.vehicle_type,
            "time_in": session.time_in,
            "time_out": session.time_out,
            "fee": session.fee,
            "status": session.status
        }
    }


@app.get("/get_all_parking_sessions", tags=["Parking"])
async def get_all_parking_sessions(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingSession).order_by(ParkingSession.time_in.desc()))
    sessions = result.scalars().all()
    return {
        "status": StatusCode.SUCCESS,
        "message": "Lấy danh sách phiên đỗ xe thành công",
        "sessions": [
            {
                "license_plate": session.license_plate,
                "vehicle_type": session.vehicle_type,
                "time_in": session.time_in,
                "time_out": session.time_out,
                "fee": session.fee,
                "status": session.status
            } for session in sessions
        ]
    }


@app.put("/update_parking_session/{license_plate}", tags=["Parking"])
async def update_parking_session(license_plate: str, session_update: ParkingSessionUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingSession).filter(
        ParkingSession.license_plate == license_plate,
        ParkingSession.status == "active"
    ))
    session = result.scalars().first()
    if not session:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy phiên đỗ xe"}

    if session_update.status:
        session.status = session_update.status
    if session_update.time_out:
        session.time_out = session_update.time_out

    await db.commit()
    return {
        "status": StatusCode.SUCCESS,
        "message": "Cập nhật thông tin phiên đỗ xe thành công",
        "session": {
            "license_plate": session.license_plate,
            "vehicle_type": session.vehicle_type,
            "time_in": session.time_in,
            "time_out": session.time_out,
            "fee": session.fee,
            "status": session.status
        }
    }


@app.delete("/delete_parking_session/{license_plate}", tags=["Parking"])
async def delete_parking_session(license_plate: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingSession).filter(
        ParkingSession.license_plate == license_plate,
        ParkingSession.status == "active"
    ))
    session = result.scalars().first()
    if not session:
        return {"status": StatusCode.ERROR, "message": "Không tìm thấy phiên đỗ xe"}

    await db.delete(session)
    await db.commit()
    return {
        "status": StatusCode.SUCCESS,
        "message": "Xóa phiên đỗ xe thành công"
    }


@app.post("/admin/create_parking_config", tags=["Admin"])
async def create_parking_config(vehicle_type: VehicleType, max_capacity: int, price_per_hour: float, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(ParkingConfig).filter(ParkingConfig.vehicle_type == vehicle_type))
    config = result.scalars().first()

    if config:
        return {"status": StatusCode.ERROR, "message": "Cấu hình bãi đỗ cho loại xe này đã tồn tại"}
    new_config = ParkingConfig(
        vehicle_type=vehicle_type,
        max_capacity=max_capacity,
        price_per_hour=price_per_hour
    )
    db.add(new_config)
    await db.commit()
    return {"status": StatusCode.SUCCESS, "message": "Tạo cấu hình bãi đỗ thành công"}
