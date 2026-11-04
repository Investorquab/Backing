// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";

contract BackingTest is Test {
    MockUSDC usdc;
    MockYieldVault vault;
    Backing backing;

    address alice = makeAddr("alice"); // creator
    address bob = makeAddr("bob"); // creator
    address fan1 = makeAddr("fan1");
    address fan2 = makeAddr("fan2");
    address fan3 = makeAddr("fan3");

    uint64 constant EPOCH = 7 days;

    function setUp() public {
        usdc = new MockUSDC();
        vault = new MockYieldVault(usdc, 1_000); // 10% APR
        usdc.setMinter(address(vault), true);
        backing = new Backing(vault, EPOCH, 1e6);

        vm.prank(alice);
        backing.registerCreator("Alice", "Makes night-shift lo-fi", "https://x.test/a.png", "alice", 0);
        vm.prank(bob);
        backing.registerCreator("Bob", "Pixel art", "", "bob", 0);

        address[3] memory fans = [fan1, fan2, fan3];
        for (uint256 i; i < 3; i++) {
            usdc.mint(fans[i], 1_000_000e6);
            vm.prank(fans[i]);
            usdc.approve(address(backing), type(uint256).max);
        }
    }

    function _back(address fan, address creator, uint256 amt) internal {
        vm.prank(fan);
        backing.back(creator, amt, bytes20(0), "");
    }

    // ------------------------------------------------------------------ profile

    function test_register_and_update() public {
        assertTrue(backing.isCreator(alice));
        assertEq(backing.creatorCount(), 2);
        vm.prank(alice);
        backing.updateProfile("Alice B", "new bio", "", "aliceb", 4242);
        Backing.CreatorView memory v = backing.getCreator(alice);
        assertEq(v.name, "Alice B");
        assertEq(v.handle, "aliceb");
        assertEq(v.fid, 4242);
    }

    function test_register_twice_reverts() public {
        vm.prank(alice);
        vm.expectRevert(Backing.AlreadyRegistered.selector);
        backing.registerCreator("A", "", "", "", 0);
    }

    function test_register_empty_name_reverts() public {
        vm.prank(fan1);
        vm.expectRevert(Backing.InvalidProfile.selector);
        backing.registerCreator("", "", "", "", 0);
    }

    // ------------------------------------------------------------------ backing

    function test_back_moves_funds_into_vault() public {
        _back(fan1, alice, 100e6);
        assertEq(usdc.balanceOf(fan1), 1_000_000e6 - 100e6);
        assertEq(usdc.balanceOf(address(backing)), 0);
        assertGt(vault.balanceOf(address(backing)), 0);
        assertEq(backing.totalPrincipal(), 100e6);
        Backing.CreatorView memory v = backing.getCreator(alice);
        assertEq(v.principal, 100e6);
        assertEq(v.backerCount, 1);
    }

    function test_back_guards() public {
        vm.prank(fan1);
        vm.expectRevert(Backing.NotRegistered.selector);
        backing.back(fan2, 10e6, bytes20(0), "");

        vm.prank(fan1);
        vm.expectRevert(Backing.AmountTooSmall.selector);
        backing.back(alice, 0.5e6, bytes20(0), "");

        usdc.mint(alice, 10e6);
        vm.startPrank(alice);
        usdc.approve(address(backing), 10e6);
        vm.expectRevert(Backing.CannotBackSelf.selector);
        backing.back(alice, 10e6, bytes20(0), "");
        vm.stopPrank();
    }

    function test_yield_goes_to_creator_not_backer() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(block.timestamp + 365 days);
        uint256 c = backing.claimable(alice);
        // 10% APR on 10k ~= 1,000 (minus vault rounding)
        assertApproxEqAbs(c, 1_000e6, 2);

        Backing.PositionView memory p = backing.getPosition(fan1, alice);
        assertEq(p.principal, 10_000e6);
        assertApproxEqAbs(p.yieldGenerated, 1_000e6, 2);
    }

    function test_yield_split_proportional_to_principal() public {
        _back(fan1, alice, 3_000e6);
        _back(fan2, bob, 1_000e6);
        vm.warp(block.timestamp + 30 days);
        uint256 a = backing.claimable(alice);
        uint256 b = backing.claimable(bob);
        assertApproxEqRel(a, b * 3, 1e14);
    }

    function test_late_backer_does_not_steal_past_yield() public {
        _back(fan1, alice, 1_000e6);
        vm.warp(block.timestamp + 100 days);
        uint256 aliceBefore = backing.claimable(alice);
        _back(fan2, bob, 1_000_000e6);
        // Alice keeps the yield earned before Bob's huge backing arrived
        assertApproxEqAbs(backing.claimable(alice), aliceBefore, 1);
        assertEq(backing.claimable(bob), 0);
    }

    function test_unback_returns_full_principal() public {
        _back(fan1, alice, 500e6);
        vm.warp(block.timestamp + 90 days);
        uint256 before = usdc.balanceOf(fan1);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertEq(usdc.balanceOf(fan1) - before, 500e6);
        assertEq(backing.getCreator(alice).backerCount, 0);
        assertEq(backing.getPositions(fan1).length, 0);
        // yield earned while backed stays with the creator
        assertGt(backing.claimable(alice), 0);
    }

    function test_partial_unback_and_topup() public {
        _back(fan1, alice, 500e6);
        vm.prank(fan1);
        backing.unback(alice, 200e6);
        assertEq(backing.getPosition(fan1, alice).principal, 300e6);
        _back(fan1, alice, 50e6);
        assertEq(backing.getPosition(fan1, alice).principal, 350e6);
        assertEq(backing.getCreator(alice).backerCount, 1);

        vm.prank(fan1);
        vm.expectRevert(Backing.InsufficientPrincipal.selector);
        backing.unback(alice, 351e6);
    }

    function test_stop_backing_stops_creator_income() public {
        _back(fan1, alice, 1_000e6);
        _back(fan2, bob, 1_000e6);
        vm.warp(block.timestamp + 10 days);
        vm.prank(fan1);
        backing.unbackAll(alice);
        uint256 frozen = backing.claimable(alice);
        vm.warp(block.timestamp + 100 days);
        assertApproxEqAbs(backing.claimable(alice), frozen, 1);
        assertGt(backing.claimable(bob), frozen);
    }

    // ------------------------------------------------------------------ claims

    function test_claim_and_epoch() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(block.timestamp + 7 days);
        uint256 expected = backing.claimable(alice);
        vm.prank(alice);
        uint256 got = backing.claim();
        assertEq(got, expected);
        assertEq(usdc.balanceOf(alice), expected);

        vm.warp(block.timestamp + 1 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Backing.EpochNotOver.selector, uint64(block.timestamp - 1 days + EPOCH)));
        backing.claim();

        vm.warp(block.timestamp + 6 days);
        vm.prank(alice);
        backing.claim();
        assertEq(backing.getCreator(alice).totalClaimed, usdc.balanceOf(alice));
    }

    function test_claim_nothing_reverts() public {
        vm.prank(alice);
        vm.expectRevert(Backing.NothingToClaim.selector);
        backing.claim();
    }

    function test_backers_list_and_positions() public {
        _back(fan1, alice, 100e6);
        _back(fan2, alice, 200e6);
        _back(fan3, alice, 300e6);
        _back(fan2, bob, 50e6);
        (address[] memory bs, uint256[] memory ps,) = backing.getBackers(alice);
        assertEq(bs.length, 3);
        assertEq(ps[2], 300e6);

        vm.prank(fan1);
        backing.unbackAll(alice); // swap-pop
        (bs, ps,) = backing.getBackers(alice);
        assertEq(bs.length, 2);
        assertEq(bs[0], fan3);
        assertEq(backing.getPositions(fan2).length, 2);

        Backing.CreatorView[] memory list = backing.getCreators(0, 10);
        assertEq(list.length, 2);
        assertEq(list[0].principal, 500e6);
    }

    // ------------------------------------------------------------------ social layer

    function test_activity_log_newest_first() public {
        // setUp registered Alice then Bob -> 2 Joined items
        assertEq(backing.activityCount(), 2);
        bytes20 cast = bytes20(hex"6a112e2d35e2d2008e25dd29811e8769d1edd9ca");
        vm.prank(fan1);
        backing.back(alice, 50e6, cast, "your 3am streams got me through finals");
        vm.prank(alice);
        backing.post("New track drops Friday", "https://example.com/track");

        (uint256[] memory ids, Backing.Activity[] memory items) = backing.getActivity(0, 10);
        assertEq(ids.length, 4);
        assertEq(ids[0], 3);
        assertEq(uint8(items[0].kind), uint8(Backing.Kind.Posted));
        assertEq(items[0].text, "New track drops Friday");
        assertEq(items[0].link, "https://example.com/track");
        assertEq(uint8(items[1].kind), uint8(Backing.Kind.Backed));
        assertEq(items[1].actor, fan1);
        assertEq(items[1].creator, alice);
        assertEq(items[1].amount, 50e6);
        assertEq(items[1].cast, cast);
        assertEq(items[1].text, "your 3am streams got me through finals");
        assertEq(uint8(items[3].kind), uint8(Backing.Kind.Joined));

        (ids,) = backing.getActivity(1, 2);
        assertEq(ids.length, 2);
        assertEq(ids[0], 2);
        (ids,) = backing.getActivity(10, 5);
        assertEq(ids.length, 0);
    }

    function test_creator_activity_and_counts() public {
        _back(fan1, bob, 10e6);
        vm.prank(alice);
        backing.post("hello", "");
        vm.prank(alice);
        backing.post("again", "");
        (uint256[] memory ids, Backing.Activity[] memory items) = backing.getCreatorActivity(alice, 0, 10);
        assertEq(ids.length, 3); // joined + 2 posts
        assertEq(items[0].text, "again");
        assertEq(backing.getCreator(alice).postCount, 2);
        (ids,) = backing.getCreatorActivity(bob, 0, 10);
        assertEq(ids.length, 2); // joined + backed
    }

    function test_post_guards() public {
        vm.prank(fan1);
        vm.expectRevert(Backing.NotRegistered.selector);
        backing.post("hi", "");
        vm.prank(alice);
        vm.expectRevert(Backing.InvalidPost.selector);
        backing.post("", "");
        bytes memory long = new bytes(281);
        for (uint256 i; i < long.length; i++) long[i] = "a";
        vm.prank(alice);
        vm.expectRevert(Backing.InvalidPost.selector);
        backing.post(string(long), "");
    }

    function test_note_too_long_reverts() public {
        bytes memory long = new bytes(141);
        for (uint256 i; i < long.length; i++) long[i] = "a";
        vm.prank(fan1);
        vm.expectRevert(Backing.NoteTooLong.selector);
        backing.back(alice, 10e6, bytes20(0), string(long));
    }

    function test_cast_stats() public {
        bytes20 castA = bytes20(uint160(1));
        bytes20 castB = bytes20(uint160(2));
        vm.prank(fan1);
        backing.back(alice, 100e6, castA, "");
        vm.prank(fan2);
        backing.back(alice, 50e6, castA, "");
        vm.prank(fan3);
        backing.back(alice, 7e6, castB, "");
        _back(fan3, alice, 1e6); // no cast
        Backing.CastView[] memory cs = backing.getCasts(alice);
        assertEq(cs.length, 2);
        assertEq(cs[0].cast, castA);
        assertEq(cs[0].backed, 150e6);
        assertEq(cs[0].backings, 2);
        assertEq(cs[1].backed, 7e6);
        assertEq(backing.getCreator(alice).castCount, 2);
    }

    function test_milestones_logged_once() public {
        _back(fan1, alice, 99e6);
        _back(fan1, alice, 2e6); // crosses 100
        _back(fan2, alice, 5_000e6); // crosses 1k and 5k in one go
        vm.prank(fan2);
        backing.unback(alice, 4_000e6); // drops below 5k
        _back(fan2, alice, 4_000e6); // back above 5k: not logged again
        (, Backing.Activity[] memory items) = backing.getCreatorActivity(alice, 0, 50);
        uint256 milestones;
        uint256 last;
        for (uint256 i; i < items.length; i++) {
            if (items[i].kind == Backing.Kind.Milestone) {
                milestones++;
                if (last == 0) last = items[i].amount;
            }
        }
        assertEq(milestones, 3);
        assertEq(last, 5_000e6); // newest milestone first
    }

    function test_claim_logged() public {
        _back(fan1, alice, 1_000e6);
        vm.warp(block.timestamp + 30 days);
        vm.prank(alice);
        uint256 got = backing.claim();
        (, Backing.Activity[] memory items) = backing.getActivity(0, 1);
        assertEq(uint8(items[0].kind), uint8(Backing.Kind.Claimed));
        assertEq(items[0].amount, got);
    }

    // ------------------------------------------------------------------ solvency

    function test_zero_yield_vault_everyone_exits_whole() public {
        vm.prank(address(this));
        vault.setApr(0);
        _back(fan1, alice, 333_333_333);
        _back(fan2, alice, 777_777_777);
        _back(fan3, bob, 1_000_001);
        vm.prank(fan2);
        backing.unbackAll(alice);
        vm.prank(fan1);
        backing.unbackAll(alice);
        vm.prank(fan3);
        backing.unbackAll(bob);
        assertEq(usdc.balanceOf(fan1), 1_000_000e6);
        assertEq(usdc.balanceOf(fan2), 1_000_000e6);
        assertEq(usdc.balanceOf(fan3), 1_000_000e6);
    }

    /// Random sequence of actions; afterwards every backer exits with exact principal and
    /// creators can claim what they are shown.
    function testFuzz_solvency(uint256 seed) public {
        address[3] memory fans = [fan1, fan2, fan3];
        address[2] memory creators = [alice, bob];
        uint256[3] memory deposited;

        for (uint256 i; i < 25; i++) {
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            uint256 f = r % 3;
            address cr = creators[(r >> 8) % 2];
            uint256 action = (r >> 16) % 4;
            vm.warp(block.timestamp + ((r >> 32) % 20 days));

            if (action <= 1) {
                uint256 amt = 1e6 + ((r >> 64) % 50_000e6);
                _back(fans[f], cr, amt);
                deposited[f] += amt;
            } else if (action == 2) {
                uint256 pr = backing.getPosition(fans[f], cr).principal;
                if (pr > 0) {
                    uint256 amt = 1 + ((r >> 64) % pr);
                    vm.prank(fans[f]);
                    backing.unback(cr, amt);
                    deposited[f] -= amt;
                }
            } else {
                Backing.CreatorView memory v = backing.getCreator(cr);
                if (v.claimable > 0 && block.timestamp >= v.nextClaimAt) {
                    uint256 bal = usdc.balanceOf(cr);
                    vm.prank(cr);
                    backing.claim();
                    assertEq(usdc.balanceOf(cr) - bal, v.claimable);
                }
            }
        }

        vm.warp(block.timestamp + 30 days);
        for (uint256 f; f < 3; f++) {
            for (uint256 c; c < 2; c++) {
                if (backing.getPosition(fans[f], creators[c]).principal > 0) {
                    vm.prank(fans[f]);
                    backing.unbackAll(creators[c]);
                }
            }
            assertEq(usdc.balanceOf(fans[f]), 1_000_000e6, "fan made whole");
        }
        assertEq(backing.totalPrincipal(), 0);

        // creators can still claim everything they are owed
        vm.warp(block.timestamp + EPOCH);
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
