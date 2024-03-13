// From https://github.com/zkemail/email-wallet/blob/feat/v1.1/packages/circuits/src/utils/constants.circom

pragma circom 2.1.8;

function email_max_bytes_const() {
    return 256;
}

function domain_len_const() {
    return 255;
}

function invitation_code_len_const() {
    return 64;
}

function field_pack_bits_const() {
    return 248;
}

function pack_bytes_const() {
    return 31;
}

function timestamp_len_const() {
    return 10;
}