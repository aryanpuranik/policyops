#!/bin/bash
# Start the PolicyOps Frontend (Next.js)

echo "🎨 Starting PolicyOps Frontend..."
echo "================================="

cd "$(dirname "$0")/policy-compiler"

echo "✅ Starting Next.js on http://localhost:3000"
echo ""
npm run dev
