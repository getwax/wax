import { Address, PublicClient, WalletClient } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { hardhat } from "viem/chains";
import pluginArtifact from "../config/SafeZkEmailRecoveryPlugin.json";
import config from "../config/config";
import parseViemError from "../utils/parseViemError";

export type InitiateRecoveryResult = {
    success: boolean;
    message: string;
};

export default class EthereumService {
    constructor(
        private publicClient: PublicClient,
        private walletClient: WalletClient
    ) {}

    async initiateRecovery(
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

        // TODO: (merge-ok) fix typing
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
            await this.publicClient.getTransactionReceipt({ hash: txHash });
        } catch (error) {
            const parsedError = parseViemError(error);

            return {
                success: false,
                message: parsedError,
            };
        }

        return {
            success: true,
            message: "Recovery has been initiated",
        };
    }
}
