// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {MockGroth16Verifier} from "./utils/MockGroth16Verifier.sol";
import {MockDKIMRegsitry} from "./utils/MockDKIMRegsitry.sol";
import {IDKIMRegsitry} from "./interface/IDKIMRegsitry.sol";
import {ISafe} from "./utils/Safe4337Base.sol";

interface ISafeECDSAPlugin {
    function getOwner(address safe) external view returns (address);
}

struct ZkEmailRecoveryStorage {
    bytes32 recoveryHash;
    bytes32 dkimPublicKeyHash;
}

/**
 * A safe plugin that recovers a safe ecdsa plugin owner via a zkp of an email.
 * NOT FOR PRODUCTION USE
 */
contract SafeZkEmailRecoveryPlugin {
    // Default DKIM public key hashes registry
    IDKIMRegsitry public immutable defaultDkimRegistry;

    bytes32 immutable RECOVERY_HASH_DOMAIN;
    string public constant DOMAIN_NAME = "RECOVERY_PLUGIN";
    uint256 public constant DOMAIN_VERSION = 1;

    // Mapping of safe address to plugin storage
    mapping(address => ZkEmailRecoveryStorage) public zkEmailRecoveryStorage;

    // Mapping of safe address to dkim registry address
    mapping(address => address) public dkimRegistryOfSafe;

    error INVALID_DKIM_KEY_HASH(
        address safe,
        string emailDomain,
        bytes32 dkimPublicKeyHash
    );
    error MODULE_NOT_ENABLED();
    error INVALID_OWNER(address expectedOwner, address owner);
    error INVALID_PROOF();

    MockGroth16Verifier public immutable verifier;

    constructor(address _verifier, address _defaultDkimRegistry) {
        verifier = MockGroth16Verifier(_verifier);
        defaultDkimRegistry = IDKIMRegsitry(_defaultDkimRegistry);

        RECOVERY_HASH_DOMAIN = keccak256(
            abi.encodePacked(
                DOMAIN_NAME,
                DOMAIN_VERSION,
                block.chainid,
                address(this)
            )
        );
    }

    /**
     * @notice returns storage accociated with a safe address
     * @param safe address to query storage with
     */
    function getZkEmailRecoveryStorage(
        address safe
    ) external view returns (ZkEmailRecoveryStorage memory) {
        return zkEmailRecoveryStorage[safe];
    }

    /**
     * @notice stores a recovery hash that can be used to recover a ecdsa plugin at a later stage.
     * @dev dkimRegistry can be a zero address if the user wants to use the defaultDkimRegistry.
     *      This function assumes it is being called from a safe - see how msg.sender is interpreted.
     * @param ecsdaPlugin safe ecsda plugin address that this function will be adding a recovery option for
     * @param owner owner of the ecdsa plugin
     * @param recoveryHash hash of domain, email and salt - keccak256(abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt))
     * @param dkimPublicKeyHash hash of DKIM public key - keccak256(abi.encodePacked(dkimPublicKey))
     * @param dkimRegistry address of a user-defined DKIM registry
     */
    function addRecoveryHash(
        address ecsdaPlugin,
        address owner,
        bytes32 recoveryHash,
        bytes32 dkimPublicKeyHash,
        address dkimRegistry
    ) external {
        address safe = msg.sender;

        bool moduleEnabled = ISafe(safe).isModuleEnabled(address(this));
        if (!moduleEnabled) revert MODULE_NOT_ENABLED();

        address expectedOwner = ISafeECDSAPlugin(ecsdaPlugin).getOwner(safe);
        if (owner != expectedOwner) revert INVALID_OWNER(expectedOwner, owner);

        zkEmailRecoveryStorage[safe] = ZkEmailRecoveryStorage(
            recoveryHash,
            dkimPublicKeyHash
        );
        dkimRegistryOfSafe[safe] = dkimRegistry;
    }

    /**
     * @notice recovers a safe ecdsa plugin using a zk email proof.
     * @dev rotates the safe ecdsa plugin owner address to a new address. The email address hash is kept hidden until this function is called.
     * This function is designed so it can be called from any account and account type.
     * @param safe the safe that manages the safe ecdsa plugin being recovered
     * @param ecdsaPlugin safe ecsda plugin address that this function will be rotating the owner address for
     * @param newOwner the new owner address of the safe ecdsa plugin
     * @param emailDomain domain name of the sender's email
     * @param a part of the proof
     * @param b part of the proof
     * @param c part of the proof
     */
    function recoverAccount(
        address safe,
        address ecdsaPlugin,
        address newOwner,
        string memory emailDomain,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c
    ) external {
        ZkEmailRecoveryStorage memory recoveryStorage = zkEmailRecoveryStorage[
            safe
        ];

        if (
            !this.isDKIMPublicKeyHashValid(
                safe,
                emailDomain,
                recoveryStorage.dkimPublicKeyHash
            )
        ) {
            revert INVALID_DKIM_KEY_HASH(
                safe,
                emailDomain,
                recoveryStorage.dkimPublicKeyHash
            );
        }

        uint256[4] memory publicSignals = [
            uint256(uint160(safe)),
            uint256(recoveryStorage.recoveryHash),
            uint256(uint160(newOwner)),
            uint256(recoveryStorage.dkimPublicKeyHash)
        ];

        // verify proof
        bool verified = verifier.verifyProof(a, b, c, publicSignals);
        if (!verified) revert INVALID_PROOF();

        bytes memory data = abi.encodeWithSignature(
            "enable(bytes)",
            abi.encodePacked(newOwner)
        );

        ISafe(safe).execTransactionFromModule(ecdsaPlugin, 0, data, 0);
    }

    /// @notice Return the DKIM public key hash for a given email domain and safe address
    /// @param safe the address of the safe that controls the plugin
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
