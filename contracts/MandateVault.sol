// SPDX-License-Identifier: MIT
pragma solidity 0.8.37;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {TestNetworks} from "./TestNetworks.sol";

/// @notice One owner, one immutable test token, and a restricted bill-payment agent.
/// @dev Invoice normalization happens before hashing, outside this contract. Only the owner can
///      approve the resulting identity. Never deploy with real funds or an untrusted token.
contract MandateVault is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Vendor {
        address recipient;
        bool enabled;
        uint256 revision;
    }

    struct Approval {
        bytes32 vendorId;
        bytes32 invoiceIdHash;
        address recipient;
        uint256 amount;
        uint64 notBefore;
        uint64 expiresAt;
        bytes32 documentHash;
    }

    struct Bill {
        bytes32 vendorId;
        address recipient;
        uint256 amount;
        uint64 notBefore;
        uint64 expiresAt;
        bytes32 documentHash;
        uint256 vendorRevision;
        uint256 approvalVersion;
        bool cancelled;
        bool paid;
    }

    error OnlyOwner();
    error OnlyAgent();
    error InvalidAddress();
    error InvalidIdentifier();
    error InvalidAmount();
    error InvalidWindow();
    error InvalidLimits();
    error InvalidToken();
    error WrongChain();
    error InvalidBatchSize();
    error DuplicateInBatch(bytes32 billKey);
    error VaultPaused();
    error RecoveryRequiresPause();
    error StalePolicy(uint256 expected, uint256 current);
    error SessionNotStarted();
    error SessionExpired();
    error BillNotApproved();
    error BillCancelled();
    error BillAlreadyPaid();
    error BillNotDue();
    error BillExpired();
    error VendorNotApproved();
    error RecipientMismatch();
    error VendorChanged();
    error PerBillLimitExceeded();
    error DailyLimitExceeded();
    error InsufficientBalance();
    error ReserveViolation();
    error InexactTransfer();

    event PolicyChanged(uint256 indexed policyVersion);
    event VendorSet(bytes32 indexed vendorId, address indexed recipient, bool enabled, uint256 revision);
    event LimitsSet(uint256 maxPerBill, uint256 dailyLimit, uint256 minReserve);
    event AgentSet(address indexed agent, uint64 notBefore, uint64 expiresAt);
    event AgentRevoked(address indexed previousAgent);
    event PauseSet(bool paused);
    event BillApproved(
        bytes32 indexed billKey,
        bytes32 indexed vendorId,
        address recipient,
        uint256 amount,
        uint64 notBefore,
        uint64 expiresAt,
        bytes32 documentHash,
        uint256 approvalVersion
    );
    event BillCancelledByOwner(bytes32 indexed billKey);
    event BillPaid(
        bytes32 indexed billKey,
        address indexed recipient,
        address indexed token,
        uint256 amount,
        uint256 policyVersion,
        uint256 utcDay,
        uint256 dailySpent
    );
    event OwnerRecovery(address indexed recipient, uint256 amount);

    uint256 public constant MAX_APPROVAL_BATCH = 50;
    address public immutable owner;
    IERC20 public immutable token;
    uint256 public immutable deploymentChainId;

    uint256 public policyVersion = 1;
    bool public paused = true;
    address public agent;
    uint64 public agentNotBefore;
    uint64 public agentExpiresAt;
    uint256 public maxPerBill;
    uint256 public dailyLimit;
    uint256 public minReserve;

    mapping(bytes32 => Vendor) public vendors;
    mapping(bytes32 => Bill) private _bills;
    mapping(uint256 => uint256) public spentPerDay;

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    constructor(
        address owner_,
        address token_,
        uint256 maxPerBill_,
        uint256 dailyLimit_,
        uint256 minReserve_
    ) {
        TestNetworks.requireSupported();
        if (owner_ == address(0) || owner_ == address(this)) revert InvalidAddress();
        if (token_.code.length == 0) revert InvalidToken();
        if (IERC20Metadata(token_).decimals() != 6) revert InvalidToken();
        owner = owner_;
        token = IERC20(token_);
        deploymentChainId = block.chainid;
        _setLimits(maxPerBill_, dailyLimit_, minReserve_);
    }

    /// @dev Any vendor update invalidates that vendor's old bill approvals, even if re-enabled
    ///      later at the same address. Re-approval is an explicit new owner action.
    function setVendor(bytes32 vendorId, address recipient, bool enabled) external onlyOwner {
        if (vendorId == bytes32(0)) revert InvalidIdentifier();
        _checkRecipient(recipient);
        Vendor storage vendor = vendors[vendorId];
        vendor.recipient = recipient;
        vendor.enabled = enabled;
        vendor.revision += 1;
        _bumpVersion();
        emit VendorSet(vendorId, recipient, enabled, vendor.revision);
    }

    function setLimits(uint256 maxPerBill_, uint256 dailyLimit_, uint256 minReserve_) external onlyOwner {
        _setLimits(maxPerBill_, dailyLimit_, minReserve_);
        _bumpVersion();
    }

    function setAgent(address agent_, uint64 notBefore, uint64 expiresAt) external onlyOwner {
        if (agent_ == address(0) || agent_ == owner || agent_ == address(this)) revert InvalidAddress();
        _checkWindow(notBefore, expiresAt);
        agent = agent_;
        agentNotBefore = notBefore;
        agentExpiresAt = expiresAt;
        _bumpVersion();
        emit AgentSet(agent_, notBefore, expiresAt);
    }

    function revokeAgent() external onlyOwner {
        address previous = agent;
        agent = address(0);
        agentNotBefore = 0;
        agentExpiresAt = 0;
        _bumpVersion();
        emit AgentRevoked(previous);
    }

    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        _bumpVersion();
        emit PauseSet(paused_);
    }

    /// @notice Recipient and amount are exact owner approvals, independent of model output.
    /// @dev A cancelled, unpaid key may be explicitly re-approved. A paid key can never be reset.
    function approveBills(Approval[] calldata approvals) external onlyOwner {
        if (approvals.length == 0 || approvals.length > MAX_APPROVAL_BATCH) revert InvalidBatchSize();
        uint256 version = _bumpVersion();
        for (uint256 i; i < approvals.length; ++i) {
            _approve(approvals[i], version);
        }
    }

    function cancelBill(bytes32 billKey) external onlyOwner {
        Bill storage bill = _bills[billKey];
        if (bill.amount == 0) revert BillNotApproved();
        if (bill.paid) revert BillAlreadyPaid();
        bill.cancelled = true;
        _bumpVersion();
        emit BillCancelledByOwner(billKey);
    }

    /// @notice The agent supplies only the bill key and policy version, never transfer fields.
    function payBill(bytes32 billKey, uint256 expectedPolicyVersion) external nonReentrant {
        if (block.chainid != deploymentChainId) revert WrongChain();
        if (msg.sender != agent || agent == address(0)) revert OnlyAgent();
        if (paused) revert VaultPaused();
        if (expectedPolicyVersion != policyVersion) revert StalePolicy(expectedPolicyVersion, policyVersion);
        if (block.timestamp < agentNotBefore) revert SessionNotStarted();
        if (block.timestamp >= agentExpiresAt) revert SessionExpired();

        Bill storage bill = _bills[billKey];
        if (bill.amount == 0) revert BillNotApproved();
        if (bill.paid) revert BillAlreadyPaid();
        if (bill.cancelled) revert BillCancelled();
        if (block.timestamp < bill.notBefore) revert BillNotDue();
        if (block.timestamp >= bill.expiresAt) revert BillExpired();
        Vendor storage vendor = vendors[bill.vendorId];
        if (!vendor.enabled) revert VendorNotApproved();
        if (bill.recipient != vendor.recipient) revert RecipientMismatch();
        if (bill.vendorRevision != vendor.revision) revert VendorChanged();

        uint256 amount = bill.amount;
        if (amount > maxPerBill) revert PerBillLimitExceeded();
        uint256 day = block.timestamp / 1 days;
        uint256 spent = spentPerDay[day];
        if (spent > dailyLimit || amount > dailyLimit - spent) revert DailyLimitExceeded();
        uint256 balance = token.balanceOf(address(this));
        if (amount > balance) revert InsufficientBalance();
        if (balance - amount < minReserve) revert ReserveViolation();
        uint256 recipientBalance = token.balanceOf(bill.recipient);

        // Effects before interaction. A failed transfer reverts these changes and all token effects.
        bill.paid = true;
        spentPerDay[day] = spent + amount;
        token.safeTransfer(bill.recipient, amount);
        if (
            token.balanceOf(address(this)) != balance - amount
                || token.balanceOf(bill.recipient) != recipientBalance + amount
        ) revert InexactTransfer();
        emit BillPaid(billKey, bill.recipient, address(token), amount, policyVersion, day, spent + amount);
    }

    /// @notice Owner recovery deliberately bypasses agent budgets, only while payments are paused.
    function recoverTokens(address recipient, uint256 amount) external onlyOwner nonReentrant {
        if (!paused) revert RecoveryRequiresPause();
        _checkRecipient(recipient);
        if (amount == 0) revert InvalidAmount();
        _bumpVersion();
        token.safeTransfer(recipient, amount);
        emit OwnerRecovery(recipient, amount);
    }

    function billKeyFor(bytes32 vendorId, bytes32 invoiceIdHash) public view returns (bytes32) {
        return keccak256(abi.encode(deploymentChainId, address(this), vendorId, invoiceIdHash));
    }

    function getBill(bytes32 billKey) external view returns (Bill memory) {
        return _bills[billKey];
    }

    function currentDaySpent() external view returns (uint256) {
        return spentPerDay[block.timestamp / 1 days];
    }

    function _approve(Approval calldata approval, uint256 version) private {
        if (approval.vendorId == bytes32(0) || approval.invoiceIdHash == bytes32(0)) {
            revert InvalidIdentifier();
        }
        if (approval.documentHash == bytes32(0)) revert InvalidIdentifier();
        if (approval.amount == 0) revert InvalidAmount();
        _checkRecipient(approval.recipient);
        _checkWindow(approval.notBefore, approval.expiresAt);
        Vendor storage vendor = vendors[approval.vendorId];
        if (!vendor.enabled) revert VendorNotApproved();
        if (approval.recipient != vendor.recipient) revert RecipientMismatch();
        bytes32 key = billKeyFor(approval.vendorId, approval.invoiceIdHash);
        if (_bills[key].paid) revert BillAlreadyPaid();
        if (_bills[key].approvalVersion == version) revert DuplicateInBatch(key);
        _bills[key] = Bill({
            vendorId: approval.vendorId,
            recipient: approval.recipient,
            amount: approval.amount,
            notBefore: approval.notBefore,
            expiresAt: approval.expiresAt,
            documentHash: approval.documentHash,
            vendorRevision: vendor.revision,
            approvalVersion: version,
            cancelled: false,
            paid: false
        });
        emit BillApproved(
            key,
            approval.vendorId,
            approval.recipient,
            approval.amount,
            approval.notBefore,
            approval.expiresAt,
            approval.documentHash,
            version
        );
    }

    function _setLimits(uint256 maxPerBill_, uint256 dailyLimit_, uint256 minReserve_) private {
        if (maxPerBill_ == 0 || dailyLimit_ == 0) revert InvalidLimits();
        maxPerBill = maxPerBill_;
        dailyLimit = dailyLimit_;
        minReserve = minReserve_;
        emit LimitsSet(maxPerBill_, dailyLimit_, minReserve_);
    }

    function _checkWindow(uint64 notBefore, uint64 expiresAt) private view {
        if (expiresAt <= notBefore || expiresAt <= block.timestamp) revert InvalidWindow();
    }

    function _checkRecipient(address recipient) private view {
        if (recipient == address(0) || recipient == address(this)) revert InvalidAddress();
    }

    function _bumpVersion() private returns (uint256) {
        policyVersion += 1;
        emit PolicyChanged(policyVersion);
        return policyVersion;
    }
}
