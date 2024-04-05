// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {EmailAuthMsg} from "ether-email-auth/packages/contracts/src/EmailAuth.sol";

interface IEmailAccountRecovery {
    function handleAcceptance(
        EmailAuthMsg memory emailAuthMsg,
        uint templateIdx
    ) external;

    function handleRecovery(
        EmailAuthMsg memory emailAuthMsg,
        uint templateIdx
    ) external;

    function completeRecovery() external;
}

/** Helper contract that routes relayer calls to correct EmailAccountRecovery implementation */
contract EmailAccountRecoveryRouter {
    address public immutable emailAccountRecoveryImpl;

    constructor(address _emailAccountRecoveryImpl) {
        emailAccountRecoveryImpl = _emailAccountRecoveryImpl;
    }

    function handleAcceptance(
        EmailAuthMsg memory emailAuthMsg,
        uint templateIdx
    ) external {
        IEmailAccountRecovery(emailAccountRecoveryImpl).handleAcceptance(
            emailAuthMsg,
            templateIdx
        );
    }

    function handleRecovery(
        EmailAuthMsg memory emailAuthMsg,
        uint templateIdx
    ) external {
        IEmailAccountRecovery(emailAccountRecoveryImpl).handleRecovery(
            emailAuthMsg,
            templateIdx
        );
    }

    function completeRecovery() external {
        IEmailAccountRecovery(emailAccountRecoveryImpl).completeRecovery();
    }
}
