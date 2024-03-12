pragma circom 2.1.8;

include "@zk-email/circuits/email-verifier.circom";

/**
 * Based on:
 * - https://github.com/zkemail/email-wallet/blob/feat/v1.1/packages/circuits/src/email_sender.circom
 * - https://github.com/zkemail/proof-of-twitter/blob/main/packages/circuits/twitter.circom
 * 
 * Verify email from user (sender) and extract subject, timestmap, recipient email (commitment), etc.
 * n - the number of bits in each chunk of the RSA public key (modulust)
 * k - the number of chunks in the RSA public key (n * k > 2048)
 * max_header_bytes - max number of bytes in the email header
 */
template EmailRecovery(n, k, max_header_bytes) {
    /**
     * Inputs
     */
    signal input in_padded[max_header_bytes]; // email data (only header part)
    signal input pubkey[k]; // RSA pubkey (modulus), k parts of n bits each.
    signal input signature[k]; // RSA signature, k parts of n bits each.
    signal input in_len_padded_bytes; // length of in email data including the padding

    /**
     * Outputs
     */
    signal output pubkey_hash;

    /**
     * Logic
     */

    // Skip checking body bytes, only need to confirm subject
    component ev = EmailVerifier(max_header_bytes, 0, n, k, 1);
    ev.in_padded <== in_padded;
    ev.pubkey <== pubkey;
    ev.signature <== signature;
    ev.in_len_padded_bytes <== in_len_padded_bytes;

    pubkey_hash <== ev.pubkey_hash;
}


/**
 * n = 121 is the number of bits in each chunk of the modulus (RSA parameter)
 * k = 17 is the number of chunks in the modulus (RSA parameter)
 * max_header_bytes = 1024 is the max number of bytes in the header
 */
component main = EmailRecovery(121, 17, 1024);
