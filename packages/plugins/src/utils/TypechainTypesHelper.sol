// SPDX-License-Identifier: MIT
pragma solidity >=0.7.0 <0.9.0;

/**
 * Helper file to import contracts so that hardhat can generate required typechain types
 */
import {SimulateTxAccessor} from "safe-contracts/contracts/accessors/SimulateTxAccessor.sol";
import {SafeProxyFactory} from "safe-contracts/contracts/proxies/SafeProxyFactory.sol";
import {TokenCallbackHandler} from "safe-contracts/contracts/handler/TokenCallbackHandler.sol";
import {CompatibilityFallbackHandler} from "safe-contracts/contracts/handler/CompatibilityFallbackHandler.sol";
import {CreateCall} from "safe-contracts/contracts/libraries/CreateCall.sol";
import {MultiSend} from "safe-contracts/contracts/libraries/MultiSend.sol";
import {MultiSendCallOnly} from "safe-contracts/contracts/libraries/MultiSendCallOnly.sol";
import {SignMessageLib} from "safe-contracts/contracts/libraries/SignMessageLib.sol";
import {SafeL2} from "safe-contracts/contracts/SafeL2.sol";
import {Safe} from "safe-contracts/contracts/Safe.sol";
import {EntryPoint} from "account-abstraction/contracts/core/EntryPoint.sol";
import {SimpleAccountFactory} from "account-abstraction/contracts/samples/SimpleAccountFactory.sol";
import {WebAuthn} from "wax/primitives/src/WebAuthn.sol";
