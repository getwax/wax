// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {MockGroth16Verifier} from "./utils/MockGroth16Verifier.sol";
import {MockDKIMRegsitry} from "./utils/MockDKIMRegsitry.sol";
import {IDKIMRegsitry} from "./interface/IDKIMRegsitry.sol";
import {ISafe} from "./utils/Safe4337Base.sol";

/*//////////////////////////////////////////////////////////////////////////
    THIS CONTRACT IS STILL IN ACTIVE DEVELOPMENT. NOT FOR PRODUCTION USE        
//////////////////////////////////////////////////////////////////////////*/

interface ISafeECDSAPlugin {
    function getOwner(address safe) external view returns (address);
}

struct RecoveryRequest {
    bytes32 recoveryHash;
    bytes32 dkimPublicKeyHash;
    uint256 executeAfter;
    address pendingNewOwner;
}

/**
 * A safe plugin that recovers a safe ecdsa plugin owner via a zkp of an email.
 * NOT FOR PRODUCTION USE
 */
contract SafeZkEmailRecoveryPlugin {
    /** Default DKIM public key hashes registry */
    IDKIMRegsitry public immutable defaultDkimRegistry;

    /** Default delay has been set to a large timeframe on purpose. Please use a default delay suited to your specific context */
    uint256 public constant defaultDelay = 2 weeks;

    bytes32 immutable RECOVERY_HASH_DOMAIN;

    /** Mapping of safe address to recovery request */
    mapping(address => RecoveryRequest) public recoveryRequests;

    /** Mapping of safe address to a custom recovery delay */
    mapping(address => uint256) public recoveryDelay;

    /** Mapping of safe address to dkim registry address */
    mapping(address => address) public dkimRegistryOfSafe;

    error MODULE_NOT_ENABLED();
    error INVALID_OWNER(address expectedOwner, address owner);
    error RECOVERY_ALREADY_INITIATED();
    error RECOVERY_NOT_CONFIGURED();
    error INVALID_DKIM_KEY_HASH(
        address safe,
        string emailDomain,
        bytes32 dkimPublicKeyHash
    );
    error INVALID_PROOF();
    error RECOVERY_NOT_INITIATED();
    error DELAY_NOT_PASSED();

    event RecoveryConfigured(
        address indexed safe,
        address ecsdaPlugin,
        address indexed owner,
        bytes32 recoveryHash,
        bytes32 dkimPublicKeyHash,
        address dkimRegistry,
        uint256 customDelay
    );
    event RecoveryInitiated(
        address indexed safe,
        address newOwner,
        uint256 executeAfter
    );
    event PluginRecovered(
        address indexed safe,
        address ecdsaPlugin,
        address newOwner
    );
    event RecoveryCancelled(address indexed safe);
    event RecoveryDelaySet(address indexed safe, uint256 delay);

    MockGroth16Verifier public immutable verifier;

    constructor(address _verifier, address _defaultDkimRegistry) {
        verifier = MockGroth16Verifier(_verifier);
        defaultDkimRegistry = IDKIMRegsitry(_defaultDkimRegistry);

        RECOVERY_HASH_DOMAIN = keccak256(
            abi.encode(
                keccak256(
                    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
                ),
                keccak256("SafeZKEmailRecoveryPlugin"),
                keccak256("1"),
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice Returns recovery request accociated with a safe address
     * @param safe address to query storage with
     */
    function getRecoveryRequest(
        address safe
    ) external view returns (RecoveryRequest memory) {
        return recoveryRequests[safe];
    }

    /**
     * @notice Stores a recovery hash that can be used to recover a ecdsa plugin
     *         at a later stage.
     * @dev dkimRegistry can be a zero address if the user wants to use the
     *      defaultDkimRegistry. customDelay can be 0 if the user wants to use defaultDelay
     *      This function assumes it is being called from a safe - see how msg.sender
     *      is interpreted. This is the first function that must be called when setting up recovery.
     * @param ecsdaPlugin Safe ecsda plugin address that this function will be adding a recovery option for
     * @param owner Owner of the ecdsa plugin
     * @param recoveryHash Hash of domain, email and salt - keccak256(abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt))
     * @param dkimPublicKeyHash Hash of DKIM public key - keccak256(abi.encodePacked(dkimPublicKey))
     * @param dkimRegistry Address of a user-defined DKIM registry
     * @param customDelay A custom delay to set the recoveryDelay value that is associated with a safe.
     */
    function configureRecovery(
        address ecsdaPlugin,
        address owner,
        bytes32 recoveryHash,
        bytes32 dkimPublicKeyHash,
        address dkimRegistry,
        uint256 customDelay
    ) external {
        address safe = msg.sender;

        bool moduleEnabled = ISafe(safe).isModuleEnabled(address(this));
        if (!moduleEnabled) revert MODULE_NOT_ENABLED();

        address expectedOwner = ISafeECDSAPlugin(ecsdaPlugin).getOwner(safe);
        if (owner != expectedOwner) revert INVALID_OWNER(expectedOwner, owner);

        if (recoveryRequests[safe].executeAfter > 0) {
            revert RECOVERY_ALREADY_INITIATED();
        }

        if (customDelay > 0) {
            recoveryDelay[safe] = customDelay;
        } else {
            recoveryDelay[safe] = defaultDelay;
        }

        recoveryRequests[safe] = RecoveryRequest({
            recoveryHash: recoveryHash,
            dkimPublicKeyHash: dkimPublicKeyHash,
            executeAfter: 0,
            pendingNewOwner: address(0)
        });
        dkimRegistryOfSafe[safe] = dkimRegistry;

        emit RecoveryConfigured(
            safe,
            ecsdaPlugin,
            owner,
            recoveryHash,
            dkimPublicKeyHash,
            dkimRegistry,
            customDelay
        );
    }

    /**
     * @notice Initiates a recovery of a safe ecdsa plugin using a zk email proof.
     * @dev Rotates the safe ecdsa plugin owner address to a new address. Uses the
     *      default delay period if no custom delay has been set. This is the second
     *      function that should be called in the recovery process - after configureRecovery
     * @param safe The safe that manages the safe ecdsa plugin being recovered
     * @param newOwner The new owner address of the safe ecdsa plugin
     * @param emailDomain Domain name of the sender's email
     * @param a Part of the proof
     * @param b Part of the proof
     * @param c Part of the proof
     */
    function initiateRecovery(
        address safe,
        address newOwner,
        string memory emailDomain,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c
    ) external {
        RecoveryRequest memory recoveryRequest = recoveryRequests[safe];

        if (recoveryRequest.recoveryHash == bytes32(0)) {
            revert RECOVERY_NOT_CONFIGURED();
        }

        if (recoveryRequest.executeAfter > 0) {
            revert RECOVERY_ALREADY_INITIATED();
        }

        if (
            !this.isDKIMPublicKeyHashValid(
                safe,
                emailDomain,
                recoveryRequest.dkimPublicKeyHash
            )
        ) {
            revert INVALID_DKIM_KEY_HASH(
                safe,
                emailDomain,
                recoveryRequest.dkimPublicKeyHash
            );
        }

        uint256[4] memory publicSignals = [
            uint256(uint160(safe)),
            uint256(recoveryRequest.recoveryHash),
            uint256(uint160(newOwner)),
            uint256(recoveryRequest.dkimPublicKeyHash)
        ];

        // verify proof
        bool verified = verifier.verifyProof(a, b, c, publicSignals);
        if (!verified) revert INVALID_PROOF();

        uint256 executeAfter = block.timestamp + recoveryDelay[safe];

        recoveryRequests[safe].executeAfter = executeAfter;
        recoveryRequests[safe].pendingNewOwner = newOwner;

        emit RecoveryInitiated(safe, newOwner, executeAfter);
    }

    /**
     * @notice Recovers a safe ecdsa plugin using a zk email proof.
     * @dev Rotates the safe ecdsa plugin owner address to a new address.
     *      This function is designed so it can be called from any account and account type.
     *      This function is the third and final function that needs to be called in the
     *      recovery process. After configureRecovery & initiateRecovery
     * @param safe The safe that manages the safe ecdsa plugin being recovered
     * @param ecdsaPlugin Safe ecsda plugin address that this function will be rotating the owner address for
     */
    function recoverPlugin(address safe, address ecdsaPlugin) external {
        RecoveryRequest memory recoveryRequest = recoveryRequests[safe];

        if (recoveryRequest.executeAfter == 0) {
            revert RECOVERY_NOT_INITIATED();
        }

        if (block.timestamp > recoveryRequest.executeAfter) {
            delete recoveryRequests[safe];

            bytes memory data = abi.encodeWithSignature(
                "enable(bytes)",
                abi.encodePacked(recoveryRequest.pendingNewOwner)
            );

            ISafe(safe).execTransactionFromModule(ecdsaPlugin, 0, data, 0);

            emit PluginRecovered(
                safe,
                ecdsaPlugin,
                recoveryRequest.pendingNewOwner
            );
        } else {
            revert DELAY_NOT_PASSED();
        }
    }

    /**
     * @notice Cancels the recovery process of the sender if it exits.
     * @dev Deletes the recovery request accociated with a safe. Assumes
     *      the msg.sender is the safe that the recovery request is being deleted for
     */
    function cancelRecovery() external {
        address safe = msg.sender;
        delete recoveryRequests[safe];
        emit RecoveryCancelled(safe);
    }

    /**
     * @notice Sets a custom delay for recovering a plugin for a specific safe.
     * @dev Custom delay is used instead of the default delay when recovering a
     *      plugin. Custom delays should be configured with care as they can be
     *      used to bypass the default delay.
     * @param delay The custom delay to be used when recovering a plugin for the safe
     */
    function setRecoveryDelay(uint256 delay) external {
        address safe = msg.sender;
        recoveryDelay[safe] = delay;
        emit RecoveryDelaySet(safe, delay);
    }

    /// @notice Return the DKIM public key hash for a given email domain and safe address
    /// @param safe The address of the safe that controls the plugin
    /// @param emailDomain Email domain for which the DKIM public key hash is to be returned
    function isDKIMPublicKeyHashValid(
        address safe,
        string memory emailDomain,
        bytes32 publicKeyHash
    ) public view returns (bool) {
        address dkimRegistry = dkimRegistryOfSafe[safe];

        if (dkimRegistry == address(0)) {
            dkimRegistry = address(defaultDkimRegistry);
        }

        return
            IDKIMRegsitry(dkimRegistry).isDKIMPublicKeyHashValid(
                emailDomain,
                publicKeyHash
            );
    }
}
