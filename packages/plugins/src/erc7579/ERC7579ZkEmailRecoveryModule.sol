// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IValidator, VALIDATION_SUCCESS, VALIDATION_FAILED, MODULE_TYPE_VALIDATOR} from "erc7579-implementation/src/interfaces/IERC7579Module.sol";
import {ModeLib, ModeCode, CallType, CALLTYPE_SINGLE} from "erc7579-implementation/src/lib/ModeLib.sol";
import {IERC7579Account} from "erc7579-implementation/src/interfaces/IERC7579Account.sol";
import {ExecutionLib} from "erc7579-implementation/src/lib/ExecutionLib.sol";
import {PackedUserOperation} from "account-abstraction/interfaces/IEntryPoint.sol";
import {ValidationData} from "account-abstraction/core/Helpers.sol";
import {MockGroth16Verifier} from "../safe/utils/MockGroth16Verifier.sol";
import {MockDKIMRegsitry} from "../safe/utils/MockDKIMRegsitry.sol";
import {IDKIMRegsitry} from "../safe/interface/IDKIMRegsitry.sol";

struct RecoveryRequest {
    bytes32 recoveryHash;
    bytes32 dkimPublicKeyHash;
    uint256 executeAfter;
    address pendingNewOwner;
}

contract ERC7579ZkEmailRecoveryModule is IValidator {
    /*//////////////////////////////////////////////////////////////////////////
                            CONSTANTS & STORAGE
    //////////////////////////////////////////////////////////////////////////*/

    /** Default DKIM public key hashes registry */
    IDKIMRegsitry public immutable defaultDkimRegistry;

    /** verifier */
    MockGroth16Verifier public immutable verifier;

    /** Default delay has been set to a large timeframe on purpose. Please use a default
    delay suited to your specific context */
    uint256 public constant defaultDelay = 2 weeks;

    /** recovery hash domain */
    bytes32 immutable RECOVERY_HASH_DOMAIN;

    /** recovery request */
    RecoveryRequest public recoveryRequest;

    /** custom recovery delay */
    uint256 public recoveryDelay;

    /** dkim registry address */
    address public dkimRegistry;

    mapping(address => bool) internal initialized;

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
    error UNSUPPORTED_OPERATION();

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

    /*//////////////////////////////////////////////////////////////////////////
                                     CONFIG
    //////////////////////////////////////////////////////////////////////////*/

    function onInstall(bytes calldata data) external override {
        if (isInitialized(msg.sender)) revert AlreadyInitialized(msg.sender);

        // Get the threshold and guardians from the data
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

        initialized[msg.sender] = true;

        emit RecoveryConfigured(
            account,
            msg.sender,
            recoveryHash,
            dkimPublicKeyHash,
            dkimRegistry,
            customDelay
        );
    }

    function onUninstall(bytes calldata) external override {
        if (!isInitialized(msg.sender)) revert NotInitialized(msg.sender);
        initialized[msg.sender] = false;
    }

    function isInitialized(address smartAccount) public view returns (bool) {
        return initialized[smartAccount];
    }

    /*//////////////////////////////////////////////////////////////////////////
                                     MODULE LOGIC
    //////////////////////////////////////////////////////////////////////////*/

    function validateUserOp(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) external override returns (uint256) {
        address account = address(this);

        (
            address newOwner,
            string memory emailDomain,
            uint256[2] memory a,
            uint256[2][2] memory b,
            uint256[2] memory c
        ) = abi.decode(
                userOp.signature,
                (address, string, uint256[2], uint256[2][2], uint256[2])
            );

        // Check if the execution is allowed
        bool isAllowedExecution;
        bytes4 selector = bytes4(userOp.callData[0:4]);
        if (selector == IERC7579Account.execute.selector) {
            // Decode and check the execution
            // Only single executions to installed validators are allowed
            isAllowedExecution = _decodeAndCheckExecution(userOp.callData);
        }

        if (recoveryRequest.recoveryHash == bytes32(0)) {
            return VALIDATION_FAILED;
        }

        if (recoveryRequest.executeAfter > 0) {
            return VALIDATION_FAILED;
        }

        if (
            !this.isDKIMPublicKeyHashValid(
                emailDomain,
                recoveryRequest.dkimPublicKeyHash
            )
        ) {
            return VALIDATION_FAILED;
        }

        uint256[4] memory publicSignals = [
            uint256(uint160(account)),
            uint256(recoveryRequest.recoveryHash),
            uint256(uint160(newOwner)),
            uint256(recoveryRequest.dkimPublicKeyHash)
        ];

        // verify proof
        bool verified = verifier.verifyProof(a, b, c, publicSignals);
        if (!verified) return VALIDATION_FAILED;

        uint256 executeAfter = block.timestamp + recoveryDelay;
        recoveryRequest.executeAfter = executeAfter;
        recoveryRequest.pendingNewOwner = newOwner;

        emit RecoveryInitiated(account, newOwner, executeAfter);
        return VALIDATION_SUCCESS;
    }

    function isValidSignatureWithSender(
        address,
        bytes32 hash,
        bytes calldata data
    ) external view override returns (bytes4) {
        // ERC-1271 not supported for recovery
        revert UNSUPPORTED_OPERATION();
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

    /*//////////////////////////////////////////////////////////////////////////
                                     INTERNAL
    //////////////////////////////////////////////////////////////////////////*/

    function _decodeAndCheckExecution(
        bytes calldata callData
    ) internal returns (bool isAllowedExecution) {
        // Get the mode and call type
        ModeCode mode = ModeCode.wrap(bytes32(callData[4:36]));
        CallType calltype = ModeLib.getCallType(mode);

        if (calltype == CALLTYPE_SINGLE) {
            // Decode the calldata
            (address to, , ) = ExecutionLib.decodeSingle(callData[100:]);

            // Check if the module is installed as a validator
            return
                IERC7579Account(msg.sender).isModuleInstalled(
                    MODULE_TYPE_VALIDATOR,
                    to,
                    ""
                );
        } else {
            return false;
        }
    }

    /*//////////////////////////////////////////////////////////////////////////
                                     METADATA
    //////////////////////////////////////////////////////////////////////////*/

    function name() external pure returns (string memory) {
        return "SocialRecoveryValidator";
    }

    function version() external pure returns (string memory) {
        return "0.0.1";
    }

    function isModuleType(uint256 typeID) external view returns (bool) {
        return typeID == MODULE_TYPE_VALIDATOR;
    }
}
