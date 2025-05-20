import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getInitialTheme, loadSettings } from './lib/storage';

// Set initial theme immediately with synchronous function
const initialTheme = getInitialTheme();
document.documentElement.classList.toggle('dark', initialTheme === 'dark');

// Then check async to ensure we have the latest setting
loadSettings().then(settings => {
  if (settings.theme === 'light' || settings.theme === 'dark') {
    document.documentElement.classList.toggle('dark', settings.theme === 'dark');
  } else if (settings.theme === 'system') {
    const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.classList.toggle('dark', systemPrefersDark);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
