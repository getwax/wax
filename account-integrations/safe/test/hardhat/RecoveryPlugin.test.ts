import { ethers } from "hardhat";
import { expect, use } from "chai";
import { AddressZero } from "@ethersproject/constants";
import { getBytes, keccak256, ContractFactory } from "ethers";
import { ethers as ethersV5 } from "ethers-v5";
import { UserOperationStruct } from "@account-abstraction/contracts";
import { calculateProxyAddress } from "./utils/calculateProxyAddress";
import { signer as hubbleBlsSigner } from "@thehubbleproject/bls";
import { getUserOpHash } from "@account-abstraction/utils";

import { executeContractCallWithSigners } from "./utils/execution";
// import { executeContractCallWithSigners } from "../../lib/safe-contracts/src";

import { SafeProxyFactory } from "../../typechain-types/lib/safe-contracts/contracts/proxies/SafeProxyFactory";
import { Safe } from "../../typechain-types/lib/safe-contracts/contracts/Safe";
import { EntryPoint } from "../../typechain-types/lib/account-abstraction/contracts/core/EntryPoint";

const BLS_PRIVATE_KEY =
  "0xdbe3d601b1b25c42c50015a87855fdce00ea9b3a7e33c92d31c69aeb70708e08";
const MNEMONIC = "test test test test test test test test test test test junk";

let safeProxyFactory: SafeProxyFactory;
let safe: Safe;
let entryPoint: EntryPoint;

