// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";

abstract contract Base is Test {
    MockUSDC usdc;
    MockYieldVault vault;
    Backing backing;

    address alice = makeAddr("alice"); // creator
    address bob = makeAddr("bob"); // creator
    address fan1 = makeAddr("fan1");
    address fan2 = makeAddr("fan2");
    address fan3 = makeAddr("fan3");

    uint64 constant EPOCH = 7 days;
    uint256 constant START = 1_000_000e6;

    function setUp() public virtual {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        vault = new MockYieldVault(usdc, 1_000); // 10% APR
        usdc.setMinter(address(vault), true);
        backing = new Backing(vault, EPOCH, 1e6);

        _register(alice, "Alice");
        _register(bob, "Bob");

        address[3] memory fans = [fan1, fan2, fan3];
        for (uint256 i; i < 3; i++) {
            usdc.mint(fans[i], START);
            vm.prank(fans[i]);
            usdc.approve(address(backing), type(uint256).max);
        }
    }

    function _profile(string memory name) internal pure returns (Backing.Profile memory) {
        return Backing.Profile({name: name, bio: "", avatar: "", banner: "", handle: "", fid: 0, x: "", xPost: ""});
    }

    function _register(address who, string memory name) internal {
        vm.prank(who);
        backing.registerCreator(_profile(name));
    }

    function _opts(uint64 duration, bool lock) internal pure returns (Backing.BackOptions memory) {
        return Backing.BackOptions({duration: duration, lock: lock, cast: bytes20(0), post: 0, note: ""});
    }

    function _back(address fan, address creator, uint256 amt) internal {
        vm.prank(fan);
        backing.back(creator, amt, _opts(0, false));
    }

    function _backTimed(address fan, address creator, uint256 amt, uint64 duration, bool lock) internal {
        vm.prank(fan);
        backing.back(creator, amt, _opts(duration, lock));
    }

    function _post(address creator, string memory text) internal returns (uint256) {
        vm.prank(creator);
        return backing.post(text, "", "");
    }
}

