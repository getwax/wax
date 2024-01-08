/* eslint-disable no-console */

import { ethers } from 'ethers';
import WaxInPage from '..';
import EthereumRpc from '../EthereumRpc';
import measureCalldataGas from '../measureCalldataGas';
import waxPrivate from '../waxPrivate';
import IBundler from './IBundler';
import {
  AddressRegistry,
  HandleOpsCaller,
  HandleOpsCaller__factory,
} from '../../hardhat/typechain-types';
import SafeSingletonFactory from '../SafeSingletonFactory';
import {
  encodeBitStack,
  encodeBytes,
  encodePseudoFloat,
  encodeRegIndex,
  encodeVLQ,
  hexJoin,
  hexLen,
  lookupAddress,
  roundUpPseudoFloat,
} from '../helpers/encodeUtils';

// This value is needed to account for the overheads of running the entry point
// that are difficult to attribute directly to each user op. It should be
// calibrated so that the bundler makes a small profit overall.
const basePreVerificationGas = 50_000n;

export default class SimulatedBundler implements IBundler {
  #waxInPage: WaxInPage;
  #handleOpsCaller?: HandleOpsCaller;

  constructor(waxInPage: WaxInPage) {
    this.#waxInPage = waxInPage;
    (window as any).simulatedBundler = this;
  }

  async foo() {
    const adminAccount = await this.#waxInPage.requestAdminAccount(
      'simulate-bundler',
    );

    const contracts = await this.#waxInPage.getContracts();

    // *not* the confirmation, just the response (don't add .wait(), that's
    // wrong).
    let txResponse;

    if (this.#waxInPage.getConfig('useTopLevelCompression')) {
      const handleOpsCaller = await this.#getHandleOpsCaller();

      txResponse = await adminAccount.sendTransaction({
        to: handleOpsCaller.getAddress(),
        data: await SimulatedBundler.encodeHandleOps(
          contracts.addressRegistry,
          [],
        ),
      });
    } else {
      txResponse = await contracts.entryPoint
        .connect(adminAccount)
        .handleOps([], adminAccount.getAddress());
    }

    const tx = ethers.Transaction.from(txResponse);
    this.#waxInPage.logBytes('Top-level calldata', tx.data);
    this.#waxInPage.logBytes('Top-level tx', tx.serialized);

