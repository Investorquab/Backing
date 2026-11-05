// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Base} from "./Backing.t.sol";
import {Backing} from "../src/Backing.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";
import {ReentrantVault} from "./mocks/ReentrantVault.sol";
import {FeeVault} from "./mocks/FeeVault.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Each test is an attempt to steal money or break the accounting.
contract AttackTest is Base {
    // 1. Vault loses money. Leaving first must not dump the loss on whoever leaves last.
    function test_attack_bank_run_after_vault_loss_is_shared_fairly() public {
        _back(fan1, alice, 1_000e6);
        _back(fan2, alice, 1_000e6);
        _back(fan3, bob, 1_000e6);
        vault.setApr(0);
        // the vault holds 13,000 (10k from others + our 3k); losing 1,300 is a 10% hit for everyone
        vault.simulateLoss(1_300e6);
        address[3] memory fans = [fan1, fan2, fan3];
        address[3] memory cr = [alice, alice, bob];
        for (uint256 i; i < 3; i++) {
            uint256 b = usdc.balanceOf(fans[i]);
            vm.prank(fans[i]);
            backing.unbackAll(cr[i]);
            assertApproxEqAbs(usdc.balanceOf(fans[i]) - b, 900e6, 3, "everyone takes the same 10%");
        }
    }

    // 2. Idle-yield sniping: growth while nothing is backed must not go to whoever backs next.
    function test_attack_idle_yield_sniping() public {
        _back(fan1, alice, 100_000e6);
        vm.warp(_now() + 365 days);
        vm.prank(fan1);
        backing.unbackAll(alice); // alice holds ~10k unclaimed, nothing is backed
        vm.warp(_now() + 365 days); // that 10k grows ~1k while idle
        address sybil = makeAddr("bobs-other-wallet");
        usdc.mint(sybil, 1e6);
        vm.startPrank(sybil);
        usdc.approve(address(backing), 1e6);
        backing.back(bob, 1e6, address(0));
        vm.stopPrank();
        backing.sync();
        assertLt(backing.claimable(bob), 1e6, "bob captured none of it");
        assertGt(backing.reserve(), 900e6, "it went to the reserve");
    }

    // 3. Reentrancy through a malicious vault, during deposit and withdraw.
    function test_attack_reentrancy_via_malicious_vault() public {
        ReentrantVault evil = new ReentrantVault(usdc);
        Backing b2 = new Backing(evil, EPOCH, 1e6);
        vm.prank(alice);
        b2.saveProfile(_p("alice"));
        vm.prank(fan1);
        usdc.approve(address(b2), type(uint256).max);
        evil.arm(address(b2), 1, address(0));
        vm.prank(fan1);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        b2.back(alice, 100e6, address(0));
        evil.arm(address(0), 0, address(0));
        vm.prank(fan1);
        b2.back(alice, 100e6, address(0));
        evil.arm(address(b2), 2, alice);
        vm.prank(fan1);
        vm.expectRevert(ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        b2.unbackAll(alice);
        assertEq(b2.getPosition(fan1, alice).principal, 100e6);
    }

    // 4. ERC-4626 inflation attack: donate into an empty vault so the next deposit rounds to dust.
    function test_attack_empty_vault_inflation_is_refused() public {
        MockYieldVault fresh = new MockYieldVault(usdc, 0);
        Backing b2 = new Backing(fresh, EPOCH, 1e6);
        vm.prank(alice);
        b2.saveProfile(_p("alice"));
        address attacker = makeAddr("attacker");
        usdc.mint(attacker, 1_000_000e6);
        vm.prank(attacker);
        usdc.transfer(address(fresh), 1_000_000e6);
        vm.startPrank(fan1);
        usdc.approve(address(b2), type(uint256).max);
        vm.expectRevert(Backing.DepositLoss.selector);
        b2.back(alice, 100e6, address(0));
        vm.stopPrank();
        assertEq(usdc.balanceOf(fan1), START);
    }

    // 4b. A vault that charges a withdrawal/redemption fee is refused at construction, so it can
    //     never silently under-collateralize the backers who stay (security review finding F1).
    function test_attack_fee_vault_is_refused() public {
        FeeVault fee = new FeeVault(usdc, 100); // 1% exit fee
        vm.expectRevert(Backing.VaultNotSupported.selector);
        new Backing(fee, EPOCH, 1e6);
        // a tiny fee is still refused: the guard tolerance is ~0.1%, well below any real fee
        FeeVault smallFee = new FeeVault(usdc, 20); // 0.2%
        vm.expectRevert(Backing.VaultNotSupported.selector);
        new Backing(smallFee, EPOCH, 1e6);
    }

    // 5. Donating to the vault just becomes creator yield; backers exit exactly whole.
    function test_attack_vault_donation_is_harmless() public {
        _back(fan1, alice, 1_000e6);
        address whale = makeAddr("whale");
        usdc.mint(whale, 50_000e6);
        vm.prank(whale);
        usdc.transfer(address(vault), 50_000e6);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertEq(usdc.balanceOf(fan1), START);
    }

    // 6. USDC sent straight to the contract is ignored.
    function test_attack_direct_transfer() public {
        _back(fan1, alice, 1_000e6);
        usdc.mint(address(backing), 5e6);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertEq(usdc.balanceOf(fan1), START);
        assertEq(usdc.balanceOf(address(backing)), 5e6);
    }

    // 7. Rounding drain over many tiny in/out cycles.
    function test_attack_rounding_drain() public {
        _back(fan2, bob, 777_777_777);
        vault.setApr(0);
        for (uint256 i; i < 150; i++) {
            _back(fan1, alice, 1_000_001 + i);
            vm.prank(fan1);
            backing.unbackAll(alice);
        }
        assertLe(usdc.balanceOf(fan1), START);
        vm.prank(fan2);
        backing.unbackAll(bob);
        assertEq(usdc.balanceOf(fan2), START);
    }

    // 8. Nobody can withdraw someone else's principal.
    function test_attack_cannot_withdraw_others_principal() public {
        _back(fan1, alice, 1_000e6);
        vm.startPrank(fan2);
        vm.expectRevert(Backing.InsufficientPrincipal.selector);
        backing.unback(alice, 1_000e6);
        vm.expectRevert(Backing.InsufficientPrincipal.selector);
        backing.unbackAll(alice);
        vm.stopPrank();
    }

    // 9. Claiming twice inside an epoch.
    function test_attack_double_claim() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(_now() + 10 days);
        vm.prank(alice);
        backing.claim();
        vm.prank(alice);
        vm.expectRevert();
        backing.claim();
    }

    // 10. A creator claiming during a shortfall takes the same haircut as backers.
    function test_attack_claim_during_shortfall_is_haircut() public {
        _back(fan1, alice, 10_000e6);
        vm.warp(_now() + 365 days);
        vault.setApr(0);
        backing.sync();
        uint256 owed = backing.claimable(alice);
        // vault holds ~22,000 (10k others, 10k principal, ~2k yield across both); lose 10%
        vault.simulateLoss(usdc.balanceOf(address(vault)) / 10);
        vm.prank(alice);
        uint256 paid = backing.claim();
        assertApproxEqRel(paid, (owed * 9) / 10, 0.01e18);
        vm.prank(fan1);
        backing.unbackAll(alice);
        assertApproxEqRel(usdc.balanceOf(fan1), START - 1_000e6, 0.001e18);
    }

    // 11. Squatting someone's username isn't possible once taken; releasing it frees it.
    function test_attack_username_squatting() public {
        vm.prank(fan1);
        vm.expectRevert(Backing.UsernameTaken.selector);
        backing.saveProfile(_p("alice"));
        vm.prank(alice);
        backing.saveProfile(_p("alice_new"));
        _join(fan1, "alice"); // freed by its owner, now claimable
        assertEq(backing.getProfileByUsername("alice").account, fan1);
        assertEq(backing.getProfileByUsername("alice_new").account, alice);
    }

    // 12. Fake referrals: referring yourself or a wallet with no profile counts nothing.
    function test_attack_fake_referrals() public {
        for (uint256 i; i < 5; i++) {
            address sock = makeAddr(string(abi.encode(i)));
            usdc.mint(sock, 2e6);
            vm.startPrank(sock);
            usdc.approve(address(backing), 2e6);
            backing.back(alice, 1e6, sock);
            vm.stopPrank();
        }
        assertEq(backing.getProfile(alice).referred, 0);
    }
}
