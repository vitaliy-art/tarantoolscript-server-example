.PHONY: up-build down-build build run

up-build:
	docker compose  -f docker-compose-build.yml up

down-build:
	docker compose  -f docker-compose-build.yml down

build: down-build up-build down-build

run:
	docker compose  -f docker-compose.yml up

down:
	docker compose  -f docker-compose.yml down
