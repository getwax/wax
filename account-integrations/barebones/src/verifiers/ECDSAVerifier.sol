// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "./Verifier.sol";

library ECDSALib {

    struct ECDSAState {
        address owner;
        uint256 nonce; // consider nonce here or in non-resettable state
    }

    function setOwner(ECDSAState memory self, address owner)
    public pure returns (ECDSAState memory newState) {
        newState = self;
        newState.owner = owner;
        return newState;
    }

    function incrementNonce(ECDSAState memory self)
    public pure returns (ECDSAState memory newState) {
        newState = self;
        newState.nonce += 1;
        return newState;
    }

    function signerHash(ECDSAState memory self, address account, bytes32 msgHash)
    public pure returns (bytes32) {
        return keccak256(abi.encode(
            self.owner,
            self.nonce,
            account,
            msgHash
        ));
    }

    // function isValidSignature (
    //     ECDSAState self,
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

    function initialState(
        bytes memory initialInfo
    ) override public pure returns(
        bytes memory newStateBytes
    ) {
        // super.initialState(initData);
        ECDSALib.ECDSAState memory newState;
        newState.owner = abi.decode(initialInfo, (address));
        newState.nonce = 0;
        return abi.encode(newState);
    }

    function state(bytes memory stateBytes) public pure returns(ECDSALib.ECDSAState memory) {
        return abi.decode(stateBytes, (ECDSALib.ECDSAState));
    }

    // function signerHash(
    //     bytes memory data,
    //     address account,
    //     bytes32 msgHash
    // ) override public pure returns(bytes32) {
    //     return state(data).hash(account, msgHash);
    // }

    function isValidSignature(
        bytes memory verifierState,
        bytes32 hash,
        bytes memory signature
    ) override public pure returns (bool) {
        // TODO: ecrecover
        verifierState; hash; signature;
        return true;
    }

    function nonce(
        bytes memory stateBytes
    ) override public pure returns(
        uint256
    ) {
        return state(stateBytes).nonce;
    }

    function incrementNonce(
        bytes memory stateBytes
    ) override public pure returns (
        bytes memory newStateBytes
    ) {
        ECDSALib.ECDSAState memory currentState = state(stateBytes);
        ECDSALib.ECDSAState memory nextECDSAState = currentState.incrementNonce();
        return abi.encode(nextECDSAState);
    }

    function recover(
        bytes memory stateBytes,
        bytes memory recoveryInfo
    ) override public pure returns(
        bytes memory newStateBytes
    ) {
        ECDSALib.ECDSAState memory newState = state(stateBytes);
        newState.owner = abi.decode(recoveryInfo, (address));
        return abi.encode(newState);
    }

}