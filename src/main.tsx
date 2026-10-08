import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { HDAProvider } from './context/HDAContext';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <HDAProvider>
      <App />
    </HDAProvider>
  </React.StrictMode>
);
