# Anon Aadhaar Contracts

These contracts are copied from https://github.com/anon-aadhaar/anon-aadhaar/tree/main/packages/contracts @ `v2.2.0`. This has been done for 2 reasons:
- `AnonAadhaarVerifier.sol` needed to be modified to use gas opcodes that work within the [validation cycle gas opcode limitations for ERC-4337 (OP-012)](https://eips.ethereum.org/EIPS/eip-7562#opcode-rules).
- Using the `@anon-aadhaar/contracts` npm package's contract interfaces causes issues with Typechain generation in this project.