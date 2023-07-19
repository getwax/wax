import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import WaxInPage from '../src';
import './index.css';
import DemoContext from './DemoContext.ts';

WaxInPage.addStylesheet();

const waxInPage = WaxInPage.create();
waxInPage.attachGlobals();

const demoContext = new DemoContext(waxInPage);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DemoContext.Provider value={demoContext}>
      <App />
    </DemoContext.Provider>
  </React.StrictMode>,
);
