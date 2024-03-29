// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.19;

import {BasePlugin} from "erc6900-reference-implementation/plugins/BasePlugin.sol";
import {IPluginExecutor} from "erc6900-reference-implementation/interfaces/IPluginExecutor.sol";
import {ManifestFunction, ManifestAssociatedFunctionType, ManifestAssociatedFunction, PluginManifest, PluginMetadata, IPlugin} from "erc6900-reference-implementation/interfaces/IPlugin.sol";
import {MockGroth16Verifier} from "../safe/utils/MockGroth16Verifier.sol";
import {MockDKIMRegsitry} from "../safe/utils/MockDKIMRegsitry.sol";
import {IDKIMRegsitry} from "../safe/interface/IDKIMRegsitry.sol";

/*//////////////////////////////////////////////////////////////////////////
    THIS CONTRACT IS STILL IN ACTIVE DEVELOPMENT. NOT FOR PRODUCTION USE        
//////////////////////////////////////////////////////////////////////////*/

struct RecoveryRequest {
    bytes32 recoveryHash;
    bytes32 dkimPublicKeyHash;
    uint256 executeAfter;
    address pendingNewOwner;
}

/// @title ZK Email Recovery Plugin
/// @author Wax
/// @notice This plugin recovers a ERC 6900 account via zk email guardians
contract ERC6900ZkEmailRecoveryModule is BasePlugin {
    // metadata used by the pluginMetadata() method down below
    string public constant NAME = "ZK Email Recovery Plugin";
    string public constant VERSION = "1.0.0";
    string public constant AUTHOR = "Wax";

    // this is a constant used in the manifest, to reference our only dependency: the single owner plugin
    // since it is the first, and only, plugin the index 0 will reference the single owner plugin
    // we can use this to tell the modular account that we should use the single owner plugin to validate our user op
    // in other words, we'll say "make sure the person calling the recovery functions is an owner of the account using our single plugin" // TODO: revisit this - recovery is more complicated as the owner is compromised
    uint256
        internal constant _MANIFEST_DEPENDENCY_INDEX_OWNER_USER_OP_VALIDATION =
        0;

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

    // ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    // ┃    Execution functions    ┃
    // ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

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
        address account = msg.sender;

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
        address account = msg.sender;

        if (recoveryRequest.executeAfter == 0) {
            revert RECOVERY_NOT_INITIATED();
        }

        if (block.timestamp > recoveryRequest.executeAfter) {
            delete recoveryRequest;

            // TODO: implement recovery logic for 6900 owner plugin
            // owner = recoveryRequest.pendingNewOwner;

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
        address account = msg.sender;
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
        address account = msg.sender;
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

    // ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
    // ┃    Plugin interface functions    ┃
    // ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛

    /// @inheritdoc BasePlugin
    function onInstall(bytes calldata data) external override {
        (
            bytes32 recoveryHash,
            bytes32 dkimPublicKeyHash,
            address _dkimRegistry,
            uint256 customDelay
        ) = abi.decode(data, (bytes32, bytes32, address, uint256));

        address account = msg.sender;

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
            msg.sender,
            recoveryHash,
            dkimPublicKeyHash,
            dkimRegistry,
            customDelay
        );
    }

    /// @inheritdoc BasePlugin
    function onUninstall(bytes calldata) external pure override {}

    /// @inheritdoc BasePlugin
    function pluginManifest()
        external
        pure
        override
        returns (PluginManifest memory)
    {
        PluginManifest memory manifest;

        // since we are using the modular account, we will specify one depedency
        // which will handle the user op validation for ownership
        // you can find this depedency specified in the installPlugin call in the tests
        manifest.dependencyInterfaceIds = new bytes4[](1);
        manifest.dependencyInterfaceIds[0] = type(IPlugin).interfaceId;

        // we have several execution functions that can be called, here we define
        // those functions on the manifest as something that can be called during execution
        manifest.executionFunctions = new bytes4[](5);
        manifest.executionFunctions[0] = this.initiateRecovery.selector;
        manifest.executionFunctions[1] = this.recoverAccount.selector;
        manifest.executionFunctions[2] = this.cancelRecovery.selector;
        manifest.executionFunctions[3] = this.setRecoveryDelay.selector;
        manifest.executionFunctions[4] = this.isDKIMPublicKeyHashValid.selector;

        // you can think of ManifestFunction as a reference to a function somewhere,
        // we want to say "use this function" for some purpose - in this case,
        // we'll be using the user op validation function from the single owner dependency
        // and this is specified by the depdendency index
        ManifestFunction
            memory ownerUserOpValidationFunction = ManifestFunction({
                functionType: ManifestAssociatedFunctionType.DEPENDENCY,
                functionId: 0, // unused since it's a dependency
                dependencyIndex: _MANIFEST_DEPENDENCY_INDEX_OWNER_USER_OP_VALIDATION
            });

        // here we will link together the recovery functions with the single owner user op validation
        // this basically says "use this user op validation function and make sure everythings okay before calling the recovery functions"
        // this will ensure that only an owner of the account can call the recovery functions
        manifest.userOpValidationFunctions = new ManifestAssociatedFunction[](
            1
        );
        manifest.userOpValidationFunctions[0] = ManifestAssociatedFunction({
            executionSelector: this.initiateRecovery.selector,
            associatedFunction: ownerUserOpValidationFunction
        });
        // TODO: recoverAccount should be permissionless if threshold is met
        manifest.userOpValidationFunctions[1] = ManifestAssociatedFunction({
            executionSelector: this.recoverAccount.selector,
            associatedFunction: ownerUserOpValidationFunction
        });
        manifest.userOpValidationFunctions[2] = ManifestAssociatedFunction({
            executionSelector: this.cancelRecovery.selector,
            associatedFunction: ownerUserOpValidationFunction
        });
        manifest.userOpValidationFunctions[3] = ManifestAssociatedFunction({
            executionSelector: this.setRecoveryDelay.selector,
            associatedFunction: ownerUserOpValidationFunction
        });
        manifest.userOpValidationFunctions[4] = ManifestAssociatedFunction({
            executionSelector: this.isDKIMPublicKeyHashValid.selector,
            associatedFunction: ownerUserOpValidationFunction
        });

        // TODO: research best way to utilise this part of the manifest
        // finally here we will always deny runtime calls to the initiateRecovery function as we will only call it through user ops
        // this avoids a potential issue where a future plugin may define
        // a runtime validation function for it and unauthorized calls may occur due to that
        manifest.preRuntimeValidationHooks = new ManifestAssociatedFunction[](
            1
        );
        manifest.preRuntimeValidationHooks[0] = ManifestAssociatedFunction({
            executionSelector: this.initiateRecovery.selector,
            associatedFunction: ManifestFunction({
                functionType: ManifestAssociatedFunctionType
                    .PRE_HOOK_ALWAYS_DENY,
                functionId: 0,
                dependencyIndex: 0
            })
        });

        return manifest;
    }

    /// @inheritdoc BasePlugin
    function pluginMetadata()
        external
        pure
        virtual
        override
        returns (PluginMetadata memory)
    {
        PluginMetadata memory metadata;
        metadata.name = NAME;
        metadata.version = VERSION;
        metadata.author = AUTHOR;
        return metadata;
    }
}
