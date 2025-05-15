import asyncio
from passlib.context import CryptContext

from database import engine, async_session
from models import Base, User, ParkingConfig, UserRole, VehicleType

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def init_db():
    # Create tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    # Create admin user
    async with async_session() as session:
        admin = User(
            username="admin",
            email="admin@example.com",
            hashed_password=pwd_context.hash("password"),
            role=UserRole.ADMIN
        )
        session.add(admin)

        # Create default parking configurations
        car_config = ParkingConfig(
            id = 1,
            vehicle_type=VehicleType.CAR,
            max_capacity=50,
            price_per_hour=10.0
        )
        motorcycle_config = ParkingConfig(
            id = 2,
            vehicle_type=VehicleType.MOTORCYCLE,
            max_capacity=100,
            price_per_hour=5.0
        )

        session.add(car_config)
        session.add(motorcycle_config)

        await session.commit()

    print("Database initialized with admin user and default parking configurations.")

if __name__ == "__main__":
    asyncio.run(init_db())
