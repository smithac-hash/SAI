SAI frontend integration patch

This patch adds:
- app/account.tsx: Athlete/Coach login and registration
- app/athlete/dashboard.tsx: athlete discoverability and result sync
- app/coach/dashboard.tsx: discoverable athlete list, assessment summaries and contact requests
- lib/api.ts: backend API client and auth storage
- lib/authStore.ts: auth exports
- updated app/index.tsx: adds an Athlete/Coach Login entry

It does NOT modify assessment screens, assessmentStore.ts, package.json, or app/_layout.tsx.

Before using:
1. Copy these files into the matching folders in your SAI project, allowing the updated app/index.tsx to replace the old one.
2. Open lib/api.ts and set API_BASE_URL:
   - Android emulator: http://10.0.2.2:5000
   - iOS simulator: http://localhost:5000
   - Physical Android/iPhone: http://YOUR_COMPUTER_IPV4:5000
3. For a physical phone, get the computer IPv4 with `ipconfig` and use the IPv4 under the active Wi-Fi adapter. Phone and laptop must be on the same Wi-Fi.
4. Keep backend running in its own terminal: `npm run dev`.
5. Start Expo in another terminal from the SAI root folder.

Important:
- Local assessment results stay in AsyncStorage. The athlete dashboard has a button to sync them to MongoDB.
- The athlete is private by default. They must enable discoverability before coaches can see their profile.
- This is a development starter. Use HTTPS, stronger production secret management, rate limiting, and a deployed backend/database before public release.
