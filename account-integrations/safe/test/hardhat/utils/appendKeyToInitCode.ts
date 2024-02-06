import { solG2 } from "@thehubbleproject/bls/dist/mcl";
import { ethers } from "ethers";

/**
 * Appends the public key to the init code.
 *
 * In handleAggregatedOps, the EntryPoint has the aggregator check the bundle
 * before any accounts are created via initCode. This means the aggregator needs
 * a way to know the public key of the account without it being deployed, and it
 * uses the last 4 words of the initCode to do this:
 * https://github.com/eth-infinitism/account-abstraction/blob/v0.6.0/contracts/samples/bls/BLSSignatureAggregator.sol#L22-L34
 *
 * Usually this could be sensibly built into the account's regular initCode
 * because it's a necessary ingredient of creating the account, but because
 * we're using safe plugins, the public key is in the separately-created safe
 * plugin and the account is tied to it via the safe plugin's address.
 *
 * We can work around this by simply appending the public key to the regular
 * initCode, because the solidity ABI generally ignores extraneous data.
 *
 * A key ingredient for making this secure is that, once created, our account
 * will check that the trailing bytes of the initCode (if present), matches its
 * public key. Otherwise, because our account's address doesn't depend on these
 * trailing bytes an attacker could instantiate our account on another network
 * together with a malicious first operation of their choosing. They would
 * simply generate their own bls key pair and modify our first user-op from
 * another network, replacing the trailing bytes of the initCode with their
 * public key, changing the calldata to perform an operation of their choice,
 * and updating the signature. This means any assets transferred to us on
 * a network we haven't started using could be stolen.
 */
export default function appendKeyToInitCode(
  initCode: string,
  blsPublicKey: solG2,
) {
  return (
    initCode +
    ethers.AbiCoder.defaultAbiCoder()
      .encode(["uint256[4]"], [blsPublicKey])
      .slice(2)
  );
}
