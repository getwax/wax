// SPDX-License-Identifier: MIT

pragma solidity >=0.8.4 <0.9.0;

import "kernel/src/validator/IValidator.sol";
import "openzeppelin-contracts/contracts/utils/cryptography/EIP712.sol";
import "kernel/src/utils/KernelHelper.sol";
import "account-abstraction/contracts/samples/bls/lib/hubble-contracts/contracts/libs/BLS.sol";

// BLSValidator is a validator that uses BLS signatures to validate transactions.
// TODO: Consider account recovery, aggregate signatures, and use EIP 712.
// Note: This is not audited and should not be used in production.
contract BLSValidator is IKernelValidator {
    bytes32 public constant BLS_DOMAIN = keccak256("eip4337.bls.domain");
    
    event OwnerChanged(address indexed kernel, uint256[4] indexed oldPublicKey, uint256[4] indexed newPublicKey);

    mapping(address => uint256[4]) public blsValidatorStorage;

    function disable(bytes calldata) external override {
        delete blsValidatorStorage[msg.sender];
    }

    function enable(bytes calldata _data) external override {
        require(_data.length >= 128, "Calldata is not long enough for bls public key");

        uint256[4] memory publicKey = abi.decode(_data, (uint256[4]));
        uint256[4] memory oldPublicKey = blsValidatorStorage[msg.sender];
        blsValidatorStorage[msg.sender] = publicKey;

        emit OwnerChanged(msg.sender, oldPublicKey, publicKey);
    }

    function validateUserOp(UserOperation calldata _userOp, bytes32 _userOpHash, uint256)
        external
        view
        override
        returns (uint256 validationData)
    {
        require(_userOp.signature.length == 64, "BLS Validator: Sig bytes length must be 64");

        uint256[2] memory decodedSignature = abi.decode(_userOp.signature, (uint256[2]));
        uint256[4] memory publicKey = blsValidatorStorage[_userOp.sender];

        require(publicKey[0] != 0, "BLS Validator: Public key not set");

        bytes memory hashBytes = abi.encodePacked(_userOpHash);
        uint256[2] memory message = BLS.hashToPoint(
            BLS_DOMAIN,
            hashBytes
        );
        (bool verified, bool callSuccess) = BLS.verifySingle(decodedSignature, publicKey, message);

        if (verified && callSuccess) {
            return 0;
        }
        // TODO: check if wallet recovered
        return SIG_VALIDATION_FAILED;
    }


    function validateSignature(bytes32 hash, bytes calldata signature) public view override returns (uint256) {
        require(signature.length == 64, "VG: Sig bytes length must be 64");

        uint256[4] memory publicKey = blsValidatorStorage[msg.sender];
        uint256[2] memory decodedSignature = abi.decode(signature, (uint256[2]));

        bytes memory hashBytes = abi.encodePacked(hash);
        uint256[2] memory message = BLS.hashToPoint(
            BLS_DOMAIN,
            hashBytes
        );
        (bool verified, bool callSuccess) = BLS.verifySingle(decodedSignature, publicKey, message);

        if (verified && callSuccess) {
            return 0;
        }
        // TODO: check if wallet recovered
        return SIG_VALIDATION_FAILED;
    }
}
