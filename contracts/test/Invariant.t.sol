// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";
import {MockYieldVault} from "../src/mocks/MockYieldVault.sol";

/// @notice Drives Backing with random sequences of every user action plus vault gains and losses.
contract Handler is Test {
    Backing public backing;
    MockUSDC public usdc;
    MockYieldVault public vault;
    address[4] public fans;
    address[3] public creators;

    mapping(address => uint256) public deposited; // ghost: what each fan put in
    mapping(address => uint256) public withdrawn; // ghost: what each fan got back
    bool public lossHappened;
    uint256 public ops;
    address internal vaultOwner;

    constructor(Backing b, MockUSDC u, MockYieldVault v, address[4] memory f, address[3] memory c, address owner_) {
        vaultOwner = owner_;
        backing = b;
        usdc = u;
        vault = v;
        fans = f;
        creators = c;
    }

    function back(uint256 fi, uint256 ci, uint256 amount, uint256 durIdx, bool lock) external {
        address fan = fans[fi % 4];
        address cr = creators[ci % 3];
        amount = bound(amount, 1e6, 100_000e6);
        uint64 dur = [uint64(0), 1 hours, 1 days, 7 days, 30 days][durIdx % 5];
        if (dur == 0) lock = false;
        usdc.mint(fan, amount);
        vm.startPrank(fan);
        usdc.approve(address(backing), amount);
        backing.back(cr, amount, Backing.BackOptions({duration: dur, lock: lock, cast: bytes20(0), post: 0, note: ""}));
        vm.stopPrank();
        deposited[fan] += amount;
        ops++;
    }

    function unback(uint256 fi, uint256 ci, uint256 amount) external {
        address fan = fans[fi % 4];
        address cr = creators[ci % 3];
        Backing.PositionView memory p = backing.getPosition(fan, cr);
        if (p.principal == 0 || vm.getBlockTimestamp() < p.lockedUntil) return;
        amount = bound(amount, 1, p.principal);
        uint256 b = usdc.balanceOf(fan);
        vm.prank(fan);
        backing.unback(cr, amount);
        withdrawn[fan] += usdc.balanceOf(fan) - b;
        ops++;
    }

    function close(uint256 fi, uint256 ci) external {
        address fan = fans[fi % 4];
        address cr = creators[ci % 3];
        Backing.PositionView memory p = backing.getPosition(fan, cr);
        if (p.principal == 0 || p.endsAt == 0 || vm.getBlockTimestamp() < p.endsAt) return;
        uint256 b = usdc.balanceOf(fan);
        backing.close(fan, cr); // called by the handler, a stranger
        withdrawn[fan] += usdc.balanceOf(fan) - b;
        ops++;
    }

    function claim(uint256 ci) external {
        address cr = creators[ci % 3];
        Backing.CreatorView memory v = backing.getCreator(cr);
        if (v.claimable == 0 || vm.getBlockTimestamp() < v.nextClaimAt) return;
        vm.prank(cr);
        backing.claim();
        ops++;
    }

    function warp(uint256 secs) external {
        vm.warp(vm.getBlockTimestamp() + bound(secs, 1, 20 days));
    }

    function donate(uint256 amount) external {
        amount = bound(amount, 1, 1_000e6);
        usdc.mint(address(vault), amount);
    }

    function loss(uint256 bps) external {
        uint256 assets = usdc.balanceOf(address(vault));
        if (assets == 0) return;
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
        for (uint256 c; c < 3; c++) s += backing.getCreator(creators[c]).principal;
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
        backing = new Backing(vault, 1 days, 1e6);
        // Like any live vault, this one already holds other people's money.
        usdc.mint(address(this), 10_000e6);
        usdc.approve(address(vault), 10_000e6);
        vault.deposit(10_000e6, address(0xdead));

        address[3] memory creators = [makeAddr("c0"), makeAddr("c1"), makeAddr("c2")];
        for (uint256 i; i < 3; i++) {
            vm.prank(creators[i]);
            backing.registerCreator(
                Backing.Profile({name: "c", bio: "", avatar: "", banner: "", handle: "", fid: 0, x: "", xPost: ""})
            );
        }
        address[4] memory fans = [makeAddr("f0"), makeAddr("f1"), makeAddr("f2"), makeAddr("f3")];
        handler = new Handler(backing, usdc, vault, fans, creators, address(this));
        usdc.setMinter(address(handler), true);
        targetContract(address(handler));
    }

    /// Fans never get back more than they put in. Backing never pays fans a return.
    function invariant_fans_never_profit() public view {
        for (uint256 i; i < 4; i++) {
            address f = handler.fans(i);
            assertLe(handler.withdrawn(f), handler.deposited(f), "fan profited");
        }
    }

    /// Every unit of principal is accounted for, three ways.
    function invariant_principal_adds_up() public view {
        assertEq(handler.sumPrincipal(), backing.totalPrincipal(), "positions != total");
        assertEq(handler.sumCreatorPrincipal(), backing.totalPrincipal(), "creators != total");
    }

    /// Without a vault loss, the vault always holds at least what is owed (a few wei of rounding per op).
    function invariant_solvent_without_loss() public view {
        if (handler.lossHappened()) return;
        (uint256 value, uint256 owed,) = backing.health();
        assertGe(value + 10 * handler.ops() + 10, owed, "insolvent without a loss");
    }

    /// The reserve never claims more than the vault actually holds above user balances.
    function invariant_reserve_backed() public view {
        (uint256 value, uint256 owed, uint256 reserve) = backing.health();
        if (value >= owed) assertLe(reserve, value - owed + 10 * handler.ops() + 10);
    }
}
