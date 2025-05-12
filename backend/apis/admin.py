from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from database import get_db
from models.models import User, UserRole, ParkingConfig, LPRLog
from schemas import User as UserSchema, UserCreate, ParkingConfig as ParkingConfigSchema, ParkingConfigCreate
from apis.auth import get_current_active_user, get_password_hash, verify_password

router = APIRouter()


def get_admin_user(current_user: User = Depends(get_current_active_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not enough permissions"
        )
    return current_user


@router.get("/login", response_model=UserSchema)
async def login(
    username: str,
    password: str,
    db: Session = Depends(get_db)
):
    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=400, detail="Incorrect username or password")

    return {"message": "Login successful", "user": user}


@router.get("/all-users", response_model=List[UserSchema])
async def get_users(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    return users


@router.post("/create-users", response_model=UserSchema)
async def create_user(
    user: UserCreate,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.username == user.username).first()
    if db_user:
        raise HTTPException(
            status_code=400, detail="Username already registered")

    hashed_password = get_password_hash(user.password)
    db_user = User(
        username=user.username,
        hashed_password=hashed_password,
        role=UserRole.USER
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.put("/users/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: int,
    role: UserRole,
    is_active: bool,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    db_user = db.query(User).filter(User.id == user_id).first()
    if not db_user:
        raise HTTPException(status_code=404, detail="User not found")

    db_user.role = role
    db_user.is_active = is_active
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/configs", response_model=List[ParkingConfigSchema])
async def get_configs(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    configs = db.query(ParkingConfig).all()
    return configs


@router.post("/configs", response_model=ParkingConfigSchema)
async def create_config(
    config: ParkingConfigCreate,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    db_config = ParkingConfig(**config.dict())
    db.add(db_config)
    db.commit()
    db.refresh(db_config)
    return db_config


@router.put("/configs/{config_id}", response_model=ParkingConfigSchema)
async def update_config(
    config_id: int,
    config: ParkingConfigCreate,
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    db_config = db.query(ParkingConfig).filter(
        ParkingConfig.id == config_id).first()
    if not db_config:
        raise HTTPException(status_code=404, detail="Config not found")

    for key, value in config.dict().items():
        setattr(db_config, key, value)

    db.commit()
    db.refresh(db_config)
    return db_config


@router.get("/lpr-logs")
async def get_lpr_logs(
    current_user: User = Depends(get_admin_user),
    db: Session = Depends(get_db)
):
    logs = db.query(LPRLog).all()
    return logs
