// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {BaseAccount} from "account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint, UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {BLS} from "account-abstraction/contracts/samples/bls/lib/hubble-contracts/contracts/libs/BLS.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
}

error IncorrectSignatureLength(uint256 length);

contract SafeBlsPlugin is BaseAccount {
    // TODO: Use EIP 712 for domain separation
    bytes32 public constant BLS_DOMAIN = keccak256("eip4337.bls.domain");
    address public immutable myAddress;
    uint256[4] private _blsPublicKey;
    address private immutable _entryPoint;

    address internal constant _SENTINEL_MODULES = address(0x1);

    error NONCE_NOT_SEQUENTIAL();

    constructor(address entryPointAddress, uint256[4] memory blsPublicKey) {
        myAddress = address(this);
        _blsPublicKey = blsPublicKey;
        _entryPoint = entryPointAddress;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        _validateNonce(userOp.nonce);
        validationData = _validateSignature(userOp, userOpHash);
        _payPrefund(missingAccountFunds);
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable {
        address payable safeAddress = payable(msg.sender);
        ISafe safe = ISafe(safeAddress);
        require(
            safe.execTransactionFromModule(to, value, data, 0),
            "tx failed"
        );
    }

    function enableMyself() public {
        ISafe(address(this)).enableModule(myAddress);
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    function owner() public pure returns (uint256[4] memory _blsPublicKey) {
        return _blsPublicKey;
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        if (userOp.signature.length != 64) {
            revert IncorrectSignatureLength(userOp.signature.length);
        }

        uint256[2] memory decodedSignature = abi.decode(userOp.signature, (uint256[2]));

        bytes memory hashBytes = abi.encodePacked(userOpHash);
        uint256[2] memory message = BLS.hashToPoint(
            BLS_DOMAIN,
            hashBytes
        );
        (bool verified, bool callSuccess) = BLS.verifySingle(decodedSignature, _blsPublicKey, message);

        if (verified && callSuccess) {
            return 0;
        }
        // TODO: check if wallet recovered
        return SIG_VALIDATION_FAILED;
    }

    /**
     * Ensures userOp nonce is sequential. Nonce uniqueness is already managed by the EntryPoint.
     * This function prevents using a “key” different from the first “zero” key.
     * @param nonce to validate
     */
    function _validateNonce(uint256 nonce) internal view override {
        if (nonce >= type(uint64).max) {
            revert NONCE_NOT_SEQUENTIAL();
        }
    }

    /**
     * This function is overridden as this plugin does not hold funds, so the transaction
     * has to be executed from the sender Safe
     * @param missingAccountFunds The minimum value this method should send to the entrypoint
     */
    function _payPrefund(uint256 missingAccountFunds) internal override {
        address payable safeAddress = payable(msg.sender);
        ISafe senderSafe = ISafe(safeAddress);

        if (missingAccountFunds != 0) {
            senderSafe.execTransactionFromModule(
                _entryPoint,
                missingAccountFunds,
                "",
                0
            );
        }
    }
}