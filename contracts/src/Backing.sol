// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title Backing — patronage that doesn't disappear
/// @notice Fans stake a stablecoin behind a creator. The principal goes into an ERC-4626 vault
///         (Morpho / Moonwell on Base) and always belongs to the fan, withdrawable any time. The
///         yield it earns goes to the creator, who claims it once per epoch.
///
///         Anyone can make a profile (unique username, Base name, picture, bio, link), post, and be
///         backed. Every join, backing, withdrawal, claim, post and milestone is appended to an
///         activity log the app reads as its feed and notifications, so no server is needed.
/// @dev    Accounting
///         - One "yield per unit of principal" accumulator. Every write first syncs: vault growth
///           beyond what is owed is spread across all principal.
///         - owedToUsers = principal + unclaimed creator yield. `reserve` sits on top: growth
///           nobody was entitled to (e.g. while nothing was backed). It's never paid out and is
///           the first thing a vault loss eats.
///         - If the vault holds less than owedToUsers, every exit is paid pro rata, so a loss is
///           shared instead of hitting whoever withdraws last.
///         - Deposits that come back short (ERC-4626 inflation attack) are refused.
contract Backing is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    struct Profile {
        string username; // unique, 3-20 chars: a-z 0-9 _
        string baseName; // e.g. ada.base.eth (self-reported)
        string avatar; // picture URL
        string bio;
        string link; // website or social link
    }

    struct Account {
        bool exists;
        uint8 milestones;
        uint64 joinedAt;
        uint64 lastClaimAt;
        uint256 principal; // total backing behind this person
        uint256 accrued; // settled, unclaimed yield
        uint256 accDebt;
        uint256 totalClaimed;
        uint256 referred; // backers this person brought in with their invite link
    }

    struct Position {
        uint256 principal;
        uint256 yieldGenerated; // lifetime yield this position sent the creator
        uint256 accDebt;
        uint64 since; // first backed (resets after a full exit)
    }

    enum Kind {
        Joined,
        Backed,
        Unbacked,
        Claimed,
        Posted,
        Milestone
    }

    struct Activity {
        Kind kind;
        address actor; // who did it
        address subject; // whose profile it's about (the creator)
        address referrer; // Backed: who invited the backer
        uint96 amount;
        uint40 time;
        string text; // post text
        string image; // post picture URL
    }

    struct ProfileView {
        address account;
        Profile profile;
        uint64 joinedAt;
        uint64 nextClaimAt;
        uint256 principal;
        uint256 backerCount;
        uint256 backingCount; // how many people this account backs
        uint256 claimable;
        uint256 totalClaimed;
        uint256 totalEarned;
        uint256 postCount;
        uint256 referred;
    }

    struct PositionView {
        address backer;
        address creator;
        uint256 principal;
        uint256 yieldGenerated;
        uint64 since;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    uint256 private constant PRECISION = 1e27;
    uint8 private constant MILESTONE_COUNT = 8;

    IERC20 public immutable asset;
    IERC4626 public immutable vault;
    uint64 public immutable epochLength;
    uint256 public immutable minBack;

    uint256 public accYieldPerPrincipal;
    uint256 public totalPrincipal;
    uint256 public totalDistributed;
    uint256 public totalClaimed;
    uint256 public reserve;

    mapping(address => Account) internal _accounts;
    mapping(address => Profile) internal _profiles;
    mapping(bytes32 => address) public usernameOwner;
    address[] internal _people;

    mapping(address => mapping(address => Position)) internal _positions; // backer => creator
    mapping(address => address[]) internal _backersOf;
    mapping(address => mapping(address => uint256)) internal _backerIdx;
    mapping(address => address[]) internal _backing; // backer => creators they back
    mapping(address => mapping(address => uint256)) internal _backingIdx;

    Activity[] internal _activity;
    mapping(address => uint256[]) internal _inbox; // activity ids that concern an account
    uint256[] internal _posts;
    mapping(address => uint256[]) internal _postsBy;

    // ---------------------------------------------------------------------
    // Events / errors
    // ---------------------------------------------------------------------

    event ProfileSaved(address indexed account, string username);
    event Backed(address indexed backer, address indexed creator, uint256 amount, address indexed referrer);
    event Unbacked(address indexed backer, address indexed creator, uint256 principal, uint256 paid);
    event Claimed(address indexed creator, uint256 amount);
    event YieldSynced(uint256 newYield, uint256 accYieldPerPrincipal);
    event ActivityAdded(uint256 indexed id, Kind indexed kind, address indexed subject);

    error NoProfile();
    error InvalidProfile();
    error UsernameTaken();
    error AmountTooSmall();
    error InsufficientPrincipal();
    error CannotBackSelf();
    error EpochNotOver(uint64 nextClaimAt);
    error NothingToClaim();
    error VaultAssetMismatch();
    error InvalidPost();
    error DepositLoss();
    error VaultNotSupported();

    constructor(IERC4626 vault_, uint64 epochLength_, uint256 minBack_) {
        vault = vault_;
        asset = IERC20(vault_.asset());
        if (address(asset) == address(0)) revert VaultAssetMismatch();
        epochLength = epochLength_;
        minBack = minBack_;

        // Only accept a fee-free, synchronous vault. A preview round-trip of a probe amount must
        // come back about whole, and withdrawing must not cost materially more shares than
        // depositing gave. A deposit/withdraw fee (or a vault that rounds against us) would let
        // each exit quietly under-collateralize everyone who stays, so we refuse it up front
        // rather than trust the vault address. Tuned for 6-decimal USDC.
        uint256 probe = 1e6;
        uint256 shares = vault_.previewDeposit(probe);
        if (shares == 0 || vault_.previewRedeem(shares) + probe / 1000 + 2 < probe) revert VaultNotSupported();
        if (vault_.previewWithdraw(probe) > shares + shares / 1000 + 2) revert VaultNotSupported();
    }

    // ---------------------------------------------------------------------
    // Profiles and posts
    // ---------------------------------------------------------------------

    /// @notice Create or update your profile. Usernames are unique.
    function saveProfile(Profile calldata p) external {
        _validate(p);
        bytes32 key = keccak256(bytes(p.username));
        address owner = usernameOwner[key];
        if (owner != address(0) && owner != msg.sender) revert UsernameTaken();

        Account storage a = _accounts[msg.sender];
        if (!a.exists) {
            a.exists = true;
            a.joinedAt = uint64(block.timestamp);
            a.accDebt = accYieldPerPrincipal;
            _people.push(msg.sender);
            _log(Kind.Joined, msg.sender, msg.sender, address(0), 0, "", "");
        } else {
            bytes32 old = keccak256(bytes(_profiles[msg.sender].username));
            if (old != key) delete usernameOwner[old];
        }
        usernameOwner[key] = msg.sender;
        _profiles[msg.sender] = p;
        emit ProfileSaved(msg.sender, p.username);
    }

    function _validate(Profile calldata p) internal pure {
        bytes calldata u = bytes(p.username);
        if (u.length < 3 || u.length > 20) revert InvalidProfile();
        for (uint256 i; i < u.length; i++) {
            bytes1 ch = u[i];
            bool ok = (ch >= 0x61 && ch <= 0x7a) || (ch >= 0x30 && ch <= 0x39) || ch == 0x5f; // a-z 0-9 _
            if (!ok) revert InvalidProfile();
        }
        if (bytes(p.baseName).length > 64 || bytes(p.avatar).length > 256 || bytes(p.bio).length > 280 || bytes(p.link).length > 120) {
            revert InvalidProfile();
        }
    }

    /// @notice Post to the feed: text up to 280 bytes and/or a picture URL.
    function post(string calldata text, string calldata image) external returns (uint256 id) {
        if (!_accounts[msg.sender].exists) revert NoProfile();
        uint256 n = bytes(text).length;
        if (n > 280 || bytes(image).length > 256 || (n == 0 && bytes(image).length == 0)) revert InvalidPost();
        id = _log(Kind.Posted, msg.sender, msg.sender, address(0), 0, text, image);
        _posts.push(id);
        _postsBy[msg.sender].push(id);
    }

    // ---------------------------------------------------------------------
    // Backing
    // ---------------------------------------------------------------------

    /// @notice Back `creator` with `amount` (approve the asset first). `referrer` is whoever shared
    ///         the invite link that brought you here, or zero.
    function back(address creator, uint256 amount, address referrer) external nonReentrant {
        Account storage c = _accounts[creator];
        if (!c.exists) revert NoProfile();
        if (creator == msg.sender) revert CannotBackSelf();
        if (amount < minBack) revert AmountTooSmall();
        if (referrer == msg.sender || !_accounts[referrer].exists) referrer = address(0);

        _sync();
        _settleCreator(c);
        Position storage p = _positions[msg.sender][creator];
        _settlePosition(p);

        if (p.principal == 0) {
            p.since = uint64(block.timestamp);
            _link(msg.sender, creator);
            if (referrer != address(0)) _accounts[referrer].referred += 1;
        }

        asset.safeTransferFrom(msg.sender, address(this), amount);
        asset.forceApprove(address(vault), amount);
        uint256 shares = vault.deposit(amount, address(this));
        if (vault.previewRedeem(shares) + amount / 100_000 + 2 < amount) revert DepositLoss();

        p.principal += amount;
        c.principal += amount;
        totalPrincipal += amount;

        emit Backed(msg.sender, creator, amount, referrer);
        uint256 id = _log(Kind.Backed, msg.sender, creator, referrer, amount, "", "");
        if (referrer != address(0) && referrer != creator) _inbox[referrer].push(id);

        uint8 m = c.milestones;
        while (m < MILESTONE_COUNT && c.principal >= _milestone(m)) {
            _log(Kind.Milestone, creator, creator, address(0), _milestone(m), "", "");
            m++;
        }
        c.milestones = m;
    }

    /// @notice Withdraw part of your principal. Always allowed.
    function unback(address creator, uint256 amount) external nonReentrant {
        _exit(creator, amount);
    }

    /// @notice Withdraw all of your principal from `creator`.
    function unbackAll(address creator) external nonReentrant {
        _exit(creator, _positions[msg.sender][creator].principal);
    }

    function _exit(address creator, uint256 amount) internal {
        Position storage p = _positions[msg.sender][creator];
        if (amount == 0 || amount > p.principal) revert InsufficientPrincipal();
        Account storage c = _accounts[creator];

        _sync();
        _settleCreator(c);
        _settlePosition(p);

        uint256 pay = _shareOfValue(amount);
        p.principal -= amount;
        c.principal -= amount;
        totalPrincipal -= amount;
        if (p.principal == 0) {
            p.since = 0;
            _unlink(msg.sender, creator);
        }
        pay = _withdraw(pay, msg.sender);
        emit Unbacked(msg.sender, creator, amount, pay);
        _log(Kind.Unbacked, msg.sender, creator, address(0), amount, "", "");
    }

    // ---------------------------------------------------------------------
    // Claims (epoch-based)
    // ---------------------------------------------------------------------

    function claim() external nonReentrant returns (uint256 amount) {
        Account storage c = _accounts[msg.sender];
        if (!c.exists) revert NoProfile();
        uint64 next = _nextClaimAt(c);
        if (block.timestamp < next) revert EpochNotOver(next);

        _sync();
        _settleCreator(c);
        uint256 owed = c.accrued;
        if (owed == 0) revert NothingToClaim();

        uint256 pay = _shareOfValue(owed);
        c.accrued = 0;
        c.lastClaimAt = uint64(block.timestamp);
        c.totalClaimed += owed;
        totalClaimed += owed;

        amount = _withdraw(pay, msg.sender);
        emit Claimed(msg.sender, amount);
        _log(Kind.Claimed, msg.sender, msg.sender, address(0), amount, "", "");
    }

    /// @notice Anyone can push accrued vault yield into the accounting.
    function sync() external nonReentrant {
        _sync();
    }

    // ---------------------------------------------------------------------
    // Internal accounting
    // ---------------------------------------------------------------------

    function _value() internal view returns (uint256) {
        return vault.convertToAssets(vault.balanceOf(address(this)));
    }

    function _owedToUsers() internal view returns (uint256) {
        return totalPrincipal + (totalDistributed - totalClaimed);
    }

    /// @dev Undistributed yield, and what the reserve should be after a sync.
    function _pending() internal view returns (uint256 yield_, uint256 newReserve) {
        uint256 value = _value();
        uint256 users = _owedToUsers();
        if (value <= users) return (0, 0); // a loss: the reserve is used up first
        uint256 surplus = value - users;
        if (surplus <= reserve || totalPrincipal == 0) return (0, surplus);
        return (surplus - reserve, reserve);
    }

    function _sync() internal {
        (uint256 y, uint256 r) = _pending();
        reserve = r;
        if (y == 0) return;
        accYieldPerPrincipal += (y * PRECISION) / totalPrincipal;
        totalDistributed += y;
        emit YieldSynced(y, accYieldPerPrincipal);
    }

    /// @dev If the vault holds less than it owes, every exit gets the same haircut.
    function _shareOfValue(uint256 amount) internal view returns (uint256) {
        uint256 users = _owedToUsers();
        uint256 value = _value();
        if (value >= users || users == 0) return amount;
        return (amount * value) / users;
    }

    function _settleCreator(Account storage c) internal {
        uint256 acc = accYieldPerPrincipal;
        if (c.principal > 0) c.accrued += (c.principal * (acc - c.accDebt)) / PRECISION;
        c.accDebt = acc;
    }

    function _settlePosition(Position storage p) internal {
        uint256 acc = accYieldPerPrincipal;
        if (p.principal > 0) p.yieldGenerated += (p.principal * (acc - p.accDebt)) / PRECISION;
        p.accDebt = acc;
    }

    /// @dev Withdraws `amount` to `to`; if vault rounding leaves us a few wei short, redeems what's left.
    function _withdraw(uint256 amount, address to) internal returns (uint256) {
        if (amount == 0) return 0;
        uint256 shares = vault.balanceOf(address(this));
        if (vault.previewWithdraw(amount) <= shares) {
            vault.withdraw(amount, to, address(this));
            return amount;
        }
        return vault.redeem(shares, to, address(this));
    }

    function _nextClaimAt(Account storage c) internal view returns (uint64) {
        return c.lastClaimAt == 0 ? 0 : c.lastClaimAt + epochLength;
    }

    /// @dev 100, 1k, 5k, 10k, 50k, 100k, 500k, 1M whole units (6 decimals)
    function _milestone(uint8 i) internal pure returns (uint256) {
        uint32[8] memory whole = [uint32(100), 1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];
        return uint256(whole[i]) * 1e6;
    }

    function _log(Kind kind, address actor, address subject, address referrer, uint256 amount, string memory text, string memory image)
        internal
        returns (uint256 id)
    {
        id = _activity.length;
        _activity.push(
            Activity({
                kind: kind,
                actor: actor,
                subject: subject,
                referrer: referrer,
                amount: SafeCast.toUint96(amount),
                time: uint40(block.timestamp),
                text: text,
                image: image
            })
        );
        _inbox[subject].push(id);
        emit ActivityAdded(id, kind, subject);
    }

    function _link(address backer, address creator) internal {
        _backersOf[creator].push(backer);
        _backerIdx[creator][backer] = _backersOf[creator].length;
        _backing[backer].push(creator);
        _backingIdx[backer][creator] = _backing[backer].length;
    }

    function _unlink(address backer, address creator) internal {
        _swapPop(_backersOf[creator], _backerIdx[creator], backer);
        _swapPop(_backing[backer], _backingIdx[backer], creator);
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

    function currentAcc() public view returns (uint256) {
        (uint256 y,) = _pending();
        if (totalPrincipal == 0 || y == 0) return accYieldPerPrincipal;
        return accYieldPerPrincipal + (y * PRECISION) / totalPrincipal;
    }

    function claimable(address account) public view returns (uint256) {
        Account storage c = _accounts[account];
        return c.accrued + (c.principal * (currentAcc() - c.accDebt)) / PRECISION;
    }

    function hasProfile(address account) external view returns (bool) {
        return _accounts[account].exists;
    }

    function peopleCount() external view returns (uint256) {
        return _people.length;
    }

    function getProfile(address account) public view returns (ProfileView memory v) {
        Account storage c = _accounts[account];
        uint256 cl = c.exists ? claimable(account) : 0;
        v.account = account;
        v.profile = _profiles[account];
        v.joinedAt = c.joinedAt;
        v.nextClaimAt = _nextClaimAt(c);
        v.principal = c.principal;
        v.backerCount = _backersOf[account].length;
        v.backingCount = _backing[account].length;
        v.claimable = cl;
        v.totalClaimed = c.totalClaimed;
        v.totalEarned = c.totalClaimed + cl;
        v.postCount = _postsBy[account].length;
        v.referred = c.referred;
    }

    function getProfileByUsername(string calldata username) external view returns (ProfileView memory) {
        return getProfile(usernameOwner[keccak256(bytes(username))]);
    }

    function getPeople(uint256 offset, uint256 limit) external view returns (ProfileView[] memory out) {
        uint256 n = _people.length;
        if (offset >= n) return new ProfileView[](0);
        uint256 end = offset + limit > n ? n : offset + limit;
        out = new ProfileView[](end - offset);
        for (uint256 i = offset; i < end; i++) out[i - offset] = getProfile(_people[i]);
    }

    function getPosition(address backer, address creator) public view returns (PositionView memory) {
        Position storage p = _positions[backer][creator];
        return PositionView({
            backer: backer,
            creator: creator,
            principal: p.principal,
            yieldGenerated: p.yieldGenerated + (p.principal * (currentAcc() - p.accDebt)) / PRECISION,
            since: p.since
        });
    }

    /// @notice Everyone backing `creator`.
    function getBackers(address creator) external view returns (PositionView[] memory out) {
        address[] storage list = _backersOf[creator];
        out = new PositionView[](list.length);
        for (uint256 i; i < list.length; i++) out[i] = getPosition(list[i], creator);
    }

    /// @notice Everyone `backer` is backing.
    function getBacking(address backer) external view returns (PositionView[] memory out) {
        address[] storage list = _backing[backer];
        out = new PositionView[](list.length);
        for (uint256 i; i < list.length; i++) out[i] = getPosition(backer, list[i]);
    }

    /// @notice Newest-first page of all posts.
    function getPosts(uint256 offset, uint256 limit) external view returns (uint256[] memory, Activity[] memory) {
        return _page(_posts, offset, limit);
    }

    function getPostsBy(address account, uint256 offset, uint256 limit) external view returns (uint256[] memory, Activity[] memory) {
        return _page(_postsBy[account], offset, limit);
    }

    /// @notice Newest-first page of everything that concerns `account`: their notifications.
    function getInbox(address account, uint256 offset, uint256 limit) external view returns (uint256[] memory, Activity[] memory) {
        return _page(_inbox[account], offset, limit);
    }

    function stats() external view returns (uint256 principal, uint256 people, uint256 yieldDistributed, uint256 yieldClaimed) {
        (uint256 y,) = _pending();
        return (totalPrincipal, _people.length, totalDistributed + y, totalClaimed);
    }

    /// @notice Vault value vs what is owed, so anyone can check solvency.
    function health() external view returns (uint256 value, uint256 owedToUsers, uint256 reserve_) {
        (, reserve_) = _pending();
        return (_value(), _owedToUsers(), reserve_);
    }

    function _page(uint256[] storage list, uint256 offset, uint256 limit) internal view returns (uint256[] memory ids, Activity[] memory items) {
        uint256 n = list.length;
        if (offset >= n) return (new uint256[](0), new Activity[](0));
        uint256 count = n - offset < limit ? n - offset : limit;
        ids = new uint256[](count);
        items = new Activity[](count);
        for (uint256 i; i < count; i++) {
            uint256 id = list[n - 1 - offset - i];
            ids[i] = id;
            items[i] = _activity[id];
        }
    }
}
