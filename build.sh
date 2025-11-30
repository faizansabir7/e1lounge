#!/bin/bash
# Build script for Render deployment
# Installs system dependencies and Python packages

set -e  # Exit on error

echo "📦 Installing system dependencies for barcode scanning..."
apt-get update -qq
apt-get install -y --no-install-recommends libzbar0

echo "🐍 Installing Python packages..."
pip install --no-cache-dir -r requirements.txt

echo "✅ Build completed successfully!"
