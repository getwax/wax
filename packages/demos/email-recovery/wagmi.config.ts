import { defineConfig } from '@wagmi/cli'
import { foundry, react } from '@wagmi/cli/plugins'

// TODO Fully link into project
export default defineConfig({
    out: 'src/abis.ts',
    plugins: [
        foundry({
            project: "../../plugins",
            include: [
                "EmailAccountRecovery.sol/**",
                "Safe.sol/**",
                "SafeZkEmailRecoveryPlugin.sol/**",
                "SimpleWallet.sol/**",
            ],
        }),
        react()
    ],
})
