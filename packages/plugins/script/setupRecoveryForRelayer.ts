import { expect } from "chai";
import { JsonRpcProvider, NonceManager, Signer, ethers } from "ethers";
import SafeSingletonFactory from "../test/e2e/utils/SafeSingletonFactory";
import { createAndSendUserOpWithEcdsaSig } from "../test/e2e/utils/createUserOp";
import { executeContractCallWithSigners } from "../test/e2e/utils/execution";
import receiptOf from "../test/e2e/utils/receiptOf";
import { setupTests } from "../test/e2e/utils/setupTests";
import {
  Safe,
  MockDKIMRegsitry,
  SafeZkEmailRecoveryPlugin,
  SafeECDSAFactory__factory,
  MockGroth16Verifier__factory,
  MockDKIMRegsitry__factory,
  SafeZkEmailRecoveryPlugin__factory,
  Safe__factory,
  SafeECDSAPlugin__factory,
} from "../typechain-types";
import { getSigners } from "../test/e2e/utils/getSigners";

async function setupRecoveryForRelayer() {
  let bundlerProvider: JsonRpcProvider;
  let provider: JsonRpcProvider;
  let admin: NonceManager;
  let otherAccount: Signer;
  let entryPointAddress: string;
  let safeSingleton: Safe;
  let mockDkimRegistry: MockDKIMRegsitry;
  let ssf: SafeSingletonFactory;

  let safeProxyAddress: string;
  let recoveryPlugin: SafeZkEmailRecoveryPlugin;

  const setup = await setupTests();
  ({
    provider,
    bundlerProvider,
    admin,
    otherAccount,
    entryPointAddress,
    ssf,
    safeSingleton,
  } = setup);

  const [, signer, otherSigner, otherOtherSigner] = getSigners();

  const safeECDSAFactory = await ssf.connectOrDeploy(
    SafeECDSAFactory__factory,
    [],
  );
  await safeECDSAFactory.waitForDeployment();

  const createArgs = [
    safeSingleton,
    entryPointAddress,
    await otherAccount.getAddress(),
    0,
  ] satisfies Parameters<typeof safeECDSAFactory.create.staticCall>;

  safeProxyAddress = await safeECDSAFactory.create.staticCall(...createArgs);

  await receiptOf(safeECDSAFactory.create(...createArgs));

  // Native tokens for the pre-fund
  await receiptOf(
    admin.sendTransaction({
      to: safeProxyAddress,
      value: ethers.parseEther("10"),
    }),
  );

  const mockGroth16Verifier = await ssf.connectOrDeploy(
    MockGroth16Verifier__factory,
    [],
  );

  const defaultDkimRegistry = await ssf.connectOrDeploy(
    MockDKIMRegsitry__factory,
    [],
  );
  const mockGroth16VerifierAddress = await mockGroth16Verifier.getAddress();
  const defaultDkimRegistryAddress = await defaultDkimRegistry.getAddress();

  mockDkimRegistry = await ssf.connectOrDeploy(MockDKIMRegsitry__factory, []);

  recoveryPlugin = await ssf.connectOrDeploy(
    SafeZkEmailRecoveryPlugin__factory,
    [mockGroth16VerifierAddress, defaultDkimRegistryAddress],
  );

  const recoveryPluginAddress = await recoveryPlugin.getAddress();
  const ownerAddress = await otherAccount.getAddress();
  const safe = Safe__factory.connect(safeProxyAddress, otherAccount);

  // Enable recovery plugin
  await receiptOf(
    executeContractCallWithSigners(
      safe,
      safe,
      "enableModule",
      [recoveryPluginAddress],
      // @ts-expect-error owner doesn't have all properties for some reason
      [otherAccount],
    ),
  );

  // Construct userOp to add recovery account
  const chainId = (await provider.getNetwork()).chainId;

  const email = ethers.keccak256(ethers.toUtf8Bytes("test2@mail.com"));
  const salt = "test salt";

  const recoveryhashDomain = ethers.solidityPackedKeccak256(
    ["string", "uint256", "uint256", "address"],
    ["RECOVERY_PLUGIN", 1, chainId, recoveryPluginAddress],
  );

  const recoveryHash = ethers.solidityPackedKeccak256(
    ["bytes32", "bytes32", "string"],
    [recoveryhashDomain, email, salt],
  );

  const safeProxyWithEcdsaPluginInterface = SafeECDSAPlugin__factory.connect(
    safeProxyAddress,
    provider,
  );
  const safeECDSAPluginAddress =
    await safeProxyWithEcdsaPluginInterface.myAddress();

  // Generated via openssl
  // Note: The actual DKIM registry hash may be dervied from splitting the DKIM public
  // key into 17 chunks of 121 bits.
  const dkimPublicKey =
    "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxES3RTDdoDUcyrIFzApJx9Vkd89Sma86iSHn8Uz" +
    "QRevFI69jNRSuqkOZfQQ0h+fK+Fh7DNz8QznLpSh6QBjOHEAfZVj/+eK1L4sbkULOSEvy1njCb7U+gkQ3D6" +
    "0j35pKBefd1gkDoH5V/2E2qnld89ECwTaklWLrTYLAgHfSAj/A01JDQpvxCRneFNHHaZG+8LbPi2wZKgwmb" +
    "97HWyPu9KokiKrnYg6tfQzLFVj5PqDRoqv4QCv9B/mXcnIRALSV0BPuLKBF4rsCEo0+FoYrcjbF+LIZzOw/" +
    "cPbOCPGTXJPh0rDZjgpLO7l+A+hRxaqh4OLd+DrinY7VjPhcKo57dwIDAQAB";
  const dkimPublicKeyHash = ethers.solidityPackedKeccak256(
    ["string"],
    [dkimPublicKey],
  );
  const dkimRegistryAddress = await mockDkimRegistry.getAddress();
  const zeroSeconds = 0;

  const configureRecoveryCalldata = recoveryPlugin.interface.encodeFunctionData(
    "configureRecovery",
    [
      safeECDSAPluginAddress,
      ownerAddress,
      recoveryHash,
      dkimPublicKeyHash,
      dkimRegistryAddress,
      zeroSeconds,
    ],
  );

  let safeEcdsaPlugin = SafeECDSAPlugin__factory.connect(
    safeProxyAddress,
    otherAccount,
  );

  let userOpCallData = safeEcdsaPlugin.interface.encodeFunctionData(
    "execTransaction",
    [await recoveryPlugin.getAddress(), "0x00", configureRecoveryCalldata],
  );

  const initCode = "0x";
  const dummySignature = await otherAccount.signMessage("dummy sig");

  // Send userOp to add recovery account
  await createAndSendUserOpWithEcdsaSig(
    provider,
    bundlerProvider,
    otherAccount,
    safeProxyAddress,
    initCode,
    userOpCallData,
    entryPointAddress,
    dummySignature,
  );

  const recoveryRequest =
    await recoveryPlugin.recoveryRequests(safeProxyAddress);
  expect(recoveryRequest[0]).to.equal(recoveryHash);
  expect(recoveryRequest[1]).to.equal(dkimPublicKeyHash);

  // Construct tx to reset ecdsa address
  const newEcdsaPluginSigner = new NonceManager(otherOtherSigner);
  await receiptOf(
    await admin.sendTransaction({
      to: await newEcdsaPluginSigner.getAddress(),
      value: ethers.parseEther("1"),
    }),
  );

  // set custom delay
  const oneSecond = 1;
  await receiptOf(
    executeContractCallWithSigners(
      safe,
      recoveryPlugin,
      "setRecoveryDelay",
      [oneSecond],
      // @ts-expect-error otherAccount doesn't have all properties for some reason
      [otherAccount],
    ),
  );

  console.log("safeProxyAddress:", safeProxyAddress);
  console.log("newOwnerAddress:", await newEcdsaPluginSigner.getAddress());
  console.log("recoveryPluginAddress:", recoveryPluginAddress);
}

setupRecoveryForRelayer().catch((error: Error) => {
  console.error(error);
  process.exitCode = 1;
});
