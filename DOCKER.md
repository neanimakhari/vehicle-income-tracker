
# Running with Docker

## From project root

```bash
docker compose up --build
```

- **API:** http://localhost:3000  
- **Tenant admin:** http://localhost:3002  
- **System admin:** http://localhost:3001  

Optional: create a `.env` in the project root to override defaults:

```env
POSTGRES_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_min_32_characters_long
JWT_REFRESH_SECRET=your_refresh_secret_min_32_chars
BOOTSTRAP_TOKEN=optional_bootstrap_token
```

### Migrations

The **API container runs migrations automatically on startup** (ensure-platform-schema + TypeORM migration:run). You don’t need to run them manually. If you ever want to run migrations without starting the server:

```bash
docker compose run --rm api npm run migration:run:prod
```

### First-time: seed the database

After the stack is up, seed to create the demo tenant and users (migrations already ran at API startup):

```bash
docker compose run --rm api npm run seed:platform:prod
```

If you get "Missing script", rebuild the API image first: `docker compose build api`

Seed creates:
- **Tenant:** demo  
- **Platform admin:** platform.admin@vit.local / ChangeMe123!  
- **Tenant admin:** tenant.admin@vit.local / ChangeMe123! (log in at http://localhost:3002)  
- **Demo driver (for app):** driver.demo@vit.local / ChangeMe123! (tenant ID: **demo**)

---

## Mobile app with Docker backend

The app defaults to **http://10.0.2.2:3000** (Android emulator → host). On **Windows** this often fails with "Connection refused"; use your PC’s LAN IP instead.

1. **Check the API is up** (on your PC): open http://localhost:3000/health in a browser or run `curl http://localhost:3000/health`.
2. **Get your PC’s IPv4 address:** run `ipconfig` (Windows) or `ifconfig` (Mac/Linux) and note the IPv4 Address (e.g. `192.168.0.105`).
3. **Run the app with that URL:**

  ```bash
  cd app
  flutter run --dart-define=API_BASE_URL=http://YOUR_PC_IP:3000
  ```

  Example (replace with your IP):

  ```bash
  flutter run --dart-define=API_BASE_URL=http://192.168.0.105:3000
  ```

- **Android emulator on Windows:** use the PC IP as above (more reliable than 10.0.2.2).
- **Physical device:** same — use your PC’s LAN IP in `API_BASE_URL`.
- **Firewall:** if it still fails, allow inbound TCP on port 3000 for your local network (Windows Firewall).

---

## Deploy folder (secrets-based)

For a production-style setup with Docker secrets, use the `deploy` compose:

```bash
cd deploy
# Copy env.example.txt to .env, copy secrets.example/ to secrets/ and fill values
docker compose up -d
```

See `deploy/README.md` for details.
