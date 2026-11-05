// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @notice Test-only ERC-4626 that charges a withdrawal/redemption fee. Backing's constructor must
///         refuse it, because a fee vault would make every exit under-collateralize the backers who
///         stay (security review finding F1).
contract FeeVault is ERC4626 {
    uint256 public immutable feeBps; // charged on the way out

    constructor(IERC20 a, uint256 feeBps_) ERC20("Fee Vault", "FEE") ERC4626(a) {
        feeBps = feeBps_;
    }

    function _fee(uint256 assets) internal view returns (uint256) {
        return (assets * feeBps) / 10_000;
    }

    /// Redeeming shares returns assets minus the fee.
    function previewRedeem(uint256 shares) public view override returns (uint256) {
        uint256 assets = super.previewRedeem(shares);
        return assets - _fee(assets);
    }

    /// Withdrawing `assets` burns the shares for `assets` plus the fee.
    function previewWithdraw(uint256 assets) public view override returns (uint256) {
        return super.previewWithdraw(assets + _fee(assets));
    }
}
