// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test, console2} from "forge-std/Test.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Backing} from "../src/Backing.sol";

/// @notice Runs Backing against a REAL Base vault on a mainnet fork.
///   BASE_RPC_URL=https://mainnet.base.org VAULT=0x... forge test --match-contract Fork -vv
/// Skipped when BASE_RPC_URL or VAULT are not set.
contract ForkTest is Test {
    address constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function test_fork_real_vault_roundtrip() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string(""));
        address vaultAddr = vm.envOr("VAULT", address(0));
        if (bytes(rpc).length == 0 || vaultAddr == address(0)) {
            console2.log("skipped: set BASE_RPC_URL and VAULT");
            return;
        }
        vm.createSelectFork(rpc);
        IERC4626 vault = IERC4626(vaultAddr);
        assertEq(vault.asset(), USDC, "vault asset must be USDC");

        Backing backing = new Backing(vault, 1 days, 1e6);
        address creator = makeAddr("creator");
        address fan = makeAddr("fan");
        vm.prank(creator);
        backing.registerCreator(Backing.Profile({name: "Creator", bio: "", avatar: "", banner: "", handle: "", fid: 0, x: "", xPost: ""}));

        deal(USDC, fan, 10_000e6);
        vm.startPrank(fan);
        IERC20(USDC).approve(address(backing), type(uint256).max);
        backing.back(creator, 10_000e6, Backing.BackOptions({duration: 0, lock: false, cast: bytes20(0), post: 0, note: ""}));
        vm.stopPrank();

        vm.warp(block.timestamp + 30 days);
        vm.roll(block.number + 30 days / 2);
        uint256 owed = backing.claimable(creator);
        console2.log("creator yield after 30 days on 10k USDC (6dp):", owed);

        vm.prank(fan);
        backing.unbackAll(creator);
        assertEq(IERC20(USDC).balanceOf(fan), 10_000e6, "fan gets full principal");
    }
}
