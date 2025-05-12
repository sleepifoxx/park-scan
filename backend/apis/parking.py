from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from database import get_db
from models.models import ParkingSession, LPRLog, User
from schemas import ParkingSession as ParkingSessionSchema, ParkingSessionCreate, LPRLog as LPRLogSchema
from apis.auth import get_current_active_user
import os
import uuid

router = APIRouter()

# LPR Service simulation


async def process_license_plate(image_path: str) -> tuple[str, float]:
    # TODO: Implement actual LPR service integration
    # For now, return a dummy plate and confidence
    return "ABC123", 0.95


@router.post("/entry", response_model=ParkingSessionSchema)
async def create_parking_session(
    image: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    # Save image
    image_path = f"uploads/{uuid.uuid4()}_{image.filename}"
    os.makedirs("uploads", exist_ok=True)
    with open(image_path, "wb") as f:
        f.write(await image.read())

    # Process license plate
    license_plate, confidence = await process_license_plate(image_path)

    # Create session
    session = ParkingSession(
        license_plate=license_plate,
        user_id=current_user.id,
        status="active"
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # Create LPR log
    lpr_log = LPRLog(
        session_id=session.id,
        image_path=image_path,
        detected_plate=license_plate,
        confidence=confidence
    )
    db.add(lpr_log)
    db.commit()

    return session


@router.post("/exit/{session_id}", response_model=ParkingSessionSchema)
async def exit_parking(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    session = db.query(ParkingSession).filter(
        ParkingSession.id == session_id,
        ParkingSession.status == "active"
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Active session not found")

    # Calculate fee
    time_in = session.time_in
    time_out = datetime.utcnow()
    duration = (time_out - time_in).total_seconds() / 3600  # hours

    # Get price configuration
    config = db.query(ParkingConfig).filter(
        ParkingConfig.hour_range == f"{int(duration)}-{int(duration)+1}"
    ).first()

    if not config:
        raise HTTPException(
            status_code=400, detail="No price configuration found for this duration")

    fee = config.price

    # Update session
    session.time_out = time_out
    session.fee = fee
    session.status = "closed"
    db.commit()
    db.refresh(session)

    return session


@router.get("/sessions", response_model=List[ParkingSessionSchema])
async def get_user_sessions(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    sessions = db.query(ParkingSession).filter(
        ParkingSession.user_id == current_user.id
    ).all()
    return sessions


@router.get("/sessions/{session_id}", response_model=ParkingSessionSchema)
async def get_session(
    session_id: int,
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
):
    session = db.query(ParkingSession).filter(
        ParkingSession.id == session_id,
        ParkingSession.user_id == current_user.id
    ).first()

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    return session
