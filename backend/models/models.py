from sqlalchemy import Boolean, Column, ForeignKey, Integer, String, DateTime, Float, Enum
from sqlalchemy.orm import relationship
from sqlalchemy.ext.declarative import declarative_base
import enum
from datetime import datetime

Base = declarative_base()

class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    sessions = relationship("ParkingSession", back_populates="user")

class ParkingConfig(Base):
    __tablename__ = "parking_configs"
    vehicle_type = Column(String)
    id = Column(Integer, primary_key=True, index=True)
    hour_range = Column(String)  # e.g., "1-2", "2-3"
    price = Column(Float)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

class ParkingSession(Base):
    __tablename__ = "parking_sessions"
    vehicle_type = Column(String)
    id = Column(Integer, primary_key=True, index=True)
    license_plate = Column(String, index=True)
    time_in = Column(DateTime, default=datetime.utcnow)
    time_out = Column(DateTime, nullable=True)
    fee = Column(Float, nullable=True)
    status = Column(String, default="active")  # active, closed
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", back_populates="sessions")
    lpr_logs = relationship("LPRLog", back_populates="session")

class LPRLog(Base):
    __tablename__ = "lpr_logs"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("parking_sessions.id"))
    image_path = Column(String)
    detected_plate = Column(String)
    confidence = Column(Float)
    timestamp = Column(DateTime, default=datetime.utcnow)
    
    session = relationship("ParkingSession", back_populates="lpr_logs") 