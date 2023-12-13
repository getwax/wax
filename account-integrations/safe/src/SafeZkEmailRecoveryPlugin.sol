// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {MockGroth16Verifier} from "./utils/MockGroth16Verifier.sol";
import {ISafe} from "./utils/Safe4337Base.sol";

interface ISafeECDSAPlugin {
    function getOwner(address safe) external view returns (address);
}

struct ZkEmailRecoveryStorage {
    bytes32 recoveryHash;
}

/**
 * A safe plugin that recovers a safe ecdsa plugin owner via a zkp of an email.
 * NOT FOR PRODUCTION USE
 */
contract SafeZkEmailRecoveryPlugin {
    bytes32 immutable RECOVERY_HASH_DOMAIN;
    string public constant DOMAIN_NAME = "RECOVERY_PLUGIN";
    uint256 public constant DOMAIN_VERSION = 1;

    mapping(address => ZkEmailRecoveryStorage) public zkEmailRecoveryStorage;

    error INVALID_RECOVERY_HASH(
        bytes32 recoveryHash,
        bytes32 expectedRecoveryHash
    );
    error MODULE_NOT_ENABLED();
    error INVALID_OWNER(address expectedOwner, address owner);
    error INVALID_PROOF();

    MockGroth16Verifier public immutable verifier;

    constructor(address _verifier) {
        verifier = MockGroth16Verifier(_verifier);
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
     * @dev this function assumes it is being called from a safe - see how msg.sender is interpreted.
     * @param recoveryHash hash of domain, email and salt - keccak256(abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt))
     * @param owner owner of the ecdsa plugin
     * @param ecsdaPlugin safe ecsda plugin address that this function will be adding a recovery option for
     */
    function addRecoveryHash(
        bytes32 recoveryHash,
        address owner,
        address ecsdaPlugin
    ) external {
        address safe = msg.sender;

        bool moduleEnabled = ISafe(safe).isModuleEnabled(address(this));
        if (!moduleEnabled) revert MODULE_NOT_ENABLED();

        address expectedOwner = ISafeECDSAPlugin(ecsdaPlugin).getOwner(safe);
        if (owner != expectedOwner) revert INVALID_OWNER(expectedOwner, owner);

        zkEmailRecoveryStorage[safe] = ZkEmailRecoveryStorage(recoveryHash);
    }

    /**
     * @notice recovers a safe ecdsa plugin using a zk email proof.
     * @dev rotates the safe ecdsa plugin owner address to a new address. The email address hash is kept hidden until this function is called.
     * This function is designed so it can be called from any account and account type.
     * @param safe the safe that manages the safe ecdsa plugin being recovered
     * @param ecdsaPlugin safe ecsda plugin address that this function will be rotating the owner address for
     * @param newOwner the new owner address of the safe ecdsa plugin
     * @param salt the salt used in the recovery hash
     * @param email the email address hash used in the recovery hash
     * @param a part of the proof
     * @param b part of the proof
     * @param c part of the proof
     * @param publicSignals public inputs for the zkp
     */
    function recoverAccount(
        address safe,
        address ecdsaPlugin,
        address newOwner,
        string memory salt,
        bytes32 email,
        uint256[2] memory a,
        uint256[2][2] memory b,
        uint256[2] memory c,
        uint256[1] memory publicSignals
    ) external {
        ZkEmailRecoveryStorage memory recoveryStorage = zkEmailRecoveryStorage[
            safe
        ];

        // Email is protected and it is only revealed on recovery
        bytes32 expectedRecoveryHash = keccak256(
            abi.encodePacked(RECOVERY_HASH_DOMAIN, email, salt)
        );

        if (expectedRecoveryHash != recoveryStorage.recoveryHash) {
            revert INVALID_RECOVERY_HASH(
                recoveryStorage.recoveryHash,
                expectedRecoveryHash
            );
        }

        // verify proof
        bool verified = verifier.verifyProof(a, b, c, publicSignals);
        if (!verified) revert INVALID_PROOF();

        bytes memory data = abi.encodeWithSignature(
            "enable(bytes)",
            abi.encodePacked(newOwner)
        );

        ISafe(safe).execTransactionFromModule(ecdsaPlugin, 0, data, 0);
    }
}
