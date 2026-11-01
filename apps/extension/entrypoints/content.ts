import { defineContentScript } from 'wxt/utils/define-content-script';

export default defineContentScript({
  matches: ['https://example.com/*'],
  main() {
    // Content-script entrypoint.
  },
});
