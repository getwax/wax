// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

//TODO: validity-checking primitives to adhere to IERC-1271

import "./ERC1271.sol";
import "./verifiers/Verifier.sol";
import "./ActionManager.sol";

interface IActionVerifier {
    function canAuth(IVerifier, bytes memory) view external returns (bool);
}

contract ActionVerifier {

    bool targetFilter;
    bool methodFilter;

    function canAuth(IVerifier verifier, bytes memory) view public returns (bool) {
        return true;
    }

    // modifier target
}

contract NonceManager {
    uint256 public nonce = 0; //TODO nonce as validater MSB and nonce LSB.

    function incrementNonce() internal {
        nonce++;
    }
    
}

/**
A minimal smart account that by default acts like an on chain EOA, but has the ability to add
additional verification mechanisms.
TODO: add MetaTx capability (OZ Context)
 */
contract BareBones is MultiVerifier, /*ActionManager,*/ NonceManager {

    // A simple direct verifier (outside of MultiVerifier)
    Verifier public adminVerifier; // TODO: make restricted "default" verifier
    // Verifier recoveryVerifier; // TODO: exclusive verification(s) to modify verifier states

    bytes public adminState;
    // bytes recoveryState;

    // TODO: initialise trusted verifier list with decentralised list
    // TODO: deploy via a simple factory
    constructor(Verifier firstVerifier, bytes memory data) {
        trustedVerifiers.push(firstVerifier);
        adminVerifier = firstVerifier;
        adminState = adminVerifier.initialState(data);
    }

    event Called(address);

    function checkValidityAndIncrementNonce(
        Action calldata a,
        bytes calldata signature
    ) internal returns(bool success) {
        success = false;

        bytes4 result = bytes4(0);
        // if (signature.length == adminVerifier.signatureLength) {
            hash = abi.encode(a)
            result = adminVerifier.isValidSignature(hash, signature);
            adminState.incrementNonce();
        // }
        // if (result != MAGICVALUE) { // may be multi-action
        //     result = super.checkValidityAndIncrementNonce(a, signature);
        // }
        if (result == MAGICVALUE) {
            success = true;
        }
    }

    function hash(Verifier v, bytes32 msg) {
        bytes memory verifierMessage;
        uint192 key

        bytes memory verifierState;
        if (v == adminVerifier) {
            verifierState = adminState;
        }
        // else if (verifierStatus[v].ACTIVE) {
        //     StatefulVerifier sv[] = verifierStates[v];
        //     //...
        // }

    }

    // consider passing regular EAO signed transaction data
    function performAction(
        Action calldata a,
        bytes calldata signature
    ) public returns (bool result, bytes memory returnVal) {
        bytes32 hash = a.hash();
        hash = adminVerifier.hash(adminState, hash);

        // TODO: split signature into verifier address
        //(or check default verifier sig length?)

        //static call verifiers to ensure non-edit? https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/SignatureChecker.sol#L24-L29
        if (isValidSignature(hash, signature)) {
            // consider reimbursing payer (msg.sender?) here (initial primary use self/dApp sponsored)

            incrementNonce();

            // require is not admin function (or has admin rights)
            if (isAdminAction(a)) {
                // check additional auth
            }
            // TODO: require is below value threshold (or has "enough" authority)
            
            // call given function
            try this._performOperation(op) returns (
                bytes[] memory _results
            ) {
                result = true;
                returnVal = _results;
            }
            catch (bytes memory returnData) {
                result = false;
                returnVal = returnData;
            }

            emit Called(a.target);
        }
    }


}
