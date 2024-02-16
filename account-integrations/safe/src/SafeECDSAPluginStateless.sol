// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {Safe4337Base, ISafe} from "./utils/Safe4337Base.sol";
import {SafeStorage} from "safe-contracts/contracts/libraries/SafeStorage.sol";
import {IEntryPoint, UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
// import "hardhat/console.sol";

struct ECDSAOwnerStorage {
    address owner;
}

contract SafeECDSAPluginStateless is SafeStorage, Safe4337Base {
    using ECDSA for bytes32;
    // TODO: Find out if this clashes with the same slot on the safe proxy
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
        ecdsaOwnerStorage[address(this)].owner = ownerKey;
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    function getAddressFromSlot(
        bytes32 slot
    ) public view returns (address owner) {
        assembly {
            owner := sload(slot)
        }
    }

    function _validateSignature(
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal override returns (uint256 validationData) {
        uint256 mappingLocation = uint256(9);
        // uint256 mappingLocation = uint256(0); // slot 0 in the Safe should theoretically be
        // the slot for the singleton address - so very important and not something we should
        // be accessing/modifying with delegatecall, I think the reason this didn't break before when
        // it was slot 0, was because the mapping slot is only needed as a salt for computing
        // the location of the mapping values along with it's keys. According to the solidity
        // docs "For mappings, the slot stays empty", slot being the slot where the mapping
        // is declared, which when not inheriting from SafeStorage, should have been the singleton address.
        // https://docs.soliditylang.org/en/latest/internals/layout_in_storage.html#mappings-and-dynamic-arrays.
        address safeAddress = address(_currentSafe());
        bytes32 ownerSlot = keccak256(abi.encode(safeAddress, mappingLocation));

        bytes memory functionCall = abi.encodeWithSignature(
            "getAddressFromSlot(bytes32)",
            ownerSlot
        );

        (bool success, bytes memory returnData) = _currentSafe()
            .execTransactionFromModuleReturnData(myAddress, 0, functionCall, 1);

        if (!success) {
            return SIG_VALIDATION_FAILED;
        }

        address keyOwner;
        if (userOp.initCode.length == 0) {
            keyOwner = ecdsaOwnerStorage[userOp.sender].owner; // This value is "0x0000000000000000000000000000000000000000". Which leads to the error: "Invalid UserOp signature or paymaster signature"
            // console.log("keyOwner - no initCode:   ", keyOwner);
        } else {
            keyOwner = address(uint160(uint256(bytes32(returnData))));
            // keyOwner = ecdsaOwnerStorage[userOp.sender].owner; // Trying to do something like this would result in the error: "unstaked account accessed"
            // console.log("keyOwner - with initCode: ", keyOwner);
        }

        bytes32 hash = userOpHash.toEthSignedMessageHash();

        if (keyOwner != hash.recover(userOp.signature)) {
            return SIG_VALIDATION_FAILED;
        }

        return 0;
    }
}
