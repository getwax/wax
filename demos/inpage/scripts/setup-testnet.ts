#!/usr/bin/env ts-node-esm

/* eslint-disable no-console */

import fs from 'fs/promises';
import shell from './helpers/shell.ts';
import fileExists from './helpers/fileExists.ts';
import projectPath from './helpers/projectPath.ts';

const demoConfigNeeded = !(await fileExists('demo/config/config.ts'));

if (demoConfigNeeded) {
  await fs.copyFile(
    projectPath('demo/config/config.testnet.ts'),
    projectPath('demo/config/config.ts'),
  );
}

await shell('yarn', ['--cwd', projectPath('hardhat')]);
await shell('yarn', ['--cwd', projectPath('hardhat'), 'hardhat', 'compile']);

console.log('Setup success 🔥');

if (demoConfigNeeded) {
  console.log('demo/config/config.ts can be edited to suit your needs');
}
