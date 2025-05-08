from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker, declarative_base

# Dùng async sqlite
SQLALCHEMY_DATABASE_URL = "sqlite+aiosqlite:///./parking_system.db"

engine = create_async_engine(SQLALCHEMY_DATABASE_URL, echo=True)

async_session = sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

Base = declarative_base()

# Dependency cho FastAPI
async def get_db():
    async with async_session() as session:
        yield session
