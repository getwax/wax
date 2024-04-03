import { ethers } from 'ethers';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import WaxInPage from '../src';
import './index.css';
import DemoContext from './DemoContext.ts';
import config from './config/config.ts';
import './windowDebug.ts';

WaxInPage.addStylesheet();

const waxInPage = new WaxInPage({
  rpcUrl: config.rpcUrl,
  bundlerRpcUrl: config.bundlerRpcUrl,
  entryPointAddress: config.entryPointAddress,
  aggregatorAddress: config.aggregatorAddress,
});

waxInPage.attachGlobals();

const globalRecord = globalThis as Record<string, unknown>;
globalRecord.ethers = ethers;

if (config.pollingInterval !== undefined) {
  waxInPage.setConfig({
    ethersPollingInterval: config.pollingInterval,
  });
} else if (config.rpcUrl === 'http://127.0.0.1:8545') {
  waxInPage.setConfig({
    ethersPollingInterval: 500,
  });
}

waxInPage.setConfig({
  logRequests: config.logRequests,
  logBytes: config.logBytes,
  requirePermission: config.requirePermission,
});

const demoContext = new DemoContext(waxInPage);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DemoContext.Provider value={demoContext}>
      <App />
    </DemoContext.Provider>
  </React.StrictMode>,
);
