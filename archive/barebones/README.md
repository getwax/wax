# BareBones Smart Account

## Goals/Focus
These contracts, and the use of them, intends to keep simplicity and clarity at the fore.

**Simplicity**
Simplicity elevates security and verifiability. Contracts should have good separation of concerns, and modules/interactions explicit in what they do.
There should be sufficient rigidity and safeguards to not readily fall victim to significant loss. By attack or user error.

**Safety first**
A key, capable of moving all value in one block, should not be the first thing a user must master.

Limitations should exist to limit losses, but should be overridable in a secure and low-friction way. Eg, buying a high-value NFT, provide an additional verification for the movement of ETH beyond default spending limits.

Concepts like recovery/safe mode should be possible, and time should be used wisely. Events should inform the user of timers and their results. Eg "Recovery mode active for (remaining time)"

**Upgradability?**
Verification methods can be updated in a very explicit manner, but a full contract upgrade mechanism is questionable in the context of a stable secure smart account.
The consequences of a malicious upgrade can circumvent any and all safety mechanisms that exist, so the task of upgrading to a new smart account contract can be achieved via the transfer of assets according to their safeguards.

Transfer of ETH may have spending limits over time, or require additional validity checks, similarly for high-value NFT conracts. Ideally BareBones' simplicity will not require an upgrade, but if new contracts are desired, users will have to move assets.

**Confidence + compatibility**
The contracts should become usable with established dApps and standards. Eg ERC-1271.


## Design

`BareBones.sol` is the deployed smart account. Starting as a regular smart account, it has a default Verifier. Constructed with an ECDSA verifier, this is like a regular smart account or EOA.
Some functions in BareBones should be restricted by privilege level, and only accessible with sufficient privileged verifier(s) attesting to the validity of the call.

**Verifiers** are designed to be stateless so can be singletons that are audited in isolation. The ECDSA example will use a library for the lower-level logic and binding to a data struct.
To ensure no state change via assembly in a view function, verification calls should be made statically.
It is worth repeating, verifiers should do one thing well, and not be overly complicated. Use of multiple verifiers is handled in `MultiVerifier`.

**Verifier State** contains variables like a verifiers public key (eg BLS), or EOA address in the case of ECDSA. They are kept in the BareBones smart account contract, and associated with the specific verifier. This benefits security, and is more readily ERC-4337 compatible if needed.
NB: Changes to a verifier's state should not be possible without significant authority, as this is akin to "recovery". That is, resetting the authorised address of an ecdsa verifier.

A **Trusted Verifier** list is maintained in the smart account, and changes to this list should be treated as a highly privileged function. Generic adding of any module will be a huge security concern of wallets, and limiting to a library of trusted modules becomes a security risk.
The advantages of both are possibly with a blended approach, eg initialising a local trusted set from the public set, then future allowing additions via highly privileged functions.

**Privileged functions** are those that will require more than one verification to achieve a required threshold to make a call. Any less will not allow the call to succeed from the wallet.
Time thesholds will be important for some of these actions too, for example in the case of re-setting a privileged verifier's key (recovery) and adding a verifier address to the trusted set.

**Pre/post condition checks (inc. intents)**, much like the `guard` in SAFE, can be incorporated around calls to revert if sufficient privileges were not provided.

Eg a throttled ECDSA verifier that can only authorise the movement of x ETH per week, and an additional webauthn verifier being required to override this limit for the current call.
In this secenario, a regular dapp interaction with the default ecdsa works fine. If the dapp is compromised and attempts to drain the wallet, it would revert due to insufficient privileges.
For an anticipated movement of funds, then the additional webauthn payload can pre-emptively be provided with the call.


## Foundry Usage
### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/Counter.s.sol:CounterScript --rpc-url <your_rpc_url> --private-key <your_private_key>
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```
