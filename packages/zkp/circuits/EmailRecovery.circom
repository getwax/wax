pragma circom 2.1.8;

include "@zk-email/circuits/email-verifier.circom";
include "@zk-email/zk-regex-circom/circuits/common/from_addr_regex.circom";
include "@zk-email/zk-regex-circom/circuits/common/email_addr_regex.circom";
include "@zk-email/zk-regex-circom/circuits/common/email_domain_regex.circom";
include "@zk-email/zk-regex-circom/circuits/common/subject_all_regex.circom";
include "./utils/constants.circom";
include "./utils/bytes2ints.circom";

/**
 * Based on:
 * - https://github.com/zkemail/email-wallet/blob/feat/v1.1/packages/circuits/src/email_sender.circom
 * - https://github.com/zkemail/proof-of-twitter/blob/main/packages/circuits/twitter.circom
 * 
 * Verify email from user (sender) and extract & check subject, recipient email (commitment)
 * n - the number of bits in each chunk of the RSA public key (modulust)
 * k - the number of chunks in the RSA public key (n * k > 2048)
 * max_header_bytes - max number of bytes in the email header
 * max_subject_bytes - max number of bytes in the email subject
 */
template EmailRecovery(n, k, max_header_bytes, max_subject_bytes) {
    /**
     * Constants
     */
    // TODO Some of these can be removed
    var email_max_bytes = email_max_bytes_const();
    var subject_field_len = compute_ints_size(max_subject_bytes);
    var domain_len = domain_len_const();
    var domain_filed_len = compute_ints_size(domain_len);
    var k2_chunked_size = k >> 1;
    if(k % 2 == 1) {
        k2_chunked_size += 1;
    }
    var timestamp_len = timestamp_len_const();

    /**
     * Inputs
     */
    // Private
    signal input in_padded[max_header_bytes]; // email data (only header part)
    signal input pubkey[k]; // RSA pubkey (modulus), k parts of n bits each.
    signal input signature[k]; // RSA signature, k parts of n bits each.
    signal input in_len_padded_bytes; // length of in email data including the padding

    // signal input sender_email_idx; // index of the from email address (= sender email address) in the email header
    // signal input sender_domain_idx; // index of the domain of the sender in the sender email address
    // signal input subject_idx; // index of the subject in the header

    // Public
    // signal input subject[max_subject_bytes]; // email subject to check
    // TODO Does this need to be in the email payload?
    // signal input chainid;

    /**
     * Outputs
     */
    signal output pubkey_hash;
    signal output domain_name[domain_filed_len];

    // Verify email DKIM signature
    // Skip checking body, only need to confirm subject
    component ev = EmailVerifier(max_header_bytes, 0, n, k, 1);
    ev.in_padded <== in_padded;
    ev.pubkey <== pubkey;
    ev.signature <== signature;
    ev.in_len_padded_bytes <== in_len_padded_bytes;

    pubkey_hash <== ev.pubkey_hash;

    // // Extract email from (email sender)
    // signal from_regex_out, from_regex_reveal[max_header_bytes];
    // (from_regex_out, from_regex_reveal) <== FromAddrRegex(max_header_bytes)(in_padded);
    // from_regex_out === 1;
    // signal sender_email_addr[email_max_bytes];
    // sender_email_addr <== VarShiftMaskedStr(max_header_bytes, email_max_bytes)(from_regex_reveal, sender_email_idx);

    // // Extract email domain
    // signal domain_regex_out, domain_regex_reveal[email_max_bytes];
    // (domain_regex_out, domain_regex_reveal) <== EmailDomainRegex(email_max_bytes)(sender_email_addr);
    // domain_regex_out === 1;
    // signal domain_name_bytes[domain_len];
    // domain_name_bytes <== VarShiftMaskedStr(email_max_bytes, domain_len)(domain_regex_reveal, sender_domain_idx);
    // domain_name <== Bytes2Ints(domain_len)(domain_name_bytes);

    log("pubkey_hash", pubkey_hash);
}


/**
 * n = 121 is the number of bits in each chunk of the modulus (RSA parameter)
 * k = 17 is the number of chunks in the modulus (RSA parameter)
 * max_header_bytes = 1024 is the max number of bytes in the header
 * max_subject_bytes = 1024 is the max number of bytes in the subject
 */
component main = EmailRecovery(121, 17, 1024, 1024);
