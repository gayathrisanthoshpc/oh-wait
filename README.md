# Oh, Wait!

**Remember it when it matters.** A local-first reminder app for everyday tasks tied to the places where they need to get done.

## Run locally

```sh
npm install
npm run dev
```

## Verify a change

```sh
npm run lint
npm run build
npm test
```

The browser workflow test builds the production app and uses Chrome or Edge in headless mode. It checks the main reminder and place flows, persistence, accessibility, mobile sizing, and offline app-shell loading.

## Offline and privacy

Oh, Wait! can be installed from browsers that support web app installation. After the first successful online visit, its service worker caches the production app shell so it can open offline. Reminders and places are kept in this browser's local storage; they do not sync to an account or backend.

Arrival remains an explicit **Simulate Arrival** action. The web prototype does not request location access or provide automatic geofencing or native push notifications.

## Build for deployment

`npm run build` creates the static production site in `dist/`, ready to deploy to Vercel or another static host.
