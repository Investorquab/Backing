// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Backing.t.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {ReentrantVault} from "./mocks/ReentrantVault.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Each test is an attempt to steal money or break the accounting.
contract AttackTest is Base {
    // 1. Vault loses money (bad debt). Early leavers must not dump the loss on late leavers.
    function test_attack_bank_run_after_vault_loss_is_shared_fairly() public {
        _back(fan1, alice, 1_000e6);
        _back(fan2, alice, 1_000e6);
        _back(fan3, bob, 1_000e6);
        vault.setApr(0); // isolate the loss from yield
        vault.simulateLoss(300e6); // the vault loses 10%

        uint256[3] memory got;
        address[3] memory fans = [fan1, fan2, fan3];
        address[3] memory cr = [alice, alice, bob];
        for (uint256 i; i < 3; i++) {
            uint256 b = usdc.balanceOf(fans[i]);
            vm.prank(fans[i]);
            backing.unbackAll(cr[i]);
            got[i] = usdc.balanceOf(fans[i]) - b;
        }
        assertApproxEqAbs(got[0], 900e6, 2, "first out takes the same haircut");
        assertApproxEqAbs(got[1], 900e6, 2);
        assertApproxEqAbs(got[2], 900e6, 2, "last out isn't left with the whole loss");
    }

    // 2. A small loss is absorbed by the reserve before it touches anyone's principal.
    function test_attack_small_loss_hits_reserve_first() public {
        _backTimed(fan1, alice, 10_000e6, 1 days, false);
        vm.warp(vm.getBlockTimestamp() + 30 days);
        backing.close(fan1, alice); // 29 days of yield move to the reserve
        _back(fan2, bob, 1_000e6);
        uint256 r = backing.reserve();
        assertGt(r, 50e6);
        vault.setApr(0);
        vault.simulateLoss(20e6);
        vm.prank(fan2);
        backing.unbackAll(bob);
        assertEq(usdc.balanceOf(fan2), START, "principal untouched");
        assertLt(backing.reserve(), r, "reserve paid for it");
    }

    // 3. Idle-yield sniping: when nobody is backing, growth on unclaimed creator balances must not
    //    be handed to whoever backs next (e.g. a creator backing themselves with a second wallet).
    function test_attack_idle_yield_sniping() public {
        _back(fan1, alice, 100_000e6);
        vm.warp(vm.getBlockTimestamp() + 365 days);
        vm.prank(fan1);
        backing.unbackAll(alice); // alice has ~10k unclaimed, nothing is backed now
        vm.warp(vm.getBlockTimestamp() + 365 days); // the unclaimed 10k grows ~1k while idle

        address sybil = makeAddr("bobs-other-wallet");
        usdc.mint(sybil, 1e6);
        vm.startPrank(sybil);
        usdc.approve(address(backing), 1e6);
        backing.back(bob, 1e6, _opts(0, false));
        vm.stopPrank();
        backing.sync();
        assertLt(backing.claimable(bob), 1e6, "bob captured none of the idle growth");
        assertGt(backing.reserve(), 900e6, "it went to the reserve");
    }

    // 4. Reentrancy: a malicious vault calls back into Backing mid-deposit / mid-withdraw.
    function test_attack_reentrancy_via_malicious_vault() public {
        ReentrantVault evil = new ReentrantVault(usdc);
        Backing b2 = new Backing(evil, EPOCH, 1e6);
        vm.prank(alice);
        b2.registerCreator(_profile("Alice"));
        vm.prank(fan1);
        usdc.approve(address(b2), type(uint256).max);

        evil.arm(address(b2), 1, address(0)); // re-enter sync() during deposit
        vm.prank(fan1);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        b2.back(alice, 100e6, _opts(0, false));

        evil.arm(address(0), 0, address(0));
        vm.prank(fan1);
        b2.back(alice, 100e6, _opts(0, false));
        evil.arm(address(b2), 2, alice); // re-enter unbackAll() during the withdraw
        vm.prank(fan1);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        b2.unbackAll(alice);
        assertEq(b2.getPosition(fan1, alice).principal, 100e6, "nothing moved");
    }

    // 4b. ERC-4626 inflation attack: donate into an EMPTY vault so the next deposit rounds down to
    //     almost no shares. Backing refuses a deposit that comes back short instead of losing it.
    function test_attack_empty_vault_inflation_is_refused() public {
        MockYieldVault fresh = new MockYieldVault(usdc, 0);
        Backing b2 = new Backing(fresh, EPOCH, 1e6);
        vm.prank(alice);
        b2.registerCreator(_profile("Alice"));
        address attacker = makeAddr("attacker");
        usdc.mint(attacker, 1_000_000e6);
        vm.prank(attacker);
        usdc.transfer(address(fresh), 1_000_000e6); // inflate the share price of an empty vault
        vm.startPrank(fan1);
        usdc.approve(address(b2), type(uint256).max);
        vm.expectRevert(Backing.DepositLoss.selector);
        b2.back(alice, 100e6, _opts(0, false));
        vm.stopPrank();
        assertEq(usdc.balanceOf(fan1), START, "victim keeps their money");
    }

    // 5. Someone donates to the vault to manipulate the share price. It just becomes yield.
    function test_attack_vault_donation_is_harmless() public {
        _back(fan1, alice, 1_000e6);
        address whale = makeAddr("whale");
        usdc.mint(whale, 50_000e6);
        vm.prank(whale);
        usdc.transfer(address(vault), 50_000e6);
        backing.sync();
        assertGt(backing.claimable(alice), 0);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertEq(usdc.balanceOf(fan1), START, "fan exactly whole, not more");
    }

    // 6. USDC sent straight to the Backing contract is ignored, not counted or stolen.
    function test_attack_direct_transfer_to_backing() public {
        _back(fan1, alice, 1_000e6);
        usdc.mint(address(this), 5e6);
        usdc.transfer(address(backing), 5e6);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertEq(usdc.balanceOf(fan1), START);
        assertEq(usdc.balanceOf(address(backing)), 5e6);
    }

    // 7. Rounding drain: hundreds of tiny in/out cycles can't pull out a single extra wei.
    function test_attack_rounding_drain() public {
        _back(fan2, bob, 777_777_777); // other money in the pot
        vault.setApr(0);
        for (uint256 i; i < 150; i++) {
            _back(fan1, alice, 1_000_001 + i);
            vm.prank(fan1);
            backing.unbackAll(alice);
        }
        assertLe(usdc.balanceOf(fan1), START, "no profit from rounding");
        vm.prank(fan2);
        backing.unbackAll(bob);
        assertEq(usdc.balanceOf(fan2), START, "victim untouched");
    }

    // 8. Closing someone's ended backing can't redirect their money.
    function test_attack_close_cannot_redirect_funds() public {
        _backTimed(fan1, alice, 5_000e6, 1 hours, true);
        address mallory = makeAddr("mallory");
        vm.warp(vm.getBlockTimestamp() + 2 hours);
        vm.prank(mallory);
        backing.close(fan1, alice);
        assertEq(usdc.balanceOf(mallory), 0);
        assertEq(usdc.balanceOf(fan1), START);
    }

    // 9. A stranger can't touch anyone else's position.
    function test_attack_cannot_withdraw_others_principal() public {
        _back(fan1, alice, 1_000e6);
        vm.prank(fan2);
        vm.expectRevert(Backing.InsufficientPrincipal.selector);
        backing.unback(alice, 1_000e6);
        vm.prank(fan2);
        vm.expectRevert(Backing.InsufficientPrincipal.selector);
        backing.unbackAll(alice);
    }

    // 10. A creator can't claim before the epoch is up, nor claim twice.
    function test_attack_double_claim() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(vm.getBlockTimestamp() + 10 days);
        vm.prank(alice);
        backing.claim();
        vm.prank(alice);
        vm.expectRevert();
        backing.claim();
    }

    // 11. Loss during claims: a creator claiming during a shortfall takes the same haircut.
    function test_attack_creator_claim_during_shortfall_is_haircut() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(vm.getBlockTimestamp() + 365 days); // ~1k yield
        vault.setApr(0);
        backing.sync();
        uint256 owed = backing.claimable(alice);
        vault.simulateLoss(1_100e6); // ~10% of everything
        vm.prank(alice);
        uint256 paid = backing.claim();
        assertApproxEqRel(paid, owed * 9 / 10, 0.01e18);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertApproxEqRel(usdc.balanceOf(fan1), START - 1_000e6, 0.001e18, "fan took the same 10%");
    }
}