describe("RecoveryPlugin", () => {
  const setupTests = async () => {
    safeProxyFactory = await (
      await ethers.getContractFactory("SafeProxyFactory")
    ).deploy();
    safe = await (await ethers.getContractFactory("Safe")).deploy();
    entryPoint = await (await ethers.getContractFactory("EntryPoint")).deploy();

    const provider = ethers.provider;
    // use ethersV5 to create a wallet
    const userWallet = ethers.Wallet.fromPhrase(MNEMONIC).connect(provider);

    return {
      provider,
      userWallet,
    };
  };

  /**
   * This test verifies a ERC4337 transaction succeeds when sent via a plugin
   * The user operation deploys a Safe with the ERC4337 plugin and a handler
   * and executes a transaction, thus verifying two things:
   * 1. Deployment of the Safe with the ERC4337 plugin and handler is possible
   * 2. Executing a transaction is possible
   */
  it("should pass the ERC4337 validation", async () => {
    const { provider, userWallet } =
      await setupTests();

    const ENTRYPOINT_ADDRESS = await entryPoint.getAddress();

    const safeECDSAPluginFactory = (
        await ethers.getContractFactory("SafeECDSAPlugin")
      ).connect(userWallet);
      const safeECDSAPlugin = await safeECDSAPluginFactory.deploy(
        ENTRYPOINT_ADDRESS,
        userWallet.address,
        { gasLimit: 10_000_000 }
    );
    // const safeBlsPluginFactory = (
    //   await ethers.getContractFactory("SafeBlsPlugin")
    // ).connect(userWallet);
    // const safeBlsPlugin = await safeBlsPluginFactory.deploy(
    //   ENTRYPOINT_ADDRESS,
    //   blsSigner.pubkey,
    //   { gasLimit: 30_000_000 }
    // );

    const feeData = await provider.getFeeData();
    if (!feeData.maxFeePerGas || !feeData.maxPriorityFeePerGas) {
      throw new Error(
        "maxFeePerGas or maxPriorityFeePerGas is null or undefined"
      );
    }

    const maxFeePerGas = "0x" + feeData.maxFeePerGas.toString();
    const maxPriorityFeePerGas = "0x" + feeData.maxPriorityFeePerGas.toString();

    const safeECDSAPluginAddress = await safeECDSAPlugin.getAddress();
    const singletonAddress = await safe.getAddress();
    const factoryAddress = await safeProxyFactory.getAddress();

    const moduleInitializer = safeECDSAPlugin.interface.encodeFunctionData(
      // @ts-ignore
      "enableMyself",
      []
    );
    const encodedInitializer = safe.interface.encodeFunctionData("setup", [
      [userWallet.address],
      1,
      safeECDSAPluginAddress,
      moduleInitializer,
      safeECDSAPluginAddress,
      AddressZero,
      0,
      AddressZero,
    ]);

    const deployedAddress = await calculateProxyAddress(
      safeProxyFactory as any,
      singletonAddress,
      encodedInitializer,
      73
    );

    // The initCode contains 20 bytes of the factory address and the rest is the calldata to be forwarded
    const initCode = ethers.concat([
      factoryAddress,
      safeProxyFactory.interface.encodeFunctionData("createProxyWithNonce", [
        singletonAddress,
        encodedInitializer,
        73,
      ]),
    ]);

    const signer = new ethers.Wallet(
      "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
    );
    const recipientAddress = signer.address;
    const transferAmount = ethers.parseEther("1");

    const userOpCallData = safeECDSAPlugin.interface.encodeFunctionData(
      "execTransaction",
      [recipientAddress, transferAmount, "0x00"]
    );

    // Native tokens for the pre-fund 💸
    await userWallet.sendTransaction({
      to: deployedAddress,
      value: ethers.parseEther("100"),
    });

    const unsignedUserOperation: UserOperationStruct = {
      sender: deployedAddress,
      nonce: "0x0",
      initCode,
      callData: userOpCallData,
      verificationGasLimit: 1e6,
      callGasLimit: 1e6,
      preVerificationGas: 1e6,
      maxFeePerGas,
      maxPriorityFeePerGas,
      paymasterAndData: "0x",
      signature: "",
    };

    const resolvedUserOp = await ethers.resolveProperties(
      unsignedUserOperation
    );
    const userOpHash = getUserOpHash(
      resolvedUserOp,
      ENTRYPOINT_ADDRESS,
      Number((await provider.getNetwork()).chainId)
    );

    const userOpSignature = await userWallet.signMessage(getBytes(userOpHash));

    const userOperation = {
      ...unsignedUserOperation,
      signature: userOpSignature,
    };

    // Uncomment to get a detailed debug message
    // const DEBUG_MESSAGE = `
    //         Using entry point: ${ENTRYPOINT_ADDRESS}
    //         Deployed Safe address: ${deployedAddress}
    //         Module/Handler address: ${safeBlsPluginAddress}
    //         User operation:
    //         ${JSON.stringify(userOperation, null, 2)}
    //     `;
    // console.log(DEBUG_MESSAGE);

    const recipientBalanceBefore = await provider.getBalance(recipientAddress);

    try {
      const rcpt = await entryPoint.handleOps(
        // @ts-ignore
        [userOperation],
        ENTRYPOINT_ADDRESS
      );
    } catch (e) {
      console.log("EntryPoint handleOps error=", e);
    }

    const recipientBalanceAfter = await provider.getBalance(recipientAddress);
    const expectedRecipientBalance = recipientBalanceBefore + transferAmount;

    expect(recipientBalanceAfter).to.equal(expectedRecipientBalance);

    // test call new function
    // const safe_execTxCallData = manager.interface.encodeFunctionData(
    //     'executeAndRevert',
    //     [to, value, data, 0],
    // );
    const twoUserOpCallData = safeECDSAPlugin.interface.encodeFunctionData(
        "updateOwner",
        [recipientAddress]
    );

    const twoUnsignedUserOperation: UserOperationStruct = {
        sender: deployedAddress,
        nonce: "0x1",
        initCode: "0x",
        callData: twoUserOpCallData,
        verificationGasLimit: 1e6,
        callGasLimit: 1e6,
        preVerificationGas: 1e6,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData: "0x",
        signature: "",
    };

    const twoResolvedUserOp = await ethers.resolveProperties(
        twoUnsignedUserOperation
    );

    const twoUserOpHash = getUserOpHash(
        twoResolvedUserOp,
        ENTRYPOINT_ADDRESS,
        Number((await provider.getNetwork()).chainId)
    );

    const twoUserOpSignature = await userWallet.signMessage(getBytes(twoUserOpHash));

    const twoUserOperation = {
        ...twoUnsignedUserOperation,
        signature: twoUserOpSignature,
    };


    // update owner directly
    try {
        const rcpt = await entryPoint.handleOps(
            // @ts-ignore
            [twoUserOperation],
            ENTRYPOINT_ADDRESS
        );
    } catch (e) {
        console.log("EntryPoint handleOps error=", e);
    }

    // try to deploy the recovery plugin
    // const recoverySigner = ethers.Wallet.createRandom().connect(provider);
    const [asdff, adf, recoverySigner] = await ethers.getSigners();
    console.log("RECOVERY SIGNER ADDRESS: ", recoverySigner.address);
    const recoveryPlugin = await (
        await ethers.getContractFactory("RecoveryPlugin")
    ).deploy(
        deployedAddress,
        recoverySigner.address,
    );

    const recoveryPluginAddress = await recoveryPlugin.getAddress();

    // add module to safe

    // const Safe = await ethers.getContractFactory("Safe");
    // const safe = await Safe.attach(deployedAddress);
        // console.log('deployed safe address: ', deployedAddress);
    // console.log("safe address: ", await testSafe.getAddress());

    const testSafe = await ethers.getContractAt("Safe", deployedAddress);
    // const baseContract = testSafe.attach(deployedAddress) as any
    
    const v5Provider = new ethersV5.providers.JsonRpcProvider(
        "http://127.0.0.1:8545"
    );
    const userWallet2 = ethersV5.Wallet.fromMnemonic(MNEMONIC).connect(v5Provider);
    const isModuleEnabledBefore = await testSafe.isModuleEnabled(recoveryPluginAddress);
    console.log('Test - recovery plugin:    ', recoveryPluginAddress)
    console.log('Test - safe:               ', await testSafe.getAddress());
    console.log('Is module enabled before:  ', isModuleEnabledBefore);
    // @ts-ignore userWalet2 doesn't have all properties for some reason
    await executeContractCallWithSigners(testSafe, testSafe, "enableModule", [recoveryPluginAddress], [userWallet2]);

    const isModuleEnabled = await testSafe.isModuleEnabled(recoveryPluginAddress);
    console.log('Is module enabled:         ', isModuleEnabled);

    // ****** make call from recovery plugin

    // const connectedModule = testSafe.connect(recoveryPlugin);
    // const asdf = await testSafe.execTransactionFromModuleReturnData(recoveryPluginAddress, 0, data, 0)
    // console.log('asdf=', asdf);

    // await execSafeTransaction(
    //     testSafe,
    //     await recoveryPlugin.getData.populateTransaction(),
    //     userWallet2
    // )
    // @ts-ignore
    const ecdsaaddress = await safeECDSAPlugin.getAddress();
    // @ts-ignore
    // await executeContractCallWithSigners(testSafe, recoveryPlugin as any, "getData", [testSafe, ecdsaaddress, data], [userWallet2]);
    // await executeContractCallWithSigners(testSafe, recoveryPlugin as any, "getData", [await testSafe.getAddress(), ecdsaaddress], [userWallet2]);
    
    const newSigner = ethers.Wallet.createRandom().connect(provider);

    // Call the "get" of the recovery plugin using the recoverySigner
    const recoveryPluginAsRecoverySigner = recoveryPlugin.connect(recoverySigner);
    const recoveryPluginAsRecoverySignerAddress = await recoveryPluginAsRecoverySigner.getAddress();
    console.log('recoveryPluginAsRecoverySignerAddress=', recoveryPluginAsRecoverySignerAddress);
    await recoveryPluginAsRecoverySigner.resetEcdsaAddress(
        await testSafe.getAddress(),
        ecdsaaddress,
        newSigner.address
    );
    console.log("done! ");

    // ***** Send tx with new key

    const threeUserOpCallData = safeECDSAPlugin.interface.encodeFunctionData(
        "execTransaction",
        [recipientAddress, transferAmount, "0x00"]
    );

    const threeUnsignedUserOperation: UserOperationStruct = {
        sender: deployedAddress,
        nonce: "0x2",
        initCode: "0x",
        callData: threeUserOpCallData,
        verificationGasLimit: 1e6,
        callGasLimit: 1e6,
        preVerificationGas: 1e6,
        maxFeePerGas,
        maxPriorityFeePerGas,
        paymasterAndData: "0x",
        signature: "",
    };

    const threeResolvedUserOp = await ethers.resolveProperties(
        threeUnsignedUserOperation
    );

    const threeUserOpHash = getUserOpHash(
        threeResolvedUserOp,
        ENTRYPOINT_ADDRESS,
        Number((await provider.getNetwork()).chainId)
    );

    const threeUserOpSignature = await newSigner.signMessage(getBytes(threeUserOpHash));

    const threeUserOperation = {
        ...threeUnsignedUserOperation,
        signature: threeUserOpSignature,
    };

    const threerecipientBalanceBefore = await provider.getBalance(recipientAddress);

    try {
        const rcpt = await entryPoint.handleOps(
            // @ts-ignore
            [threeUserOperation],
            ENTRYPOINT_ADDRESS
        );
    } catch (e) {
        console.log("EntryPoint handleOps error=", e);
    }

    const threerecipientBalanceAfter = await provider.getBalance(recipientAddress);
    const threeexpectedRecipientBalance = threerecipientBalanceBefore + transferAmount;

    expect(threerecipientBalanceAfter).to.equal(threeexpectedRecipientBalance);

  });
});

// async function execSafeTransaction(
//     safe: Safe,
//     { to, data, value = 0 }: TransactionRequest,
//     signer: SignerWithAddress
//   ) {
//     const address = await safe.getAddress()
//     const chainId = await safe.getChainId()
//     const nonce = await safe.nonce()
  
//     const { domain, types, message } = paramsToSign(
//       address,
//       chainId,
//       { to, data, value },
//       nonce
//     )
  
//     const signature = await signer.signTypedData(domain, types, message)
  
//     return safe.execTransaction(
//       to as string,
//       value as number | bigint,
//       data as string,
//       0, // operation
//       0,
//       0,
//       0,
//       ZeroAddress,
//       ZeroAddress,
//       signature
//     )
//   }
