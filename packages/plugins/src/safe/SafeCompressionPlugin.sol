// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {ECDSA} from "openzeppelin-contracts/contracts/utils/cryptography/ECDSA.sol";
import {HandlerContext} from "safe-contracts/contracts/handler/HandlerContext.sol";
import {IEntryPoint, UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

import {Safe4337Base, ISafe} from "./utils/Safe4337Base.sol";
import {WaxLib as W} from "../compression/WaxLib.sol";
import {IDecompressor} from "../compression/decompressors/IDecompressor.sol";

struct ECDSAOwnerStorage {
    address owner;
}

contract SafeCompressionPlugin is Safe4337Base {
    using ECDSA for bytes32;

    mapping(address => ECDSAOwnerStorage) public ecdsaOwnerStorage;
    address public immutable myAddress;
    address private immutable _entryPoint;
    IDecompressor public decompressor;

    address internal constant _SENTINEL_MODULES = address(0x1);

    event OWNER_UPDATED(address indexed safe, address indexed oldOwner, address indexed newOwner);

    constructor(address entryPointParam, IDecompressor decompressorParam) {
        myAddress = address(this);
        _entryPoint = entryPointParam;
        decompressor = decompressorParam;
    }

    function decompressAndPerform(
        bytes calldata stream
    ) public {
        _requireFromEntryPoint();

        (W.Action[] memory actions,) = decompressor.decompress(stream);

        ISafe safe = _currentSafe();

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
    ) public {
        _requireFromCurrentSafeOrEntryPoint();
        decompressor = decompressorParam;
    }

    function enableMyself(address ownerKey) public {
        ISafe(address(this)).enableModule(myAddress);

        // Enable the safe address with the defined key
        bytes memory _data = abi.encodePacked(ownerKey);
        SafeCompressionPlugin(myAddress).enable(_data);
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
        UserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        address keyOwner = ecdsaOwnerStorage[msg.sender].owner;
        bytes32 hash = userOpHash.toEthSignedMessageHash();

        if (keyOwner != hash.recover(userOp.signature)) {
            return SIG_VALIDATION_FAILED;
        }

        return 0;
    }
}
