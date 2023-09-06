#!/usr/bin/env ts-node-esm

import concurrently from 'concurrently';
import config from '../demo/config.ts';

const tasks = ['vite'];

if (config.rpcUrl === 'http://127.0.0.1:8545') {
  tasks.push('yarn --cwd hardhat hardhat node');
}

await concurrently(tasks, { killOthers: 'failure' }).result;
