import { AbiCoder } from "ethers";
import { readFile } from "fs/promises";
import path from "path";
import { Groth16Proof, ZKArtifact, groth16 } from "snarkjs";
// TS does not like locally generated JS files. Not sure how else to do this.
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import buildCalculator from "../zk/circuits/ERC4337PasswordVerifier_js/witness_calculator";
import { ContractProof } from "./types";

const abiEncodedProofTypes = ["uint256[2]", "uint256[2][2]", "uint256[2]"];

/**
 * Calulates the merkle witness needed to generate the proof
 */
interface WitnessCalculator {
  calculateWTNSBin(inputs: Record<string, unknown>, sanityCheck: number): Promise<ZKArtifact>;
}

/**
 * Client which can prove & verify the ERC4337PasswordVerifier circuit,
 * as well as prove a ERC-4337 UserOp.
 */
export class ERC4337ZKPPasswordClient {
  static readonly zkRoot = path.join(__dirname, "../zk");
  static readonly circuitName = "ERC4337PasswordVerifier";
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
  static async create(): Promise<ERC4337ZKPPasswordClient> {
    // Gets zk files for circuit
    const [wasm, zkey, vkeyBuf] = await Promise.all([
      readFile(this.wasmFilePath),
      readFile(this.zkeyFilePath),
      readFile(this.vkeyFilePath),
    ]);

    // Build neededed zk constructs
    const calculator = await buildCalculator(wasm);
    const vkey = JSON.parse(vkeyBuf.toString());

    return new ERC4337ZKPPasswordClient(calculator, zkey, vkey);
  }

  /**
   * Generates proof
   *
   * @param password password set in circuit
   * @param userOpHash hash of the UserOp to prove
   * @returns Proof for local verification & proof for use in contract generated off circuit
   */
  public async prove(password: string, userOpHash: string): Promise<{
    grothProof: Groth16Proof, contractProof: ContractProof
  }> {
    const inputs = {
      password: this.strToBytes(password),
      userOpHash: BigInt(userOpHash),
    };

    const wtns = await this.calculator.calculateWTNSBin(inputs, 0);
    const { proof } = await groth16.prove(this.zkey, wtns);

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
  public async verify(proof: Groth16Proof, userOpHash: string): Promise<boolean> {
    const publicSignals = [`${BigInt(userOpHash)}`];
    return groth16.verify(this.vkey, publicSignals, proof);
  }

  /**
   * Generates a proof as an ABI encoded sigature for use in an unsigned UserOp
   *
   * @param password password set in circuit
   * @param userOpHash hash of the UserOp to prove
   * @returns ABI encoded proof as signature & contract proof
   */
  public async proveUserOp(password: string, userOpHash: string): Promise<{
    signature: string, proof: ContractProof,
  }> {
    const { contractProof } = await this.prove(password, userOpHash);
    const { a, b, c } = contractProof;
    return {
      signature: AbiCoder.defaultAbiCoder()
        .encode(abiEncodedProofTypes, [a, b, c]),
      proof: contractProof,
    };
  }

  /**
   * Decodes UserOp signature to contract proof
   *
   * @param signature UserOp signature
   * @returns contract proof
   */
  public decodeUserOpSig(signature: string): ContractProof {
    const [a, b, c] = AbiCoder.defaultAbiCoder().decode(
      abiEncodedProofTypes, signature
    );
    return { a, b, c };
  }

  private strToBytes(str: string): bigint[] {
    const strBytes = new Uint8Array(str.length);
    const encoder = new TextEncoder();
    encoder.encodeInto(str, strBytes);
    return Array.from(strBytes).map((b) => BigInt(b));
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
