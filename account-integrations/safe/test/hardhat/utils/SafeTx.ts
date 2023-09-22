import { ethers } from "ethers";
import { Safe__factory } from "../../../typechain-types";

const SAFE_TX_TYPEHASH = ethers.keccak256(
  new TextEncoder().encode(
    [
      "SafeTx(address to,uint256 value,bytes data,uint8 operation,",
      "uint256 safeTxGas,uint256 baseGas,uint256 gasPrice,address gasToken,",
      "address refundReceiver,uint256 nonce)",
    ].join(""),
  ),
);

const DOMAIN_SEPARATOR_TYPEHASH = ethers.keccak256(
  new TextEncoder().encode(
    "EIP712Domain(uint256 chainId,address verifyingContract)",
  ),
);

export default class SafeTx {
  signatures: string[] = [];

  constructor(
    public chainId: bigint,
    public safeAddress: string,
    public to: string,
    public value: bigint,
    public data: string,
    public operation: 0 | 1,
    public safeTxGas: bigint,
    public baseGas: bigint,
    public gasPrice: bigint,
    public gasToken: string,
    public refundReceiver: string,
    public nonce: bigint,
  ) {}

  encode(): string {
    const safeTxHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        [
          "bytes32",
          "address",
          "uint256",
          "bytes32",
          "uint8",
          "uint256",
          "uint256",
          "uint256",
          "address",
          "address",
          "uint256",
        ],
        [
          SAFE_TX_TYPEHASH,
          this.to,
          this.value,
          ethers.keccak256(this.data),
          this.operation,
          this.safeTxGas,
          this.baseGas,
          this.gasPrice,
          this.gasToken,
          this.refundReceiver,
          this.nonce,
        ],
      ),
    );

    const domainSeparator = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "uint256", "address"],
        [DOMAIN_SEPARATOR_TYPEHASH, this.chainId, this.safeAddress],
      ),
    );

    return ethers.solidityPacked(
      ["bytes1", "bytes1", "bytes32", "bytes32"],
      ["0x19", "0x01", domainSeparator, safeTxHash],
    );
  }

  async sign(signer: ethers.Signer) {
    const txHash = ethers.keccak256(this.encode());
    let sig = await signer.signMessage(ethers.getBytes(txHash));

    const v = Number(`0x${sig.slice(130)}`);
    const vAdj = v + 4;

    sig = `${sig.slice(0, 130)}${vAdj.toString(16)}`;

    return sig;
  }

  async exec(runner: ethers.Signer) {
    const safe = Safe__factory.connect(this.safeAddress, runner);

    const threshold = await safe.getThreshold();

    if (this.signatures.length < threshold) {
      throw new Error(
        [
          "Not enough signatures",
          `(have: ${this.signatures.length},`,
          `need: ${threshold})`,
        ].join(" "),
      );
    }

    return await safe.execTransaction(
      this.to,
      this.value,
      this.data,
      this.operation,
      this.safeTxGas,
      this.baseGas,
      this.gasPrice,
      this.gasToken,
      this.refundReceiver,
      ethers.concat(this.signatures),
    );
  }
}
