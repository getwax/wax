#!/usr/bin/env tsx

/* eslint-disable no-console */

import concurrently from 'concurrently';
import config from '../demo/config/config.ts';

const tasks = ['vite'];

let externalNode: boolean;

if (config.rpcUrl === 'http://127.0.0.1:8545') {
  try {
    await fetch(config.rpcUrl);
    externalNode = true;
  } catch (e) {
    if ((e as { code: string }).code !== 'ECONNREFUSED') {
      throw e;
    }

    externalNode = false;
    tasks.push('yarn --cwd hardhat hardhat node');
  }
} else {
  externalNode = true;
}

if (externalNode) {
  console.log(`Relying on external node: ${config.rpcUrl}`);
} else {
  console.log('Starting dev node');
}

await concurrently(tasks, { killOthers: 'failure' }).result;
