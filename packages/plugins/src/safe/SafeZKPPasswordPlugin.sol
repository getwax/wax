// SPDX-License-Identifier: LGPL-3.0-only
pragma solidity >=0.7.0 <0.9.0;
pragma abicoder v2;

import {IGroth16Verifier} from "./interface/IGroth16Verifier.sol";
import {ISafe} from "./interface/ISafe.sol";
import {Safe4337Base, SIG_VALIDATION_FAILED} from "./utils/Safe4337Base.sol";
import {IEntryPoint, PackedUserOperation} from "account-abstraction/contracts/interfaces/IEntryPoint.sol";

struct ZKPPasswordOwnerStorage {
    address owner;
}

contract SafeZKPPasswordPlugin is Safe4337Base {
    mapping(address => ZKPPasswordOwnerStorage) public zkpPasswordOwnerStorage;

    address public immutable myAddress; // Module address
    address private immutable _entryPoint;
    IGroth16Verifier private immutable _verifier;

    address internal constant _SENTINEL_MODULES = address(0x1);

    event OWNER_UPDATED(
        address indexed safe,
        address indexed oldOwner,
        address indexed newOwner
    );

    constructor(address entryPointAddress, IGroth16Verifier verifier) {
        myAddress = address(this);
        _entryPoint = entryPointAddress;
        _verifier = verifier;
    }

    function getOwner(address safe) external view returns (address owner) {
        owner = zkpPasswordOwnerStorage[safe].owner;
    }

    function execTransaction(
        address to,
        uint256 value,
        bytes calldata data
    ) external payable {
        _requireFromEntryPoint();

        bool success = _currentSafe().execTransactionFromModule(
            to,
            value,
            data,
            0
        );

        require(success, "tx failed");
    }

    function enableMyself(address ownerKey) public {
        // Called during safe setup as a delegatecall. This is why we use `this`
        // to refer to the safe instead of `msg.sender` / _currentSafe().

        ISafe(address(this)).enableModule(myAddress);

        // Enable the safe address with the defined key
        bytes memory _data = abi.encodePacked(ownerKey);
        SafeZKPPasswordPlugin(myAddress).enable(_data);
    }

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(_entryPoint);
    }

    function enable(bytes calldata _data) external payable {
        address newOwner = address(bytes20(_data[0:20]));
        address oldOwner = zkpPasswordOwnerStorage[msg.sender].owner;
        zkpPasswordOwnerStorage[msg.sender].owner = newOwner;
        emit OWNER_UPDATED(msg.sender, oldOwner, newOwner);
    }

    function _validateSignature(
        PackedUserOperation calldata userOp,
        bytes32 userOpHash
    ) internal view override returns (uint256 validationData) {
        // TODO (merge-ok) There is likely a more efficient way to encode this
        // to save on space, which would be especially desirable on rollups.
        uint256[2] memory a;
        uint256[2][2] memory b;
        uint256[2] memory c;
        (a, b, c) = abi.decode(
            userOp.signature,
            (uint256[2], uint256[2][2], uint256[2])
        );
        uint256[1] memory pubSignals = [bytesToUint(userOpHash)];
        bool result = _verifier.verifyProof(a, b, c, pubSignals);
        if (!result) {
            return SIG_VALIDATION_FAILED;
        }
        return 0;
    }

    // From https://ethereum.stackexchange.com/a/51234
    function bytesToUint(bytes32 b) internal pure returns (uint256) {
        uint256 number;
        for (uint i = 0; i < b.length; i++) {
            number =
                number +
                uint(uint8(b[i])) *
                (2 ** (8 * (b.length - (i + 1))));
        }
        return number;
    }
}
