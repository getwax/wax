import {
    Address,
    TransactionReceipt,
    PublicClient,
    WalletClient,
    decodeEventLog,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import pluginArtifact from "../config/SafeZkEmailRecoveryPlugin.json";
import config from "../config/config";
import parseViemError from "../utils/parseViemError";

type InitiateRecoverySuccess = {
    safeAddress: Address;
    newOwner: Address;
    recoveryPlugin: Address;
    executeAfter: bigint;
    blockTimestamp: bigint;
};

type InitiateRecoveryFailure = {
    safeAddress: Address;
    newOwner: Address;
    recoveryPlugin: Address;
    revertReason: string;
};

export type InitiateRecoveryResult =
    | InitiateRecoverySuccess
    | InitiateRecoveryFailure;

export default class EthereumService {
    constructor(
        private publicClient: PublicClient,
        private walletClient: WalletClient
    ) {}

    public async initiateRecovery(
        safeProxyAddress: Address,
        newOwnerAddress: Address,
        recoveryPluginAddress: Address,
        emailDomain: string,
        a: [bigint, bigint],
        b: [[bigint, bigint], [bigint, bigint]],
        c: [bigint, bigint]
    ): Promise<InitiateRecoveryResult> {
        const account = mnemonicToAccount(config.viem.mnenmonic, {
            // hardhat account #3
            path: "m/44'/60'/0'/0/3",
        });
        const nonce = await this.publicClient.getTransactionCount({
            address: account.address,
        });

        // TODO: (merge-ok) fix typing - https://github.com/getwax/wax/issues/205
        let receipt: TransactionReceipt;
        try {
            const { request } = await this.publicClient.simulateContract({
                address: recoveryPluginAddress,
                abi: pluginArtifact.abi,
                functionName: "initiateRecovery",
                args: [safeProxyAddress, newOwnerAddress, emailDomain, a, b, c],
                account: account,
                chain: hardhat,
                nonce: nonce,
            });

            const txHash = await this.walletClient.writeContract(request);
            receipt = await this.publicClient.getTransactionReceipt({
                hash: txHash,
            });
        } catch (error) {
            const parsedError = parseViemError(error);

            return {
                safeAddress: safeProxyAddress,
                newOwner: newOwnerAddress,
                recoveryPlugin: recoveryPluginAddress,
                revertReason: parsedError,
            };
        }

        const log = decodeEventLog({
            abi: pluginArtifact.abi,
            data: receipt.logs[0].data,
            topics: receipt.logs[0].topics,
        });

        // TODO: (merge-ok) fix typing - https://github.com/getwax/wax/issues/205
        // viem docs suggest type should be inferred so shouldn't need
        // to do this - https://viem.sh/docs/contract/decodeEventLog#return-value.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const args = log.args as any;
        const executeAfter = args.executeAfter as bigint;

        const block = await this.publicClient.getBlock({
            blockHash: receipt.blockHash,
        });
        const blockTimestamp = block.timestamp;

        return {
            safeAddress: safeProxyAddress,
            newOwner: newOwnerAddress,
            recoveryPlugin: recoveryPluginAddress,
            executeAfter,
            blockTimestamp,
        };
    }
}
