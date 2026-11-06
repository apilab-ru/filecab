import { defineBackground } from 'wxt/utils/define-background';

import { registerAuthWorker } from '../src/auth/worker';

export default defineBackground(() => {
  registerAuthWorker();
});