contract BackingCoreTest is Base {
    // ------------------------------------------------------------------ profiles

    function test_register_and_update() public {
        assertTrue(backing.isCreator(alice));
        assertEq(backing.creatorCount(), 2);
        Backing.Profile memory p = _profile("Alice B");
        p.x = "aliceb";
        p.xPost = "1850000000000000000";
        p.banner = "https://img.test/b.png";
        p.fid = 4242;
        vm.prank(alice);
        backing.updateProfile(p);
        Backing.CreatorView memory v = backing.getCreator(alice);
        assertEq(v.name, "Alice B");
        assertEq(v.x, "aliceb");
        assertEq(v.xPost, "1850000000000000000");
        assertEq(v.banner, "https://img.test/b.png");
        assertEq(v.fid, 4242);
    }

    function test_register_guards() public {
        vm.prank(alice);
        vm.expectRevert(Backing.AlreadyRegistered.selector);
        backing.registerCreator(_profile("A"));
        vm.prank(fan1);
        vm.expectRevert(Backing.InvalidProfile.selector);
        backing.registerCreator(_profile(""));
        Backing.Profile memory p = _profile("ok");
        p.x = "this-handle-is-way-too-long-for-x-ok";
        vm.prank(fan1);
        vm.expectRevert(Backing.InvalidProfile.selector);
        backing.registerCreator(p);
    }

    // ------------------------------------------------------------------ backing

    function test_back_moves_funds_into_vault() public {
        _back(fan1, alice, 100e6);
        assertEq(usdc.balanceOf(fan1), START - 100e6);
        assertEq(usdc.balanceOf(address(backing)), 0);
        assertGt(vault.balanceOf(address(backing)), 0);
        assertEq(backing.totalPrincipal(), 100e6);
        assertEq(backing.getCreator(alice).backerCount, 1);
    }

    function test_back_guards() public {
        vm.startPrank(fan1);
        vm.expectRevert(Backing.NotRegistered.selector);
        backing.back(fan2, 10e6, _opts(0, false));
        vm.expectRevert(Backing.AmountTooSmall.selector);
        backing.back(alice, 0.5e6, _opts(0, false));
        vm.expectRevert(Backing.InvalidDuration.selector);
        backing.back(alice, 10e6, _opts(0, true)); // a lock needs a duration
        vm.expectRevert(Backing.InvalidDuration.selector);
        backing.back(alice, 10e6, _opts(400 days, false));
        Backing.BackOptions memory o = _opts(0, false);
        o.note = string(new bytes(141));
        vm.expectRevert(Backing.NoteTooLong.selector);
        backing.back(alice, 10e6, o);
        vm.stopPrank();

        usdc.mint(alice, 10e6);
        vm.startPrank(alice);
        usdc.approve(address(backing), 10e6);
        vm.expectRevert(Backing.CannotBackSelf.selector);
        backing.back(alice, 10e6, _opts(0, false));
        vm.stopPrank();
    }

    function test_yield_goes_to_creator_not_backer() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(vm.getBlockTimestamp() + 365 days);
        assertApproxEqAbs(backing.claimable(alice), 1_000e6, 2);
        Backing.PositionView memory p = backing.getPosition(fan1, alice);
        assertEq(p.principal, 10_000e6);
        assertApproxEqAbs(p.yieldGenerated, 1_000e6, 2);
    }

    function test_yield_split_proportional_to_principal() public {
        _back(fan1, alice, 3_000e6);
        _back(fan2, bob, 1_000e6);
        vm.warp(vm.getBlockTimestamp() + 30 days);
        assertApproxEqRel(backing.claimable(alice), backing.claimable(bob) * 3, 1e14);
    }

    function test_late_backer_does_not_steal_past_yield() public {
        _back(fan1, alice, 1_000e6);
        vm.warp(vm.getBlockTimestamp() + 100 days);
        uint256 before = backing.claimable(alice);
        _back(fan2, bob, 1_000_000e6);
        assertApproxEqAbs(backing.claimable(alice), before, 1);
        assertEq(backing.claimable(bob), 0);
    }

    function test_unback_partial_topup_and_full() public {
        _back(fan1, alice, 500e6);
        vm.prank(fan1);
        backing.unback(alice, 200e6);
        assertEq(backing.getPosition(fan1, alice).principal, 300e6);
        _back(fan1, alice, 50e6);
        assertEq(backing.getPosition(fan1, alice).principal, 350e6);
        vm.prank(fan1);
        vm.expectRevert(Backing.InsufficientPrincipal.selector);
        backing.unback(alice, 351e6);
        vm.warp(vm.getBlockTimestamp() + 90 days);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertEq(usdc.balanceOf(fan1), START);
        assertEq(backing.getCreator(alice).backerCount, 0);
        assertGt(backing.claimable(alice), 0);
    }

    function test_stop_backing_stops_creator_income() public {
        _back(fan1, alice, 1_000e6);
        _back(fan2, bob, 1_000e6);
        vm.warp(vm.getBlockTimestamp() + 10 days);
        vm.prank(fan1);
        backing.unbackAll(alice);
        uint256 frozen = backing.claimable(alice);
        vm.warp(vm.getBlockTimestamp() + 100 days);
        assertApproxEqAbs(backing.claimable(alice), frozen, 1);
    }

    function test_claim_and_epoch() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        uint256 expected = backing.claimable(alice);
        vm.prank(alice);
        assertEq(backing.claim(), expected);
        assertEq(usdc.balanceOf(alice), expected);
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Backing.EpochNotOver.selector, uint64(vm.getBlockTimestamp() - 1 days + EPOCH)));
        backing.claim();
        vm.prank(bob);
        vm.expectRevert(Backing.NothingToClaim.selector);
        backing.claim();
    }

    function test_backers_list_and_positions() public {
        _back(fan1, alice, 100e6);
        _back(fan2, alice, 200e6);
        _backTimed(fan3, alice, 300e6, 7 days, true);
        _back(fan2, bob, 50e6);
        Backing.BackerView[] memory bs = backing.getBackers(alice);
        assertEq(bs.length, 3);
        assertEq(bs[2].principal, 300e6);
        assertEq(bs[2].lockedUntil, uint64(vm.getBlockTimestamp() + 7 days));
        vm.prank(fan1);
        backing.unbackAll(alice);
        bs = backing.getBackers(alice);
        assertEq(bs.length, 2);
        assertEq(bs[0].backer, fan3);
        assertEq(backing.getPositions(fan2).length, 2);
    }

    // ------------------------------------------------------------------ posts, comments, feed

    function test_posts_newest_first_with_stats() public {
        uint256 p1 = _post(alice, "first");
        vm.prank(bob);
        uint256 p2 = backing.post("", "https://x.com/bob/status/1", "https://img.test/p.webp");
        (uint256[] memory ids, Backing.Activity[] memory items, Backing.PostStats[] memory st) = backing.getPosts(0, 10);
        assertEq(ids.length, 2);
        assertEq(ids[0], p2);
        assertEq(items[0].link, "https://x.com/bob/status/1");
        assertEq(items[0].image, "https://img.test/p.webp");
        assertEq(items[1].text, "first");
        assertEq(st[1].comments, 0);
        (ids,,) = backing.getCreatorPosts(alice, 0, 10);
        assertEq(ids.length, 1);
        assertEq(ids[0], p1);
        assertEq(backing.getCreator(alice).postCount, 1);
    }

    function test_post_guards() public {
        vm.prank(fan1);
        vm.expectRevert(Backing.NotRegistered.selector);
        backing.post("hi", "", "");
        vm.prank(alice);
        vm.expectRevert(Backing.InvalidPost.selector);
        backing.post("", "", "");
        vm.prank(alice);
        vm.expectRevert(Backing.InvalidPost.selector);
        backing.post(string(new bytes(281)), "", "");
    }

    function test_comments_anyone_ordered_and_notify_creator() public {
        uint256 p = _post(alice, "new track");
        vm.prank(fan1);
        backing.comment(p, "love it");
        vm.prank(bob); // another creator can comment too
        backing.comment(p, "same");
        (uint256[] memory ids, Backing.Activity[] memory items) = backing.getComments(p, 0, 10);
        assertEq(ids.length, 2);
        assertEq(items[0].text, "love it");
        assertEq(items[0].actor, fan1);
        assertEq(items[0].creator, alice);
        assertEq(items[0].ref, p);
        (, Backing.PostStats memory st) = backing.getPost(p);
        assertEq(st.comments, 2);
        // shows up in Alice's notifications
        (, Backing.Activity[] memory notes) = backing.getCreatorActivity(alice, 0, 1);
        assertEq(uint8(notes[0].kind), uint8(Backing.Kind.Commented));
    }

    function test_comment_guards() public {
        uint256 p = _post(alice, "x");
        vm.startPrank(fan1);
        vm.expectRevert(Backing.UnknownPost.selector);
        backing.comment(0, "id zero is never a post");
        vm.expectRevert(Backing.UnknownPost.selector);
        backing.comment(1, "id 1 is Bob joining, not a post");
        vm.expectRevert(Backing.UnknownPost.selector);
        backing.comment(999, "out of range");
        vm.expectRevert(Backing.InvalidComment.selector);
        backing.comment(p, "");
        vm.stopPrank();
    }

    function test_back_through_a_post() public {
        uint256 p = _post(alice, "back me");
        Backing.BackOptions memory o = _opts(0, false);
        o.post = p;
        o.note = "for this one";
        vm.prank(fan1);
        backing.back(alice, 120e6, o);
        (, Backing.PostStats memory st) = backing.getPost(p);
        assertEq(st.backed, 120e6);
        assertEq(st.backings, 1);
        // can't attribute a backing to someone else's post
        vm.prank(fan2);
        vm.expectRevert(Backing.UnknownPost.selector);
        backing.back(bob, 10e6, o);
    }

    function test_cast_stats() public {
        Backing.BackOptions memory o = _opts(0, false);
        o.cast = bytes20(hex"6a112e2d35e2d2008e25dd29811e8769d1edd9ca");
        vm.prank(fan1);
        backing.back(alice, 100e6, o);
        vm.prank(fan2);
        backing.back(alice, 50e6, o);
        Backing.CastView[] memory cs = backing.getCasts(alice);
        assertEq(cs.length, 1);
        assertEq(cs[0].backed, 150e6);
        assertEq(cs[0].backings, 2);
    }

    function test_milestones_logged_once() public {
        _back(fan1, alice, 99e6);
        _back(fan1, alice, 2e6);
        _back(fan2, alice, 5_000e6);
        vm.prank(fan2);
        backing.unback(alice, 4_000e6);
        _back(fan2, alice, 4_000e6);
        (, Backing.Activity[] memory items) = backing.getCreatorActivity(alice, 0, 50);
        uint256 n;
        for (uint256 i; i < items.length; i++) if (items[i].kind == Backing.Kind.Milestone) n++;
        assertEq(n, 3);
    }

    // ------------------------------------------------------------------ timed and locked backing

    function test_flexible_timed_can_leave_early() public {
        _backTimed(fan1, alice, 100e6, 7 days, false);
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertEq(usdc.balanceOf(fan1), START);
    }

    function test_close_after_end_pays_backer_not_caller() public {
        _backTimed(fan1, alice, 100e6, 1 hours, false);
        vm.prank(fan2);
        vm.expectRevert(Backing.NotEnded.selector);
        backing.close(fan1, alice);
        vm.warp(vm.getBlockTimestamp() + 1 hours);
        uint256 f2 = usdc.balanceOf(fan2);
        vm.prank(fan2); // a stranger closes it
        backing.close(fan1, alice);
        assertEq(usdc.balanceOf(fan1), START);
        assertEq(usdc.balanceOf(fan2), f2);
        assertEq(backing.getPosition(fan1, alice).principal, 0);
        (, Backing.Activity[] memory items) = backing.getCreatorActivity(alice, 0, 1);
        assertEq(uint8(items[0].kind), uint8(Backing.Kind.Ended));
    }

    function test_cannot_close_ongoing() public {
        _back(fan1, alice, 100e6);
        vm.warp(vm.getBlockTimestamp() + 365 days);
        vm.expectRevert(Backing.NotEnded.selector);
        backing.close(fan1, alice);
    }

    function test_locked_cannot_leave_until_end() public {
        _backTimed(fan1, alice, 100e6, 7 days, true);
        uint64 until = uint64(vm.getBlockTimestamp() + 7 days);
        vm.warp(vm.getBlockTimestamp() + 6 days);
        vm.prank(fan1);
        vm.expectRevert(abi.encodeWithSelector(Backing.Locked.selector, until));
        backing.unbackAll(alice);
        vm.prank(fan1);
        vm.expectRevert(abi.encodeWithSelector(Backing.Locked.selector, until));
        backing.unback(alice, 1e6);
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertEq(usdc.balanceOf(fan1), START);
    }

    function test_lock_only_extends() public {
        _backTimed(fan1, alice, 100e6, 7 days, true);
        uint64 lock7 = uint64(vm.getBlockTimestamp() + 7 days);
        _backTimed(fan1, alice, 10e6, 1 days, true); // shorter lock doesn't shorten
        assertEq(backing.getPosition(fan1, alice).lockedUntil, lock7);
        assertEq(backing.getPosition(fan1, alice).endsAt, lock7);
        _back(fan1, alice, 10e6); // switching to ongoing keeps the lock
        assertEq(backing.getPosition(fan1, alice).lockedUntil, lock7);
        assertEq(backing.getPosition(fan1, alice).endsAt, 0);
        _backTimed(fan1, alice, 10e6, 30 days, true);
        assertEq(backing.getPosition(fan1, alice).lockedUntil, uint64(vm.getBlockTimestamp() + 30 days));
    }

    function test_yield_after_end_goes_to_reserve_not_creator() public {
        _backTimed(fan1, alice, 10_000e6, 1 days, false);
        _back(fan2, bob, 10_000e6); // keeps totalPrincipal > 0 and shows normal accrual
        vm.warp(vm.getBlockTimestamp() + 10 days);
        vm.prank(fan3);
        backing.close(fan1, alice);
        uint256 day = uint256(10_000e6) * 1_000 / 10_000 / 365; // one day at 10% APR
        assertApproxEqRel(backing.claimable(alice), day, 0.02e18);
        assertApproxEqRel(backing.reserve(), 9 * day, 0.02e18);
        assertApproxEqRel(backing.claimable(bob), 10 * day, 0.02e18);
        assertEq(usdc.balanceOf(fan1), START);
    }

    function test_creator_claiming_before_close_does_not_break_close() public {
        _backTimed(fan1, alice, 10_000e6, 1 days, false);
        vm.warp(vm.getBlockTimestamp() + 8 days);
        vm.prank(alice);
        backing.claim(); // grabs post-expiry yield before anyone closes
        vm.prank(fan2);
        backing.close(fan1, alice); // still works, fan still whole
        assertEq(usdc.balanceOf(fan1), START);
    }

    // ------------------------------------------------------------------ fuzz

    /// Random sequence incl. timed and locked backings; afterwards every backer exits with exact
    /// principal and creators can claim what they are shown.
    function testFuzz_solvency(uint256 seed) public {
        address[3] memory fans = [fan1, fan2, fan3];
        address[2] memory creators = [alice, bob];
        for (uint256 i; i < 30; i++) {
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            address fan = fans[r % 3];
            address cr = creators[(r >> 8) % 2];
            uint256 action = (r >> 16) % 5;
            vm.warp(vm.getBlockTimestamp() + ((r >> 32) % 10 days));
            if (action <= 1) {
                uint64 dur = [uint64(0), 1 hours, 1 days, 7 days][(r >> 96) % 4];
                _backTimed(fan, cr, 1e6 + ((r >> 64) % 50_000e6), dur, dur != 0 && (r >> 100) % 2 == 0);
            } else if (action == 2) {
                Backing.PositionView memory pv = backing.getPosition(fan, cr);
                if (pv.principal > 0 && vm.getBlockTimestamp() >= pv.lockedUntil) {
                    vm.prank(fan);
                    backing.unback(cr, 1 + ((r >> 64) % pv.principal));
                }
            } else if (action == 3) {
                Backing.PositionView memory pv = backing.getPosition(fan, cr);
                if (pv.principal > 0 && pv.endsAt != 0 && vm.getBlockTimestamp() >= pv.endsAt) backing.close(fan, cr);
            } else {
                Backing.CreatorView memory v = backing.getCreator(cr);
                if (v.claimable > 0 && vm.getBlockTimestamp() >= v.nextClaimAt) {
                    uint256 bal = usdc.balanceOf(cr);
                    vm.prank(cr);
                    backing.claim();
                    assertLe(usdc.balanceOf(cr) - bal, v.claimable);
                }
            }
        }
        vm.warp(vm.getBlockTimestamp() + 400 days); // past every lock
        for (uint256 f; f < 3; f++) {
            for (uint256 c; c < 2; c++) {
                if (backing.getPosition(fans[f], creators[c]).principal > 0) {
                    vm.prank(fans[f]);
                    backing.unbackAll(creators[c]);
                }
            }
            assertEq(usdc.balanceOf(fans[f]), START, "fan made whole");
        }
        assertEq(backing.totalPrincipal(), 0);
        vm.warp(vm.getBlockTimestamp() + EPOCH);
        for (uint256 c; c < 2; c++) {
            uint256 owed = backing.claimable(creators[c]);
            if (owed > 0) {
                uint256 bal = usdc.balanceOf(creators[c]);
                vm.prank(creators[c]);
                backing.claim();
                assertEq(usdc.balanceOf(creators[c]) - bal, owed, "creator paid");
            }
        }
    }
}
