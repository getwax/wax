import WaxInPage from '..';
import EthereumRpc from '../EthereumRpc';
import assert from '../helpers/assert';
import measureCalldataGas from '../measureCalldataGas';
import waxPrivate from '../waxPrivate';
import IBundler from './IBundler';

// This value is needed to account for the overheads of running the entry point
// that are difficult to attribute directly to each user op. It should be
// calibrated so that the bundler makes a small profit overall.
const basePreVerificationGas = 50_000n;

// Cost of validating a signature or whatever verification method is in place.
const baseVerificationGas = 100_000n;

export default class SimulatedBundler implements IBundler {
  #waxInPage: WaxInPage;

  constructor(waxInPage: WaxInPage) {
    this.#waxInPage = waxInPage;
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
    await contracts.entryPoint
      .connect(adminAccount)
      .handleOps([userOp], adminAccount.getAddress());

    return await contracts.entryPoint.getUserOpHash(userOp);
  }

  async eth_estimateUserOperationGas(
    userOp: EthereumRpc.UserOperation,
  ): Promise<EthereumRpc.UserOperationGasEstimate> {
    const contracts = await this.#waxInPage.getContracts();
    const account = await this.#waxInPage._getAccount(waxPrivate);

    // We need a beneficiary address to measure the encoded calldata, but
    // there's no need for it to be correct.
    const fakeBeneficiary = userOp.sender;

    const baselineData = contracts.entryPoint.interface.encodeFunctionData(
      'handleOps',
      [[], fakeBeneficiary],
    );

    const data = contracts.entryPoint.interface.encodeFunctionData(
      'handleOps',
      [[userOp], fakeBeneficiary],
    );

    const calldataGas =
      measureCalldataGas(data) - measureCalldataGas(baselineData);

    let verificationGasLimit = baseVerificationGas;

    assert(userOp.sender.toLowerCase() === account.address.toLowerCase());

    if (BigInt(userOp.nonce) === 0n) {
      verificationGasLimit +=
        await contracts.simpleAccountFactory.createAccount.estimateGas(
          account.ownerAddress,
          0,
        );
    }

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

    return {
      preVerificationGas: `0x${(basePreVerificationGas + calldataGas).toString(
        16,
      )}`,
      verificationGasLimit: `0x${verificationGasLimit.toString(16)}`,
      callGasLimit,
    };
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
}
