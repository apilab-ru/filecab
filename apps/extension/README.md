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

To run the API alongside the extension, use `pnpm dev:api` in another terminal, or use `pnpm dev` to start both.

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
