# Gemini API backend

The Gemini API key belongs on the server only. Never put it in a `VITE_` variable,
the React source, or an Android build.

## Local development

1. Revoke any key that has been pasted into a chat, ticket, or source file. Create
   a new key in [Google AI Studio](https://aistudio.google.com/apikey).
2. Copy `.env.server.example` to `.env.server` and set `GEMINI_API_KEY` to the new
   key. `.env.server` is ignored by Git.
3. Edit `.env.server` with the new key and start the proxy:

   ```powershell
   npm run server
   ```

   The command loads `.env.server`. In a second terminal, run `npm run dev`; Vite
   forwards `/api` requests to the local server.

The server accepts only known mode/category/intensity values, limits request body
size, applies a per-process request limit, and never returns the upstream key.

## Android and deployment

The Android app cannot reach the local development server on the developer's
computer. Deploy `server/index.js` to a Node.js host with HTTPS and Node.js 20.6
or newer. Set `GEMINI_API_KEY` in the host's secret environment settings and set
`APP_ORIGIN` to the app's production web origin. For the Capacitor Android
WebView, allow its `https://localhost` origin as well. Do not commit the key.

Set `VITE_API_BASE_URL` to the deployed server origin, for example
`https://your-service.example`, before building the Android app:

```powershell
$env:VITE_API_BASE_URL = "https://your-service.example"
npm run cap:sync
npm run cap:open
```

In Android Studio, build the APK after Gradle sync. The APK contains only the
public proxy URL; the Gemini key remains in the server's environment.
