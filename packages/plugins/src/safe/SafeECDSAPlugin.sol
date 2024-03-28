// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {Safe4337Base, SIG_VALIDATION_FAILED} from "./utils/Safe4337Base.sol";
import {IEntryPoint, PackedUserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {PackedUserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

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

contract SafeECDSAPlugin is Safe4337Base {
    using ECDSA for bytes32;

    mapping(address => ECDSAOwnerStorage) public ecdsaOwnerStorage;

    address public immutable myAddress; // Module address
    address private immutable _entryPoint;

    address internal constant _SENTINEL_MODULES = address(0x1);

    event OWNER_UPDATED(
        address indexed safe,
        address indexed oldOwner,
        address indexed newOwner
    );

    constructor(address entryPointAddress) {
        myAddress = address(this);
        _entryPoint = entryPointAddress;
    }

    function getOwner(address safe) external view returns (address owner) {
        owner = ecdsaOwnerStorage[safe].owner;
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable {
        _requireFromEntryPoint();

        bool success = _currentSafe().execTransactionFromModule(
            to,
            value,
            data,
            0
        );

        require(success, "tx failed");
    }

    function enableMyself(address ownerKey) public {
        // Called during safe setup as a delegatecall. This is why we use `this`
        // to refer to the safe instead of `msg.sender` / _currentSafe().

        ISafe(address(this)).enableModule(myAddress);

        // Enable the safe address with the defined key
        bytes memory _data = abi.encodePacked(ownerKey);
        SafeECDSAPlugin(myAddress).enable(_data);
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    function enable(bytes calldata _data) external payable {
        address newOwner = address(bytes20(_data[0:20]));
        address oldOwner = ecdsaOwnerStorage[msg.sender].owner;
        ecdsaOwnerStorage[msg.sender].owner = newOwner;
        emit OWNER_UPDATED(msg.sender, oldOwner, newOwner);
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        address keyOwner = ecdsaOwnerStorage[msg.sender].owner;
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);

        if (keyOwner != hash.recover(userOp.signature)) {
            return SIG_VALIDATION_FAILED;
        }

        return 0;
    }
}
