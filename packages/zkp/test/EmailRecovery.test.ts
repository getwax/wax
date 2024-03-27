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
    console.time("proof generation time");
    const chainid = 0;
    const { grothProof } = await client.prove(rawEmail, chainid);
    console.log("groth proof", grothProof);
    console.timeEnd("proof generation time");
    // TODO This fails, figure out why
    expect(await client.verify(grothProof, chainid)).to.be.true;
  })
});
