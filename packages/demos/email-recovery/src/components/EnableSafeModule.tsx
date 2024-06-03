import { ConnectKitButton } from "connectkit";
import { Button } from "./Button";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { safe7579 } from "../../contracts.base-sepolia.json";
import { abi as safeAbi } from "../abi/Safe.json";
import { abi as safe7579Abi } from "../abi/Safe7579.json";
import { useCallback, useContext, useEffect, useState } from "react";
import { StepsContext } from "../App";
import { STEPS } from "../constants";
import Loader from "./Loader";
import toast from "react-hot-toast";
import { createPublicClient, encodeAbiParameters, encodeFunctionData, http, zeroAddress } from "viem";
import { baseSepolia } from "viem/chains";
import { ENTRYPOINT_ADDRESS_V07, createSmartAccountClient } from "permissionless";
import { createPimlicoBundlerClient, createPimlicoPaymasterClient } from "permissionless/clients/pimlico";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { signerToSafeSmartAccount } from "permissionless/accounts";

const EnableSafeModule = () => {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();

  const stepsContext = useContext(StepsContext);
  const [isEnableModalLoading, setIsEnableModuleLoading] = useState(false);

  // TODO Update this to check Safe7579.isModuleInstalled for email recovery module
  // We may want to do that check in recovery configuration page.
  const { data: isModuleEnabled, isLoading: isCheckModuleEnabledLoading } =
    useReadContract({
      address,
      abi: safeAbi,
      functionName: "isModuleEnabled",
      args: [safe7579],
    });

  useEffect(() => {
    console.log(isModuleEnabled);
  }, [isModuleEnabled]);

  console.log(isModuleEnabled);

  if (isModuleEnabled) {
    console.log("Module is enabled");
    setIsEnableModuleLoading(false);
    stepsContext?.setStep(STEPS.REQUEST_GUARDIAN);
  }

  const enableSafe7579Module = useCallback(async () => {
    setIsEnableModuleLoading(true);
    if (!address) {
      throw new Error("unable to get account address");
    }

    toast("Please check Safe Website to complete transaction", {
      // TODO Where is this infoIcon from?
      // icon: <img src={infoIcon} />,
      style: {
        background: 'white'
      }
    })

    const rpcUrl = baseSepolia.rpcUrls.default.http[0];

    // TODO Cache this value in local stroage
    // For now, create a new account on every run.
    const signerPrivKey = generatePrivateKey();
    const signer = privateKeyToAccount(signerPrivKey)

    const bundlerUrl = `https://api.pimlico.io/v2/${baseSepolia.id}/rpc?apikey=${import.meta.env.VITE_PIMLICO_API_KEY}`;

    const publicClient = createPublicClient({
      transport: http(rpcUrl),
    })

    const paymasterClient = createPimlicoPaymasterClient({
      transport: http(bundlerUrl),
      entryPoint: ENTRYPOINT_ADDRESS_V07,
    })

    const bundlerClient = createPimlicoBundlerClient({
      transport: http(bundlerUrl),
      entryPoint: ENTRYPOINT_ADDRESS_V07,
    })

    const safeAccount = await signerToSafeSmartAccount(publicClient, {
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      signer: signer,
      saltNonce: 0n,
      safeVersion: "1.4.1",
    })

    const smartAccountClient = createSmartAccountClient({
      account: safeAccount,
      entryPoint: ENTRYPOINT_ADDRESS_V07,
      chain: baseSepolia,
      bundlerTransport: http(bundlerUrl),
      middleware: {
        sponsorUserOperation: paymasterClient.sponsorUserOperation,
        gasPrice: async () => (await bundlerClient.getUserOperationGasPrice()).fast,
      },
    })

    console.debug("send batched userops");

    const executorModuleTypeId = 2;
    const oneWeekInSeconds = 60n * 60n * 24n * 7n;
    const installData = encodeAbiParameters(
      [
        { type: "address[]" },
        { type: "uint256[]" },
        { type: "uint256" },
        { type: "uint256" },
        { type: "uint256" },
      ],
      [
        [zeroAddress], // guardians TODO get from form
        [1n], // weights
        1n, // threshold
        1n, // delay
        oneWeekInSeconds * 2n, // expiry
      ]
    );

    // TODO We may be able to use safe 7579 launchpad for all of this
    const userOpHash = await smartAccountClient.sendTransactions({
      transactions: [
        // Enable 7579 module
        {
          to: safeAccount.address,
          value: 0n,
          data: encodeFunctionData({
            abi: safeAbi,
            functionName: "enableModule",
            args: [safe7579]
          }),
        },
        // Set 7579 as fallback
        {
          to: safeAccount.address,
          value: 0n,
          data: encodeFunctionData({
            abi: safeAbi,
            functionName: "setFallbackHandler",
            args: [safe7579]
          }),
        },
        // Initialize adapter
        {
          to: safe7579 as `0x${string}`,
          value: 0n,
          data: encodeFunctionData({
            abi: safe7579Abi,
            functionName: "initializeAccount",
            args: [
              [], // Validators
              [], // Executors
              [], // Fallbacks
              [], // Hooks
              {
                registry: zeroAddress, // TODO Set to deployed registry (if needed)
                attesters: [],
                threshold: 0,
              },
            ],
          }),
        },
        // Install email recovery module
        // TODO This fails with 0x error, may need default executor or validator before this point
        // Can also try switching to launchpad init since this is a brand new 
        // {
        //   to: safe7579 as `0x${string}`,
        //   value: 0n,
        //   data: encodeFunctionData({
        //     abi: safe7579Abi,
        //     functionName: "installModule",
        //     args: [
        //       executorModuleTypeId,
        //       safeRecoveryModule,
        //       installData // TODO likely error here
        //     ]
        //   }),
        // }
      ],
    })

    console.debug("init userOpHash", userOpHash);

    // TODO Make sure module is actually enabling
  }, [address, writeContractAsync]);

  if (isCheckModuleEnabledLoading) {
    return <Loader />;
  }

  return (
    <div style={{ display: "flex", gap: "2rem", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
        Connected wallet: <ConnectKitButton />
      </div>
      {!isModuleEnabled ? (
        <Button
          disabled={isEnableModalLoading}
          loading={isEnableModalLoading}
          onClick={enableSafe7579Module}
        >
          Enable Safe ERC-7579 Module
        </Button>
      ) : null}
      {/* {isEnableModalLoading ? (
        <>Please check Safe Website to complete transaction</>
      ) : null} */}
    </div>
  );
};

export default EnableSafeModule;

/*
  This code is the WalletConnect version of the logic in enableSafe7579Module w/o
  ERC-4337/UserOp. May be helpful in the future so left here.

  console.debug("1", "Enable 7579 Module");

  await writeContractAsync({
    abi: safeAbi,
    address,
    functionName: "enableModule",
    args: [safe7579]
  });

  console.debug("2", "Set as fallback handler");

  await writeContractAsync({
    abi: safeAbi,
    address,
    functionName: "setFallbackHandler",
    args: [safe7579]
  });

  console.debug("3", "Initiliaze Safe w/ 7579 Adapter");

  await writeContractAsync({
    abi: safe7579Abi,
    address: safe7579 as `0x{string}`,
    functionName: "initializeAccount",
    args: [
      [], // Validators
      [], // Executors TODO We may need to add a default
      [], // Fallbacks
      [], // Hooks
      {
        registry: zeroAddress, // TODO Set to deployed registry (if needed)
        attesters: [],
        threshold: 0,
      },
    ],
  });

  TODO Consider batching all of the above ^ via `safeAppsSDK.txs.send({ txs })` from @safe-global/safe-apps-sdk
  May also be able to use MultiCall3

  At this point, we should be setup for ERC-4337 & ERC-7579

  TODO This step currently reverts as it needs to be run via ERC-4337 Entrypoint (UserOp)
  Since this is likely the only UserOp we need to run, can directly submit to entrypoint
  console.debug("4", "Install email recovery module");

  // TODO Move to env
  const pimlicoApiKey = "c58c6c9c-67da-4a24-85b4-86815638e377";
  const bundlerUrl = `https://api.pimlico.io/v2/${baseSepolia.id}/rpc?apikey=${pimlicoApiKey}`;
  const bundler = createBundlerClient({
    chain: baseSepolia,
    transport: http(bundlerUrl),
    entryPoint,
  });

  // console.debug("4.1", "Fetching bundler gas prices")

  const oneWeekInSeconds = 60n * 60n * 24n * 7n;
  // TODO Move to ConfigureSafeModule component so we can use guardian setup
  // TODO Check this is not already installed
  const installData = encodeAbiParameters(
    [
      { type: "address[]" },
      { type: "uint256[]" },
      { type: "uint256" },
      { type: "uint256" },
      { type: "uint256" },
    ],
    [
      [zeroAddress], // guardians TODO get from form
      [1n], // weights
      1n, // threshold
      1n, // delay
      oneWeekInSeconds * 2n, // expiry
    ]
  );

  if (!publicClient) {
    throw new Error("Missing public client");
  }

  const nonce = await getAccountNonce(publicClient, {
    sender: address,
    entryPoint,
  });

  const executorModuleTypeId = 2; // Executor
  const rawUserOp = {
    sender: address,
    nonce,
    signature: "0x",
    callData: encodeFunctionData({
      abi: safe7579Abi,
      functionName: "installModule",
      args: [
        executorModuleTypeId,
        safeRecoveryModule,
        installData
      ]
    }),
    maxPriorityFeePerGas: 113000100n,
    maxFeePerGas: 113000100n,
  };

  console.debug("4.2", "Estimate UserOp gas");

  const userOpGasEstimate = await bundler.estimateUserOperationGas({
    userOperation: rawUserOp
  });

  console.debug("4.3", "Sign UserOp");

  const userOp: UserOperation<"v0.7"> = {
    ...userOpGasEstimate,
    ...rawUserOp,
    signature: "0xTODO, get safe to sign"
  };

  console.debug("4.4", "userOp", userOp);

  console.debug("4.5", "Send UserOp to Entrypoint");

  await writeContractAsync({
    abi: entryPointAbi,
    address: entryPoint as `0x{string}`,
    functionName: "handleOps",
    args: [
      [userOp],
      zeroAddress, // beneficiary
    ]
  });

  console.debug("Done!");
*/
