.PHONY: help setup backend frontend dev lint

help:
	@echo "PolicyOps — available commands:"
	@echo "  make setup     Install all dependencies"
	@echo "  make backend   Start the FastAPI backend (port 8000)"
	@echo "  make frontend  Start the Next.js frontend (port 3000)"
	@echo "  make dev       Start both backend and frontend"
	@echo "  make lint      Run frontend type-check"

setup:
	cd backend && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt
	cd policy-compiler && npm install

backend:
	./start-backend.sh

frontend:
	./start-frontend.sh

dev:
	./start-backend.sh & ./start-frontend.sh

lint:
	cd policy-compiler && npx tsc --noEmit
