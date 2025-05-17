from sqlalchemy import Boolean, Column, Integer, String, DateTime, Float, Enum
from sqlalchemy.ext.declarative import declarative_base
import enum
from datetime import datetime, timedelta, timezone


def now_vn():
    return datetime.now(timezone(timedelta(hours=7)))


Base = declarative_base()


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class VehicleType(str, enum.Enum):
    CAR = "car"
    MOTORCYCLE = "motorcycle"


class StatusCode(str, enum.Enum):
    SUCCESS = "success"
    ERROR = "error"
    PENDING = "pending"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=now_vn)


class ParkingConfig(Base):
    __tablename__ = "parking_configs"
    id = Column(Integer, primary_key=True, index=True)
    vehicle_type = Column(String)
    max_capacity = Column(Integer)
    price_per_hour = Column(Float)
    created_at = Column(DateTime, default=now_vn)
    updated_at = Column(DateTime, default=now_vn, onupdate=now_vn)


class ParkingSession(Base):
    __tablename__ = "parking_sessions"
    vehicle_type = Column(String)
    id = Column(Integer, primary_key=True, index=True)
    license_plate = Column(String)
    time_in = Column(DateTime, default=now_vn)
    time_out = Column(DateTime, nullable=True)
    fee = Column(Float, nullable=True)
    status = Column(String, default="active")  # active, closed
    created_at = Column(DateTime, default=now_vn)
