from apis import users, parking, admin
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apis import auth_api
from database import engine
from models import models

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Parking Management System")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5000",
                   "http://127.0.0.1:5500"],  # Frontend URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Import and include routers
app.include_router(auth_api.router, tags=["Authentication"])
app.include_router(users.router, prefix="/api/users", tags=["Users"])
app.include_router(parking.router, prefix="/api/parking", tags=["Parking"])
app.include_router(admin.router, prefix="/api/admin", tags=["Admin"])


@app.get("/")
def read_root():
    return {"message": "Welcome to Parking Management System API"}
