import { readFile } from "fs/promises";
import { generateCircuitInputs } from "@zk-email/helpers";
import { verifyDKIMSignature } from "@zk-email/helpers/dist/dkim";
import path from "path";
import * as snarkjs from "snarkjs";
import buildCalculator from "../zk/circuits/EmailRecovery_js/witness_calculator";
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
  static readonly zkRoot = path.join(__dirname, "../zk");
  static readonly circuitName = "EmailRecovery";
  static readonly wasmFilePath = path.join(
    this.zkRoot, `circuits/${this.circuitName}_js/${this.circuitName}.wasm`);
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
    
    const inputs = generateCircuitInputs({
      rsaSignature: dkimResult.signature, // The RSA signature of the email
      rsaPublicKey: dkimResult.publicKey, // The RSA public key used for verification
      body: dkimResult.body, // body of the email 
      bodyHash: dkimResult.bodyHash, // hash of the email body
      message: dkimResult.message, // the message that was signed (header + bodyHash)
      // TODO Check that these are correct values
      maxMessageLength: 1024, // Maximum allowed length of the message in circuit
      maxBodyLength: 1024, // Maximum allowed length of the body in circuit
      ignoreBodyHashCheck: true, // To be used when ignore_body_hash_check is true in circuit
    });

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
   * @param userOpHash hash of the UserOp to verify
   * @returns whether the proof is valid for a given UserOp
   */
  public async verify(proof: Groth16Proof): Promise<boolean> {
    const publicSignals = [BigInt(0)]; // TODO Update
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
