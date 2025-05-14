from database import Base, engine
from models import User, ParkingConfig, ParkingSession

Base.metadata.create_all(bind=engine)
print("Database initialized and tables created.")
