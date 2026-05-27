#!/bin/bash
# Start the PolicyOps Backend (FastAPI + LangGraph)

echo "🚀 Starting PolicyOps Backend..."
echo "================================"

cd "$(dirname "$0")/backend"

# Check for .env file
if [ ! -f ".env" ]; then
    echo "⚠️  No .env file found. Copying from .env.example..."
    cp .env.example .env
    echo "📝 Please edit backend/.env and add your OPENAI_API_KEY"
    echo ""
fi

# Activate venv
source venv/bin/activate

# Start FastAPI
echo "✅ Starting FastAPI on http://localhost:8000"
echo "📖 API Docs: http://localhost:8000/docs"
echo ""
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
