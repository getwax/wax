import { Address, PublicClient, WalletClient, parseAbi, type WriteContractErrorType, ContractFunctionRevertedError, BaseError } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';
import { hardhat } from 'viem/chains';
import { EventEmitter } from 'node:events';
import EmailTable from '../tables/emailTable';
import contract from "./SafeZkEmailRecoveryPlugin.json";

export default class EthereumService {
    constructor(
        public publicClient: PublicClient,
        public walletClient: WalletClient,
        public emailTable: EmailTable,
        public eventEmitter: EventEmitter
    ) {
        this.eventEmitter.on("email processed", this.initiateRecovery);
    }

    async initiateRecovery(safeProxyAddress: Address, newOwnerAddress: Address, recoveryPluginAddress: Address, emailDomain: string, a: [bigint, bigint], b: [[bigint, bigint], [bigint, bigint]], c: [bigint, bigint]): Promise<boolean> {
        const account = mnemonicToAccount(
            'test test test test test test test test test test test junk',
            {
                // hardhat account #3
                path: "m/44'/60'/0'/0/3"
            });
        const nonce = await this.publicClient.getTransactionCount({ address: account.address });
        
        // TODO: fix typing
        const { request } = await this.publicClient.simulateContract({
            address: recoveryPluginAddress,
            abi: contract.abi,
            functionName: 'initiateRecovery',
            args: [safeProxyAddress, newOwnerAddress, emailDomain, a, b, c],
            account: account,
            chain: hardhat,
            nonce: nonce,
        });

        const txHash = await this.walletClient.writeContract(request)
        await this.publicClient.getTransactionReceipt({ hash: txHash });
        
        // TODO: fix typing
        const recoveryRequest: any = await this.publicClient.readContract({
            address: recoveryPluginAddress,
            abi: contract.abi,
            functionName: "getRecoveryRequest",
            args: [safeProxyAddress]
        });
        
        if (recoveryRequest?.pendingNewOwner !== newOwnerAddress) {
            return false;
        }

        return true
    }
}