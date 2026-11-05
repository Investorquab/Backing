// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IBackingLike {
    function sync() external;
    function unbackAll(address creator) external;
    function claim() external returns (uint256);
}

/// @notice Attack vault: tries to call back into Backing in the middle of a deposit or withdraw.
contract ReentrantVault is ERC4626 {
    address public target;
    uint8 public mode; // 0 off, 1 sync, 2 unbackAll, 3 claim
    address public creatorArg;

    constructor(IERC20 a) ERC20("Evil", "EVIL") ERC4626(a) {}

    function arm(address target_, uint8 mode_, address creator_) external {
        target = target_;
        mode = mode_;
        creatorArg = creator_;
    }

    function _attack() internal {
        if (mode == 1) IBackingLike(target).sync();
        else if (mode == 2) IBackingLike(target).unbackAll(creatorArg);
        else if (mode == 3) IBackingLike(target).claim();
    }

    function _deposit(address caller, address receiver, uint256 assets, uint256 shares) internal override {
        super._deposit(caller, receiver, assets, shares);
        _attack();
    }

    function _withdraw(address caller, address receiver, address owner_, uint256 assets, uint256 shares) internal override {
        super._withdraw(caller, receiver, owner_, assets, shares);
        _attack();
    }
}
