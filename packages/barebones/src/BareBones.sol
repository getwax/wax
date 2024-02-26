// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

//TODO: validity-checking primitives to adhere to IERC-1271

import "./ERC1271.sol";
import "./verifiers/Verifier.sol";
import "./ActionManager.sol";

interface IActionVerifier {
    function canAuth(IVerifier, bytes memory) view external returns (bool);
}

// contract ActionVerifier {

//     bool targetFilter;
//     bool methodFilter;

    // function canAuth(IVerifier verifier, bytes memory) view public returns (bool) {
    //     return true;
    // }

    // modifier target
// }

contract NonceManager {
    uint256 public nonce = 1; //TODO nonce as validater MSB and nonce LSB.

    function incrementNonce() internal {
        nonce++;
    }
    
}

/**
A minimal smart account that by default acts like an on chain EOA, but has the ability to add
additional verification mechanisms.
TODO: add MetaTx capability (OZ Context)
 */
contract BareBones is ERC1271, MultiVerifier, ActionManager, NonceManager {

    // A simple direct verifier (outside of MultiVerifier)
    Verifier public adminVerifier;
    Verifier public defaultVerifier; // TODO: make restricted "default" verifier

    bytes public adminState;
    // bytes public defaultState;

    // TODO: initialise trusted verifier list with decentralised list
    // TODO: deploy via a simple factory
    constructor(Verifier firstVerifier, bytes memory data) {
        trustedVerifiers.push(firstVerifier);
        adminVerifier = firstVerifier;
        adminState = adminVerifier.initialState(data);
    }

    event Called(address);

    /**
     @param hash hash of data to check validity
     @param signature address of extension that checks for validity
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) override(ERC1271, MultiVerifier) public view returns (bytes4 magicValue) {
        if (
            signature.length == adminVerifier.signatureLength() &&
            adminVerifier.isValidSignature(adminState, hash, signature)
        ) {
            magicValue = MAGICVALUE;
        } else {
            magicValue = super.isValidSignature(hash, signature);
        }
    }

    function checkValidityAndSetLevel(
        Action calldata a,
        bytes calldata signature
    ) internal returns(bool) {
        bytes32 hash = keccak256(abi.encode(a, nonce));
        if (
            signature.length == adminVerifier.signatureLength() &&
            (adminVerifier.isValidSignature(adminState, hash, signature))
        ) {
            adminState = adminVerifier.incrementNonce(adminState);
            verifiedLevel = LEVEL_ADMIN;
            return true;
        } else {
            return super.checkValidityAndSetLevel(hash, signature);
        }
    }

    // function hash(Verifier v, bytes32 msg) public pure returns(bytes32) {
    //     bytes memory verifierMessage;
    //     uint192 key; //TODO: key/sequence nonce split

    //     bytes memory verifierState;
    //     if (v == adminVerifier) {
    //         verifierState = adminState;
    //     }
    //     // else if (verifierStatus[v].ACTIVE) {
    //     //     StatefulVerifier sv[] = verifierStates[v];
    //     //     //...
    //     // }
    //     return bytes32(0);
    // }

    // consider passing regular EAO signed transaction data
    function performAction(
        Action calldata a,
        bytes calldata signature
    ) public returns (bool success, bytes memory returnVal) {
        if (checkValidityAndSetLevel(a, signature)) {
            // consider reimbursing payer (msg.sender?) here (initial primary use self/dApp sponsored)

            if (isAdminAction(a) && (verifiedLevel < LEVEL_ADMIN)) {
                revert InsufficientVerification(verifiedLevel, LEVEL_ADMIN);
            }
            resetLevel();

            incrementNonce();

            if (a.value > 0) {
                (success, returnVal) = payable(a.target).call{value: a.value}(a.encodedFunction());
            }
            else {
                (success, returnVal) = address(a.target).call(a.encodedFunction());
            }

            emit Called(a.target);
        }
    }


}
