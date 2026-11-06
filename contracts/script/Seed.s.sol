// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {Backing} from "../src/Backing.sol";
import {MockUSDC} from "../src/mocks/MockUSDC.sol";

/// @notice Fills a DEMO deployment with sample people, posts and backings so the app isn't empty.
///         Throwaway wallets are derived from SEED_SALT (testnet only, they hold nothing of value)
///         and funded with gas and Test USDC by the broadcasting account (the deployer).
///         SEED_IMAGE_BASE (e.g. https://your-site.vercel.app/demo) adds pictures to the demo posts.
///         Run with --slow so funding lands before the derived wallets transact.
contract Seed is Script {
    uint256 constant SECP_N = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;

    function run() external {
        string memory dep = vm.readFile(string.concat("../web/src/deployments/", vm.toString(block.chainid), ".json"));
        require(vm.parseJsonBool(dep, ".demo"), "Seed only runs on demo deployments");
        Backing backing = Backing(vm.parseJsonAddress(dep, ".backing"));
        MockUSDC usdc = MockUSDC(vm.parseJsonAddress(dep, ".usdc"));
        bytes32 salt = keccak256(abi.encode(vm.envOr("SEED_SALT", string("backing-demo")), block.chainid));
        uint256 gas = vm.envOr("SEED_GAS_WEI", uint256(0.0004 ether));
        string memory img = vm.envOr("SEED_IMAGE_BASE", string(""));

        string[4] memory users = ["nightbuilder", "basegremlin", "lagosdev", "moonlitpixels"];
        string[4] memory bases = ["nightbuilder.base.eth", "basegremlin.base.eth", "lagosdev.base.eth", "moonlit.base.eth"];
        string[4] memory bios = [
            "Shipping small apps on Base after dark. Deep in Vibeathon 02 this week.",
            "Onchain tinkerer. I break things on testnet so you don't have to.",
            "Building from Lagos, 1am to sunrise. Vibecoding everything.",
            "UI and motion for onchain apps. Night shift only. Prints for backers."
        ];
        string[4] memory posts = [
            "Night 3 of Vibeathon. Shipped the vault flow: backers withdraw to the cent, creators keep the yield. Base gas is cheap enough that I redeployed six times today without blinking.",
            "PSA for the hackathon crowd: test your ERC-4626 round-trips before mainnet. Caught a fee-on-withdraw vault at 2am that would quietly short every backer. Backing refuses vaults like that at deploy.",
            "3am in Lagos. The timeline is asleep, the build finally works, and the tests are green. This is the hour.",
            "New profile cards tonight: lit-window motif, amber accent, mono numbers. Dark UI that doesn't burn your eyes at 2am."
        ];
        string[4] memory posts2 = [
            "The thing that finally clicked tonight: backing is not tipping. Your USDC earns yield in a lending vault, the creator takes the yield, and you pull your principal out whenever you want. Support with zero downside.",
            "Ran the fuzz suite 10k times while the coffee brewed. 34 tests, 4 invariants, all green. If a backer could ever withdraw less than they put in, one of these would fail. They do not.",
            "Wired up invite links tonight. Share your profile, and whoever backs through it credits you onchain. No backend, it all lives in the contract. Small thing, feels great.",
            "Designed the 'your money is still yours' moment for the backing flow. People should feel that the downside is zero before they ever confirm. Copy and motion doing the heavy lifting."
        ];
        string[3] memory fanNames = ["onchain_amara", "tunde_backs", "zee_onbase"];

        uint256[4] memory ck;
        uint256[6] memory fk;
        for (uint256 i; i < 4; i++) ck[i] = uint256(keccak256(abi.encode(salt, "creator", i))) % SECP_N;
        for (uint256 i; i < 6; i++) fk[i] = uint256(keccak256(abi.encode(salt, "fan", i))) % SECP_N;

        vm.startBroadcast();
        for (uint256 i; i < 4; i++) payable(vm.addr(ck[i])).transfer(gas);
        for (uint256 i; i < 6; i++) {
            payable(vm.addr(fk[i])).transfer(gas);
            usdc.mint(vm.addr(fk[i]), 5_000e6);
        }
        vm.stopBroadcast();

        for (uint256 i; i < 4; i++) {
            if (backing.hasProfile(vm.addr(ck[i]))) continue;
            vm.startBroadcast(ck[i]);
            backing.saveProfile(Backing.Profile({username: users[i], baseName: bases[i], avatar: "", bio: bios[i], link: ""}));
            string memory picture = bytes(img).length > 0 ? string.concat(img, "/night-", vm.toString(i), ".webp") : "";
            backing.post(posts[i], picture);
            backing.post(posts2[i], ""); // second post, text-only, for a fuller and more varied feed
            vm.stopBroadcast();
        }
        // three of the fans have profiles too, so backer lists show names
        for (uint256 i; i < 3; i++) {
            if (backing.hasProfile(vm.addr(fk[i]))) continue;
            vm.startBroadcast(fk[i]);
            backing.saveProfile(Backing.Profile({username: fanNames[i], baseName: "", avatar: "", bio: "Here for the night-shift crew.", link: ""}));
            vm.stopBroadcast();
        }

        uint256[6] memory amounts = [uint256(2_500e6), 1_200e6, 800e6, 400e6, 150e6, 50e6];
        for (uint256 i; i < 6; i++) {
            // fans 3-5 arrived through fan 0's invite link
            address ref = i >= 3 ? vm.addr(fk[0]) : address(0);
            vm.startBroadcast(fk[i]);
            usdc.approve(address(backing), type(uint256).max);
            backing.back(vm.addr(ck[i % 4]), amounts[i], ref);
            if (i < 3) backing.back(vm.addr(ck[(i + 1) % 4]), amounts[i] / 2, address(0));
            vm.stopBroadcast();
        }
        console2.log("Seeded 4 creators, 3 fan profiles, 8 posts and 9 backings");
    }
}
