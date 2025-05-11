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
    hashed_password = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

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


@app.delete("/admin/delete-user/{user_id}", tags=["User"])
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


