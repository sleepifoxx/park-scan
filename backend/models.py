from sqlalchemy import Boolean, Column, Integer, String, func, DateTime, Float, Enum
from sqlalchemy.ext.declarative import declarative_base
import enum

Base = declarative_base()


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    USER = "user"


class VehicleType(str, enum.Enum):
    CAR = "car"
    MOTORCYCLE = "motorcycle"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(Enum(UserRole), default=UserRole.USER)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=func.now())


class ParkingConfig(Base):
    __tablename__ = "parking_configs"
    id = Column(Integer, primary_key=True, index=True)
<<<<<<< HEAD
    vehicle_type = Column(Enum(VehicleType))
    price_per_hour = Column(Float)
    max_capacity = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow,
                        onupdate=datetime.utcnow)
=======
    vehicle_type = Column(String)
    max_capacity = Column(Integer)
    price_per_hour = Column(Float)
    created_at = Column(DateTime, default=func.now())
    updated_at = Column(DateTime, default=func.now(),
                        onupdate=func.now())
>>>>>>> 239d8b8daf52835275c764c09eb4f7f8e5690ed1


class ParkingSession(Base):
    __tablename__ = "parking_sessions"
<<<<<<< HEAD
    license_plate = Column(String, primary_key=True, index=True)
    vehicle_type = Column(Enum(VehicleType))
    time_in = Column(DateTime, default=datetime.utcnow)
    time_out = Column(DateTime, nullable=True)
    fee = Column(Float, nullable=True)
    status = Column(String, default="active")  # active, closed
    user_id = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime, default=datetime.utcnow)
=======
    vehicle_type = Column(String)
    license_plate = Column(String, primary_key=True, index=True)
    time_in = Column(DateTime, default=func.now())
    time_out = Column(DateTime, nullable=True)
    fee = Column(Float, nullable=True)
    status = Column(String, default="active")  # active, closed
    created_at = Column(DateTime, default=func.now())
>>>>>>> 239d8b8daf52835275c764c09eb4f7f8e5690ed1
