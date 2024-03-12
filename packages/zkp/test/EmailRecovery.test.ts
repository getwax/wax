import { expect } from "chai";
import fs from "fs";
import path from "path";
import { EmailRecoveryClient } from "../src";

describe("EmailRecovery", function () {
  let rawEmail: string;

  let client: EmailRecoveryClient;

  beforeEach(async () => {
    client = await EmailRecoveryClient.create();
    rawEmail = fs.readFileSync(
      path.join(__dirname, "./data/recovery-email.eml"),
      "utf8"
    );
  });

  // TODO Add chai-as-promised
  it.only("generates email proof & verifies", async function () {
    console.log("starting email proof generation...");
    const { grothProof } = await client.prove(rawEmail);
    console.log("groth proof", grothProof);
    // TODO This fails, figure out why
    expect(await client.verify(grothProof)).to.be.true;
  })
});
