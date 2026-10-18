// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {TestBase, Vm, MandateVault} from "./TestBase.sol";
import {MandateDemoToken} from "../contracts/MandateDemoToken.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @dev Hostile test fixture only. Never used by the local demonstration or deployment.
contract AdversarialToken is MandateDemoToken {
    enum Mode {
        Normal,
        ReturnFalse,
        RevertTransfer,
        NoTransfer,
        Fee,
        Reenter
    }
    error TransferRefused();

    Mode public mode;
    MandateVault public callbackVault;
    bytes32 public callbackBill;
    bytes public callbackResult;
    bool public callbackSucceeded;

    constructor() MandateDemoToken(address(0xA11CE), 1000 * 1e6) {}

    function configure(Mode mode_, MandateVault vault_, bytes32 bill_) external {
        mode = mode_;
        callbackVault = vault_;
        callbackBill = bill_;
    }

    function transfer(address to, uint256 amount) public override returns (bool) {
        if (mode == Mode.ReturnFalse) return false;
        if (mode == Mode.RevertTransfer) revert TransferRefused();
        if (mode == Mode.NoTransfer) return true;
        if (mode == Mode.Fee) {
            _transfer(msg.sender, to, amount - 1);
            _burn(msg.sender, 1);
            return true;
        }
        if (mode == Mode.Reenter) {
            (callbackSucceeded, callbackResult) = address(callbackVault)
                .call(abi.encodeCall(callbackVault.payBill, (callbackBill, callbackVault.policyVersion())));
        }
        return super.transfer(to, amount);
    }
}

contract WrongDecimalsToken is ERC20 {
    constructor() ERC20("Wrong Asset", "WRONG") {}
}

