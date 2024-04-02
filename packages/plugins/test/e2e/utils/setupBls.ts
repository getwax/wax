import { getBytes, keccak256, parseEther } from "ethers";
import { signer as hubbleBlsSigner } from "@thehubbleproject/bls";

import DeterministicDeployer from "../../../lib-ts/deterministic-deployer/DeterministicDeployer";
import {
  BLSOpen__factory,
  BLSSignatureAggregator__factory,
} from "../../../typechain-types";
import receiptOf from "./receiptOf";

export default async function setupBls(
  deployer: DeterministicDeployer,
  entryPointAddress: string,
  blsPrivateKey: string,
) {
  const blsOpen = await deployer.connectOrDeploy(BLSOpen__factory, []);

  const blsSignatureAggregator = await deployer.connectOrDeploy(
    DeterministicDeployer.link(BLSSignatureAggregator__factory, [
      {
        "lib/account-abstraction/contracts/samples/bls/lib/BLSOpen.sol:BLSOpen":
          await blsOpen.getAddress(),
      },
    ]),
    [entryPointAddress],
  );

  await receiptOf(
    blsSignatureAggregator.addStake(100n * 86_400n, {
      value: parseEther("1"),
    }),
  );

  const domain = getBytes(keccak256(Buffer.from("eip4337.bls.domain")));
  const signerFactory = await hubbleBlsSigner.BlsSignerFactory.new();
  const blsSigner = signerFactory.getSigner(domain, blsPrivateKey);

  return { blsSignatureAggregator, blsSigner };
}
