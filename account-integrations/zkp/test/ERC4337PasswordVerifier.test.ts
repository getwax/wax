import { expect } from "chai";
import { ERC4337ZKPPasswordClient } from "../src";

const emojiPassword = "👻🎃🕸🦇🕷🪦";
// keccak256(0)
const userOpHash0 =
  "0x044852b2a670ade5407e78fb2863c51de9fcb96542a07186fe3aeda6bb8a116d";
// keccak256(1)
const userOpHash1 =
  "0xc89efdaa54c0f20c7adf612882df0950f5a951637e0307cdcb4c672f298b8bc6";

describe("ERC4337PasswordVerifier", () => {
  let client: ERC4337ZKPPasswordClient;

  beforeEach(async function () {
    client = await ERC4337ZKPPasswordClient.create();
  });

  // TODO Add chai-as-promised
  it.skip("fails to verify proof with incorrect password", async function () {
    const badPassword = "🪦🪦🪦🪦🪦🪦";
    const { grothProof } = await client.prove(badPassword, userOpHash0);
    expect(await client.verify(grothProof, userOpHash0)).to.throw;
  });

  it("fails to verify proof with incorrect UserOp hash", async function () {
    const { grothProof } = await client.prove(emojiPassword, userOpHash0);
    expect(await client.verify(grothProof, userOpHash1)).to.be.false;
  });

  it("should verify proof with correct password and UserOp hash", async function () {
    const { grothProof } = await client.prove(emojiPassword, userOpHash0);
    expect(await client.verify(grothProof, userOpHash0)).to.be.true;
  });

  // TODO Fix, ethers.js Result type throws off deep equal
  // Likely need to convert in client
  it.skip("correctly encodes/decodes userOp signature", async function () {
    const { signature, proof } = await client.proveUserOp(emojiPassword, userOpHash0);
    const decodedSignature = client.decodeUserOpSig(signature);

    expect(decodedSignature).to.deep.equal(proof);
  })
});
