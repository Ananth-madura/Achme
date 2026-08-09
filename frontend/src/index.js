import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import * as serviceWorkerRegistration from './serviceWorkerRegistration';
import { installSafariDateShim } from './utils/dateCompat';
import socket from './socket/socket';

installSafariDateShim();

window.socket = socket;

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);

reportWebVitals();

// Register the PWA service worker for full offline asset caching
serviceWorkerRegistration.register();



