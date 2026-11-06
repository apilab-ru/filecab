# Filecab Chrome extension

Chrome extension built with WXT and React. Complete the [repository setup](../../README.md#setup) first. Run the commands below from the repository root.

## Development

```sh
pnpm dev:extension
```

Keep this command running while developing. WXT builds the extension, watches for changes, and launches a browser with the extension loaded.

To load the development extension manually in Chrome:

1. Open `chrome://extensions`.
2. Enable **Developer mode** in the upper-right corner.
3. Click **Load unpacked**.
4. Select `apps/extension/.output/chrome-mv3-dev` inside this repository.
5. Pin **Filecab** from Chrome's extensions menu, then click its icon to open the popup.

The `.output` directory is created after starting development. On macOS, press **Cmd+Shift+G** in the folder picker and paste the full directory path to select this hidden directory.

WXT rebuilds when source files change. Refresh the target webpage when testing content script changes. If a change does not appear, click the extension's reload button in `chrome://extensions` and reopen its popup or refresh the webpage.

To run the API alongside the extension, use `pnpm dev:api` in another terminal, or use `pnpm dev` for the website/API and run `pnpm dev:extension` separately.

## Source files and debugging

| File                             | Purpose                                 |
| -------------------------------- | --------------------------------------- |
| `entrypoints/popup/main.tsx`     | Popup UI                                |
| `entrypoints/full-page/main.tsx` | Full page UI                            |
| `entrypoints/background.ts`      | Background service worker               |
| `entrypoints/content.ts`         | Script injected into matching webpages  |
| `styles.scss`                    | Extension styles                        |
| `wxt.config.ts`                  | WXT configuration and manifest settings |

- **Popup:** open it, right-click inside it, and select **Inspect**.
- **Background:** open `chrome://extensions` and click **service worker** on the Filecab card.
- **Content script:** open DevTools on a matching webpage.
- **Full page:** find the extension ID in `chrome://extensions`, then open `chrome-extension://<extension-id>/full-page.html`.

## Build and check

```sh
pnpm exec nx typecheck extension
pnpm exec nx build extension
```

To test the production build, follow the **Load unpacked** steps above and select `apps/extension/.output/chrome-mv3`. This build can run without the development server. Rebuild and reload the extension after making changes.

## Documentation

- [WXT documentation](https://wxt.dev/)
- [Chrome: load an unpacked extension](https://developer.chrome.com/docs/extensions/get-started/tutorial/hello-world#load-unpacked)

## Google authentication

Set the public API origin in `apps/extension/.env` if it differs from
`http://127.0.0.1:3001`. The build grants API host access for that origin only.
Google secrets belong exclusively in the API environment.

After loading the extension, copy its ID from `chrome://extensions` and add
`chrome-extension://<id>` to the API's `EXTENSION_ORIGINS`; restart the API.
Choose **Sign in with Google** in the popup or full page. The worker opens the
interactive Google flow, verifies the callback attempt and redeems a one-use
code. Its return URL is `https://<id>.chromiumapp.org/filecab`.

Storage areas are restricted to `TRUSTED_CONTEXTS` before credentials are used.
The worker manages refresh tokens in local storage and access tokens/login
attempts in session storage. Content-script messages are rejected. Auth messages
return account state, never credentials. On uncertain refresh outcomes, sign in
again rather than retrying a consumed refresh credential. Authentication changes
do not import, clear or upload guest library data.

## Debugging sign-in

1. Run the API (`pnpm dev:api`) and the extension (`pnpm dev:extension`) in separate terminals. After editing the private API `.env`, restart the entire API/Nx command; a source reload can retain environment variables inherited from the old Nx process.
2. Open `chrome://extensions`, find Filecab and check its **ID** and **Errors**. Add that exact `chrome-extension://<id>` to the private API `EXTENSION_ORIGINS`. Development and built copies can have different IDs. Reload the extension after a new build or manifest change.
3. Prefer the full-page UI while diagnosing login: `chrome-extension://<id>/full-page.html`. A popup normally closes when focus moves to the Google window; reopen it after login to read the saved account state.
4. On the Filecab card, click the **service worker** link. In its Console, filter by `[Filecab auth]`. This is where API fetches and `identity.launchWebAuthFlow` run. Use that DevTools **Network** panel and enable **Preserve log** when tracing a failure. Popup DevTools inspect the UI/message bridge, not the worker's network traffic.
5. Retry sign-in. The UI now reports the failed **stage**, a stable code, optional HTTP status and request ID. Expand **Connection details** to see the actual loaded extension ID, required origin, callback and API address. Compare these with the private API configuration and built manifest permissions.

From the popup or full-page **Console**, run this credential-free check:

```js
await chrome.runtime.sendMessage({ action: 'auth.diagnostics' });
```

It checks the API's public extension configuration without opening Google or
reading stored credentials. Run it from an extension UI page, not a website's
Console or the worker Console: the sender checks intentionally allow only
Filecab's popup/full-page documents. Query strings such as `?debug=1` are allowed.

| Stage/code                              | What to check                                                                                                                                                                                           |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `configuration / EXTENSION_NOT_ALLOWED` | Exact extension ID in `EXTENSION_ORIGINS`; fully restart API/Nx after changing it.                                                                                                                      |
| `configuration / GOOGLE_DISABLED`       | `GOOGLE_ENABLED=true` and valid Google settings in private API config.                                                                                                                                  |
| `API_UNREACHABLE`                       | API process/address, `/api/v1/health/live`, and matching API host permission in the loaded manifest.                                                                                                    |
| `API_OUTDATED`                          | Restart the API with current source; `/api/v1/auth/extension/config` must exist.                                                                                                                        |
| `browser-login`                         | Browser cancellation, Google consent error, or the API callback response. The Google authorized URI must exactly match `GOOGLE_CALLBACK_URL`; do not replace it with the Chromium extension return URL. |
| `callback / CALLBACK_MISMATCH`          | Reloaded extension, interrupted attempt or wrong callback; start a fresh login.                                                                                                                         |
| `exchange` or `refresh`                 | HTTP status and request ID. Find that ID in the API terminal. Replayed/expired credentials require a fresh login.                                                                                       |
| `storage`                               | `identity`/`storage` permissions and extension reload.                                                                                                                                                  |
| `messaging / WORKER_UNAVAILABLE`        | Worker registration/Errors panel, stale popup after reload, or unsupported sender context; reopen the UI.                                                                                               |

Worker logs contain only stage/outcome, code, status and a safe correlation UUID.
Do not share raw authorization/callback URLs, request headers or request/response
bodies from DevTools: they can contain login codes, verifiers or tokens. For a bug
report, copy the stage/code/status/request ID and public Connection details.

`pnpm test:e2e` builds the extension and exercises its real Chromium worker,
message bridge, trusted storage and UI with Google/API I/O mocked. This catches
extension-only failures without requiring a Google account; it does not prove
that a real Google consent flow completed.
