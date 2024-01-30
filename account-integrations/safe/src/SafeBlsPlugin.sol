// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {HandlerContext} from "safe-contracts/contracts/handler/HandlerContext.sol";

import {IEntryPoint, UserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";
import {BLS} from "account-abstraction/contracts/samples/bls/lib/hubble-contracts/contracts/libs/BLS.sol";
import {IBLSAccount} from "account-abstraction/contracts/samples/bls/IBLSAccount.sol";

import {Safe4337Base, ISafe} from "./utils/Safe4337Base.sol";

error IncorrectSignatureLength(uint256 length);

contract SafeBlsPlugin is Safe4337Base, IBLSAccount {
    // TODO: Use EIP 712 for domain separation
    bytes32 public constant BLS_DOMAIN = keccak256("eip4337.bls.domain");
    address public immutable myAddress;
    uint256[4] private _blsPublicKey;
    address private immutable _entryPoint;
    address private immutable _aggregator;

    address internal constant _SENTINEL_MODULES = address(0x1);

    constructor(
        address entryPointAddress,
        address aggregatorAddress,
        uint256[4] memory blsPublicKey
    ) {
        myAddress = address(this);
        _blsPublicKey = blsPublicKey;
        _entryPoint = entryPointAddress;
        _aggregator = aggregatorAddress;
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable {
        _requireFromEntryPoint();

        require(
            _currentSafe().execTransactionFromModule(to, value, data, 0),
            "tx failed"
        );
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
        UserOperation calldata /* userOp */,
        bytes32 /* userOpHash */
    ) internal view override returns (uint256) {
        // TODO: Check initCode (and explain why)
        return uint256(uint160(_aggregator));
    }
}
