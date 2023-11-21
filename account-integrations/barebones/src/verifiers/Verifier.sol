// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "../interfaces/IERC1271.sol";
import "../ERC1271.sol";
import "../MultiVerifier.sol";

//TODO: separate interface into ./interfaces/..
/**
For a Verifier to be reused by multiple wallets, it can be delegate called by a
smart account. 
 */
interface IVerifier is IERC1271 {
    function initialState() external pure returns(bytes memory);
    function init(address smartAccount, bytes memory initData) external;
    
}

/**
    Generic verifier
 */
abstract contract Verifier is ERC1271 {
    uint256 public immutable initialStateLength;

    constructor(uint256 initLen) {
        initialStateLength = initLen;
    }

    function initialState(
        bytes memory initData
    ) virtual public view isInitLen(initData.length) returns(
        bytes memory
    )  {
        return "0x";
    }

    modifier isInitLen(uint256 len) {
        require(len == initialStateLength, "");
        _;
    }

    // }

    /**
     @param hash hash of data to check validity
     @param signature address of extension that checks for validity
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) virtual override public pure returns (bytes4 magicValue);

}
