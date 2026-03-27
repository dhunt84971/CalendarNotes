/**
 * Calendar Notes - Renderer Entry Point
 *
 * Global error handlers are registered here (before any other imports)
 * so that module-level failures, import errors, and early init crashes
 * are captured in the main-process log file.
 */

// Register global error handlers FIRST, before any app imports.
// These catch errors that occur during module loading or early init,
// before App.init() has a chance to run.
window.addEventListener('error', (event) => {
  const msg = `${event.message} at ${event.filename}:${event.lineno}:${event.colno}`;
  console.error('[Renderer error]', msg);
  window.api?.log?.error(msg);
});

window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const msg = reason instanceof Error ? `${reason.message}\n${reason.stack}` : String(reason);
  console.error('[Renderer unhandled rejection]', msg);
  window.api?.log?.error(`Unhandled promise rejection: ${msg}`);
});

// Now import the app — if these imports throw, the handlers above will catch it
import('./core/App.js').then(({ app }) => {
  return import('./ui/DOMHelper.js').then(({ domReady }) => {
    return domReady().then(() => {
      window.api?.log?.info('DOM ready, starting App.init()');
      return app.init();
    });
  });
}).catch((error) => {
  const msg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
  console.error('[Renderer fatal]', msg);
  window.api?.log?.error(`Fatal renderer startup error: ${msg}`);
});
