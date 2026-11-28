# SAI Backend Starter

This is the first backend layer for the SAI Expo app. It provides:
- Athlete and coach registration/login with role-based JWT authentication
- Athlete discoverability (private by default)
- Syncing assessment results from the phone to MongoDB
- Coach dashboard data for opted-in athletes and their report-card results
- Coach contact requests, with athlete acceptance/decline

## 1. Requirements
- Node.js LTS
- MongoDB Community Server running locally
- MongoDB Compass (GUI to inspect the database)

## 2. Install
Open PowerShell in this `backend` folder:

```powershell
npm install
Copy-Item .env.example .env
```

Open `.env` and replace `JWT_SECRET` with a long random string. Keep `.env` private.

## 3. Start MongoDB
If installed as a Windows service:

```powershell
Get-Service MongoDB
Start-Service MongoDB
```

If the service name is not found, install MongoDB Community Server first. Compass alone is not the database server.

## 4. Start API

```powershell
npm run dev
```

Open `http://localhost:5000` in a browser. Expected response:

```json
{"message":"SAI API is running"}
```

Compass connection string:

```text
mongodb://127.0.0.1:27017
```

Database name: `sai`

## 5. API routes

### Public
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me` (Bearer token)

Register athlete JSON:
```json
{
  "name": "Asha",
  "email": "asha@example.com",
  "password": "password123",
  "role": "athlete",
  "age": 20,
  "gender": "Female",
  "weight": 48
}
```

Register coach JSON:
```json
{
  "name": "Coach Ravi",
  "email": "coach@example.com",
  "password": "password123",
  "role": "coach",
  "organization": "Sports Academy",
  "specialization": "Athletics",
  "bio": "Sprint and jump training"
}
```

### Athlete (requires athlete token)
- `PATCH /api/athletes/discoverability` body `{ "discoverable": true }`
- `POST /api/athletes/results/sync` body `{ "results": [...] }`
- `GET /api/athletes/my-results`
- `GET /api/athletes/contact-requests`
- `PATCH /api/athletes/contact-requests/:id` body `{ "status": "accepted" }` or `"declined"`

### Coach (requires coach token)
- `GET /api/coaches/profile`
- `GET /api/coaches/athletes`
- `GET /api/coaches/athletes/:id`
- `POST /api/coaches/contact-requests` body `{ "athleteId": "...", "message": "..." }`
- `GET /api/coaches/contact-requests`

For protected routes send header:
`Authorization: Bearer YOUR_TOKEN`

## Important development note
`localhost` only works on the computer running the backend. When testing from a physical phone, the Expo app must use your computer's LAN IPv4 address (for example `http://192.168.1.5:5000`). The phone and computer should be on the same Wi-Fi. Do not expose this development server publicly. For production, deploy the API and use a hosted MongoDB database.

## Integration note
Your current SAI project stores profiles and results in AsyncStorage. This backend does not replace that local storage. The next frontend integration step will:
1. Add role selection and login/register screens.
2. Keep local assessment saving intact.
3. Sync results to the backend when an athlete is signed in.
4. Add athlete discoverability controls and coach dashboard screens.
