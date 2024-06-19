// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

struct Action {
    uint256 value;
    address target;
    bytes4 selector;
    bytes params;
}

using ActionLib for Action global;

library ActionLib {

    function hash(Action memory self) public pure returns(bytes32) {
        return keccak256(abi.encode(
            self.value,
            self.target,
            self.selector,
            self.params
        ));
    }

    /** Same target and selector */
    function isSameFunction(Action memory self, Action memory rhs)
    public pure returns(bool) {
        if (self.target != rhs.target) { return false; }
        if (self.selector != rhs.selector) { return false; }
        return true;
    }

    function sameFunctionInSet(
        Action memory self,
        Action[] storage actionsToSearch
    ) public view returns(uint256 atIndex) {
        Action memory item;
        for (uint256 i=0; i<actionsToSearch.length; i++) {
            item = actionsToSearch[i];
            if (isSameFunction(self, item)) {
                return i;
            }
        }
        return type(uint256).max;
    }

    function isLEQActionValue(Action memory self, Action memory rhs)
    public pure returns(bool) {
        return self.value <= rhs.value;
    }

    function isLEQValue(Action memory self, uint256 value)
    public pure returns(bool) {
        return self.value <= value;
    }

    function encodedFunction(Action memory self)
    public pure returns(bytes memory) {
        return abi.encode(self.selector, self.params);
    }
}

contract ActionManager {
    bytes32 immutable ACTION_DOMAIN = keccak256("BB-ActionManager");

    Action[] adminActions;
    //uint256 valueLimit;

    function hash(Action memory action, uint256 nonce)
    public view returns(bytes32) {
        return keccak256(abi.encode(block.chainid, ACTION_DOMAIN, nonce, action));
    }

    function isAdminAction(Action memory a) public view returns(bool isAdmin) {
        isAdmin = (a.target == address(this));
        isAdmin = isAdmin || (a.sameFunctionInSet(adminActions) != type(uint256).max);
    }

}


