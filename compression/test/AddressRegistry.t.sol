// SPDX-License-Identifier: Unlicense
pragma solidity ^0.8.13;

import "forge-std/Test.sol";
import {AddressRegistry} from "../src/AddressRegistry.sol";

contract AddressRegistryTest is Test {
    function test_register_and_lookup() public {
        AddressRegistry ar = new AddressRegistry();

        ar.register(address(this));

        // The index on AddressRegistered can be used to find a registered
        // address's ID off-chain, but there appears to be no way to do this in
        // a foundry test.
        assertEq(ar.lookup(0), address(this));
    }
}
