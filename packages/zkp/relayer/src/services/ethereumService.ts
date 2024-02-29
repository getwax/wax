import {
    Address,
    TransactionReceipt,
    PublicClient,
    WalletClient,
    decodeEventLog,
    keccak256,
    encodeAbiParameters,
} from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import safeZkEmailRecoveryPluginArtifact from "../config/SafeZkEmailRecoveryPlugin.json";
import claveEmailRecoveryModuleArtifact from "../config/EmailRecoveryModule.json";
import config from "../config/config";
import parseViemError from "../utils/parseViemError";

type InitiateRecoverySuccess = {
    accountAddress: Address;
    newOwner: Address | string;
    recoveryPlugin: Address;
    executeAfter: bigint;
    blockTimestamp: bigint;
};

type InitiateRecoveryFailure = {
    accountAddress: Address;
    newOwner: Address | string;
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
        accountAddress: Address,
        newOwnerAddress: Address,
        recoveryPluginAddress: Address,
        emailDomain: string,
        a: [bigint, bigint],
        b: [[bigint, bigint], [bigint, bigint]],
        c: [bigint, bigint]
    ): Promise<InitiateRecoveryResult> {
        const account = mnemonicToAccount(
            config.viem.networks.hardhat.mnenmonic,
            {
                // hardhat account #3
                path: "m/44'/60'/0'/0/3",
            }
        );
        const nonce = await this.publicClient.getTransactionCount({
            address: account.address,
        });

        // TODO: (merge-ok) fix typing - https://github.com/getwax/wax/issues/205
        let receipt: TransactionReceipt;
        try {
            const { request } = await this.publicClient.simulateContract({
                address: recoveryPluginAddress,
                abi: safeZkEmailRecoveryPluginArtifact.abi,
                functionName: "initiateRecovery",
                args: [accountAddress, newOwnerAddress, emailDomain, a, b, c],
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
                accountAddress,
                newOwner: newOwnerAddress,
                recoveryPlugin: recoveryPluginAddress,
                revertReason: parsedError,
            };
        }

        // TODO: better error handling here
        const log = decodeEventLog({
            abi: safeZkEmailRecoveryPluginArtifact.abi,
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
            accountAddress,
            newOwner: newOwnerAddress,
            recoveryPlugin: recoveryPluginAddress,
            executeAfter,
            blockTimestamp,
        };
    }

    public async initiateRecoveryClave(
        accountAddress: Address,
        newOwnerPublicKey: string,
        recoveryPluginAddress: Address,
        emailDomain: string,
        a: [bigint, bigint],
        b: [[bigint, bigint], [bigint, bigint]],
        c: [bigint, bigint]
    ): Promise<InitiateRecoveryResult> {
        const account = mnemonicToAccount(
            config.viem.networks.zkSyncEraInMemory.mnenmonic
        );
        const nonce = await this.publicClient.getTransactionCount({
            address: account.address,
        });

        const recoveryData = {
            recoveringAddress: accountAddress,
            newOwner: newOwnerPublicKey,
            nonce: 0,
        };

        const guardianHash = keccak256(
            encodeAbiParameters(
                [{ name: "guardianHash", type: "string" }],
                ["mockGuardianHash"]
            )
        );
        const dkimPublicKeyHash = keccak256(
            encodeAbiParameters(
                [{ name: "dkimPublicKeyHash", type: "string" }],
                ["mockDkimPublicKeyHash"]
            )
        );
        type GuardianData = {
            guardianHash: string;
            dkimPublicKeyHash: string;
            emailDomain: string;
            a: [bigint, bigint];
            b: [[bigint, bigint], [bigint, bigint]];
            c: [bigint, bigint];
        }[];
        const guardianData: GuardianData = [
            {
                guardianHash: guardianHash,
                dkimPublicKeyHash: dkimPublicKeyHash,
                emailDomain,
                a,
                b,
                c,
            },
        ];

        // TODO: (merge-ok) fix typing - https://github.com/getwax/wax/issues/205
        let receipt: TransactionReceipt;
        try {
            const { request } = await this.publicClient.simulateContract({
                address: recoveryPluginAddress,
                abi: claveEmailRecoveryModuleArtifact.abi,
                functionName: "startRecovery",
                args: [recoveryData, guardianData],
                account: account,
                chain: config.viem.networks.hardhat.chain,
                nonce: nonce,
            });

            const txHash = await this.walletClient.writeContract(request);
            receipt = await this.publicClient.getTransactionReceipt({
                hash: txHash,
            });
        } catch (error) {
            const parsedError = parseViemError(error);

            return {
                accountAddress,
                newOwner: newOwnerPublicKey,
                recoveryPlugin: recoveryPluginAddress,
                revertReason: parsedError,
            };
        }

        // TODO: better error handling here + also find correct log
        // const log = decodeEventLog({
        //     abi: claveEmailRecoveryModuleArtifact.abi,
        //     data: receipt.logs[0].data,
        //     topics: receipt.logs[0].topics,
        // });

        // TODO: (merge-ok) fix typing - https://github.com/getwax/wax/issues/205
        // viem docs suggest type should be inferred so shouldn't need
        // to do this - https://viem.sh/docs/contract/decodeEventLog#return-value.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        // const args = log.args as any;
        // const timelockExpiry = args.timelockExpiry as bigint;

        const block = await this.publicClient.getBlock({
            blockHash: receipt.blockHash,
        });
        const blockTimestamp = block.timestamp;

        return {
            accountAddress: accountAddress,
            newOwner: newOwnerPublicKey,
            recoveryPlugin: recoveryPluginAddress,
            // executeAfter: timelockExpiry,
            executeAfter: blockTimestamp,
            blockTimestamp,
        };
    }
}
