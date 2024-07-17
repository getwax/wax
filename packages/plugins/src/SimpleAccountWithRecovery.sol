// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/* solhint-disable avoid-low-level-calls */
/* solhint-disable no-inline-assembly */
/* solhint-disable reason-string */

import {SimpleAccount} from "account-abstraction/samples/SimpleAccount.sol";
import {IEntryPoint} from "account-abstraction/interfaces/IEntryPoint.sol";

import {MockGroth16Verifier} from "./safe/utils/MockGroth16Verifier.sol";
import {MockDKIMRegsitry} from "./safe/utils/MockDKIMRegsitry.sol";
import {IDKIMRegsitry} from "./safe/interface/IDKIMRegsitry.sol";

/*//////////////////////////////////////////////////////////////////////////
    THIS CONTRACT IS OUTDATED. NOT FOR PRODUCTION USE
    It is recomended you use https://github.com/zkemail/email-recovery instead.   
//////////////////////////////////////////////////////////////////////////*/

struct RecoveryRequest {
    bytes32 recoveryHash;
    bytes32 dkimPublicKeyHash;
    uint256 executeAfter;
    address pendingNewOwner;
}

/**
 * minimal account.
 *  this is sample minimal account with ZK Email recovery for rotating the owner
 */
contract SimpleAccountWithRecovery is SimpleAccount {
    /** Default DKIM public key hashes registry */
    IDKIMRegsitry public immutable defaultDkimRegistry;

    /** verifier */
    MockGroth16Verifier public immutable verifier;

    /** Default delay has been set to a large timeframe on purpose. Please use a default delay suited to your specific context */
    uint256 public constant defaultDelay = 2 weeks;

    /** recovery hash domain */
    bytes32 immutable RECOVERY_HASH_DOMAIN;

    /** recovery request */
    RecoveryRequest public recoveryRequest;

    /** custom recovery delay */
    uint256 public recoveryDelay;

    /** dkim registry address */
    address public dkimRegistry;

    error RECOVERY_ALREADY_INITIATED();
    error RECOVERY_NOT_CONFIGURED();
    error INVALID_DKIM_KEY_HASH(
        address account,
        string emailDomain,
        bytes32 dkimPublicKeyHash
    );
    error INVALID_PROOF();
    error RECOVERY_NOT_INITIATED();
    error DELAY_NOT_PASSED();

    event RecoveryConfigured(
        address indexed account,
        address indexed owner,
        bytes32 recoveryHash,
        bytes32 dkimPublicKeyHash,
        address dkimRegistry,
        uint256 customDelay
    );
    event RecoveryInitiated(
        address indexed account,
        address newOwner,
        uint256 executeAfter
    );
    event AccountRecovered(address indexed account, address newOwner);
    event RecoveryCancelled(address indexed account);
    event RecoveryDelaySet(address indexed account, uint256 delay);

    constructor(
        IEntryPoint anEntryPoint,
        address _verifier,
        address _defaultDkimRegistry
    ) SimpleAccount(anEntryPoint) {
        verifier = MockGroth16Verifier(_verifier);
        defaultDkimRegistry = IDKIMRegsitry(_defaultDkimRegistry);

        RECOVERY_HASH_DOMAIN = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("SimpleAccountWithRecovery"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Stores a recovery hash that can be used to recover the account
     * @dev dkimRegistry can be a zero address if the user wants to use the
     *      defaultDkimRegistry. customDelay can be 0 if the user wants to use defaultDelay
     *      This is the first function that must be called when setting up recovery.
     * @param recoveryHash Hash of domain, email and salt - keccak256(abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt))
     * @param dkimPublicKeyHash Hash of DKIM public key - keccak256(abi.encodePacked(dkimPublicKey))
     * @param _dkimRegistry Address of a user-defined DKIM registry
     * @param customDelay A custom delay to set the recoveryDelay value that is associated with a account.
     */
    function configureRecovery(
        bytes32 recoveryHash,
        bytes32 dkimPublicKeyHash,
        address _dkimRegistry,
        uint256 customDelay
    ) external onlyOwner {
        address account = address(this);

        if (recoveryRequest.executeAfter > 0) {
            revert RECOVERY_ALREADY_INITIATED();
        }

        if (customDelay > 0) {
            recoveryDelay = customDelay;
        } else {
            recoveryDelay = defaultDelay;
        }

        recoveryRequest = RecoveryRequest({
            recoveryHash: recoveryHash,
            dkimPublicKeyHash: dkimPublicKeyHash,
            executeAfter: 0,
            pendingNewOwner: address(0)
        });
        dkimRegistry = _dkimRegistry; // FIXME: could be zero

        emit RecoveryConfigured(
            account,
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            dkimRegistry,
            customDelay
        );
    }

    /**
     * @notice Initiates a recovery for an account using a zk email proof.
     * @dev Rotates the account owner address to a new address. Uses the
     *      default delay period if no custom delay has been set. This is the second
     *      function that should be called in the recovery process - after configureRecovery
     * @param newOwner The new owner address of the account
     * @param emailDomain Domain name of the sender's email
     * @param a Part of the proof
     * @param b Part of the proof
     * @param c Part of the proof
     */
    function initiateRecovery(
        address newOwner,
        string memory emailDomain,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c
    ) external {
        address account = address(this);

        if (recoveryRequest.recoveryHash == bytes32(0)) {
            revert RECOVERY_NOT_CONFIGURED();
        }

        if (recoveryRequest.executeAfter > 0) {
            revert RECOVERY_ALREADY_INITIATED();
        }

        if (
            !this.isDKIMPublicKeyHashValid(
                emailDomain,
                recoveryRequest.dkimPublicKeyHash
            )
        ) {
            revert INVALID_DKIM_KEY_HASH(
                account,
                emailDomain,
                recoveryRequest.dkimPublicKeyHash
            );
        }

        uint256[4] memory publicSignals = [
            uint256(uint160(account)),
            uint256(recoveryRequest.recoveryHash),
            uint256(uint160(newOwner)),
            uint256(recoveryRequest.dkimPublicKeyHash)
        ];

        // verify proof
        bool verified = verifier.verifyProof(a, b, c, publicSignals);
        if (!verified) revert INVALID_PROOF();

        uint256 executeAfter = block.timestamp + recoveryDelay;

        recoveryRequest.executeAfter = executeAfter;
        recoveryRequest.pendingNewOwner = newOwner;

        emit RecoveryInitiated(account, newOwner, executeAfter);
    }

    /**
     * @notice Recovers an account using a zk email proof.
     * @dev Rotates the account owner address to a new address.
     *      This function is the third and final function that needs to be called in the
     *      recovery process. After configureRecovery & initiateRecovery
     */
    function recoverAccount() public {
        address account = address(this);

        if (recoveryRequest.executeAfter == 0) {
            revert RECOVERY_NOT_INITIATED();
        }

        if (block.timestamp > recoveryRequest.executeAfter) {
            delete recoveryRequest;

            owner = recoveryRequest.pendingNewOwner;

            emit AccountRecovered(account, recoveryRequest.pendingNewOwner);
        } else {
            revert DELAY_NOT_PASSED();
        }
    }

    /**
     * @notice Cancels the recovery process of the sender if it exits.
     * @dev Deletes the recovery request accociated with a account. Assumes
     *      the msg.sender is the account that the recovery request is being deleted for
     */
    function cancelRecovery() external {
        address account = address(this);
        delete recoveryRequest;
        emit RecoveryCancelled(account);
    }

    /**
     * @notice Sets a custom delay for recovering the account.
     * @dev Custom delay is used instead of the default delay when recovering the
     *      account. Custom delays should be configured with care as they can be
     *      used to bypass the default delay.
     * @param delay The custom delay to be used when recovering the account
     */
    function setRecoveryDelay(uint256 delay) external {
        address account = address(this);
        recoveryDelay = delay;
        emit RecoveryDelaySet(account, delay);
    }

    /// @notice Return the DKIM public key hash for a given email domain and account address
    /// @param emailDomain Email domain for which the DKIM public key hash is to be returned
    function isDKIMPublicKeyHashValid(
        string memory emailDomain,
        bytes32 publicKeyHash
    ) public view returns (bool) {
        if (dkimRegistry == address(0)) {
            return
                defaultDkimRegistry.isDKIMPublicKeyHashValid(
                    emailDomain,
                    publicKeyHash
                );
        } else {
            return
                IDKIMRegsitry(dkimRegistry).isDKIMPublicKeyHashValid(
                    emailDomain,
                    publicKeyHash
                );
        }
    }
}
