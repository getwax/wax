// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "../interfaces/IERC1271.sol";
import "../ERC1271.sol";
import "../MultiVerifier.sol";

//TODO: separate interface into ./interfaces/..

interface IVerifier is IERC1271 {
    function verifierType() external returns(string memory);

    function initialState(bytes memory initData) external pure returns(bytes memory);
    // function init(address smartAccount, bytes memory initData) external;

    function signerHash(
        bytes memory data,
        address account,
        bytes32 msgHash
    ) external pure returns(bytes32);

    /**
     @param state Verifier state being used to check validity
     @param hash hash of data to check validity
     @param signature address of extension that checks for validity
     */
    function isValidSignature(
        bytes memory state,
        bytes32 hash,
        bytes memory signature
    ) external pure returns (bool);

    function incrementNonce(
        bytes memory state
    ) external pure returns (
        bytes memory newState
    );

    function recover(
        bytes memory stateBytes,
        bytes memory recoveryInfo
    ) external pure returns(
        bytes memory newStateBytes
    );

}

/**
    Generic verifier
 */
abstract contract Verifier {
    uint256 public immutable initialStateLength;
    uint256 public immutable signatureLength;

    constructor(uint256 initLen) {
        initialStateLength = initLen;
    }

    function initialState(
        bytes memory initData
    ) virtual public view isInitLen(initData.length) returns(
        bytes memory
    ) {
        return "0x";
    }

    modifier isInitLen(uint256 len) {
        require(len == initialStateLength, "");
        _;
    }

    function signerHash(
        bytes memory data,
        address account,
        bytes32 msgHash
    ) virtual public pure returns(bytes32) {
        return keccak256(abi.encode(
            account,
            data,
            msgHash
        ));
    }
    
    /**
     @param hash hash of data to check validity
     @param signature address of extension that checks for validity
     */
    function isValidSignature(
        bytes memory state,
        bytes32 hash,
        bytes memory signature
    ) virtual public pure returns (bool);

    function nonce(
        bytes memory state
    ) virtual public pure returns(
        uint256 nonce
    );

    function incrementNonce(
        bytes memory state
    ) virtual public pure returns (
        bytes memory newState
    );

    function recover(
        bytes memory stateBytes,
        bytes memory recoveryInfo
    ) virtual public view returns(
        bytes memory newStateBytes
    );
}
