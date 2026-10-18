// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

/// @dev Prototype safety boundary, not a license to use real funds.
library TestNetworks {
    error UnsupportedChain(uint256 chainId);

    function requireSupported() internal view {
        if (block.chainid != 31337 && block.chainid != 11155111) {
            revert UnsupportedChain(block.chainid);
        }
    }
}
