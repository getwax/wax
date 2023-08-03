import { ethers } from 'ethers';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import WaxInPage from '../src';
import './index.css';
import DemoContext from './DemoContext.ts';

WaxInPage.addStylesheet();

const waxInPage = new WaxInPage();
waxInPage.attachGlobals();

const globalRecord = globalThis as Record<string, unknown>;
globalRecord.ethers = ethers;

const demoContext = new DemoContext(waxInPage);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DemoContext.Provider value={demoContext}>
      <App />
    </DemoContext.Provider>
  </React.StrictMode>,
);
