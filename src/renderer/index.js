/**
 * Calendar Notes - Renderer Entry Point
 */

import { app } from './core/App.js';
import { domReady } from './ui/DOMHelper.js';

// Wait for DOM to be ready, then initialize the app
domReady().then(() => {
  app.init();
});
