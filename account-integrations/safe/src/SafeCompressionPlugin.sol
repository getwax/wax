// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";

import {HandlerContext} from "safe-contracts/contracts/handler/HandlerContext.sol";

import {BaseAccount} from "account-abstraction/contracts/core/BaseAccount.sol";
import {UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {WaxLib as W} from "./compression/WaxLib.sol";
import {IDecompressor} from "./compression/decompressors/IDecompressor.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
}

struct ECDSAOwnerStorage {
    address owner;
}

contract SafeCompressionPlugin is HandlerContext {
    using ECDSA for bytes32;

    uint256 constant internal SIG_VALIDATION_FAILED = 1;

    mapping(address => ECDSAOwnerStorage) public ecdsaOwnerStorage;
    address public immutable myAddress;
    address private immutable entryPoint;
    IDecompressor public decompressor;

    address internal constant _SENTINEL_MODULES = address(0x1);

    error NONCE_NOT_SEQUENTIAL();
    event OWNER_UPDATED(address indexed safe, address indexed oldOwner, address indexed newOwner);

    constructor(address entryPointParam, IDecompressor decompressorParam) {
        myAddress = address(this);
        entryPoint = entryPointParam;
        decompressor = decompressorParam;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData) {
        _validateNonce(userOp.nonce);
        validationData = _validateSignature(userOp, userOpHash);
        _payPrefund(missingAccountFunds);
    }

    function decompressAndPerform(
        bytes calldata stream
    ) public fromThisOrEntryPoint {
        (W.Action[] memory actions,) = decompressor.decompress(stream);

        ISafe safe = ISafe(msg.sender);

        for (uint256 i = 0; i < actions.length; i++) {
            W.Action memory a = actions[i];

            require(
                safe.execTransactionFromModule(a.to, a.value, a.data, 0),
                "tx failed"
            );
        }
    }

    function setDecompressor(
        IDecompressor decompressorParam
    ) public fromThisOrEntryPoint {
        decompressor = decompressorParam;
    }

    function enableMyself(address ownerKey) public {
        ISafe(address(this)).enableModule(myAddress);

        // Enable the safe address with the defined key
        bytes memory _data = abi.encodePacked(ownerKey);
        SafeCompressionPlugin(myAddress).enable(_data);
    }

    function enable(bytes calldata _data) external payable {
        address newOwner = address(bytes20(_data[0:20]));
        address oldOwner = ecdsaOwnerStorage[msg.sender].owner;
        ecdsaOwnerStorage[msg.sender].owner = newOwner;
        emit OWNER_UPDATED(msg.sender, oldOwner, newOwner);
    }

    modifier fromThisOrEntryPoint() {
        require(
            _msgSender() == entryPoint ||
            _msgSender() == address(this)
        );
        _;
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view returns (uint256 validationData) {
        address keyOwner = ecdsaOwnerStorage[msg.sender].owner;
        bytes32 hash = userOpHash.toEthSignedMessageHash();
        if (keyOwner != hash.recover(userOp.signature))
            return SIG_VALIDATION_FAILED;
        return 0;
    }

    /**
     * Ensures userOp nonce is sequential. Nonce uniqueness is already managed by the EntryPoint.
     * This function prevents using a “key” different from the first “zero” key.
     * @param nonce to validate
     */
    function _validateNonce(uint256 nonce) internal pure {
        if (nonce >= type(uint64).max) {
            revert NONCE_NOT_SEQUENTIAL();
        }
    }

    /**
     * This function is overridden as this plugin does not hold funds, so the transaction
     * has to be executed from the sender Safe
     * @param missingAccountFunds The minimum value this method should send to the entrypoint
     */
    function _payPrefund(uint256 missingAccountFunds) internal {
        address payable safeAddress = payable(msg.sender);
        ISafe senderSafe = ISafe(safeAddress);

        if (missingAccountFunds != 0) {
            senderSafe.execTransactionFromModule(
                entryPoint,
                missingAccountFunds,
                "",
                0
            );
        }
    }
}
