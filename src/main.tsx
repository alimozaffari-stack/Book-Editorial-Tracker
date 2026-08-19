import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import { renderRendererStartupFailure } from './rendererStartup';
import './index.css';

const root = document.getElementById('root');
const fallbackTarget = root ?? document.body;
let startupFailureShown = false;

function showStartupFailure(error: unknown) {
  if (startupFailureShown) return;
  startupFailureShown = true;
  renderRendererStartupFailure(fallbackTarget, error);
}

window.addEventListener('error', (event) => {
  showStartupFailure(event.error ?? new Error(event.message || 'Unknown renderer startup error.'));
});

window.addEventListener('unhandledrejection', (event) => {
  showStartupFailure(event.reason);
});

if (!root) {
  const error = new Error('Renderer root element was not found.');
  showStartupFailure(error);
  throw error;
}

try {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} catch (error) {
  showStartupFailure(error);
  throw error;
}
