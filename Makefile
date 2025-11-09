# Olympus root Makefile

SHELL := /bin/bash

.PHONY: dev stop status

# Start Flask (python), Node MCP server, and Vite dev server
dev:
	bash scripts/dev.sh

# Stop common dev ports/processes
stop:
	bash scripts/stop.sh

# Quick status of listeners
status:
	@echo "Listeners:" && lsof -nPiTCP -sTCP:LISTEN | egrep "(PID|:5000|:8080|:5173)" || true
