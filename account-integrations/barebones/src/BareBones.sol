// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

//TODO: validity-checking primitives to adhere to IERC-1271

import "./ERC1271.sol";
import "./verifiers/Verifier.sol";

interface IActionVerifier {
    function canAuth(IVerifier, bytes memory) view external returns (bool);
}

contract ActionVerifier {

    bool targetFilter;
    bool methodFilter;

    function canAuth(IVerifier, bytes memory) view public returns (bool) {
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
contract BareBones is MultiVerifier, NonceManager {

    Verifier adminVerifier;
    // Verifier recoveryVerifier;

    bytes adminState;
    // bytes recoveryState;

    constructor(Verifier firstVerifier, bytes memory data) {
        adminVerifier = firstVerifier;
        adminState = adminVerifier.initialState(data);
    }


    event Called(address);

    function actionHash(address target, bytes memory params, uint256 nonce) public pure returns(bytes32) {
        return keccak256(abi.encode(target, params, nonce));
    }

    // consider passing regular EAO signed transaction data
    function performAction(
        address target, //TODO: struct of calldata
        bytes calldata params,
        bytes calldata signature
    ) public returns (bool result, bytes memory returnVal) {
        bytes32 hash = actionHash(target, params, nonce);

        //static call verifiers to ensure non-edit? https://github.com/OpenZeppelin/openzeppelin-contracts/blob/master/contracts/utils/cryptography/SignatureChecker.sol#L24-L29
        if (isValidSignature(hash, signature) == MAGICVALUE) {

            // TODO: increment nonce
            incrementNonce();
            

            // call given function
            // try this._performOperation(op) returns (
            //     bytes[] memory _results
            // ) {
            //     result = true;
            //     returnVal = _results;
            // }
            // catch (bytes memory returnData) {
            //     result = false;
            //     returnVal = returnData;
            // }

            emit Called(target);
        }
    }


}
