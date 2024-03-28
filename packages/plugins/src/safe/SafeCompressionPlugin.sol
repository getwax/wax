// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {HandlerContext} from "safe-contracts/contracts/handler/HandlerContext.sol";

import {IEntryPoint, PackedUserOperation} from "account-abstraction/interfaces/IEntryPoint.sol";
import {BLS} from "account-abstraction/samples/bls/lib/hubble-contracts/contracts/libs/BLS.sol";
import {IBLSAccount} from "account-abstraction/samples/bls/IBLSAccount.sol";
import {MessageHashUtils} from "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";

import {Safe4337Base, ISafe, SIG_VALIDATION_FAILED} from "./utils/Safe4337Base.sol";
import {WaxLib as W} from "../compression/WaxLib.sol";
import {IDecompressor} from "../compression/decompressors/IDecompressor.sol";

error IncorrectSignatureLength(uint256 length);

contract SafeCompressionPlugin is Safe4337Base, IBLSAccount {
    // TODO: Use EIP 712 for domain separation
    bytes32 public constant BLS_DOMAIN = keccak256("eip4337.bls.domain");
    address public immutable myAddress;
    uint256[4] private _blsPublicKey;
    address private immutable _entryPoint;
    address private immutable _aggregator;
    IDecompressor public _decompressor;

    address internal constant _SENTINEL_MODULES = address(0x1);

    constructor(
        address entryPointAddress,
        address aggregatorAddress,
        uint256[4] memory blsPublicKey,
        IDecompressor decompressorParam
    ) {
        myAddress = address(this);
        _blsPublicKey = blsPublicKey;
        _entryPoint = entryPointAddress;
        _aggregator = aggregatorAddress;
        _decompressor = decompressorParam;
    }

    function decompressAndPerform(bytes calldata stream) public {
        _requireFromEntryPoint();

        (W.Action[] memory actions, ) = _decompressor.decompress(stream);

        ISafe safe = _currentSafe();

        for (uint256 i = 0; i < actions.length; i++) {
            W.Action memory a = actions[i];

            require(
                safe.execTransactionFromModule(a.to, a.value, a.data, 0),
                "tx failed"
            );
        }
    }

    function setDecompressor(IDecompressor decompressorParam) public {
        _requireFromCurrentSafeOrEntryPoint();
        _decompressor = decompressorParam;
    }

    function enableMyself() public {
        ISafe(address(this)).enableModule(myAddress);
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    function getBlsPublicKey() public view returns (uint256[4] memory) {
        return _blsPublicKey;
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 /* userOpHash */
    ) internal view override returns (uint256) {
        uint256 initCodeLen = userOp.initCode.length;

        if (initCodeLen > 0) {
            bytes32 claimedKeyHash = keccak256(
                userOp.initCode[initCodeLen - 128:]
            );

            // See appendKeyToInitCode.ts for a detailed explanation.
            require(
                claimedKeyHash == keccak256(abi.encode(getBlsPublicKey())),
                "Trailing bytes of initCode do not match the public key"
            );
        }

        return uint256(uint160(_aggregator));
    }
}
