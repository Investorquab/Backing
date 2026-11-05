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
        // like any live vault, it already holds other people's money
        usdc.mint(address(this), 10_000e6);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6, address(0xdead));
        backing = new Backing(vault, EPOCH, 1e6);

        _join(alice, "alice");
        _join(bob, "bob");

        address[3] memory fans = [fan1, fan2, fan3];
        for (uint256 i; i < 3; i++) {
            usdc.mint(fans[i], START);
            vm.prank(fans[i]);
            usdc.approve(address(backing), type(uint256).max);
        }
    }

    function _p(string memory username) internal pure returns (Backing.Profile memory) {
        return Backing.Profile({username: username, baseName: "", avatar: "", bio: "", link: ""});
    }

    function _join(address who, string memory username) internal {
        vm.prank(who);
        backing.saveProfile(_p(username));
    }

    function _back(address fan, address creator, uint256 amt) internal {
        vm.prank(fan);
        backing.back(creator, amt, address(0));
    }

    function _now() internal view returns (uint256) {
        return vm.getBlockTimestamp();
    }
}

contract BackingTest is Base {
    // ------------------------------------------------------------------ profiles

    function test_profile_create_update_and_lookup() public {
        assertTrue(backing.hasProfile(alice));
        assertEq(backing.peopleCount(), 2);
        Backing.Profile memory p = Backing.Profile({username: "ada_nights", baseName: "ada.base.eth", avatar: "https://img.test/a.webp", bio: "lofi", link: "https://ada.test"});
        vm.prank(alice);
        backing.saveProfile(p);
        Backing.ProfileView memory v = backing.getProfileByUsername("ada_nights");
        assertEq(v.account, alice);
        assertEq(v.profile.baseName, "ada.base.eth");
        // the old username is free again
        assertEq(backing.usernameOwner(keccak256("alice")), address(0));
        assertEq(backing.peopleCount(), 2, "updating doesn't add a person");
    }

    function test_username_unique_and_valid() public {
        vm.prank(fan1);
        vm.expectRevert(Backing.UsernameTaken.selector);
        backing.saveProfile(_p("alice"));
        string[5] memory bad = ["ab", "Alice", "has space", "dash-name", "waytoolongusername_123"];
        for (uint256 i; i < bad.length; i++) {
            vm.prank(fan1);
            vm.expectRevert(Backing.InvalidProfile.selector);
            backing.saveProfile(_p(bad[i]));
        }
        _join(fan1, "fan_1");
        assertTrue(backing.hasProfile(fan1));
    }

    // ------------------------------------------------------------------ backing

    function test_back_moves_funds_into_vault() public {
        _back(fan1, alice, 100e6);
        assertEq(usdc.balanceOf(fan1), START - 100e6);
        assertEq(usdc.balanceOf(address(backing)), 0);
        assertEq(backing.totalPrincipal(), 100e6);
        Backing.ProfileView memory v = backing.getProfile(alice);
        assertEq(v.principal, 100e6);
        assertEq(v.backerCount, 1);
        assertEq(backing.getProfile(fan1).backingCount, 1);
    }

    function test_back_guards() public {
        vm.startPrank(fan1);
        vm.expectRevert(Backing.NoProfile.selector);
        backing.back(fan2, 10e6, address(0));
        vm.expectRevert(Backing.AmountTooSmall.selector);
        backing.back(alice, 0.5e6, address(0));
        vm.stopPrank();
        usdc.mint(alice, 10e6);
        vm.startPrank(alice);
        usdc.approve(address(backing), 10e6);
        vm.expectRevert(Backing.CannotBackSelf.selector);
        backing.back(alice, 10e6, address(0));
        vm.stopPrank();
    }

    function test_yield_goes_to_creator_not_backer() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(_now() + 365 days);
        assertApproxEqAbs(backing.claimable(alice), 1_000e6, 2);
        assertApproxEqAbs(backing.getPosition(fan1, alice).yieldGenerated, 1_000e6, 2);
    }

    function test_yield_split_proportional() public {
        _back(fan1, alice, 3_000e6);
        _back(fan2, bob, 1_000e6);
        vm.warp(_now() + 30 days);
        assertApproxEqRel(backing.claimable(alice), backing.claimable(bob) * 3, 1e14);
    }

    function test_late_backer_does_not_steal_past_yield() public {
        _back(fan1, alice, 1_000e6);
        vm.warp(_now() + 100 days);
        uint256 before = backing.claimable(alice);
        _back(fan2, bob, 1_000_000e6);
        assertApproxEqAbs(backing.claimable(alice), before, 1);
        assertEq(backing.claimable(bob), 0);
    }

    function test_withdraw_any_time_partial_and_full() public {
        _back(fan1, alice, 500e6);
        vm.prank(fan1);
        backing.unback(alice, 200e6);
        assertEq(backing.getPosition(fan1, alice).principal, 300e6);
        vm.prank(fan1);
        vm.expectRevert(Backing.InsufficientPrincipal.selector);
        backing.unback(alice, 301e6);
        vm.warp(_now() + 90 days);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertEq(usdc.balanceOf(fan1), START);
        assertEq(backing.getProfile(alice).backerCount, 0);
        assertEq(backing.getBacking(fan1).length, 0);
        assertGt(backing.claimable(alice), 0, "yield earned while backed stays with the creator");
    }

    function test_stop_backing_stops_income() public {
        _back(fan1, alice, 1_000e6);
        _back(fan2, bob, 1_000e6);
        vm.warp(_now() + 10 days);
        vm.prank(fan1);
        backing.unbackAll(alice);
        uint256 frozen = backing.claimable(alice);
        vm.warp(_now() + 100 days);
        assertApproxEqAbs(backing.claimable(alice), frozen, 1);
    }

    function test_claim_per_epoch() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(_now() + 7 days);
        uint256 expected = backing.claimable(alice);
        vm.prank(alice);
        assertEq(backing.claim(), expected);
        assertEq(usdc.balanceOf(alice), expected);
        vm.warp(_now() + 1 days);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Backing.EpochNotOver.selector, uint64(_now() - 1 days + EPOCH)));
        backing.claim();
        vm.prank(bob);
        vm.expectRevert(Backing.NothingToClaim.selector);
        backing.claim();
    }

    function test_backers_and_backing_lists() public {
        _back(fan1, alice, 100e6);
        _back(fan2, alice, 200e6);
        _back(fan3, alice, 300e6);
        _back(fan2, bob, 50e6);
        assertEq(backing.getBackers(alice).length, 3);
        assertEq(backing.getBacking(fan2).length, 2);
        vm.prank(fan1);
        backing.unbackAll(alice);
        Backing.PositionView[] memory bs = backing.getBackers(alice);
        assertEq(bs.length, 2);
        assertEq(bs[0].backer, fan3, "swap-pop keeps the list tight");
    }

    // ------------------------------------------------------------------ invites

    function test_referral_counts_new_backers_once() public {
        _join(fan1, "fan_one");
        vm.prank(fan2);
        backing.back(alice, 100e6, fan1); // fan1's link brought fan2
        vm.prank(fan2);
        backing.back(alice, 100e6, fan1); // top-up: not a new backer
        vm.prank(fan3);
        backing.back(alice, 100e6, fan1);
        assertEq(backing.getProfile(fan1).referred, 2);
        // fan1 is told about it
        (, Backing.Activity[] memory inbox) = backing.getInbox(fan1, 0, 10);
        assertEq(uint8(inbox[0].kind), uint8(Backing.Kind.Backed));
        assertEq(inbox[0].referrer, fan1);
    }

    function test_referral_ignores_self_and_unknown() public {
        vm.prank(fan2);
        backing.back(alice, 100e6, fan2); // self
        vm.prank(fan3);
        backing.back(alice, 100e6, makeAddr("nobody")); // no profile
        (, Backing.Activity[] memory items) = backing.getInbox(alice, 0, 10);
        for (uint256 i; i < items.length; i++) assertEq(items[i].referrer, address(0));
    }

    // ------------------------------------------------------------------ posts and notifications

    function test_posts_feed_and_by_person() public {
        vm.prank(alice);
        uint256 p1 = backing.post("first", "");
        vm.prank(bob);
        uint256 p2 = backing.post("", "https://img.test/p.webp");
        (uint256[] memory ids, Backing.Activity[] memory items) = backing.getPosts(0, 10);
        assertEq(ids.length, 2);
        assertEq(ids[0], p2);
        assertEq(items[0].image, "https://img.test/p.webp");
        assertEq(items[1].text, "first");
        (ids,) = backing.getPostsBy(alice, 0, 10);
        assertEq(ids[0], p1);
        assertEq(backing.getProfile(alice).postCount, 1);
        (ids,) = backing.getPosts(1, 10);
        assertEq(ids.length, 1);
    }

    function test_post_guards() public {
        vm.prank(fan1);
        vm.expectRevert(Backing.NoProfile.selector);
        backing.post("hi", "");
        vm.prank(alice);
        vm.expectRevert(Backing.InvalidPost.selector);
        backing.post("", "");
        vm.prank(alice);
        vm.expectRevert(Backing.InvalidPost.selector);
        backing.post(string(new bytes(281)), "");
    }

    function test_inbox_shows_backings_withdrawals_milestones_claims() public {
        _back(fan1, alice, 1_000e6); // also crosses 100 and 1,000 milestones
        vm.warp(_now() + 8 days);
        vm.prank(fan1);
        backing.unback(alice, 10e6);
        vm.prank(alice);
        backing.claim();
        (, Backing.Activity[] memory items) = backing.getInbox(alice, 0, 20);
        assertEq(uint8(items[0].kind), uint8(Backing.Kind.Claimed));
        assertEq(uint8(items[1].kind), uint8(Backing.Kind.Unbacked));
        assertEq(uint8(items[2].kind), uint8(Backing.Kind.Milestone));
        assertEq(items[2].amount, 1_000e6);
        assertEq(uint8(items[4].kind), uint8(Backing.Kind.Backed));
        assertEq(uint8(items[5].kind), uint8(Backing.Kind.Joined));
    }

    // ------------------------------------------------------------------ fuzz

    /// Random back / withdraw / claim sequences: afterwards every backer exits with exactly their
    /// principal and creators receive exactly what they were shown.
    function testFuzz_solvency(uint256 seed) public {
        address[3] memory fans = [fan1, fan2, fan3];
        address[2] memory creators = [alice, bob];
        for (uint256 i; i < 30; i++) {
            uint256 r = uint256(keccak256(abi.encode(seed, i)));
            address fan = fans[r % 3];
            address cr = creators[(r >> 8) % 2];
            uint256 action = (r >> 16) % 4;
            vm.warp(_now() + ((r >> 32) % 10 days));
            if (action <= 1) {
                _back(fan, cr, 1e6 + ((r >> 64) % 50_000e6));
            } else if (action == 2) {
                uint256 pr = backing.getPosition(fan, cr).principal;
                if (pr > 0) {
                    vm.prank(fan);
                    backing.unback(cr, 1 + ((r >> 64) % pr));
                }
            } else {
                Backing.ProfileView memory v = backing.getProfile(cr);
                if (v.claimable > 0 && _now() >= v.nextClaimAt) {
                    uint256 bal = usdc.balanceOf(cr);
                    vm.prank(cr);
                    backing.claim();
                    assertEq(usdc.balanceOf(cr) - bal, v.claimable);
                }
            }
        }
        vm.warp(_now() + 30 days);
        for (uint256 f; f < 3; f++) {
            for (uint256 c; c < 2; c++) {
                if (backing.getPosition(fans[f], creators[c]).principal > 0) {
                    vm.prank(fans[f]);
                    backing.unbackAll(creators[c]);
                }
            }
            assertEq(usdc.balanceOf(fans[f]), START, "fan made whole");
        }
        vm.warp(_now() + EPOCH);
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
