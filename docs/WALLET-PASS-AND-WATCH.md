# Wallet Pass & Watch Glance (Task 181.1, stretch)

Goal: put Folio's daily "can I afford this today?" number on a glanceable
surface outside the app — Apple Wallet (Lock Screen + paired Apple Watch
Wallet app) and, ideally, a watch-face complication.

This documents what ships today, the one deployment step needed to make the
Wallet pass installable, and an honest feasibility assessment of a native
watch-face complication.

## What ships in the app

- `src/lib/walletPass.ts` — builds the Apple Wallet `pass.json` document from
  the live daily-allowance data. Reuses the same data contract
  (`WidgetDailyAllowanceData`) as the home-screen widget, so the pass shows the
  same number. Warm purple theme, soft status colors, no shame-based copy.
- `src/app/api/wallet/daily-allowance/route.ts` — `GET /api/wallet/daily-allowance`
  serves the pass. It reads the live allowance from query params handed off by
  the app (the client holds the live number via `useHomeData` / `widgetSync`),
  and falls back to a safe placeholder flagged `offlineStale` when no live data
  is available. Degrades gracefully offline — it never throws, always returns a
  well-formed pass.

The data source is deliberately shared with the widget
(`/api/widget/daily-allowance` + `src/lib/widgetSync.ts`) so there is one
source of truth for the daily number across every glanceable surface.

### Entry point (progressive disclosure)

Per the product rules, nothing is added to the home screen. Any "Add to
Wallet" affordance belongs behind Tools/Settings. The app can link to:

```
/api/wallet/daily-allowance?amount=$42&spentToday=$7&status=Good&message=Nice,%20you%27ve%20got%20room%20left&progressPercent=68
```

passing the current values from the live allowance so the pass reflects the
exact number the user sees on the home screen.

## Deployment prerequisite: signing the `.pkpass`

The endpoint currently serves the **unsigned** `pass.json`. Apple Wallet will
only *install* a **signed** `.pkpass` bundle. Signing requires certificates
that only exist in the Apple Developer account / deploy environment, so it is
intentionally a deploy-time step rather than something committed to the repo.

To make the pass installable, provision these and wire a signing step:

1. **Apple Developer account artifacts**
   - A **Pass Type ID** (e.g. `pass.app.folio.dailyallowance`) and its
     certificate (`.p12` → PEM cert + key).
   - The **Apple WWDR** intermediate certificate.
   - Your **Team ID**.
2. **Environment variables** (read by the route/lib):
   - `WALLET_PASS_TYPE_ID`
   - `WALLET_TEAM_ID`
   - `WALLET_PASS_CERT_PEM` (pass type certificate, PEM)
   - `WALLET_PASS_CERT_KEY` (private key, PEM)
   - `WALLET_WWDR_PEM` (WWDR intermediate, PEM)
   When `WALLET_PASS_CERT_PEM` + `WALLET_PASS_CERT_KEY` are present the route
   reports `X-Folio-Pass-Signed: true`.
3. **Bundle + sign** (server-side, on request):
   - Add image assets (`icon.png`, `icon@2x.png`, `logo.png`) to the bundle.
   - Compute `manifest.json` = SHA-1 of every file.
   - Produce a detached PKCS#7 `signature` of the manifest using the pass cert +
     WWDR cert.
   - Zip `{pass.json, manifest.json, signature, images...}` into a `.pkpass`.
   - Respond with `Content-Type: application/vnd.apple.pkpass`.
   A small, well-maintained library (e.g. `passkit-generator`) handles the
   manifest/signature/zip steps; only the certificates are the true blocker,
   and those are environment-specific by design.

Until signing is configured, the endpoint is still useful: it renders the
correct pass content for preview and lets the client consume the same data.

## Watch-face complication feasibility

Short version: a true **watch-face complication is not feasible from a PWA /
web backend alone** — it requires a native app shell. Assessment:

- **Apple Watch (WatchOS) complications** require a native WatchOS app built
  with WidgetKit/ClockKit in Swift, distributed through the App Store, and a
  paired iOS app. A PWA cannot register a complication. This would mean adding
  a native iOS/WatchOS project — out of scope for a web/PWA stretch task.
- **Wear OS (Android) complications** similarly require a native
  `ComplicationDataSourceService` in an Android app.
- **What the Wallet pass buys us today (no native code):** once a signed
  `.pkpass` is installed, the daily number is glanceable on the iPhone Lock
  Screen and in the **Wallet app on a paired Apple Watch** — covering most of
  the "glance at my number on my wrist/lock screen" value without shipping a
  native app. This is why the Wallet route is the recommended, feasible path.

### If a native complication is later desired

The groundwork is already reusable: the shared allowance data contract
(`WidgetDailyAllowanceData`) and the `/api/widget/daily-allowance` /
`/api/wallet/daily-allowance` endpoints give a native shell a single JSON
source to poll for the current number. A native WatchOS/Wear OS target would:

1. Wrap the PWA (or authenticate directly) to obtain the user's allowance.
2. Poll the shared endpoint (respecting `offlineStale` for degradation).
3. Feed the number into a WidgetKit/ClockKit (or Wear OS complication) provider.

That native shell is the only remaining blocker; the data layer is done.
