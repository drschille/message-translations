#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "Pulling latest changes..."
git pull origin main

echo "Installing dependencies..."
npm ci

echo "Building..."
npm run build

echo "Deploy complete!"
