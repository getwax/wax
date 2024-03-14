import { readFile } from "fs/promises";
import { generateCircuitInputs } from "@zk-email/helpers";
import { verifyDKIMSignature } from "@zk-email/helpers/dist/dkim";
import path from "path";
import * as snarkjs from "snarkjs";
// @ts-ignore TODO Use artifact from package
import buildCalculator from "../lib/ether-email-auth/packages/circuits/build/email_auth_js/witness_calculator.js";
import { ContractProof, Groth16Proof } from "./types";

/**
 * Calulates the merkle witness needed to generate the proof
 */
interface WitnessCalculator {
  calculateWTNSBin(inputs: Record<string, unknown>, sanityCheck: number): Promise<unknown>;
}

/**
 * Client which can prove & verify the EmailRecovery circuit,
 */
export class EmailRecoveryClient {
  static readonly zkRoot = path.join(__dirname, "../lib/ether-email-auth/packages/circuits/build");
  static readonly circuitName = "email_auth";
  // TODO Ideally we would just get these zk artifacts from the npm package of ether-email-auth
  static readonly wasmFilePath = path.join(
    this.zkRoot, `${this.circuitName}_js/${this.circuitName}.wasm`);
  // TODO These are currently not generated in ether-email-auth
  static readonly zkeyFilePath = path.join(
    this.zkRoot, `zkeys/${this.circuitName}.zkey`);
  static readonly vkeyFilePath = path.join(
    this.zkRoot, `vkeys/${this.circuitName}.json`);

  /**
   * Use create instead
   */
  protected constructor(
    protected readonly calculator: WitnessCalculator,
    protected readonly zkey: Buffer,
    protected readonly vkey: Record<string, unknown>,
  ) {}

  /**
   * Creates client object
   */
  static async create(): Promise<EmailRecoveryClient> {
    // Gets zk files for circuit
    const [wasm, zkey, vkeyBuf] = await Promise.all([
      readFile(this.wasmFilePath),
      readFile(this.zkeyFilePath),
      readFile(this.vkeyFilePath),
    ]);

    // Build neededed zk constructs
    const calculator = await buildCalculator(wasm);
    const vkey = JSON.parse(vkeyBuf.toString());

    return new EmailRecoveryClient(calculator, zkey, vkey);
  }

  /**
   * Generates proof
   *
   * @param TODO
   * @returns Proof for local verification & proof for use in contract generated off circuit
   */
  public async prove(rawEmail: string): Promise<{
    grothProof: Groth16Proof, contractProof: ContractProof
  }> {
    const dkimResult = await verifyDKIMSignature(Buffer.from(rawEmail));
    // const parsedEmail = await emailWalletUtils.parseEmail(rawEmail);
    
    const emailInputs = generateCircuitInputs({
      rsaSignature: dkimResult.signature, // The RSA signature of the email
      rsaPublicKey: dkimResult.publicKey, // The RSA public key used for verification
      body: dkimResult.body, // body of the email
      bodyHash: dkimResult.bodyHash, // hash of the email body
      // body: Buffer.from(""),
      // bodyHash: "",
      message: dkimResult.message, // the message that was signed (header + bodyHash)
      // TODO Check that these are correct values
      maxMessageLength: 1024, // Maximum allowed length of the message in circuit
      maxBodyLength: 1024, // Maximum allowed length of the body in circuit
      ignoreBodyHashCheck: true, // To be used when ignore_body_hash_check is true in circuit
    });

    // TODO Get these from a published utils package or somewhere else
    // const senderEmailIdxes = emailWalletUtils.extractFromAddrIdxes(parsedEmail.canonicalizedHeader)[0];
    // const fromEmailAddrPart = parsedEmail.canonicalizedHeader.slice(senderEmailIdxes[0], senderEmailIdxes[1]);
    // const domainIdx = emailWalletUtils.extractEmailDomainIdxes(fromEmailAddrPart)[0][0];
    // const subjectEmailIdxes = emailWalletUtils.extractSubjectAllIdxes(parsedEmail.canonicalizedHeader)[0];
    // const subject = parsedEmail.canonicalizedHeader.slice(subjectEmailIdxes[0], subjectEmailIdxes[1]);

    const inputs = {
      ...emailInputs,
    };
    console.log("inputs", inputs);

    const wtns = await this.calculator.calculateWTNSBin(inputs, 0);
    const { proof } = await snarkjs.groth16.prove(this.zkey, wtns);

    return {
      grothProof: proof,
      contractProof: this.grothToContractProof(proof)
    };
  }

  /**
   * Verifies proof
   *
   * @param proof proof generated from client
   * @returns whether the proof is valid for a given UserOp
   */
  public async verify(proof: Groth16Proof): Promise<boolean> {
    const publicSignals: [] = []; // TODO Update w/ subject, masked sender
    return snarkjs.groth16.verify(this.vkey, publicSignals, proof);
  }

  private grothToContractProof(proof: Groth16Proof): ContractProof {
    /*
     * Prevent reverse from modifying original proof.
     * Ideally we would use Array.toReversed,
     * but it is in NodeJS >= 20.
     */
    const proofCopy = structuredClone(proof);
    return {
      a: [proofCopy.pi_a[0], proofCopy.pi_a[1]],
      b: [
        proofCopy.pi_b[0].reverse() as [string, string],
        proofCopy.pi_b[1].reverse() as [string, string],
      ],
      c: [proofCopy.pi_c[0], proofCopy.pi_c[1]],
    };
  }
}