contract TransferIntegrityTest is TestBase {
    AdversarialToken internal hostile;

    function _newToken() internal override returns (MandateDemoToken) {
        hostile = new AdversarialToken();
        return hostile;
    }

    // C06: Test actual failed interactions after the vault has written tentative paid/spent state.
    function testFalseReturnRollsBackPaidAndSpending() public {
        bytes32 key = _bill("FALSE", UNIT);
        hostile.configure(AdversarialToken.Mode.ReturnFalse, vault, key);
        uint256 version = vault.policyVersion();
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(hostile)));
        vm.prank(AGENT);
        vault.payBill(key, version);
        _assertRollback(key);
        hostile.configure(AdversarialToken.Mode.Normal, vault, key);
        _pay(key); // Failed attempt must not consume the bill or the daily allowance.
    }

    function testTokenRevertRollsBackPaidAndSpending() public {
        bytes32 key = _bill("TOKEN-REVERT", UNIT);
        hostile.configure(AdversarialToken.Mode.RevertTransfer, vault, key);
        _expectRejected(key, AdversarialToken.TransferRefused.selector);
        _assertRollback(key);
    }

    function testTrueReturnWithoutTransferIsRejected() public {
        bytes32 key = _bill("NO-TRANSFER", UNIT);
        hostile.configure(AdversarialToken.Mode.NoTransfer, vault, key);
        _expectRejected(key, MandateVault.InexactTransfer.selector);
        _assertRollback(key);
    }

    function testFeeTransferIsRejectedAndTokenEffectsRollback() public {
        bytes32 key = _bill("FEE", UNIT);
        hostile.configure(AdversarialToken.Mode.Fee, vault, key);
        _expectRejected(key, MandateVault.InexactTransfer.selector);
        _assertRollback(key);
        _eq(token.totalSupply(), 1000 * UNIT, "reverted fee burned tokens");
    }

    function testReentrancyCannotPayAnotherEligibleBill() public {
        bytes32 outer = _bill("OUTER", 10 * UNIT);
        bytes32 inner = _bill("INNER", 20 * UNIT);
        // The hostile token is also the authorized agent, so a missing guard would allow its
        // callback to pay the second valid bill. This isolates the guard from role/paid checks.
        vm.prank(OWNER);
        vault.setAgent(address(hostile), START, START + 1 days);
        hostile.configure(AdversarialToken.Mode.Reenter, vault, inner);
        uint256 version = vault.policyVersion();
        vm.prank(address(hostile));
        vault.payBill(outer, version);
        require(!hostile.callbackSucceeded(), "token reentered successfully");
        require(
            keccak256(hostile.callbackResult())
                == keccak256(abi.encodeWithSelector(ReentrancyGuard.ReentrancyGuardReentrantCall.selector)),
            "callback failed for a reason other than the guard"
        );
        require(vault.getBill(outer).paid && !vault.getBill(inner).paid, "nested bill state incorrect");
        _eq(token.balanceOf(HOST), 10 * UNIT, "callback paid extra tokens");
        _eq(vault.currentDaySpent(), 10 * UNIT, "callback counted extra spending");
    }

    function testPaymentEventMatchesActualTokenTransfer() public {
        bytes32 key = _bill("EVENT", 12_345_678);
        uint256 version = vault.policyVersion();
        vm.recordLogs();
        _pay(key);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        _eq(logs.length, 2, "unexpected payment logs");
        require(logs[0].emitter == address(token), "wrong token emitter");
        require(logs[0].topics[0] == keccak256("Transfer(address,address,uint256)"), "missing ERC20 transfer");
        require(logs[0].topics[1] == bytes32(uint256(uint160(address(vault)))), "wrong transfer source");
        require(logs[0].topics[2] == bytes32(uint256(uint160(HOST))), "wrong transfer destination");
        _eq(abi.decode(logs[0].data, (uint256)), 12_345_678, "wrong transfer amount");
        require(logs[1].emitter == address(vault), "wrong vault emitter");
        require(
            logs[1].topics[0]
                == keccak256("BillPaid(bytes32,address,address,uint256,uint256,uint256,uint256)"),
            "missing bill event"
        );
        require(logs[1].topics[1] == key, "wrong event bill");
        require(logs[1].topics[2] == bytes32(uint256(uint160(HOST))), "wrong event recipient");
        require(logs[1].topics[3] == bytes32(uint256(uint160(address(token)))), "wrong event asset");
        (uint256 amount, uint256 policy, uint256 day, uint256 spent) =
            abi.decode(logs[1].data, (uint256, uint256, uint256, uint256));
        _eq(amount, token.balanceOf(HOST), "event differs from received tokens");
        _eq(policy, version, "event policy mismatch");
        _eq(day, block.timestamp / 1 days, "event UTC day mismatch");
        _eq(spent, vault.currentDaySpent(), "event daily accounting mismatch");
    }

    function testNonSixDecimalTokenRejected() public {
        WrongDecimalsToken wrong = new WrongDecimalsToken();
        vm.expectRevert(MandateVault.InvalidToken.selector);
        new MandateVault(OWNER, address(wrong), UNIT, UNIT, 0);
    }

    function testRecoveryRevertLeavesStateUnchanged() public {
        vm.prank(OWNER);
        vault.setPaused(true);
        hostile.configure(AdversarialToken.Mode.ReturnFalse, vault, bytes32(0));
        uint256 version = vault.policyVersion();
        vm.expectRevert(abi.encodeWithSelector(SafeERC20.SafeERC20FailedOperation.selector, address(hostile)));
        vm.prank(OWNER);
        vault.recoverTokens(OWNER, UNIT);
        _eq(vault.policyVersion(), version, "failed recovery changed version");
        _eq(token.balanceOf(address(vault)), 1000 * UNIT, "failed recovery moved tokens");
    }

    function _assertRollback(bytes32 key) private view {
        require(!vault.getBill(key).paid, "failed transfer consumed bill");
        require(vault.currentDaySpent() == 0, "failed transfer consumed budget");
        require(token.balanceOf(address(vault)) == 1000 * UNIT, "failed transfer moved vault tokens");
        require(token.balanceOf(HOST) == 0, "failed transfer credited recipient");
    }
}
