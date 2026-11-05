// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";

/// @notice Fires random backings, withdrawals, claims, time jumps, vault gains and vault losses.
contract Handler is Test {
    Backing public backing;
    MockUSDC public usdc;
    MockYieldVault public vault;
    address[4] public fans;
    address[3] public creators;
    address internal vaultOwner;

    mapping(address => uint256) public deposited;
    mapping(address => uint256) public withdrawn;
    bool public lossHappened;
    uint256 public ops;

    constructor(Backing b, MockUSDC u, MockYieldVault v, address[4] memory f, address[3] memory c, address owner_) {
        backing = b;
        usdc = u;
        vault = v;
        fans = f;
        creators = c;
        vaultOwner = owner_;
    }

    function back(uint256 fi, uint256 ci, uint256 amount, uint256 ri) external {
        address fan = fans[fi % 4];
        address cr = creators[ci % 3];
        amount = bound(amount, 1e6, 100_000e6);
        usdc.mint(fan, amount);
        vm.startPrank(fan);
        usdc.approve(address(backing), amount);
        backing.back(cr, amount, creators[ri % 3]);
        vm.stopPrank();
        deposited[fan] += amount;
        ops++;
    }

    function unback(uint256 fi, uint256 ci, uint256 amount) external {
        address fan = fans[fi % 4];
        address cr = creators[ci % 3];
        uint256 p = backing.getPosition(fan, cr).principal;
        if (p == 0) return;
        amount = bound(amount, 1, p);
        uint256 b = usdc.balanceOf(fan);
        vm.prank(fan);
        backing.unback(cr, amount);
        withdrawn[fan] += usdc.balanceOf(fan) - b;
        ops++;
    }

    function claim(uint256 ci) external {
        address cr = creators[ci % 3];
        Backing.ProfileView memory v = backing.getProfile(cr);
        if (v.claimable == 0 || block.timestamp < v.nextClaimAt) return;
        vm.prank(cr);
        backing.claim();
        ops++;
    }

    function warp(uint256 secs) external {
        vm.warp(vm.getBlockTimestamp() + bound(secs, 1, 20 days));
    }

    function donate(uint256 amount) external {
        usdc.mint(address(vault), bound(amount, 1, 1_000e6));
    }

    function loss(uint256 bps) external {
        uint256 assets = usdc.balanceOf(address(vault));
        uint256 amount = (assets * bound(bps, 1, 500)) / 10_000; // up to 5%
        if (amount == 0) return;
        vm.prank(vaultOwner);
        vault.simulateLoss(amount);
        lossHappened = true;
    }

    function sumPrincipal() external view returns (uint256 s) {
        for (uint256 f; f < 4; f++) for (uint256 c; c < 3; c++) s += backing.getPosition(fans[f], creators[c]).principal;
    }

    function sumCreatorPrincipal() external view returns (uint256 s) {
        for (uint256 c; c < 3; c++) s += backing.getProfile(creators[c]).principal;
    }
}

contract BackingInvariantTest is Test {
    Backing backing;
    MockUSDC usdc;
    MockYieldVault vault;
    Handler handler;

    function setUp() public {
        vm.warp(1_700_000_000);
        usdc = new MockUSDC();
        vault = new MockYieldVault(usdc, 2_000); // 20% APR so yield moves fast
        usdc.setMinter(address(vault), true);
        usdc.mint(address(this), 10_000e6);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6, address(0xdead)); // a live vault already holds other money
        backing = new Backing(vault, 1 days, 1e6);

        address[3] memory creators = [makeAddr("c0"), makeAddr("c1"), makeAddr("c2")];
        string[3] memory names = ["c_zero", "c_one", "c_two"];
        for (uint256 i; i < 3; i++) {
            vm.prank(creators[i]);
            backing.saveProfile(Backing.Profile({username: names[i], baseName: "", avatar: "", bio: "", link: ""}));
        }
        address[4] memory fans = [makeAddr("f0"), makeAddr("f1"), makeAddr("f2"), makeAddr("f3")];
        handler = new Handler(backing, usdc, vault, fans, creators, address(this));
        usdc.setMinter(address(handler), true);
        targetContract(address(handler));
    }

    /// Fans never get back more than they put in.
    function invariant_fans_never_profit() public view {
        for (uint256 i; i < 4; i++) {
            address f = handler.fans(i);
            assertLe(handler.withdrawn(f), handler.deposited(f));
        }
    }

    /// Every unit of principal is accounted for, three ways.
    function invariant_principal_adds_up() public view {
        assertEq(handler.sumPrincipal(), backing.totalPrincipal());
        assertEq(handler.sumCreatorPrincipal(), backing.totalPrincipal());
    }

    /// Without a vault loss, the vault always holds what is owed (give or take rounding).
    function invariant_solvent_without_loss() public view {
        if (handler.lossHappened()) return;
        (uint256 value, uint256 owed,) = backing.health();
        assertGe(value + 10 * handler.ops() + 10, owed);
    }

    /// The reserve is always backed by real surplus.
    function invariant_reserve_backed() public view {
        (uint256 value, uint256 owed, uint256 reserve) = backing.health();
        if (value >= owed) assertLe(reserve, value - owed + 10 * handler.ops() + 10);
    }
}
