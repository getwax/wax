// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.8.0 <0.9.0;

import {BaseAccount} from "account-abstraction/contracts/core/BaseAccount.sol";
import {IEntryPoint, UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {FCL_WebAuthn} from "./lib/FCL_Webauthn.sol";

interface ISafe {
    function enableModule(address module) external;

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes memory data,
        uint8 operation
    ) external returns (bool success);
}

contract SafeWebAuthnPlugin is BaseAccount {
    address public immutable myAddress;
    address private immutable _entryPoint;
    uint256[2] private _publicKey;

    address internal constant _SENTINEL_MODULES = address(0x1);

    constructor(address entryPointAddress, uint256[2] memory pubKey) {
        myAddress = address(this);
        _entryPoint = entryPointAddress;
        _publicKey = pubKey;
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        address payable safeAddress = payable(userOp.sender);
        ISafe senderSafe = ISafe(safeAddress);

        if (missingAccountFunds != 0) {
            senderSafe.execTransactionFromModule(
                _entryPoint,
                missingAccountFunds,
                "",
                0
            );
        }

        validationData = _validateSignature(userOp, userOpHash);
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

    function publicKey() public view returns (uint256[2] memory) {
        return _publicKey;
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        {
            (
                bytes memory authenticatorData,
                bytes1 authenticatorDataFlagMask,
                bytes memory clientData,
                uint256 clientChallengeDataOffset,
                uint256[2] memory signature,
                uint256[2] memory pubKey
            ) = abi.decode(
                    userOp.signature,
                    (bytes, bytes1, bytes, uint256, uint256[2], uint256[2])
                );

            bool verified = FCL_WebAuthn.checkSignature(
                authenticatorData,
                authenticatorDataFlagMask,
                clientData,
                userOpHash,
                clientChallengeDataOffset,
                signature,
                pubKey
            );
            if (!verified) return SIG_VALIDATION_FAILED;
            return 0;
        }
    }
}
