// TODO (merge-ok) Remove with https://github.com/getwax/wax/issues/147
export type Groth16Proof = {
    pi_a: [string, string, string];
    pi_b: [
        [string, string],
        [string, string],
        [string, string],
    ];
    pi_c: [string, string, string];
};

export type ContractProof = {
    a: [string, string];
    b: [
        [string, string],
        [string, string]
    ];
    c: [string, string];
};
