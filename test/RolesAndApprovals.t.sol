// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {TestBase, Vm, MandateVault} from "./TestBase.sol";
import {MandateDemoToken} from "../contracts/MandateDemoToken.sol";
import {TestNetworks} from "../contracts/TestNetworks.sol";

contract RolesAndApprovalsTest is TestBase {
    // C01/C02: Every exposed administrative path is exercised with a hostile agent caller.
    function testAgentCannotUseAnyOwnerMethod() public {
        bytes32 key = _bill("ROLE", 10 * UNIT);
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](1);
        batch[0] = _approval("NEW", 1 * UNIT);
        bytes[] memory calls = new bytes[](8);
        calls[0] = abi.encodeCall(vault.setVendor, (VHOST, ATTACKER, true));
        calls[1] = abi.encodeCall(vault.setLimits, (999 * UNIT, 999 * UNIT, 0));
        calls[2] = abi.encodeCall(vault.setAgent, (ATTACKER, START, START + 1 days));
        calls[3] = abi.encodeCall(vault.revokeAgent, ());
        calls[4] = abi.encodeCall(vault.setPaused, (true));
        calls[5] = abi.encodeCall(vault.approveBills, (batch));
        calls[6] = abi.encodeCall(vault.cancelBill, (key));
        calls[7] = abi.encodeCall(vault.recoverTokens, (ATTACKER, 1000 * UNIT));
        uint256 version = vault.policyVersion();
        for (uint256 i; i < calls.length; ++i) {
            vm.prank(AGENT);
            (bool success, bytes memory result) = address(vault).call(calls[i]);
            require(
                !success
                    && keccak256(result)
                        == keccak256(abi.encodeWithSelector(MandateVault.OnlyOwner.selector)),
                "owner boundary bypassed"
            );
        }
        _eq(vault.policyVersion(), version, "hostile admin call changed version");
        _eq(token.balanceOf(address(vault)), 1000 * UNIT, "hostile admin call moved funds");
        require(!vault.getBill(key).cancelled, "hostile cancellation succeeded");
    }

    function testOwnerAndStrangerCannotExecuteAgentPayment() public {
        bytes32 key = _bill("ONLY-AGENT", 10 * UNIT);
        uint256 version = vault.policyVersion();
        vm.expectRevert(MandateVault.OnlyAgent.selector);
        vm.prank(OWNER);
        vault.payBill(key, version);
        vm.expectRevert(MandateVault.OnlyAgent.selector);
        vm.prank(ATTACKER);
        vault.payBill(key, version);
        _eq(token.balanceOf(HOST), 0, "unauthorized execution paid");
    }

    function testUnapprovedBillCannotPay() public {
        _expectRejected(keccak256("not approved"), MandateVault.BillNotApproved.selector);
    }

    function testTwoBillsApprovedInOneOwnerCall() public {
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](2);
        batch[0] = _approval("HOST-1001", 200 * UNIT);
        batch[1] = _approval("ART-2001", 150 * UNIT);
        batch[1].vendorId = VDESIGN;
        batch[1].recipient = DESIGN;
        vm.prank(OWNER);
        vault.approveBills(batch);
        _pay(vault.billKeyFor(VHOST, batch[0].invoiceIdHash));
        _pay(vault.billKeyFor(VDESIGN, batch[1].invoiceIdHash));
        _eq(token.balanceOf(HOST), 200 * UNIT, "hosting recipient mismatch");
        _eq(token.balanceOf(DESIGN), 150 * UNIT, "design recipient mismatch");
        _eq(token.balanceOf(address(vault)), 650 * UNIT, "batch balance mismatch");
        _eq(vault.currentDaySpent(), 350 * UNIT, "batch spending mismatch");
    }

    function testExtraCalldataCannotReplaceStoredTransferFields() public {
        bytes32 key = _bill("EXTRA-DATA", 12_345_678);
        uint256 version = vault.policyVersion();
        bytes memory callData =
            abi.encodePacked(abi.encodeCall(vault.payBill, (key, version)), abi.encode(ATTACKER, 900 * UNIT));
        vm.prank(AGENT);
        (bool success,) = address(vault).call(callData);
        require(success, "approved stored transfer should work");
        _eq(token.balanceOf(HOST), 12_345_678, "did not use exact stored amount");
        _eq(token.balanceOf(ATTACKER), 0, "extra fields redirected payment");
    }

    function testNoArbitraryCallOrTokenApprovalPath() public {
        bytes[] memory calls = new bytes[](3);
        calls[0] = abi.encodeWithSignature(
            "execute(address,bytes)",
            address(token),
            abi.encodeWithSignature("transfer(address,uint256)", ATTACKER, 1000 * UNIT)
        );
        calls[1] = abi.encodeWithSignature("approve(address,uint256)", ATTACKER, type(uint256).max);
        calls[2] = abi.encodeWithSignature(
            "payBill(bytes32,uint256,address,uint256)", bytes32(0), 1, ATTACKER, 1000 * UNIT
        );
        for (uint256 i; i < calls.length; ++i) {
            vm.prank(AGENT);
            (bool success,) = address(vault).call(calls[i]);
            require(!success, "unexpected call path exists");
        }
        _eq(token.allowance(address(vault), AGENT), 0, "agent received token allowance");
        vm.prank(AGENT);
        (bool withdrawn,) = address(token)
            .call(
                abi.encodeWithSignature("transferFrom(address,address,uint256)", address(vault), ATTACKER, 1)
            );
        require(!withdrawn, "agent withdrew directly from token");
        _eq(token.balanceOf(address(vault)), 1000 * UNIT, "direct call moved funds");
    }

    function testApprovalRejectsWrongRecipientAndDisabledVendor() public {
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](1);
        batch[0] = _approval("WRONG-RECIPIENT", UNIT);
        batch[0].recipient = ATTACKER;
        vm.expectRevert(MandateVault.RecipientMismatch.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
        batch[0].recipient = HOST;
        vm.prank(OWNER);
        vault.setVendor(VHOST, HOST, false);
        vm.expectRevert(MandateVault.VendorNotApproved.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
    }

    function testInvalidApprovalFieldsRejectedWithoutPartialBatch() public {
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](2);
        batch[0] = _approval("VALID", UNIT);
        batch[1] = _approval("ZERO", 0);
        uint256 version = vault.policyVersion();
        vm.expectRevert(MandateVault.InvalidAmount.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
        _eq(
            vault.getBill(vault.billKeyFor(VHOST, batch[0].invoiceIdHash)).amount,
            0,
            "partial batch approval persisted"
        );
        _eq(vault.policyVersion(), version, "failed batch incremented version");
        batch = new MandateVault.Approval[](1);
        batch[0] = _approval("BAD", UNIT);
        batch[0].recipient = address(0);
        vm.expectRevert(MandateVault.InvalidAddress.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
        batch[0].recipient = HOST;
        batch[0].invoiceIdHash = bytes32(0);
        vm.expectRevert(MandateVault.InvalidIdentifier.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
        batch[0].invoiceIdHash = keccak256("BAD");
        batch[0].documentHash = bytes32(0);
        vm.expectRevert(MandateVault.InvalidIdentifier.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
    }

    function testDuplicateWithinApprovalBatchIsAtomic() public {
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](2);
        batch[0] = _approval("SAME", UNIT);
        batch[1] = batch[0];
        bytes32 key = vault.billKeyFor(VHOST, batch[0].invoiceIdHash);
        vm.expectRevert(abi.encodeWithSelector(MandateVault.DuplicateInBatch.selector, key));
        vm.prank(OWNER);
        vault.approveBills(batch);
        _eq(vault.getBill(key).amount, 0, "partial duplicate batch persisted");
    }

    function testApprovalBatchBounds() public {
        MandateVault.Approval[] memory batch = new MandateVault.Approval[](0);
        vm.expectRevert(MandateVault.InvalidBatchSize.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
        batch = new MandateVault.Approval[](51);
        vm.expectRevert(MandateVault.InvalidBatchSize.selector);
        vm.prank(OWNER);
        vault.approveBills(batch);
    }

    function testBillKeySeparatesVaultChainAndVendor() public {
        bytes32 invoice = keccak256("COMMON-100");
        bytes32 key = vault.billKeyFor(VHOST, invoice);
        bytes32 expected = keccak256(abi.encode(uint256(31337), address(vault), VHOST, invoice));
        require(key == expected, "bill-key encoding differs from specification");
        require(key != vault.billKeyFor(VDESIGN, invoice), "vendors share identity");
        MandateVault other = new MandateVault(OWNER, address(token), 250 * UNIT, 400 * UNIT, 300 * UNIT);
        require(key != other.billKeyFor(VHOST, invoice), "vaults share identity");
        vm.chainId(11155111);
        MandateVault sepolia = new MandateVault(OWNER, address(token), 250 * UNIT, 400 * UNIT, 300 * UNIT);
        require(sepolia.deploymentChainId() == 11155111, "Sepolia rejected");
        require(key != sepolia.billKeyFor(VHOST, invoice), "chains share identity");
    }

    function testUnsupportedNetworksAndChangedChainRejected() public {
        bytes32 key = _bill("CHAIN", UNIT);
        vm.chainId(1);
        vm.expectRevert(abi.encodeWithSelector(TestNetworks.UnsupportedChain.selector, uint256(1)));
        new MandateDemoToken(OWNER, UNIT);
        vm.expectRevert(abi.encodeWithSelector(TestNetworks.UnsupportedChain.selector, uint256(1)));
        new MandateVault(OWNER, address(token), UNIT, UNIT, 0);
        _expectRejected(key, MandateVault.WrongChain.selector);
    }

    function testConstructorAndConfigurationValidation() public {
        vm.expectRevert(MandateVault.InvalidAddress.selector);
        new MandateVault(address(0), address(token), UNIT, UNIT, 0);
        vm.expectRevert(MandateVault.InvalidToken.selector);
        new MandateVault(OWNER, ATTACKER, UNIT, UNIT, 0);
        vm.expectRevert(MandateVault.InvalidLimits.selector);
        new MandateVault(OWNER, address(token), 0, UNIT, 0);
        vm.expectRevert(MandateVault.InvalidLimits.selector);
        vm.prank(OWNER);
        vault.setLimits(UNIT, 0, 0);
        vm.expectRevert(MandateVault.InvalidAddress.selector);
        vm.prank(OWNER);
        vault.setVendor(VHOST, address(0), true);
        vm.expectRevert(MandateVault.InvalidIdentifier.selector);
        vm.prank(OWNER);
        vault.setVendor(bytes32(0), HOST, true);
        vm.expectRevert(MandateVault.InvalidAddress.selector);
        vm.prank(OWNER);
        vault.setAgent(OWNER, START, START + 1 days);
    }

    function testNewVaultStartsPausedAndHasFixedSixDecimalToken() public {
        MandateVault fresh = new MandateVault(OWNER, address(token), UNIT, UNIT, 0);
        require(fresh.paused(), "new vault started active");
        require(address(fresh.token()) == address(token), "wrong fixed token");
        require(fresh.owner() == OWNER, "wrong immutable owner");
        _eq(token.decimals(), 6, "wrong decimal precision");
        _eq(token.totalSupply(), 1000 * UNIT, "unexpected token supply");
    }
}
