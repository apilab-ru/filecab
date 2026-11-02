import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'Filecab',
    description: 'Filecab extension scaffold.',
    icons: { 48: 'wish-list-icon.png' },
    action: { default_icon: 'wish-list-icon.png' },
  },
});
