// SPDX-License-Identifier: Unlicense
pragma solidity >=0.7.0 <0.9.0;

import "openzeppelin-contracts/contracts/token/ERC20/ERC20.sol";

contract SimpleERC20 is ERC20 {
    constructor(
        string memory name,
        string memory symbol,
        address owner,
        uint256 supply
    ) ERC20(name, symbol) {
        _mint(owner, supply);
    }
}
