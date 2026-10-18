// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {TestBase, MandateVault} from "./TestBase.sol";

contract StopAndReplayTest is TestBase {
    // C04/C05/C06: Isolate each stopped state with an otherwise payable bill.
    function testSessionBeforeStartAndAtStart() public {
        bytes32 key = _bill("SESSION-START", UNIT);
        vm.prank(OWNER);
        vault.setAgent(AGENT, START + 10, START + 100);
        vm.warp(START + 9);
        _expectRejected(key, MandateVault.SessionNotStarted.selector);
        vm.warp(START + 10);
        _pay(key);
    }

    function testSessionJustBeforeExpiry() public {
        bytes32 key = _bill("SESSION-BEFORE-END", UNIT);
        vm.warp(START + 1 days - 1);
        _pay(key);
    }

    function testSessionAtExpiryAndAfterExpiry() public {
        bytes32 key = _bill("SESSION-END", UNIT);
        vm.warp(START + 1 days);
        _expectRejected(key, MandateVault.SessionExpired.selector);
        vm.warp(START + 1 days + 1);
        _expectRejected(key, MandateVault.SessionExpired.selector);
    }

    function testBillBeforeStartAndAtStart() public {
        MandateVault.Approval memory approval = _approval("BILL-START", UNIT);
        approval.notBefore = START + 10;
        bytes32 key = _approve(approval);
        vm.warp(START + 9);
        _expectRejected(key, MandateVault.BillNotDue.selector);
        vm.warp(START + 10);
        _pay(key);
    }

    function testBillJustBeforeExpiry() public {
        MandateVault.Approval memory approval = _approval("BILL-BEFORE-END", UNIT);
        approval.expiresAt = START + 100;
        bytes32 key = _approve(approval);
        vm.warp(START + 99);
        _pay(key);
    }

    function testBillAtExpiryAndAfterExpiry() public {
        MandateVault.Approval memory approval = _approval("BILL-END", UNIT);
        approval.expiresAt = START + 100;
        bytes32 key = _approve(approval);
        vm.warp(START + 100);
        _expectRejected(key, MandateVault.BillExpired.selector);
        vm.warp(START + 101);
        _expectRejected(key, MandateVault.BillExpired.selector);
    }

    function testInvalidBillAndSessionWindows() public {
        vm.expectRevert(MandateVault.InvalidWindow.selector);
        vm.prank(OWNER);
        vault.setAgent(AGENT, START, START);
        vm.expectRevert(MandateVault.InvalidWindow.selector);
        vm.prank(OWNER);
        vault.setAgent(AGENT, START - 10, START - 1);
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](1);
        batch[0] = _approval("BAD-WINDOW", UNIT);
        batch[0].expiresAt = START;
        vm.expectRevert(MandateVault.InvalidWindow.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
        batch[0].notBefore = START + 100;
        batch[0].expiresAt = START + 10;
        vm.expectRevert(MandateVault.InvalidWindow.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
    }

    function testConfirmedPauseStopsOtherwiseEligibleBill() public {
        bytes32 key = _bill("PAUSED", UNIT);
        vm.prank(OWNER);
        vault.setPaused(true);
        _expectRejected(key, MandateVault.VaultPaused.selector);
        vm.prank(OWNER);
        vault.setPaused(false);
        _pay(key);
    }

    function testConfirmedRevocationStopsOtherwiseEligibleBill() public {
        bytes32 key = _bill("REVOKED", UNIT);
        vm.prank(OWNER);
        vault.revokeAgent();
        _expectRejected(key, MandateVault.OnlyAgent.selector);
        require(vault.agent() == address(0), "revocation retained key");
    }

    function testRotationStopsOldKeyAndAllowsNewKey() public {
        bytes32 key = _bill("ROTATION", UNIT);
        vm.prank(OWNER);
        vault.setAgent(AGENT2, START, START + 1 days);
        _expectRejected(key, MandateVault.OnlyAgent.selector);
        uint256 version = vault.policyVersion();
        vm.prank(AGENT2);
        vault.payBill(key, version);
        _eq(token.balanceOf(HOST), UNIT, "new key failed");
    }

    function testCancellationAndExplicitOwnerReapproval() public {
        MandateVault.Approval memory approval = _approval("CANCEL", UNIT);
        bytes32 key = _approve(approval);
        vm.prank(OWNER);
        vault.cancelBill(key);
        _expectRejected(key, MandateVault.BillCancelled.selector);
        _approve(approval); // Explicit owner action, not an automatic retry.
        _pay(key);
    }

    function testOwnerRecoveryOnlyWhilePausedAndDoesNotResetPaidOrSpent() public {
        bytes32 key = _bill("RECOVERY", UNIT);
        _pay(key);
        vm.expectRevert(MandateVault.RecoveryRequiresPause.selector);
        vm.prank(OWNER);
        vault.recoverTokens(OWNER, 10 * UNIT);
        vm.prank(OWNER);
        vault.setPaused(true);
        vm.prank(OWNER);
        vault.recoverTokens(OWNER, 900 * UNIT); // Owner may recover below the agent reserve.
        _eq(token.balanceOf(OWNER), 900 * UNIT, "recovery did not reach owner");
        _eq(vault.currentDaySpent(), UNIT, "recovery reset agent spending");
        require(vault.getBill(key).paid, "recovery reset paid key");
    }

    function testStalePolicyFailsAfterPermissionChange() public {
        bytes32 key = _bill("STALE", UNIT);
        uint256 oldVersion = vault.policyVersion();
        _limits(250 * UNIT, 400 * UNIT, 301 * UNIT);
        uint256 current = vault.policyVersion();
        vm.expectRevert(abi.encodeWithSelector(MandateVault.StalePolicy.selector, oldVersion, current));
        vm.prank(AGENT);
        vault.payBill(key, oldVersion);
        _eq(token.balanceOf(HOST), 0, "stale plan paid");
        require(!vault.getBill(key).paid, "stale plan changed paid flag");
        _pay(key);
    }

    function testChangedUnpaidApprovalNeedsNewVersionAndUsesNewExactFields() public {
        MandateVault.Approval memory approval = _approval("CHANGED", 50 * UNIT);
        bytes32 key = _approve(approval);
        uint256 oldVersion = vault.policyVersion();
        approval.amount = 80 * UNIT;
        approval.documentHash = keccak256("corrected document");
        _approve(approval);
        uint256 current = vault.policyVersion();
        vm.expectRevert(abi.encodeWithSelector(MandateVault.StalePolicy.selector, oldVersion, current));
        vm.prank(AGENT);
        vault.payBill(key, oldVersion);
        require(vault.getBill(key).documentHash == approval.documentHash, "source fingerprint not stored");
        _pay(key);
        _eq(token.balanceOf(HOST), 80 * UNIT, "updated exact amount not used");
    }

    function testVendorChangesAndReenableRequireFreshBillApproval() public {
        MandateVault.Approval memory approval = _approval("VENDOR-CHANGE", UNIT);
        bytes32 key = _approve(approval);
        vm.prank(OWNER);
        vault.setVendor(VHOST, HOST, false);
        _expectRejected(key, MandateVault.VendorNotApproved.selector);
        vm.prank(OWNER);
        vault.setVendor(VHOST, ATTACKER, true);
        _expectRejected(key, MandateVault.RecipientMismatch.selector);
        vm.prank(OWNER);
        vault.setVendor(VHOST, HOST, true);
        _expectRejected(key, MandateVault.VendorChanged.selector);
        _approve(approval);
        _pay(key);
        _eq(token.balanceOf(ATTACKER), 0, "vendor change redirected bill");
    }

    function testDuplicateRetryAndConcurrentPlansPayAtMostOnce() public {
        bytes32 key = _bill("RETRY", 20 * UNIT);
        uint256 version = vault.policyVersion();
        vm.prank(AGENT);
        vault.payBill(key, version);
        // Two workers can share one snapshot; the EVM serializes their execution.
        _expectRejected(key, MandateVault.BillAlreadyPaid.selector);
        _eq(token.balanceOf(HOST), 20 * UNIT, "duplicate payment escaped");
        _eq(vault.currentDaySpent(), 20 * UNIT, "retry changed daily spend");
    }

    function testPaidKeyCannotBeReapprovedOrCancelled() public {
        MandateVault.Approval memory approval = _approval("PERMANENT", UNIT);
        bytes32 key = _approve(approval);
        _pay(key);
        approval.amount = 2 * UNIT;
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](1);
        batch[0] = approval;
        vm.expectRevert(MandateVault.BillAlreadyPaid.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
        vm.expectRevert(MandateVault.BillAlreadyPaid.selector);
        vm.prank(OWNER);
        vault.cancelBill(key);
        require(vault.getBill(key).paid, "paid key reset");
        _eq(vault.getBill(key).amount, UNIT, "paid approval changed");
    }

    function testEveryOwnerPermissionChangeIncreasesVersion() public {
        uint256 version = vault.policyVersion();
        vm.prank(OWNER);
        vault.setVendor(VHOST, HOST, true);
        _eq(vault.policyVersion(), ++version, "vendor update version");
        _limits(250 * UNIT, 400 * UNIT, 300 * UNIT);
        _eq(vault.policyVersion(), ++version, "limit update version");
        vm.prank(OWNER);
        vault.setAgent(AGENT, START, START + 1 days);
        _eq(vault.policyVersion(), ++version, "session update version");
        bytes32 key = _bill("VERSION", UNIT);
        _eq(vault.policyVersion(), ++version, "approval version");
        vm.prank(OWNER);
        vault.cancelBill(key);
        _eq(vault.policyVersion(), ++version, "cancel version");
        vm.prank(OWNER);
        vault.revokeAgent();
        _eq(vault.policyVersion(), ++version, "revoke version");
        vm.prank(OWNER);
        vault.setPaused(true);
        _eq(vault.policyVersion(), ++version, "pause version");
        vm.prank(OWNER);
        vault.recoverTokens(OWNER, UNIT);
        _eq(vault.policyVersion(), ++version, "recovery version");
    }

    function testFuzzRepeatedAndUnauthorizedAttempts(uint256 seed) public {
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](8);
        bytes32[] memory keys = new bytes32[](8);
        bool[] memory modelPaid = new bool[](8);
        for (uint256 i; i < 8; ++i) {
            batch[i] = _approval("FUZZ-RETRY", 50 * UNIT);
            batch[i].invoiceIdHash = keccak256(abi.encode("FUZZ-RETRY", i));
            keys[i] = vault.billKeyFor(VHOST, batch[i].invoiceIdHash);
        }
        vm.prank(OWNER);
        vault.approveBills(batch);
        uint256 version = vault.policyVersion();
        uint256 expectedSpent;
        for (uint256 attempt; attempt < 32; ++attempt) {
            seed = uint256(keccak256(abi.encode(seed, attempt)));
            uint256 i = seed % 8;
            bool authorized = ((seed >> 8) % 3) != 0;
            bool expectedSuccess = authorized && !modelPaid[i];
            vm.prank(authorized ? AGENT : ATTACKER);
            (bool success,) = address(vault).call(abi.encodeCall(vault.payBill, (keys[i], version)));
            require(success == expectedSuccess, "fuzz attempt disagrees with independent replay model");
            if (success) {
                modelPaid[i] = true;
                expectedSpent += 50 * UNIT;
            }
            _eq(token.balanceOf(HOST), expectedSpent, "fuzz recipient balance");
            _eq(vault.currentDaySpent(), expectedSpent, "fuzz daily accounting");
            _eq(token.balanceOf(address(vault)), 1000 * UNIT - expectedSpent, "fuzz vault accounting");
        }
        for (uint256 i; i < 8; ++i) {
            require(vault.getBill(keys[i]).paid == modelPaid[i], "fuzz paid marker");
        }
    }
}