    void txResponse.wait().then((receipt) => {
      if (!receipt) {
        console.error('Failed to get bundle receipt');
        return;
      }

      if (receipt) {
        console.log('Top-level gas used:', receipt.gasUsed.toString());
      }
    });
  }

  async eth_sendUserOperation(
    userOp: EthereumRpc.UserOperation,
  ): Promise<string> {
    const adminAccount = await this.#waxInPage.requestAdminAccount(
      'simulate-bundler',
    );

    const contracts = await this.#waxInPage.getContracts();

    // *not* the confirmation, just the response (don't add .wait(), that's
    // wrong).
    let txResponse;

    if (this.#waxInPage.getConfig('useTopLevelCompression')) {
      const handleOpsCaller = await this.#getHandleOpsCaller();

      txResponse = await adminAccount.sendTransaction({
        to: handleOpsCaller.getAddress(),
        data: await SimulatedBundler.encodeHandleOps(
          contracts.addressRegistry,
          [userOp],
        ),
      });
    } else {
      txResponse = await contracts.entryPoint
        .connect(adminAccount)
        .handleOps([userOp], adminAccount.getAddress());
    }

    const tx = ethers.Transaction.from(txResponse);
    this.#waxInPage.logBytes('Top-level calldata', tx.data);
    this.#waxInPage.logBytes('Top-level tx', tx.serialized);

    void txResponse.wait().then((receipt) => {
      if (!receipt) {
        console.error('Failed to get bundle receipt');
        return;
      }

      if (receipt) {
        console.log('Top-level gas used:', receipt.gasUsed.toString());
      }
    });

    return await contracts.entryPoint.getUserOpHash(userOp);
  }

  async eth_estimateUserOperationGas(
    userOp: EthereumRpc.UserOperation,
  ): Promise<EthereumRpc.UserOperationGasEstimate> {
    const contracts = await this.#waxInPage.getContracts();
    const account = await this.#waxInPage._getOrCreateAccount(waxPrivate);

    const calldataGas = await this.#calculateCalldataGas(userOp);

    const verificationGasLimit = await account.estimateVerificationGas(userOp);

    const callGasLimit = await this.#waxInPage.ethereum.request({
      method: 'eth_estimateGas',
      params: [
        {
          from: await contracts.entryPoint.getAddress(),
          to: userOp.sender,
          data: userOp.callData,
        },
      ],
    });

    let res = {
      preVerificationGas: `0x${(basePreVerificationGas + calldataGas).toString(
        16,
      )}`,
      verificationGasLimit: `0x${verificationGasLimit.toString(16)}`,
      callGasLimit,
    };

    if (this.#waxInPage.getConfig('useTopLevelCompression')) {
      res = SimulatedBundler.roundUpGasEstimate(res);
    }

    return res;
  }

  async eth_getUserOperationReceipt(
    userOpHash: string,
  ): Promise<EthereumRpc.UserOperationReceipt | null> {
    const contracts = await this.#waxInPage.getContracts();

    const events = await contracts.entryPoint.queryFilter(
      contracts.entryPoint.filters.UserOperationEvent(userOpHash),
    );

    if (events.length === 0) {
      return null;
    }

    const event = events[0];

    const txReceipt = await this.#waxInPage.ethereum.request({
      method: 'eth_getTransactionByHash',
      params: [event.transactionHash],
    });

    if (txReceipt === null) {
      return null;
    }

    let revertReason = '0x';

    if (!event.args.success) {
      const errorEvents = await contracts.entryPoint.queryFilter(
        contracts.entryPoint.filters.UserOperationRevertReason(userOpHash),
      );

      const errorEvent = errorEvents.at(0);

      if (errorEvent !== undefined) {
        revertReason = errorEvent.args.revertReason;
      }
    }

    return {
      userOpHash,
      entryPoint: await contracts.entryPoint.getAddress(),
      sender: event.args.sender,
      nonce: `0x${event.args.nonce.toString(16)}`,
      paymaster: event.args.paymaster,
      actualGasCost: `0x${event.args.actualGasCost.toString(16)}`,
      actualGasUsed: `0x${event.args.actualGasUsed.toString(16)}`,
      success: event.args.success,
      reason: revertReason,
      logs: [], // TODO: Logs
      receipt: txReceipt,
    } satisfies EthereumRpc.UserOperationReceipt;
  }

  async eth_supportedEntryPoints(): Promise<string[]> {
    const contracts = await this.#waxInPage.getContracts();
    return [await contracts.entryPoint.getAddress()];
  }

  async #getHandleOpsCaller(): Promise<HandleOpsCaller> {
    if (this.#handleOpsCaller === undefined) {
      const wallet = await this.#waxInPage.requestAdminAccount(
        'deploy-contracts',
      );

      const contracts = await this.#waxInPage.getContracts();

      const factory = await SafeSingletonFactory.init(wallet);

      this.#handleOpsCaller = await factory.connectOrDeploy(
        HandleOpsCaller__factory,
        [
          await contracts.entryPoint.getAddress(),
          wallet.address,
          await contracts.addressRegistry.getAddress(),
        ],
      );
    }

    return this.#handleOpsCaller;
  }

  async #calculateCalldataGas(
    userOp: EthereumRpc.UserOperation,
  ): Promise<bigint> {
    const contracts = await this.#waxInPage.getContracts();

    let baselineData: string;
    let data: string;

    if (this.#waxInPage.getConfig('useTopLevelCompression')) {
      baselineData = await SimulatedBundler.encodeHandleOps(
        contracts.addressRegistry,
        [],
      );

      data = await SimulatedBundler.encodeHandleOps(contracts.addressRegistry, [
        userOp,
      ]);
    } else {
      // We need a beneficiary address to measure the encoded calldata, but
      // there's no need for it to be correct.
      const fakeBeneficiary = userOp.sender;

      baselineData = contracts.entryPoint.interface.encodeFunctionData(
        'handleOps',
        [[], fakeBeneficiary],
      );

      data = contracts.entryPoint.interface.encodeFunctionData('handleOps', [
        [userOp],
        fakeBeneficiary,
      ]);
    }

    return measureCalldataGas(data) - measureCalldataGas(baselineData);
  }

  static async encodeHandleOps(
    registry: AddressRegistry,
    ops: EthereumRpc.UserOperation[],
  ): Promise<string> {
    const encodedLen = encodeVLQ(BigInt(ops.length));

    const bits: boolean[] = [];
    const encodedOps: string[] = [];

    for (const op of ops) {
      const parts: string[] = [];

      const senderIndex = await lookupAddress(registry, op.sender);

      if (senderIndex === undefined) {
        bits.push(false);
        parts.push(op.sender);
      } else {
        bits.push(true);
        parts.push(encodeRegIndex(senderIndex));
      }

      parts.push(encodeVLQ(BigInt(op.nonce)));

      if (hexLen(op.initCode) === 0) {
        bits.push(false);
      } else {
        bits.push(true);
        parts.push(encodeBytes(op.initCode));
      }

      SimulatedBundler.encodeUserOpCalldata(bits, parts, op.callData);

      parts.push(encodePseudoFloat(BigInt(op.callGasLimit)));
      parts.push(encodePseudoFloat(BigInt(op.verificationGasLimit)));
      parts.push(encodePseudoFloat(BigInt(op.preVerificationGas)));
      parts.push(encodePseudoFloat(BigInt(op.maxFeePerGas)));
      parts.push(encodePseudoFloat(BigInt(op.maxPriorityFeePerGas)));

      if (hexLen(op.paymasterAndData) === 0) {
        bits.push(false);
      } else {
        bits.push(true);
        parts.push(encodeBytes(op.paymasterAndData));
      }

      parts.push(encodeBytes(op.signature));

      encodedOps.push(hexJoin(parts));
    }

    return hexJoin([encodedLen, encodeBitStack(bits), ...encodedOps]);
  }

  static encodeUserOpCalldata(
    bits: boolean[],
    parts: string[],
    calldata: string,
  ) {
    let decompressAndPerformBytes: string | undefined;

    if (calldata.startsWith(decompressAndPerformSelector)) {
      const abiCoder = ethers.AbiCoder.defaultAbiCoder();

      try {
        const bytesArg = abiCoder.decode(
          ['bytes'],
          `0x${calldata.slice(10)}`,
        )[0] as string;

        if (
          hexJoin([
            decompressAndPerformSelector,
            abiCoder.encode(['bytes'], [bytesArg]),
          ]) === calldata
        ) {
          decompressAndPerformBytes = bytesArg;
        }
      } catch {
        // Fallthrough to default that handles any calldata
      }
    }

    if (decompressAndPerformBytes !== undefined) {
      bits.push(true);
      parts.push(encodeBytes(decompressAndPerformBytes));
    } else {
      bits.push(false);
      parts.push(encodeBytes(calldata));
    }
  }

  static roundUpGasEstimate({
    preVerificationGas,
    verificationGasLimit,
    callGasLimit,
  }: EthereumRpc.UserOperationGasEstimate): EthereumRpc.UserOperationGasEstimate {
    const roundUp = (x: string) =>
      `0x${roundUpPseudoFloat(BigInt(x)).toString(16)}`;

    return {
      preVerificationGas: roundUp(preVerificationGas),
      verificationGasLimit: roundUp(verificationGasLimit),
      callGasLimit: roundUp(callGasLimit),
    };
  }
}

const decompressAndPerformSelector = ethers.FunctionFragment.getSelector(
  'decompressAndPerform',
  ['bytes'],
);
