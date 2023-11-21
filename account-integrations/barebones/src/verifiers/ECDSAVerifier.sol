// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "./Verifier.sol";

library ECDSALib {

    struct ECDSAData {
        address owner;
        uint256 nonce;
    }

    function setOwner(ECDSAData memory data, address owner)
    public pure returns (ECDSAData memory nextData) {
        nextData = data;
        nextData.owner = owner;
        return nextData;
    }

    // function isValidSignature (
    //     ECDSAData data,
    //     bytes32 _hash, 
    //     bytes memory _signature
    // ) virtual  external view
    // returns (bytes4 magicValue) {

    // }

}

/**
Audited and deployed singleton used by many.
 */
contract ECDSAVerifier is Verifier(32) {

    // ECDSALib ecdsaLib = address(0);

    using ECDSALib for ECDSALib.ECDSAData;

    function initialState(bytes memory initData) override public view returns(bytes memory) {
        super.initialState(initData);
        ECDSALib.ECDSAData memory newState;
        newState.owner = abi.decode(initData, (address));
        return abi.encode(newState);
    }


    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) override public pure returns (bytes4 magicValue) {
        // ecrecover
        return MAGICVALUE;
    }

}