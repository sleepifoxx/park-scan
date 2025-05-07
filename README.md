# Parking Management System

A modern parking management system with license plate recognition, user management, and payment processing.

## Features

- User authentication and authorization
- License plate recognition for vehicle entry/exit
- Parking session management
- Payment processing
- Admin dashboard for user and configuration management
- Real-time monitoring and reporting

## Tech Stack

### Backend
- FastAPI
- SQLAlchemy
- SQLite
- JWT Authentication

### Frontend
- Next.js
- TypeScript
- Tailwind CSS
- Axios

## Setup Instructions

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment and activate it:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Initialize the database:
```bash
python init_db.py
```
This will:
- Create all necessary database tables
- Create an admin user with credentials:
  - Username: admin
  - Password: admin123

5. Run the backend server:
```bash
uvicorn main:app --reload
```

The backend server will run on http://localhost:8000

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

The frontend will run on http://localhost:3000

## API Documentation

Once the backend server is running, you can access the API documentation at:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## Usage

1. Access the application at http://localhost:3000
2. Log in with your credentials
3. For admin access, use the admin credentials:
   - Username: admin
   - Password: admin123
4. Use the dashboard to manage parking sessions
5. Use the admin dashboard to manage users and configurations

## License

MIT 