// import {
//   installModule,
//   getModule,
//   getAccount,
//   getClient,
// } from '@rhinestone/module-sdk';
import { ConnectKitButton } from "connectkit";
import { encodeFunctionData } from 'viem';
import { Button } from "./Button";
import {
  useAccount,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { safe7579, safe7579Launchpad, entryPoint } from "../../contracts.base-sepolia.json";
import { abi as entryPointAbi } from "../abi/Safe7579Launchpad.json";
import { abi as safeAbi } from "../abi/Safe.json";
import { abi as launchpadAbi } from "../abi/Safe7579Launchpad.json";
import { useCallback, useContext, useEffect, useState } from "react";
import { StepsContext } from "../App";
import { STEPS } from "../constants";
import Loader from "./Loader";
import toast from "react-hot-toast";

// TODO Move to env
// const bundlerUrl = "https://public.stackup.sh/api/v1/node/base-sepolia";

const EnableSafeModule = () => {
  const { address } = useAccount();

  // const moduleClient = useMemo(() => getClient(chainId), [chainId]);
  // const module = getModule({
  //   module: moduleAddress,
  //   data: initData,
  //   type: moduleType,
  // })

  // // Get the executions required to install the module
  // const executions = await installModule({
  //   client,
  //   account,
  //   module,
  // })

  const { writeContractAsync } = useWriteContract();
  const stepsContext = useContext(StepsContext);
  const [isEnableModalLoading, setIsEnableModuleLoading] = useState(false);

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
      icon: <img src={infoIcon} />,
      style: {
        background: 'white'
      }
    })

    const setupData = encodeFunctionData({
      abi: launchpadAbi,
      functionName: "initSafe7579",
      args: [
        safe7579,
        [], // executors TODO We may need a default
        [], // fallbacks
        [], // hooks
        [], // attester addr
        0, // threshold
      ],
    });

    const initData = {
      singleton: address,
      owners: [], // TODO How can we get this?
      threshold: 1, // Same here
      setupTo: safe7579Launchpad,
      setupData,
      safe7579,
      validators: [],
      callData: "0x",
      // TODO We might be able to use this to setup email recovery module in the same call
      // Solidity example below,
      //
      // callData: abi.encodeCall(
      //     IERC7579Account.execute,
      //     (
      //         ModeLib.encodeSimpleSingle(),
      //         ExecutionLib.encodeSingle({
      //             target: address(target),
      //             value: 0,
      //             callData: abi.encodeCall(MockTarget.set, (1337))
      //         })
      //     )
      // )
    };

    const encodedSetupSafeCall = encodeFunctionData({
      abi: launchpadAbi,
      functionName: "setupSafe",
      args: [initData],
    });

    const userOp = {};

    // const userOP = {
    //   sender: account,
    //   nonce: 0,
    //   initCode: "",
    //   callData: "",
    //   accountGasLimits: bytes32(abi.encodePacked(uint128(2e6), uint128(2e6))),
    //   preVerificationGas: 2e6,
    //   gasFees: bytes32(abi.encodePacked(uint128(2e6), uint128(2e6))),
    //   paymasterAndData: bytes(""),
    //   signature: abi.encodePacked(hex"41414141")
    // };

    // This can also be a a bundler RPC call instead to submit UserOp.
    await writeContractAsync({
      abi: entryPointAbi,
      address: entryPoint as `0x{string}`,
      functionName: "handleOps",
      args: [[userOp], "0x" /* beneficiary */],
    });
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
