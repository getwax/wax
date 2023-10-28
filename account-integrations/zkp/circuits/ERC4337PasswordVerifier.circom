pragma circom 2.1.4;
include "../node_modules/circomlib/circuits/comparators.circom";

/**
 * Verifies that a private byte sequence matches
 * the expected secret bytes value as well as an
 * expected UserOp hash.
 * 
 * TODO Password needs to be salted & hashed before being passed in here
 * https://github.com/getwax/wax/issues/146
 */
template ERC4337PasswordVerifier(passwordBytes, passwordBytesLen) {
    // public
    /* 
     * Ensure proof cannot be replayed on another UserOp.
     * Since the UserOp & hash includes the nonce & chainid,
     * we do not need to independently check those fields.
     */ 
    signal input userOpHash;
    
    // private
    signal input password[passwordBytesLen];

    // Check each password byte against what is expected
    component passwordBytesEqual[passwordBytesLen];
    for (var i = 0; i < passwordBytesLen; i++) {
        passwordBytesEqual[i] = IsEqual();
        passwordBytesEqual[i].in[0] <== passwordBytes[i];
        passwordBytesEqual[i].in[1] <== password[i];
        passwordBytesEqual[i].out === 1;
    }

    // Constrain UserOp hash to ensure it is included
    signal userOpHashSquared <== userOpHash * userOpHash;
}

component main { public [userOpHash] } = ERC4337PasswordVerifier([
    // 👻🎃🕸🦇🕷🪦 encoded into UTF-8 bytes
    240, 159,
    145, 187,
    240, 159,
    142, 131,
    240, 159,
    149, 184
], 12);
