// TODO (merge-ok) Remove with https://github.com/getwax/wax/issues/147
export type ContractProof = {
    a: [string, string];
    b: [
        [string, string],
        [string, string]
    ];
    c: [string, string];
};
