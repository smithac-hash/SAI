SAI IN-APP MESSAGING INTEGRATION

Included files:
- backend/server.js (updated to mount /api/messages)
- backend/src/models/Message.js (new)
- backend/src/routes/messageRoutes.js (new)
- app/chat/[userId].tsx (new chat screen)
- app/coach/dashboard.tsx (updated)
- app/athlete/dashboard.tsx (updated)

INSTALLATION
1. Stop the backend terminal with Ctrl+C.
2. Extract this ZIP.
3. Copy the included backend and app folders into your existing SAI project root:
   C:\Users\Smitha C\Desktop\SAI\SAI
   Allow replacement of backend/server.js and the two dashboard files.
   The new Message.js, messageRoutes.js and app/chat/[userId].tsx should be added.
4. Do not delete or replace your existing auth, User, ContactRequest, assessment, or API files.
5. Start backend from the backend folder:
   npm run dev
6. Start Expo from the project root in another terminal:
   npx expo start --dev-client --tunnel --clear

HOW IT WORKS
- Messaging is enabled only when the ContactRequest status is "accepted".
- Both coach and athlete can send and read messages.
- Messages are stored in MongoDB.
- The chat screen has a manual refresh button. This first version is not real-time; messages appear after sending or refreshing/reopening the chat.

IMPORTANT
- Keep your existing .env file. Do not replace it with .env.example.
- The app uses the existing apiRequest authentication token.
- No new npm packages are required.
- Test with two different accounts: send request as coach, accept as athlete, return to coach dashboard, refresh, then tap Message Athlete.
