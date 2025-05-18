import asyncio
import os
from passlib.context import CryptContext

from database import engine, async_session
from models import Base, User, ParkingConfig, UserRole, VehicleType

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

DB_PATH = "/app/database/database.db"  # đường dẫn tuyệt đối trong container


async def init_db():
    db_exists = os.path.exists(DB_PATH)

    # Nếu chưa có file database, tạo mới và khởi tạo dữ liệu
    if not db_exists:
        print("Database not found. Creating new database...")

        # Create tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        # Create admin user and default configs
        async with async_session() as session:
            admin = User(
                username="admin",
                email="admin@example.com",
                hashed_password=pwd_context.hash("password"),
                role=UserRole.ADMIN
            )
            session.add(admin)

            car_config = ParkingConfig(
                id=1,
                vehicle_type=VehicleType.CAR,
                max_capacity=50,
                price_per_hour=50000.0
            )
            motorcycle_config = ParkingConfig(
                id=2,
                vehicle_type=VehicleType.MOTORCYCLE,
                max_capacity=100,
                price_per_hour=5000.0
            )

            session.add(car_config)
            session.add(motorcycle_config)

            await session.commit()

        print("Database created with admin user and default configs.")
    else:
        print("Database already exists. Skipping initialization.")

if __name__ == "__main__":
    asyncio.run(init_db())
