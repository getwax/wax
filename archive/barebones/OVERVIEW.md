# Overview
Overview of Setup, Creation, Use and Modification of accounts (EOAs and Smart Accounts) and underlying components. With specific regard to ecosystem actions, and individual account actions.

## Ecosystem Setup
What needs to exist initially.
- EOA: Protocol
- SA: SA Factory and Verification Singletons deployed (sensible defaults, audited & community voted modules)

## Account Creation
How a new account is created.
- EOA: entropy for ecdsa private key
- SA: Deploy from trusted(+verifiable) SA factory with defaults + snapshot of trusted verifier address set (latest or specific version)
- Note: dApps deploying SA on behalf of users may hold users' key(s). The user can change these once aware/ready, but in the meantime the dApp can add custom verification modules. Since it could be a favourably permissive module, *third-party SA module checkers would be valuable for the ecosystem*.


## Ecosystem additions
How all EOAs, and future SAs, have newer functionality.
- EOA: EIPs + protocol upgrades via client consensus. All EOAs now have this functionality
- SA: New Verification modules deployed permissionlessly, community votes on integrity/value. (Note: existing SAs remain unchanged by default)
- SA: Trusting verifiers is opt-in, and a highly privileged action, like setting a verifier's state. I.e. requires more than one auth mechanism, and a cooling off period before active. Note: this is seperate from using the trusted singleton.

## Account additions
- EOA: not possible
- SA: Wallets able to create state(s) for use with trusted verifiers (in tx authentication), doing so is a privileged action.
- SA: Eg set up a bls module with a public key, or set up an additional ecdsa module with higher spending limits, or set up a multisig verifier for social recovery...


## Account Use - DApp constructs transaction for User's wallet to sign.
- EOA wallet: present information to the user, once accepted returns ECDSA signature of standard msg payload, call made unrestricted.
- SA wallet: present information for the user, once accepted...
    - (A) wallet needs to determine or specify verifiers to sign for. SA default + recommendation based on action
    - (B) verifier(s) add their component(s) to msg (namely unique reference to verifier in account, eg verifier state index)
    - (C) wallet signs/authenticates with corresponding component(s) in wallet
    - signature(s)/proof(s) combined into one "signature" bytes field in a structured way

### SA Details
(A) Wallet can select verifiers that SA has, or interrogate SA from appropriate verifier fro desired action. Eg,
- high value eth: default verifier + additional webauthn verifier for high value calls.
- modify a verifier's state: function can fail with error indicating required verifier, so wallet can determine iteratively a required verifier
- if actions/values gated by authentication levels, a verifiers can be selected until their corresponding auth levels meet the minimum required.
