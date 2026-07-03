# BrowserVault

A Chrome Extension for locking your browser. 

## Development Setup

1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Load the extension in Chrome:
   - Go to `chrome://extensions`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the `dist` folder.

## Scripts

- `npm run dev` - Run Vite dev server for hot reloading.
- `npm run build` - Build for production.
- `npm run format` - Format code with Prettier.
- `npm run lint` - Lint code with ESLint.
- `npm run test` - Run unit tests via Vitest.
- `npm run test:e2e` - Run E2E tests via Playwright.
