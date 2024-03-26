import { ethers, getBytes, keccak256, solidityPacked } from 'ethers';
import { z } from 'zod';
import { signer as hubbleBlsSigner } from '@thehubbleproject/bls';
import {
  SafeCompressionPlugin,
  SafeCompressionPlugin__factory,
} from '../../hardhat/typechain-types';
import EthereumRpc from '../EthereumRpc';
import IAccount from './IAccount';
import WaxInPage from '..';
import { SafeCompressionFactory } from '../../hardhat/typechain-types/lib/plugins/src/safe/SafeCompressionFactory';
import receiptOf from '../helpers/receiptOf';
import {
  encodeBitStack,
  encodePseudoFloat,
  encodeRegIndex,
  encodeVLQ,
  hexJoin,
  hexLen,
  lookupAddress,
} from '../helpers/encodeUtils';
import getBlsUserOpHash from '../helpers/getBlsUserOpHash';

export const SafeCompressionAccountData = z.object({
  type: z.literal('SafeCompressionAccount'),
  address: z.string(),
  privateKey: z.string(),
  ownerAddress: z.string(),
});

export type SafeCompressionAccountData = z.infer<
  typeof SafeCompressionAccountData
>;

// Cost of validating a signature or whatever verification method is in place.
const baseVerificationGas = 100_000n;

export default class SafeCompressionAccountWrapper implements IAccount {
  type = 'SafeCompressionAccount';

  constructor(
    public address: string,
    public privateKey: string,
    public ownerAddress: string,
    public waxInPage: WaxInPage,
  ) {}

  static fromData(data: SafeCompressionAccountData, waxInPage: WaxInPage) {
    return new SafeCompressionAccountWrapper(
      data.address,
      data.privateKey,
      data.ownerAddress,
      waxInPage,
    );
  }

  toData(): SafeCompressionAccountData {
    return {
      type: 'SafeCompressionAccount',
      address: this.address,
      privateKey: this.privateKey,
      ownerAddress: this.ownerAddress,
    };
  }

  static async createRandom(
    waxInPage: WaxInPage,
  ): Promise<SafeCompressionAccountWrapper> {
    const contracts = await waxInPage.getContracts();

    const wallet = ethers.Wallet.createRandom();

    const admin = await waxInPage.requestAdminAccount('deploy-account');

    const createArgs = [
      contracts.safe,
      contracts.entryPoint,
      contracts.blsSignatureAggregator,
      (await getBlsSigner(wallet.privateKey)).pubkey,
      contracts.fallbackDecompressor,
      wallet,
      0,
    ] satisfies Parameters<SafeCompressionFactory['create']>;

    const address = await contracts.safeCompressionFactory.create.staticCall(
      ...createArgs,
    );

    await receiptOf(
      contracts.safeCompressionFactory.connect(admin).create(...createArgs),
    );

    return new SafeCompressionAccountWrapper(
      address,
      wallet.privateKey,
      wallet.address,
      waxInPage,
    );
  }

  getContract(): SafeCompressionPlugin {
    return SafeCompressionPlugin__factory.connect(
      this.address,
      this.waxInPage.ethersProvider,
    );
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  async makeInitCode(): Promise<string> {
    throw new Error(
      [
        'SafeCompressionAccount does not use initCode (it must be created',
        'before use)',
      ].join(' '),
    );
  }

  // eslint-disable-next-line @typescript-eslint/require-await, class-methods-use-this
  async encodeActions(actions: EthereumRpc.Action[]): Promise<string> {
    const contracts = await this.waxInPage.getContracts();

    let stream = '0x';
    const bits: boolean[] = [];

    for (const action of actions) {
      const addressIndex = await lookupAddress(
        contracts.addressRegistry,
        action.to,
      );

      bits.push(addressIndex !== undefined);

      let toBytes;

      if (addressIndex !== undefined) {
        toBytes = encodeRegIndex(addressIndex);
      } else {
        toBytes = action.to;
      }

      stream = hexJoin([
        stream,
        toBytes,
        encodePseudoFloat(BigInt(action.value ?? 0)),
        encodeVLQ(BigInt(hexLen(action.data ?? '0x'))),
        action.data ?? '0x',
      ]);
    }

    stream = hexJoin([
      encodeVLQ(BigInt(actions.length)),
      encodeBitStack(bits),
      stream,
    ]);

    this.waxInPage.logBytes('stream argument of decompressAndPerform', stream);

    return SafeCompressionPlugin__factory.createInterface().encodeFunctionData(
      'decompressAndPerform',
      [stream],
    );
  }

  // eslint-disable-next-line class-methods-use-this, @typescript-eslint/require-await
  async estimateVerificationGas(
    _userOp: EthereumRpc.UserOperation,
  ): Promise<bigint> {
    // TODO: estimateGas on validateUserOp?
    return baseVerificationGas;
  }

  async getNonce(): Promise<bigint> {
    const contracts = await this.waxInPage.getContracts();

    // TODO: Why does this give a different result to
    // this.getContract().getNonce()?
    // (And why does that alternative give the wrong answer?)
    return await contracts.entryPoint.getNonce(this.address, 0);
  }

  async sign(
    userOp: EthereumRpc.UserOperation,
    _userOpHash: string,
  ): Promise<string> {
    const blsSigner = await getBlsSigner(this.privateKey);
    const provider = this.waxInPage.ethersProvider;
    const contracts = await this.waxInPage.getContracts();

    const blsUserOpHash = getBlsUserOpHash(
      (await provider.getNetwork()).chainId,
      await contracts.blsSignatureAggregator.getAddress(),
      blsSigner.pubkey,
      userOp,
    );

    return solidityPacked(['uint256[2]'], [blsSigner.sign(blsUserOpHash)]);
  }
}

async function getBlsSigner(ecdsaPrivateKey: string) {
  // Note: The BLS library we use implements key derivation that allows this
  // to work, so it's the simplest way to get a BLS private key in our
  // context, but there should be a standard around this.
  const blsPrivateKey = ecdsaPrivateKey;

  const domain = getBytes(keccak256(Buffer.from('eip4337.bls.domain')));
  const signerFactory = await hubbleBlsSigner.BlsSignerFactory.new();
  const blsSigner = signerFactory.getSigner(domain, blsPrivateKey);

  return blsSigner;
}
