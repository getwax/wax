// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.22;

import "./ERC1271.sol";
import "./verifiers/Verifier.sol";

contract MultiVerifier is ERC1271 {
    // type VerifierState is bytes;

    /** State used with Verifier singletons.
        Consider separation of persistent|resetable verifier state.
    */
    struct StatefulVerifier {
        Verifier verifier;
        uint8 level;
        bool active;
        // uint256 nonce; ?
        bytes state; // resetable state?
    }

    // list of verifier singleton contracts that are trusted and can be added to the wallet
    Verifier[] trustedVerifiers;

    error VerifierNotTrusted(Verifier);

    /**
    Verifiers can be added and activated by admin+guardians, but not removed.
    Protects against replay attacks.
     */
    StatefulVerifier[] accountVerifiers;
    event AddedVerifier(Verifier indexed newVerifier, uint256 verifierCount);

    /** `verifiedLevel` should always be 0 between calls, can be increased only after particular
    checks, then returned to 0 just before call, to prevent re-entrancy.
    Used when calling admin functions.
    */
    uint256 verifiedLevel;
    uint8 constant LEVEL_ADMIN = 255;
    error InsufficientVerification(uint256 current, uint256 required);

    modifier verifiedTo(uint256 requiredLevel) {
        if (verifiedLevel < requiredLevel) {
            revert InsufficientVerification(verifiedLevel, requiredLevel);
        }
        _;
    }

    modifier trustedVerifier(Verifier v) {
        if (!isTrusted(v)) { revert VerifierNotTrusted(v); }
        _;
    }

    // constructor(
    //     IVerifier adminVerifier,
    //     bytes memory initData
    // ) {
    //     require(adminVerifier != address(0), "MV: Verifier must not be 0");
    //     addVerifier(adminVerifier, initData);
    // }


    function isTrusted(Verifier v) public view returns(bool) {
        for (uint256 i=0; i<trustedVerifiers.length; i++) {
            if (trustedVerifiers[i] == v) {
                return true;
            }
        }
        return false;
    }


    /**
    Adds new Verifier address to trusted list.
    Emit events when trusting too many, then prevent additions without revoking.
     */
    // function trustVerifier internal verifiedTo(LEVEL_ADMIN) { TODO }
    // function revokeVerifier internal verifiedTo(LEVEL_ADMIN) { TODO }

    /**
    Add new verifier data using existing trusted verifier.
     */
    function addVerifier(
        Verifier verifierToAdd,
        bytes memory initData
    ) internal
    verifiedTo(LEVEL_ADMIN)
    trustedVerifier(verifierToAdd)
    {
        StatefulVerifier memory sv = StatefulVerifier(
            verifierToAdd,
            0,
            true,
            verifierToAdd.initialState(initData)
        );
        accountVerifiers.push(sv);
        emit AddedVerifier(verifierToAdd, accountVerifiers.length);
    }

    /** Pause an active and approved verifier from being used.
    */
    // function disableVerifier(address verifierToStop, uint256 index) internal verifiedTo(LEVEL_ADMIN) { TODO }
    // function enableVerifier(address verifierToStop, uint256 index) internal verifiedTo(LEVEL_ADMIN) { TODO }

    /** Signatures are assumed to have been created with awareness
    of the smart account's verifiers. One or more signatures are preceeded by
    an array of corresponding indices into `statefulVerifiers`.
    */
    function verifierIndicesSigsFromSig(bytes memory signature)
    public pure returns(uint8[] memory verifierIndices, bytes[] memory sig) {
        return abi.decode(signature, (uint8[], bytes[]));
    }


    function checkValidityAndSetLevel(
        bytes32 hash,
        bytes memory signature
    ) internal returns(bool) {
        if (isValidSignature(hash, signature) != MAGICVALUE) {
            return false;
        }

        uint8[] memory verifierIndices;
        (verifierIndices, ) = verifierIndicesSigsFromSig(signature);

        for (uint256 i=0; i<verifierIndices.length; i++) {
            verifiedLevel += accountVerifiers[verifierIndices[i]].level;
        }
        return true;
    }

    /**
     @dev An implementation of isValidSignature that expects arrays of values in the signature
     @param hash hash of data to check validity of
     @param signature (uint8[], bytes[]) verifier indices and verification data (eg sig, proof, ...)
     @return result MAGICVALUE if interpretation of verifier sigs were valid for each, otherwise index first failed element
     */
    function isValidSignature(
        bytes32 hash,
        bytes memory signature
    ) virtual override public view returns(bytes4 result) {
        uint8[] memory verifierIndices;

        bytes[] memory sigs;
        (verifierIndices, sigs) = verifierIndicesSigsFromSig(signature);
        require(verifierIndices.length > 0, "No verifiers in signature");
        require(verifierIndices.length == sigs.length, "Verifier/sig length mismatch");

        StatefulVerifier storage sv;
        result = bytes4(0);
        for (uint32 i=0; i<verifierIndices.length; i++) {
            sv = accountVerifiers[verifierIndices[i]];
            if (!sv.verifier.isValidSignature(
                sv.state,
                hash,
                sigs[i]
                )
            ) {
                return bytes4(i);
            }
        }
        return MAGICVALUE;
    }

    /** Bring the value
     */
    function resetLevel() public {
        verifiedLevel = 0;
    }

}
