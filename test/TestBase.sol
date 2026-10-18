// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {MandateDemoToken} from "../contracts/MandateDemoToken.sol";
import {MandateVault} from "../contracts/MandateVault.sol";

// Minimal interface to Foundry's test-only cheatcodes; no cheatcodes exist in deployed contracts.
interface Vm {
    struct Log {
        bytes32[] topics;
        bytes data;
        address emitter;
    }

    function prank(address sender) external;
    function warp(uint256 timestamp) external;
    function chainId(uint256 newChainId) external;
    function expectRevert(bytes4 revertData) external;
    function expectRevert(bytes calldata revertData) external;
    function recordLogs() external;
    function getRecordedLogs() external returns (Log[] memory);
}

abstract contract TestBase {
    Vm internal constant vm = Vm(address(uint160(uint256(keccak256("hevm cheat code")))));
    uint256 internal constant UNIT = 1e6;
    uint64 internal constant START = 1_792_238_400; // 2026-10-17 12:00 UTC
    address internal constant OWNER = address(0xA11CE);
    address internal constant AGENT = address(0xA6E);
    address internal constant AGENT2 = address(0xA6E2);
    address internal constant HOST = address(0xB001);
    address internal constant DESIGN = address(0xB002);
    address internal constant ATTACKER = address(0xBAD);
    bytes32 internal constant VHOST = keccak256("V-HOST");
    bytes32 internal constant VDESIGN = keccak256("V-DESIGN");

    MandateDemoToken internal token;
    MandateVault internal vault;

    function setUp() public virtual {
        vm.chainId(31337);
        vm.warp(START);
        token = _newToken();
        vault = new MandateVault(OWNER, address(token), 250 * UNIT, 400 * UNIT, 300 * UNIT);
        vm.prank(OWNER);
        token.transfer(address(vault), 1000 * UNIT);
        vm.prank(OWNER);
        vault.setVendor(VHOST, HOST, true);
        vm.prank(OWNER);
        vault.setVendor(VDESIGN, DESIGN, true);
        vm.prank(OWNER);
        vault.setAgent(AGENT, START, START + 1 days);
        vm.prank(OWNER);
        vault.setPaused(false);
    }

    function _newToken() internal virtual returns (MandateDemoToken) {
        return new MandateDemoToken(OWNER, 1000 * UNIT);
    }

    function _approval(string memory number, uint256 amount)
        internal
        pure
        returns (MandateVault.Approval memory)
    {
        return MandateVault.Approval({
            vendorId: VHOST,
            invoiceIdHash: keccak256(bytes(number)),
            recipient: HOST,
            amount: amount,
            notBefore: START,
            expiresAt: START + 2 days,
            documentHash: keccak256(abi.encode("synthetic document", number, amount))
        });
    }

    function _approve(MandateVault.Approval memory approval) internal returns (bytes32 key) {
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](1);
        batch[0] = approval;
        vm.prank(OWNER);
        vault.approveBills(batch);
        return vault.billKeyFor(approval.vendorId, approval.invoiceIdHash);
    }

    function _bill(string memory number, uint256 amount) internal returns (bytes32) {
        return _approve(_approval(number, amount));
    }

    function _pay(bytes32 key) internal {
        uint256 version = vault.policyVersion();
        vm.prank(AGENT);
        vault.payBill(key, version);
    }

    function _expectRejected(bytes32 key, bytes4 reason) internal {
        uint256 version = vault.policyVersion();
        uint256 beforeBalance = token.balanceOf(address(vault));
        uint256 beforeSpent = vault.currentDaySpent();
        MandateVault.Bill memory beforeBill = vault.getBill(key);
        uint256 beforeRecipientBalance = token.balanceOf(beforeBill.recipient);
        vm.expectRevert(reason);
        vm.prank(AGENT);
        vault.payBill(key, version);
        _eq(token.balanceOf(address(vault)), beforeBalance, "rejected call moved vault tokens");
        _eq(token.balanceOf(beforeBill.recipient), beforeRecipientBalance, "rejected call paid recipient");
        _eq(vault.currentDaySpent(), beforeSpent, "rejected call changed daily spending");
        require(vault.getBill(key).paid == beforeBill.paid, "rejected call changed paid marker");
    }

    function _limits(uint256 perBill, uint256 daily, uint256 reserve) internal {
        vm.prank(OWNER);
        vault.setLimits(perBill, daily, reserve);
    }

    function _eq(uint256 actual, uint256 expected, string memory reason) internal pure {
        require(actual == expected, reason);
    }
}
