import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import './theme/tokens.css';
import './theme/print.css';
// Screen 22 print rules. Must stay after print.css (the 04/21 sheet rules);
// it is loaded last in the app entry so it never weakens those.
import './theme/print-summary.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
