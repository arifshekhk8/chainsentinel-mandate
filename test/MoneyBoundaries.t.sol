// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {TestBase, MandateVault} from "./TestBase.sol";

contract MoneyBoundariesTest is TestBase {
    // C03: Amounts below/at/above each boundary differ by one smallest token unit.
    function testPerBillOneUnitBelow() public {
        _pay(_bill("PER-BELOW", 250 * UNIT - 1));
        _eq(token.balanceOf(HOST), 250 * UNIT - 1, "below per-bill cap failed");
    }

    function testPerBillExactlyAtLimit() public {
        _pay(_bill("PER-AT", 250 * UNIT));
        _eq(token.balanceOf(HOST), 250 * UNIT, "equal per-bill cap failed");
    }

    function testPerBillOneUnitAbove() public {
        bytes32 key = _bill("PER-ABOVE", 250 * UNIT + 1);
        _expectRejected(key, MandateVault.PerBillLimitExceeded.selector);
    }

    function testDailyOneUnitBelow() public {
        _dailyBoundary(250 * UNIT - 1, false);
        _eq(vault.currentDaySpent(), 400 * UNIT - 1, "below daily cap failed");
    }

    function testDailyExactlyAtLimit() public {
        _dailyBoundary(250 * UNIT, false);
        _eq(vault.currentDaySpent(), 400 * UNIT, "equal daily cap failed");
    }

    function testDailyOneUnitAbove() public {
        _dailyBoundary(250 * UNIT + 1, true);
    }

    function testReserveOneUnitAboveMinimum() public {
        _setBalance(500 * UNIT);
        _pay(_bill("RESERVE-ABOVE", 200 * UNIT - 1));
        _eq(token.balanceOf(address(vault)), 300 * UNIT + 1, "above reserve failed");
    }

    function testReserveExactlyAtMinimum() public {
        _setBalance(500 * UNIT);
        _pay(_bill("RESERVE-AT", 200 * UNIT));
        _eq(token.balanceOf(address(vault)), 300 * UNIT, "equal reserve failed");
    }

    function testReserveOneUnitBelowMinimum() public {
        _setBalance(500 * UNIT);
        bytes32 key = _bill("RESERVE-BELOW", 200 * UNIT + 1);
        _expectRejected(key, MandateVault.ReserveViolation.selector);
    }

    function testInsufficientBalanceIndependentlyOfReserve() public {
        _setBalance(40 * UNIT);
        _limits(250 * UNIT, 400 * UNIT, 0);
        bytes32 key = _bill("INSUFFICIENT", 50 * UNIT);
        _expectRejected(key, MandateVault.InsufficientBalance.selector);
    }

    function testSmallestUnitAndExactSixDecimals() public {
        _pay(_bill("ONE-UNIT", 1));
        _pay(_bill("DECIMALS", 12_345_678));
        _eq(token.balanceOf(HOST), 12_345_679, "fractional tokens rounded");
        _eq(vault.currentDaySpent(), 12_345_679, "fractional spending rounded");
    }

    function testNormalBatchLeavesOnlyFiftyOfDailyBudget() public {
        _pay(_bill("HOST-1001", 200 * UNIT));
        _pay(_bill("ART-2001", 150 * UNIT));
        bytes32 third = _bill("HOST-1002", 75 * UNIT);
        _expectRejected(third, MandateVault.DailyLimitExceeded.selector);
        _eq(token.balanceOf(address(vault)), 650 * UNIT, "normal batch wrong balance");
        _eq(vault.dailyLimit() - vault.currentDaySpent(), 50 * UNIT, "daily budget wrong");
    }

    function testReserveDemoUsesIndependentStartingState() public {
        _setBalance(500 * UNIT);
        bytes32 key = _bill("ART-2003", 225 * UNIT);
        _expectRejected(key, MandateVault.ReserveViolation.selector);
    }

    function testAgentRotationDoesNotResetDailySpending() public {
        _pay(_bill("FIRST", 250 * UNIT));
        bytes32 next = _bill("SECOND", 151 * UNIT);
        vm.prank(OWNER);
        vault.setAgent(AGENT2, START, START + 1 days);
        _eq(vault.currentDaySpent(), 250 * UNIT, "rotation reset daily spend");
        uint256 version = vault.policyVersion();
        vm.expectRevert(MandateVault.DailyLimitExceeded.selector);
        vm.prank(AGENT2);
        vault.payBill(next, version);
        _eq(token.balanceOf(HOST), 250 * UNIT, "rotation bypassed daily cap");
        require(!vault.getBill(next).paid, "rotation marked blocked bill paid");
    }

    function testPolicyChangesKeepSpentHistoryEvenWhenNewCapIsBelowSpent() public {
        _pay(_bill("OLD-LIMIT", 200 * UNIT));
        bytes32 next = _bill("LOWERED-LIMIT", UNIT);
        _limits(250 * UNIT, 100 * UNIT, 300 * UNIT);
        _expectRejected(next, MandateVault.DailyLimitExceeded.selector);
        _eq(vault.currentDaySpent(), 200 * UNIT, "rule change erased spending");
    }

    function testUtcMidnightStartsNewDayWithoutErasingPreviousDay() public {
        _pay(_bill("YESTERDAY", 250 * UNIT));
        bytes32 next = _bill("TODAY", 200 * UNIT);
        uint256 oldDay = block.timestamp / 1 days;
        vm.warp((oldDay + 1) * 1 days);
        _eq(vault.currentDaySpent(), 0, "new UTC day inherited spending");
        _pay(next);
        _eq(vault.currentDaySpent(), 200 * UNIT, "new day not counted");
        _eq(vault.spentPerDay(oldDay), 250 * UNIT, "old day erased");
    }

    function testFuzzLimitsAndReserve(uint96 amountSeed, uint96 perSeed, uint96 daySeed, uint96 reserveSeed)
        public
    {
        uint256 amount = 1 + uint256(amountSeed) % (1200 * UNIT);
        uint256 perBill = 1 + uint256(perSeed) % (1000 * UNIT);
        uint256 daily = 1 + uint256(daySeed) % (1000 * UNIT);
        uint256 reserve = uint256(reserveSeed) % (1200 * UNIT);
        _limits(perBill, daily, reserve);
        bytes32 key = _bill("FUZZ-LIMITS", amount);
        if (amount > perBill) {
            _expectRejected(key, MandateVault.PerBillLimitExceeded.selector);
        } else if (amount > daily) {
            _expectRejected(key, MandateVault.DailyLimitExceeded.selector);
        } else if (amount > 1000 * UNIT) {
            _expectRejected(key, MandateVault.InsufficientBalance.selector);
        } else if (1000 * UNIT - amount < reserve) {
            _expectRejected(key, MandateVault.ReserveViolation.selector);
        } else {
            _pay(key);
            _eq(token.balanceOf(HOST), amount, "fuzz exact amount mismatch");
            _eq(vault.currentDaySpent(), amount, "fuzz spending mismatch");
            require(token.balanceOf(address(vault)) >= reserve, "fuzz reserve broken");
        }
    }

    function _dailyBoundary(uint256 secondAmount, bool blocked) private {
        _limits(300 * UNIT, 400 * UNIT, 300 * UNIT); // Upper daily case must pass the per-bill cap.
        _pay(_bill("DAILY-FIRST", 150 * UNIT));
        bytes32 next = _bill("DAILY-SECOND", secondAmount);
        if (blocked) _expectRejected(next, MandateVault.DailyLimitExceeded.selector);
        else _pay(next);
    }

    function _setBalance(uint256 balance) private {
        vm.prank(OWNER);
        vault.setPaused(true);
        vm.prank(OWNER);
        vault.recoverTokens(OWNER, 1000 * UNIT - balance);
        vm.prank(OWNER);
        vault.setPaused(false);
    }
}
