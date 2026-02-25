@echo off
REM Build and start the stack from deploy/ so .env is loaded and NEXT_PUBLIC_API_URL
REM is baked into the frontends. Run from repo root: deploy\build-and-up.bat

cd /d "%~dp0"

if not exist .env (
  echo Missing deploy\.env. Copy deploy\env.example.txt to deploy\.env and set NEXT_PUBLIC_API_URL and CORS_ORIGINS.
  exit /b 1
)

echo Building from deploy/ so .env is used...
docker compose -f docker-compose.yml build --no-cache
if errorlevel 1 exit /b 1

echo Starting containers...
docker compose -f docker-compose.yml up -d
if errorlevel 1 exit /b 1

echo Done. API and frontends should be up. Check with: docker compose -f deploy\docker-compose.yml ps
