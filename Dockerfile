# Use Python 3.11.7 specifically
FROM python:3.11.7-slim

# Set working directory
WORKDIR /app

# Install system dependencies for OpenCV and pyzbar
RUN apt-get update && apt-get install -y \
    libzbar0 \
    libgl1-mesa-glx \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application files
COPY . .

# Expose port (Render will override this with $PORT)
EXPOSE 8080

# Set environment variables
ENV FLASK_ENV=production
ENV PYTHONUNBUFFERED=1

# Start command
CMD gunicorn --bind 0.0.0.0:$PORT --workers 1 --threads 2 --timeout 120 app:app
