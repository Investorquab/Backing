// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";

/// @title Backing — patronage that doesn't disappear
/// @notice Fans stake a stablecoin behind a creator. Principal goes into an audited ERC-4626
///         vault and always belongs to the fan. The yield it earns is attributed to the creator,
///         who claims it once per epoch. A backing can be ongoing, end after a set time, or be
///         locked for that time.
/// @dev    Accounting
///         - One "yield per unit of principal" accumulator (MasterChef-style). Every write first
///           syncs: vault growth beyond what is owed is spread across all principal.
///         - owedToUsers = totalPrincipal + unclaimed creator yield. `reserve` sits on top: yield
///           that nobody was entitled to (growth while nothing was backed, yield after a timed
///           backing ended). It is never paid out and is the first thing a vault loss eats.
///         - If the vault ever holds less than owedToUsers, every exit (unback, close, claim) is
///           paid pro rata (value / owedToUsers), so the loss is shared instead of hitting
///           whoever withdraws last.
///         - Timed backings: yield earned after `endsAt` is moved from the creator to the reserve
///           when the position is next touched (interpolated by time). Anyone can `close` an
///           ended backing; the principal always goes to the backer.
///         Social layer: profiles, posts with an optional picture, comments, and an append-only
///         activity log the app reads as its feed and notifications. No server needed.
contract Backing is ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ---------------------------------------------------------------------
    // Types
    // ---------------------------------------------------------------------

    struct Creator {
        bool registered;
        uint8 milestones;
        uint64 registeredAt;
        uint64 lastClaimAt;
        uint256 principal;
        uint256 accrued; // settled, unclaimed yield
        uint256 accDebt;
        uint256 totalClaimed;
    }

    struct Profile {
        string name;
        string bio;
        string avatar; // image URL
        string banner; // image URL
        string handle; // Base App / Farcaster username
        uint64 fid; // Farcaster id reported by Base App. Self-reported.
        string x; // X username, without @
        string xPost; // id of the X post that carries this wallet's link code (checked off-chain)
    }

    struct Position {
        uint256 principal;
        uint256 yieldGenerated; // lifetime yield this position produced for the creator
        uint256 accDebt;
        uint64 since; // first backed (resets after a full exit)
        uint64 settledAt; // last time this position's yield was settled
        uint64 endsAt; // 0 = ongoing. After this the backing stops counting and anyone can close it
        uint64 lockedUntil; // principal can't be withdrawn before this (0 = flexible)
    }

    struct BackOptions {
        uint64 duration; // seconds; 0 = ongoing
        bool lock; // lock the principal for `duration`
        bytes20 cast; // Farcaster cast that led here, or zero
        uint256 post; // activity id of the creator's post that led here, or 0
        string note; // public note, max 140 bytes
    }

    enum Kind {
        Joined,
        Backed,
        Claimed,
        Posted,
        Milestone,
        Commented,
        Ended
    }

    struct Activity {
        Kind kind;
        address actor; // backer, commenter, or the creator
        address creator;
        uint96 amount;
        uint40 time;
        bytes20 cast;
        uint256 ref; // Backed/Commented: the post id
        string text; // note, post text or comment
        string link; // post link (any https URL, e.g. an X post)
        string image; // post picture URL
    }

    struct PostStats {
        uint128 backed; // total backed through this post
        uint32 backings;
        uint32 comments;
    }

    struct CreatorView {
        address creator;
        string name;
        string bio;
        string avatar;
        string banner;
        string handle;
        uint64 fid;
        string x;
        string xPost;
        uint64 registeredAt;
        uint64 lastClaimAt;
        uint64 nextClaimAt;
        uint256 principal;
        uint256 backerCount;
        uint256 claimable;
        uint256 totalClaimed;
        uint256 totalEarned;
        uint256 postCount;
        uint256 castCount;
    }

    struct PositionView {
        address creator;
        string creatorName;
        string creatorAvatar;
        uint256 principal;
        uint256 yieldGenerated;
        uint64 since;
        uint64 endsAt;
        uint64 lockedUntil;
    }

    struct BackerView {
        address backer;
        uint256 principal;
        uint256 generated;
        uint64 endsAt;
        uint64 lockedUntil;
    }

    struct CastView {
        bytes20 cast;
        uint256 backed;
        uint256 backings;
    }

    // ---------------------------------------------------------------------
    // Storage
    // ---------------------------------------------------------------------

    uint256 private constant PRECISION = 1e27;
    uint64 public constant MAX_DURATION = 366 days;
    uint8 internal constant MILESTONE_COUNT = 8;

    IERC20 public immutable asset;
    IERC4626 public immutable vault;
    uint64 public immutable epochLength;
    uint256 public immutable minBack;

    uint256 public accYieldPerPrincipal;
    uint256 public totalPrincipal;
    uint256 public totalDistributed;
    uint256 public totalClaimed;
    uint256 public reserve;

    mapping(address => Creator) internal _creators;
    mapping(address => Profile) internal _profiles;
    address[] internal _creatorList;

    mapping(address => mapping(address => Position)) internal _positions;
    mapping(address => address[]) internal _backersOf;
    mapping(address => mapping(address => uint256)) internal _backerIdx;
    mapping(address => address[]) internal _backedBy;
    mapping(address => mapping(address => uint256)) internal _creatorIdx;

    Activity[] internal _activity;
    mapping(address => uint256[]) internal _creatorActivity; // everything involving a creator
    uint256[] internal _posts;
    mapping(address => uint256[]) internal _creatorPosts;
    mapping(uint256 => uint256[]) internal _comments; // post id => comment activity ids
    mapping(uint256 => PostStats) internal _postStats;
    mapping(address => bytes20[]) internal _casts;
    mapping(address => mapping(bytes20 => CastView)) internal _castStats;

    // ---------------------------------------------------------------------
    // Events / errors
    // ---------------------------------------------------------------------

    event CreatorRegistered(address indexed creator, string name);
    event ProfileUpdated(address indexed creator);
    event Backed(address indexed backer, address indexed creator, uint256 amount, uint256 newPrincipal, uint64 endsAt, uint64 lockedUntil);
    event Unbacked(address indexed backer, address indexed creator, uint256 principal, uint256 paid);
    event Closed(address indexed backer, address indexed creator, address indexed by, uint256 paid);
    event Claimed(address indexed creator, uint256 amount);
    event YieldSynced(uint256 newYield, uint256 accYieldPerPrincipal);
    event ReserveChanged(uint256 reserve);
    event ActivityAdded(uint256 indexed id, Kind indexed kind, address indexed creator);

    error NotRegistered();
    error AlreadyRegistered();
    error InvalidProfile();
    error AmountTooSmall();
    error InsufficientPrincipal();
    error CannotBackSelf();
    error EpochNotOver(uint64 nextClaimAt);
    error NothingToClaim();
    error VaultAssetMismatch();
    error InvalidPost();
    error NoteTooLong();
    error InvalidComment();
    error UnknownPost();
    error InvalidDuration();
    error Locked(uint64 until);
    error NotEnded();
    error DepositLoss();

    constructor(IERC4626 vault_, uint64 epochLength_, uint256 minBack_) {
        vault = vault_;
        asset = IERC20(vault_.asset());
        if (address(asset) == address(0)) revert VaultAssetMismatch();
        epochLength = epochLength_;
        minBack = minBack_;
    }

    // ---------------------------------------------------------------------
    // Profiles, posts, comments
    // ---------------------------------------------------------------------

    function registerCreator(Profile calldata p) external {
        Creator storage c = _creators[msg.sender];
        if (c.registered) revert AlreadyRegistered();
        _validateProfile(p);
        c.registered = true;
        c.registeredAt = uint64(block.timestamp);
        c.accDebt = accYieldPerPrincipal;
        _profiles[msg.sender] = p;
        _creatorList.push(msg.sender);
        emit CreatorRegistered(msg.sender, p.name);
        _log(Kind.Joined, msg.sender, msg.sender, 0, bytes20(0), 0, "", "", "");
    }

    function updateProfile(Profile calldata p) external {
        if (!_creators[msg.sender].registered) revert NotRegistered();
        _validateProfile(p);
        _profiles[msg.sender] = p;
        emit ProfileUpdated(msg.sender);
    }

    function _validateProfile(Profile calldata p) internal pure {
        uint256 n = bytes(p.name).length;
        if (
            n == 0 || n > 48 || bytes(p.bio).length > 280 || bytes(p.avatar).length > 256 || bytes(p.banner).length > 256
                || bytes(p.handle).length > 32 || bytes(p.x).length > 32 || bytes(p.xPost).length > 32
        ) revert InvalidProfile();
    }

    /// @notice Post to your backers. Text up to 280 bytes, an optional link (e.g. one of your X
    ///         posts) and an optional picture URL. Public and permanent.
    function post(string calldata text, string calldata link, string calldata image) external returns (uint256 id) {
        if (!_creators[msg.sender].registered) revert NotRegistered();
        uint256 n = bytes(text).length;
        if (n > 280 || bytes(link).length > 256 || bytes(image).length > 256) revert InvalidPost();
        if (n == 0 && bytes(link).length == 0 && bytes(image).length == 0) revert InvalidPost();
        id = _log(Kind.Posted, msg.sender, msg.sender, 0, bytes20(0), 0, text, link, image);
        _posts.push(id);
        _creatorPosts[msg.sender].push(id);
    }

    /// @notice Comment on a post. Anyone can comment.
    function comment(uint256 postId, string calldata text) external returns (uint256 id) {
        address creator = _postCreator(postId);
        uint256 n = bytes(text).length;
        if (n == 0 || n > 280) revert InvalidComment();
        id = _log(Kind.Commented, msg.sender, creator, 0, bytes20(0), postId, text, "", "");
        _comments[postId].push(id);
        _postStats[postId].comments += 1;
    }

    function _postCreator(uint256 postId) internal view returns (address) {
        if (postId == 0 || postId >= _activity.length || _activity[postId].kind != Kind.Posted) revert UnknownPost();
        return _activity[postId].creator;
    }

    // ---------------------------------------------------------------------
    // Backing
    // ---------------------------------------------------------------------

    /// @notice Back `creator` with `amount`. Requires prior approval of the asset.
    function back(address creator, uint256 amount, BackOptions calldata o) external nonReentrant {
        Creator storage c = _creators[creator];
        if (!c.registered) revert NotRegistered();
        if (creator == msg.sender) revert CannotBackSelf();
        if (amount < minBack) revert AmountTooSmall();
        if (bytes(o.note).length > 140) revert NoteTooLong();
        if (o.duration > MAX_DURATION || (o.lock && o.duration == 0)) revert InvalidDuration();
        if (o.post != 0 && _postCreator(o.post) != creator) revert UnknownPost();

        _sync();
        _settleCreator(c);
        Position storage p = _positions[msg.sender][creator];
        _settlePosition(p, c);

        if (p.principal == 0) {
            p.since = uint64(block.timestamp);
            p.endsAt = 0;
            p.lockedUntil = 0;
            _addLink(msg.sender, creator);
        }

        // Terms apply to the whole position. A lock can only be extended, never shortened.
        uint64 until = o.duration == 0 ? 0 : uint64(block.timestamp) + o.duration;
        if (o.lock && until > p.lockedUntil) p.lockedUntil = until;
        if (until == 0) p.endsAt = 0;
        else p.endsAt = until > p.lockedUntil ? until : p.lockedUntil;

        asset.safeTransferFrom(msg.sender, address(this), amount);
        asset.forceApprove(address(vault), amount);
        uint256 shares = vault.deposit(amount, address(this));
        // Refuse deposits that lose value to a manipulated share price (ERC-4626 inflation attack).
        if (vault.previewRedeem(shares) + amount / 100_000 + 2 < amount) revert DepositLoss();

        p.principal += amount;
        c.principal += amount;
        totalPrincipal += amount;

        emit Backed(msg.sender, creator, amount, p.principal, p.endsAt, p.lockedUntil);
        _log(Kind.Backed, msg.sender, creator, amount, o.cast, o.post, o.note, "", "");

        if (o.cast != bytes20(0)) {
            CastView storage cv = _castStats[creator][o.cast];
            if (cv.backings == 0) {
                cv.cast = o.cast;
                _casts[creator].push(o.cast);
            }
            cv.backed += amount;
            cv.backings += 1;
        }
        if (o.post != 0) {
            PostStats storage ps = _postStats[o.post];
            ps.backed += SafeCast.toUint128(amount);
            ps.backings += 1;
        }

        uint8 m = c.milestones;
        while (m < MILESTONE_COUNT && c.principal >= _milestone(m)) {
            _log(Kind.Milestone, creator, creator, _milestone(m), bytes20(0), 0, "", "", "");
            m++;
        }
        c.milestones = m;
    }

    /// @notice Withdraw `amount` of your principal. Not possible while locked.
    function unback(address creator, uint256 amount) external nonReentrant {
        _exit(msg.sender, creator, amount, false);
    }

    /// @notice Withdraw all of your principal. Not possible while locked.
    function unbackAll(address creator) external nonReentrant {
        _exit(msg.sender, creator, _positions[msg.sender][creator].principal, false);
    }

    /// @notice End a timed backing that has run its course. Anyone can call it (the app does it
    ///         for you); the principal always goes back to the backer.
    function close(address backer, address creator) external nonReentrant {
        Position storage p = _positions[backer][creator];
        if (p.principal == 0 || p.endsAt == 0 || block.timestamp < p.endsAt) revert NotEnded();
        _exit(backer, creator, p.principal, true);
    }

    function _exit(address backer, address creator, uint256 amount, bool isClose) internal {
        Position storage p = _positions[backer][creator];
        if (amount == 0 || amount > p.principal) revert InsufficientPrincipal();
        if (!isClose && block.timestamp < p.lockedUntil) revert Locked(p.lockedUntil);
        Creator storage c = _creators[creator];

        _sync();
        _settleCreator(c);
        _settlePosition(p, c);

        uint256 pay = _shareOfValue(amount);
        p.principal -= amount;
        c.principal -= amount;
        totalPrincipal -= amount;
        if (p.principal == 0) {
            p.since = 0;
            p.endsAt = 0;
            p.lockedUntil = 0;
            _removeLink(backer, creator);
        }

        pay = _withdrawFromVault(pay, backer);
        if (isClose) {
            emit Closed(backer, creator, msg.sender, pay);
            _log(Kind.Ended, backer, creator, amount, bytes20(0), 0, "", "", "");
        } else {
            emit Unbacked(backer, creator, amount, pay);
        }
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
        uint256 owedToCreator = c.accrued;
        if (owedToCreator == 0) revert NothingToClaim();

        uint256 pay = _shareOfValue(owedToCreator);
        c.accrued = 0;
        c.lastClaimAt = uint64(block.timestamp);
        c.totalClaimed += owedToCreator;
        totalClaimed += owedToCreator;

        amount = _withdrawFromVault(pay, msg.sender);
        emit Claimed(msg.sender, amount);
        _log(Kind.Claimed, msg.sender, msg.sender, amount, bytes20(0), 0, "", "", "");
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

    function _owedToUsers() internal view returns (uint256) {
        return totalPrincipal + (totalDistributed - totalClaimed);
    }

    /// @dev Yield not yet distributed, and what the reserve should be after a sync.
    function _pending() internal view returns (uint256 yield_, uint256 newReserve) {
        uint256 value = _currentValue();
        uint256 users = _owedToUsers();
        if (value <= users) return (0, 0); // loss (or flat): the reserve is gone first
        uint256 surplus = value - users;
        if (surplus <= reserve) return (0, surplus); // reserve absorbed part of a loss
        if (totalPrincipal == 0) return (0, surplus); // nobody to attribute it to: it all goes to reserve
        return (surplus - reserve, reserve);
    }

    function _sync() internal {
        (uint256 y, uint256 r) = _pending();
        if (r != reserve) {
            reserve = r;
            emit ReserveChanged(r);
        }
        if (y == 0) return;
        accYieldPerPrincipal += (y * PRECISION) / totalPrincipal;
        totalDistributed += y;
        emit YieldSynced(y, accYieldPerPrincipal);
    }

    /// @dev What `amount` of user claims is actually worth if the vault holds less than it owes.
    ///      Everyone exiting while the vault is short takes the same haircut.
    function _shareOfValue(uint256 amount) internal view returns (uint256) {
        uint256 users = _owedToUsers();
        uint256 value = _currentValue();
        if (value >= users || users == 0) return amount;
        return (amount * value) / users;
    }

    function _settleCreator(Creator storage c) internal {
        uint256 acc = accYieldPerPrincipal;
        if (c.principal > 0) c.accrued += (c.principal * (acc - c.accDebt)) / PRECISION;
        c.accDebt = acc;
    }

    /// @dev Call after _settleCreator. Credits the position with what it earned since it was last
    ///      settled, minus anything earned after it ended, which moves from the creator to the reserve.
    function _settlePosition(Position storage p, Creator storage c) internal {
        uint256 acc = accYieldPerPrincipal;
        uint64 nowTs = uint64(block.timestamp);
        if (p.principal > 0) {
            uint256 earned = (p.principal * (acc - p.accDebt)) / PRECISION;
            uint256 excess;
            if (earned > 0 && p.endsAt != 0 && nowTs > p.endsAt) {
                uint64 from = p.settledAt > p.endsAt ? p.settledAt : p.endsAt;
                uint256 span = nowTs - p.settledAt;
                excess = span == 0 ? 0 : (earned * (nowTs - from)) / span;
                if (excess > c.accrued) excess = c.accrued; // the creator may already have claimed it
                if (excess > 0) {
                    c.accrued -= excess;
                    // the creator's share was counted as distributed; hand it back to the reserve
                    totalDistributed -= excess;
                    reserve += excess;
                    emit ReserveChanged(reserve);
                }
            }
            p.yieldGenerated += earned - excess;
        }
        p.accDebt = acc;
        p.settledAt = nowTs;
    }

    /// @dev Withdraws `amount` to `to`; if vault rounding leaves us a few wei short, redeems what's left.
    function _withdrawFromVault(uint256 amount, address to) internal returns (uint256) {
        if (amount == 0) return 0;
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

    /// @dev 100, 1k, 5k, 10k, 50k, 100k, 500k, 1M whole units (6 decimals)
    function _milestone(uint8 i) internal pure returns (uint256) {
        uint32[8] memory whole = [uint32(100), 1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000];
        return uint256(whole[i]) * 1e6;
    }

    function _log(
        Kind kind,
        address actor,
        address creator,
        uint256 amount,
        bytes20 cast,
        uint256 ref,
        string memory text,
        string memory link,
        string memory image
    ) internal returns (uint256 id) {
        id = _activity.length;
        _activity.push(
            Activity({
                kind: kind,
                actor: actor,
                creator: creator,
                amount: SafeCast.toUint96(amount),
                time: uint40(block.timestamp),
                cast: cast,
                ref: ref,
                text: text,
                link: link,
                image: image
            })
        );
        _creatorActivity[creator].push(id);
        emit ActivityAdded(id, kind, creator);
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

    function currentAcc() public view returns (uint256) {
        (uint256 y,) = _pending();
        if (totalPrincipal == 0 || y == 0) return accYieldPerPrincipal;
        return accYieldPerPrincipal + (y * PRECISION) / totalPrincipal;
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
        v.creator = creator;
        v.name = pr.name;
        v.bio = pr.bio;
        v.avatar = pr.avatar;
        v.banner = pr.banner;
        v.handle = pr.handle;
        v.fid = pr.fid;
        v.x = pr.x;
        v.xPost = pr.xPost;
        v.registeredAt = c.registeredAt;
        v.lastClaimAt = c.lastClaimAt;
        v.nextClaimAt = _nextClaimAt(c);
        v.principal = c.principal;
        v.backerCount = _backersOf[creator].length;
        v.claimable = cl;
        v.totalClaimed = c.totalClaimed;
        v.totalEarned = c.totalClaimed + cl;
        v.postCount = _creatorPosts[creator].length;
        v.castCount = _casts[creator].length;
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

    function getBackers(address creator) external view returns (BackerView[] memory out) {
        address[] storage list = _backersOf[creator];
        out = new BackerView[](list.length);
        uint256 acc = currentAcc();
        for (uint256 i; i < list.length; i++) {
            Position storage p = _positions[list[i]][creator];
            out[i] = BackerView({
                backer: list[i],
                principal: p.principal,
                generated: p.yieldGenerated + (p.principal * (acc - p.accDebt)) / PRECISION,
                endsAt: p.endsAt,
                lockedUntil: p.lockedUntil
            });
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
            since: p.since,
            endsAt: p.endsAt,
            lockedUntil: p.lockedUntil
        });
    }

    function getPositions(address backer) external view returns (PositionView[] memory out) {
        address[] storage list = _backedBy[backer];
        out = new PositionView[](list.length);
        for (uint256 i; i < list.length; i++) {
            out[i] = getPosition(backer, list[i]);
        }
    }

    function activityCount() external view returns (uint256) {
        return _activity.length;
    }

    /// @notice Newest-first page of everything that involves `creator` (their notifications).
    function getCreatorActivity(address creator, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, Activity[] memory items)
    {
        return _page(_creatorActivity[creator], offset, limit);
    }

    /// @notice Newest-first page of all posts, with their stats.
    function getPosts(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, Activity[] memory items, PostStats[] memory stats)
    {
        (ids, items) = _page(_posts, offset, limit);
        stats = _statsFor(ids);
    }

    function getCreatorPosts(address creator, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, Activity[] memory items, PostStats[] memory stats)
    {
        (ids, items) = _page(_creatorPosts[creator], offset, limit);
        stats = _statsFor(ids);
    }

    function getPost(uint256 postId) external view returns (Activity memory item, PostStats memory stats) {
        _postCreator(postId);
        return (_activity[postId], _postStats[postId]);
    }

    /// @notice Oldest-first page of a post's comments.
    function getComments(uint256 postId, uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory ids, Activity[] memory items)
    {
        uint256[] storage list = _comments[postId];
        uint256 n = list.length;
        if (offset >= n) return (new uint256[](0), new Activity[](0));
        uint256 count = n - offset < limit ? n - offset : limit;
        ids = new uint256[](count);
        items = new Activity[](count);
        for (uint256 i; i < count; i++) {
            ids[i] = list[offset + i];
            items[i] = _activity[ids[i]];
        }
    }

    function getCasts(address creator) external view returns (CastView[] memory out) {
        bytes20[] storage list = _casts[creator];
        out = new CastView[](list.length);
        for (uint256 i; i < list.length; i++) {
            out[i] = _castStats[creator][list[i]];
        }
    }

    function stats() external view returns (uint256 principal, uint256 creators, uint256 yieldDistributed, uint256 yieldClaimed) {
        (uint256 y,) = _pending();
        return (totalPrincipal, _creatorList.length, totalDistributed + y, totalClaimed);
    }

    /// @notice Vault value vs what is owed, for anyone checking solvency.
    function health() external view returns (uint256 value, uint256 owedToUsers, uint256 reserve_) {
        (, reserve_) = _pending();
        return (_currentValue(), _owedToUsers(), reserve_);
    }

    function _page(uint256[] storage list, uint256 offset, uint256 limit)
        internal
        view
        returns (uint256[] memory ids, Activity[] memory items)
    {
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

    function _statsFor(uint256[] memory ids) internal view returns (PostStats[] memory out) {
        out = new PostStats[](ids.length);
        for (uint256 i; i < ids.length; i++) {
            out[i] = _postStats[ids[i]];
        }
    }
}
