.PHONY: dev dev-backend dev-frontend down

dev: dev-backend dev-frontend

dev-backend:
	docker compose -f backend/docker-compose.yml up --build -d

dev-frontend:
	docker compose -f frontend/docker-compose.yml up --build -d

down:
	docker compose -f backend/docker-compose.yml down
	docker compose -f frontend/docker-compose.yml down
