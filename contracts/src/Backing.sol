// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Backing — patronage that doesn't disappear
/// @notice Fans stake a stablecoin behind a creator. Principal is deposited into an
///         audited ERC-4626 vault and stays withdrawable by the fan at any time. The
///         yield that principal earns is attributed to the creator, who claims it once
///         per epoch.
/// @dev    Yield attribution uses a single "yield per unit of principal" accumulator
///         (MasterChef-style). Every state-changing call first syncs: it measures how
///         much the contract's vault position grew beyond what is owed (principal plus
///         unclaimed creator yield) and spreads that growth across all principal. Because
///         principal only changes at sync points, attribution is exact up to rounding,
///         and rounding always favours the contract (dust stays in the vault as buffer).
contract Backing is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    struct Creator {
        bool registered;
        uint64 registeredAt;
        uint64 lastClaimAt;
        uint256 principal; // total principal backing this creator
        uint256 accrued; // settled, unclaimed yield
        uint256 accDebt; // accumulator snapshot at last settle
        uint256 totalClaimed; // lifetime claimed yield
    }

    struct Profile {
        string name;
        string bio;
        string avatar; // image URL
        string handle; // X / social handle, without @
    }

    struct Position {
        uint256 principal;
        uint256 yieldGenerated; // lifetime yield this position produced for the creator (settled)
        uint256 accDebt;
        uint64 since; // first backed (resets after a full exit)
    }

    struct CreatorView {
        address creator;
        string name;
        string bio;
        string avatar;
        string handle;
        uint64 registeredAt;
        uint64 lastClaimAt;
        uint64 nextClaimAt;
        uint256 principal;
        uint256 backerCount;
        uint256 claimable; // accrued incl. pending yield
        uint256 totalClaimed;
        uint256 totalEarned; // totalClaimed + claimable
    }

    struct PositionView {
        address creator;
        string creatorName;
        string creatorAvatar;
        uint256 principal;
        uint256 yieldGenerated; // incl. pending
        uint64 since;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    uint256 private constant PRECISION = 1e27;

    IERC20 public immutable asset;
    IERC4626 public immutable vault;
    uint64 public immutable epochLength;
    uint256 public immutable minBack;

    uint256 public accYieldPerPrincipal;
    uint256 public totalPrincipal;
    uint256 public totalDistributed; // lifetime yield attributed to creators
    uint256 public totalClaimed; // lifetime yield claimed by creators

    mapping(address => Creator) internal _creators;
    mapping(address => Profile) internal _profiles;
    address[] internal _creatorList;

    mapping(address => mapping(address => Position)) internal _positions; // backer => creator => position
    mapping(address => address[]) internal _backersOf; // creator => backers
    mapping(address => mapping(address => uint256)) internal _backerIdx; // creator => backer => index+1
    mapping(address => address[]) internal _backedBy; // backer => creators
    mapping(address => mapping(address => uint256)) internal _creatorIdx; // backer => creator => index+1

    // ---------------------------------------------------------------------
    // Events / errors
    // ---------------------------------------------------------------------

    event CreatorRegistered(address indexed creator, string name);
    event ProfileUpdated(address indexed creator);
    event Backed(address indexed backer, address indexed creator, uint256 amount, uint256 newPrincipal);
    event Unbacked(address indexed backer, address indexed creator, uint256 amount, uint256 newPrincipal);
    event Claimed(address indexed creator, uint256 amount);
    event YieldSynced(uint256 newYield, uint256 accYieldPerPrincipal);

    error NotRegistered();
    error AlreadyRegistered();
    error InvalidProfile();
    error AmountTooSmall();
    error InsufficientPrincipal();
    error CannotBackSelf();
    error EpochNotOver(uint64 nextClaimAt);
    error NothingToClaim();
    error VaultAssetMismatch();

    constructor(IERC4626 vault_, uint64 epochLength_, uint256 minBack_) {
        vault = vault_;
        asset = IERC20(vault_.asset());
        epochLength = epochLength_;
        minBack = minBack_;
        if (address(asset) == address(0)) revert VaultAssetMismatch();
    }

    // ---------------------------------------------------------------------
    // Creator profile
    // ---------------------------------------------------------------------

    function registerCreator(string calldata name, string calldata bio, string calldata avatar, string calldata handle)
        external
    {
        Creator storage c = _creators[msg.sender];
        if (c.registered) revert AlreadyRegistered();
        _validateProfile(name, bio, avatar, handle);
        c.registered = true;
        c.registeredAt = uint64(block.timestamp);
        c.accDebt = accYieldPerPrincipal;
        _profiles[msg.sender] = Profile(name, bio, avatar, handle);
        _creatorList.push(msg.sender);
        emit CreatorRegistered(msg.sender, name);
    }

    function updateProfile(string calldata name, string calldata bio, string calldata avatar, string calldata handle)
        external
    {
        if (!_creators[msg.sender].registered) revert NotRegistered();
        _validateProfile(name, bio, avatar, handle);
        _profiles[msg.sender] = Profile(name, bio, avatar, handle);
        emit ProfileUpdated(msg.sender);
    }

    function _validateProfile(string calldata name, string calldata bio, string calldata avatar, string calldata handle)
        internal
        pure
    {
        uint256 n = bytes(name).length;
        if (n == 0 || n > 48 || bytes(bio).length > 280 || bytes(avatar).length > 256 || bytes(handle).length > 32) {
            revert InvalidProfile();
        }
    }

    // ---------------------------------------------------------------------
    // Backing
    // ---------------------------------------------------------------------

    /// @notice Back `creator` with `amount` of the asset. Requires prior approval.
    function back(address creator, uint256 amount) external nonReentrant {
        Creator storage c = _creators[creator];
        if (!c.registered) revert NotRegistered();
        if (creator == msg.sender) revert CannotBackSelf();
        if (amount < minBack) revert AmountTooSmall();

        _sync();
        _settleCreator(c);
        Position storage p = _positions[msg.sender][creator];
        _settlePosition(p);

        if (p.principal == 0) {
            p.since = uint64(block.timestamp);
            _addLink(msg.sender, creator);
        }

        asset.safeTransferFrom(msg.sender, address(this), amount);
        asset.forceApprove(address(vault), amount);
        vault.deposit(amount, address(this));

        p.principal += amount;
        c.principal += amount;
        totalPrincipal += amount;

        emit Backed(msg.sender, creator, amount, p.principal);
    }

    /// @notice Withdraw `amount` of principal from a backing. Stops future yield on that amount.
    function unback(address creator, uint256 amount) external nonReentrant {
        _unback(creator, amount);
    }

    /// @notice Withdraw all principal backing `creator`.
    function unbackAll(address creator) external nonReentrant {
        _unback(creator, _positions[msg.sender][creator].principal);
    }

    function _unback(address creator, uint256 amount) internal {
        Position storage p = _positions[msg.sender][creator];
        if (amount == 0 || amount > p.principal) revert InsufficientPrincipal();
        Creator storage c = _creators[creator];

        _sync();
        _settleCreator(c);
        _settlePosition(p);

        p.principal -= amount;
        c.principal -= amount;
        totalPrincipal -= amount;
        if (p.principal == 0) {
            p.since = 0;
            _removeLink(msg.sender, creator);
        }

        _withdrawFromVault(amount, msg.sender);
        emit Unbacked(msg.sender, creator, amount, p.principal);
    }

    // ---------------------------------------------------------------------
    // Creator claims (epoch-based)
    // ---------------------------------------------------------------------

    function claim() external nonReentrant returns (uint256 amount) {
        Creator storage c = _creators[msg.sender];
        if (!c.registered) revert NotRegistered();
        uint64 next = _nextClaimAt(c);
        if (block.timestamp < next) revert EpochNotOver(next);

        _sync();
        _settleCreator(c);
        amount = c.accrued;
        if (amount == 0) revert NothingToClaim();

        c.accrued = 0;
        c.lastClaimAt = uint64(block.timestamp);
        c.totalClaimed += amount;
        totalClaimed += amount;

        amount = _withdrawFromVault(amount, msg.sender);
        emit Claimed(msg.sender, amount);
    }

    /// @notice Anyone can push accrued vault yield into the accounting.
    function sync() external nonReentrant {
        _sync();
    }

    // ---------------------------------------------------------------------
    // Internal accounting
    // ---------------------------------------------------------------------

    function _currentValue() internal view returns (uint256) {
        return vault.convertToAssets(vault.balanceOf(address(this)));
    }

    function _owed() internal view returns (uint256) {
        return totalPrincipal + (totalDistributed - totalClaimed);
    }

    function _pendingYield() internal view returns (uint256) {
        if (totalPrincipal == 0) return 0;
        uint256 value = _currentValue();
        uint256 owed = _owed();
        return value > owed ? value - owed : 0;
    }

    function _sync() internal {
        uint256 y = _pendingYield();
        if (y == 0) return;
        accYieldPerPrincipal += (y * PRECISION) / totalPrincipal;
        totalDistributed += y;
        emit YieldSynced(y, accYieldPerPrincipal);
    }

    function _settleCreator(Creator storage c) internal {
        uint256 acc = accYieldPerPrincipal;
        if (c.principal > 0) c.accrued += (c.principal * (acc - c.accDebt)) / PRECISION;
        c.accDebt = acc;
    }

    function _settlePosition(Position storage p) internal {
        uint256 acc = accYieldPerPrincipal;
        if (p.principal > 0) p.yieldGenerated += (p.principal * (acc - p.accDebt)) / PRECISION;
        p.accDebt = acc;
    }

    /// @dev Withdraws `amount` of asset to `to`. If vault rounding leaves the contract a few
    ///      wei short of shares, redeems everything that is left instead.
    function _withdrawFromVault(uint256 amount, address to) internal returns (uint256) {
        uint256 sharesNeeded = vault.previewWithdraw(amount);
        uint256 shares = vault.balanceOf(address(this));
        if (sharesNeeded <= shares) {
            vault.withdraw(amount, to, address(this));
            return amount;
        }
        return vault.redeem(shares, to, address(this));
    }

    function _nextClaimAt(Creator storage c) internal view returns (uint64) {
        if (c.lastClaimAt == 0) return 0;
        return c.lastClaimAt + epochLength;
    }

    function _addLink(address backer, address creator) internal {
        _backersOf[creator].push(backer);
        _backerIdx[creator][backer] = _backersOf[creator].length;
        _backedBy[backer].push(creator);
        _creatorIdx[backer][creator] = _backedBy[backer].length;
    }

    function _removeLink(address backer, address creator) internal {
        _swapPop(_backersOf[creator], _backerIdx[creator], backer);
        _swapPop(_backedBy[backer], _creatorIdx[backer], creator);
    }

    function _swapPop(address[] storage list, mapping(address => uint256) storage idx, address item) private {
        uint256 i = idx[item] - 1;
        uint256 last = list.length - 1;
        if (i != last) {
            address moved = list[last];
            list[i] = moved;
            idx[moved] = i + 1;
        }
        list.pop();
        delete idx[item];
    }

    // ---------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------

    /// @notice Accumulator value as if synced right now.
    function currentAcc() public view returns (uint256) {
        if (totalPrincipal == 0) return accYieldPerPrincipal;
        return accYieldPerPrincipal + (_pendingYield() * PRECISION) / totalPrincipal;
    }

    function claimable(address creator) public view returns (uint256) {
        Creator storage c = _creators[creator];
        return c.accrued + (c.principal * (currentAcc() - c.accDebt)) / PRECISION;
    }

    function creatorCount() external view returns (uint256) {
        return _creatorList.length;
    }

    function isCreator(address account) external view returns (bool) {
        return _creators[account].registered;
    }

    function getCreator(address creator) public view returns (CreatorView memory v) {
        Creator storage c = _creators[creator];
        Profile storage pr = _profiles[creator];
        uint256 cl = c.registered ? claimable(creator) : 0;
        v = CreatorView({
            creator: creator,
            name: pr.name,
            bio: pr.bio,
            avatar: pr.avatar,
            handle: pr.handle,
            registeredAt: c.registeredAt,
            lastClaimAt: c.lastClaimAt,
            nextClaimAt: _nextClaimAt(c),
            principal: c.principal,
            backerCount: _backersOf[creator].length,
            claimable: cl,
            totalClaimed: c.totalClaimed,
            totalEarned: c.totalClaimed + cl
        });
    }

    function getCreators(uint256 offset, uint256 limit) external view returns (CreatorView[] memory out) {
        uint256 n = _creatorList.length;
        if (offset >= n) return new CreatorView[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        out = new CreatorView[](end - offset);
        for (uint256 i = offset; i < end; i++) {
            out[i - offset] = getCreator(_creatorList[i]);
        }
    }

    function getBackers(address creator)
        external
        view
        returns (address[] memory backers, uint256[] memory principals, uint256[] memory generated)
    {
        backers = _backersOf[creator];
        principals = new uint256[](backers.length);
        generated = new uint256[](backers.length);
        uint256 acc = currentAcc();
        for (uint256 i; i < backers.length; i++) {
            Position storage p = _positions[backers[i]][creator];
            principals[i] = p.principal;
            generated[i] = p.yieldGenerated + (p.principal * (acc - p.accDebt)) / PRECISION;
        }
    }

    function getPosition(address backer, address creator) public view returns (PositionView memory v) {
        Position storage p = _positions[backer][creator];
        Profile storage pr = _profiles[creator];
        v = PositionView({
            creator: creator,
            creatorName: pr.name,
            creatorAvatar: pr.avatar,
            principal: p.principal,
            yieldGenerated: p.yieldGenerated + (p.principal * (currentAcc() - p.accDebt)) / PRECISION,
            since: p.since
        });
    }

    function getPositions(address backer) external view returns (PositionView[] memory out) {
        address[] storage list = _backedBy[backer];
        out = new PositionView[](list.length);
        for (uint256 i; i < list.length; i++) {
            out[i] = getPosition(backer, list[i]);
        }
    }

    /// @notice Protocol-wide totals for the landing page.
    function stats()
        external
        view
        returns (uint256 principal, uint256 creators, uint256 yieldDistributed, uint256 yieldClaimed)
    {
        return (totalPrincipal, _creatorList.length, totalDistributed + _pendingYield(), totalClaimed);
    }
}
