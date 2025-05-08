from pydantic import BaseModel, EmailStr
from typing import Optional, List
from datetime import datetime
from models.models import UserRole

class UserBase(BaseModel):
    username: str
    email: EmailStr

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    username: str
    password: str
    
class User(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        orm_mode = True

class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

class ParkingConfigBase(BaseModel):
    hour_range: str
    price: float

class ParkingConfigCreate(ParkingConfigBase):
    pass

class ParkingConfig(ParkingConfigBase):
    id: int
    created_at: datetime
    updated_at: datetime

    class Config:
        orm_mode = True

class ParkingSessionBase(BaseModel):
    license_plate: str

class ParkingSessionCreate(ParkingSessionBase):
    pass

class ParkingSession(ParkingSessionBase):
    id: int
    time_in: datetime
    time_out: Optional[datetime]
    fee: Optional[float]
    status: str
    user_id: int
    created_at: datetime
    vehicle_type: str 
    class Config:
        orm_mode = True

class LPRLogBase(BaseModel):
    image_path: str
    detected_plate: str
    confidence: float

class LPRLogCreate(LPRLogBase):
    session_id: int

class LPRLog(LPRLogBase):
    id: int
    session_id: int
    timestamp: datetime

    class Config:
        orm_mode = True 