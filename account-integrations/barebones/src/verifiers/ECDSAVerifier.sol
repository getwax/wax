// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "./Verifier.sol";

library ECDSALib {

    struct ECDSAState {
        address owner;
        uint256 nonce;
    }

    function setOwner(ECDSAState memory state, address owner)
    public pure returns (ECDSAState memory newState) {
        newState = state;
        newState.owner = owner;
        return newState;
    }

    function incrementNonce(ECDSAState memory state)
    public pure returns (ECDSAState memory newState) {
        newState = state;
        newState.nonce += 1;
        return newState;
    }

    // function isValidSignature (
    //     ECDSAState state,
    //     bytes32 _hash, 
    //     bytes memory _signature
    // ) virtual  external view
    // returns (bytes4 magicValue) {

    // }

}

/**
Audited and deployed singleton used by many.
 */
contract ECDSAVerifier is Verifier(20) {

    // ECDSALib ecdsaLib = address(0);

    using ECDSALib for ECDSALib.ECDSAState;

    function initialData(
        bytes memory initialInfo
    ) override public view returns(
        bytes memory newStateBytes
    ) {
        // super.initialState(initData);
        ECDSALib.ECDSAState memory newState;
        newState.owner = abi.decode(initData, (address));
        newState.nonce = 0;
        return abi.encode(newState);
    }

    function recover(
        bytes memory stateBytes,
        bytes memory recoveryInfo
    ) override public view returns(
        bytes memory newStateBytes
    ) {
        ECDSALib.ECDSAState memory newState = state(stateBytes);
        newState.owner = abi.decode(recoveryInfo, (address));
        return abi.encode(newState);
    }

    function state(bytes memory stateBytes) public pure returns(ECDSALib.ECDSAState memory) {
        return abi.decode(stateBytes, (ECDSALib.ECDSAState));
    }

    function hash(
        bytes memory data,
        bytes32 msgHash
    ) override public pure returns(bytes32 hash) {
        ECDSALib.ECDSAState ecdsaData = state(data);
        hash = abi.encode(this, ecdsaData.nonce, msgHash);
    }

    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) override public pure returns (bytes4 magicValue) {
        // ecrecover
        return MAGICVALUE;
    }

    function incrementNonce(
        bytes memory stateBytes
    ) public pure returns (
        bytes memory newStateBytes
    ) {
        ECDSALib.ECDSAState state = state(stateBytes);
        ECDSALib.ECDSAState nextECDSAState = state.incrementNonce();
        return abi.encode(nextECDSAState);
    }


}