import { defineConfig } from 'wxt';

const apiOrigin = process.env.WXT_PUBLIC_API_ORIGIN ?? 'http://127.0.0.1:3001';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Filecab',
    permissions: ['identity', 'storage'],
    host_permissions: [`${new URL(apiOrigin).origin}/*`],
    description: 'Filecab extension scaffold.',
    icons: { 48: 'wish-list-icon.png' },
    action: { default_icon: 'wish-list-icon.png' },
  },
});
