FROM python:3.11-slim


RUN apt-get update && apt-get install -y libgl1 libglib2.0-0

WORKDIR /app

# Copy requirements first to leverage Docker cache
COPY requirements.txt .

RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Expose the port the app runs on
EXPOSE 8001

# Command to run the application
CMD ["uvicorn", "webcam_api:app", "--host", "0.0.0.0", "--port", "8001"] 