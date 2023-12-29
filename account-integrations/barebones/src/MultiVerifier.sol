// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "./ERC1271.sol";
import "./verifiers/Verifier.sol";

contract MultiVerifier is ERC1271 {
    // type VerifierState is bytes;

    struct StatefulVerifier {
        Status currentStatus;
        uint256 verifierIndex;
        uint8 level;
        bytes data;
    }

        /**
    A verifier needs to be manually approved and activated.
    After that, it can only be paused via a more privileged verifier.
     */
    enum Status {
        NOT_APPROVED,
        PAUSED,
        ACTIVE
    }

    // list of verifier singleton contracts that are trusted and can be added to the wallet
    IVerifier[] trustedVerifiers;

    /**
    Verifiers can be added by admins and paused by admin+guardians, but not removed.
    Protects against replay attacks.
     */
    /** index to verifiers state(s) */
    StatefulVerifier[] verifierStates;

    // constructor(
    //     IVerifier adminVerifier,
    //     bytes memory initData
    // ) {
    //     require(adminVerifier != address(0), "MV: Verifier must not be 0");
    //     addVerifier(adminVerifier, initData);
    // }

    /**
    Level / auth score?
    State.
     */
    // mapping(IVerifier => (uint, bytes)) verifierBytes;


    /** Variable should always be 0 between calls, can be increased only after particular
    checks, then returned to 0 just before call, to prevent re-entrancy.
    Used when calling admin functions.
    */
    uint256 verifiedLevel;

    modifier privlegedCall() {
        require(verifiedLevel == 1, "MV: Inufficient privileges");
        _;
    }

    /**
    Adds new Verifier address to trusted list.
     */
    // function trustVerifier internal privilegedCall {

    // }

    /**
    Add new verifier data using existing trusted verifier.
     */
    function addVerifier(Verifier verifierToAdd, bytes memory initData) internal {
        require(
            verifierStatus[verifierToAdd] == Status.NOT_APPROVED,
            "Already approved"
        );
        // verifierToAdd.delegateCall.init(initData); // avoid delegatecall, rogue verifier can modify any state
        verifierStatus[verifierToAdd] = Status.PAUSED;
    }

    /** Pause an active and approved verifier from being used.
    */
    // function pauseVerifier(address verifierToStop) private {
    // }

    function verifierFromSig(bytes memory signature)
    public pure returns(Verifier verifier, bytes memory sig) {
        return abi.decode(signature, (Verifier, bytes));
    }

    /**
     @param hash hash of data to check validity
     @param signature (address, bytes) verifier address and verification data (eg a signature)
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) override public view returns (bytes4 result) {

        Verifier verifier;
        bytes memory sig;
        (verifier, sig) = verifierFromSig(signature);

        require(
            verifierStatus[verifier] == Status.ACTIVE,
            ""
        );
        result = verifier.isValidSignature(
            hash,
            sig
        );


        return MAGICVALUE; //TODO: result;
    }

}
