<<<<<<< HEAD
from models import Base
from sqlalchemy import create_engine

# Replace with your database URL
DATABASE_URL = "sqlite:///database.db"


def init_db():
    engine = create_engine(DATABASE_URL)
    Base.metadata.create_all(engine)
    print("Database initialized successfully.")


if __name__ == "__main__":
    init_db()
=======
from database import Base, engine
from models import User, ParkingConfig, ParkingSession

Base.metadata.create_all(bind=engine)
print("Database initialized and tables created.")
>>>>>>> 239d8b8daf52835275c764c09eb4f7f8e5690ed1
