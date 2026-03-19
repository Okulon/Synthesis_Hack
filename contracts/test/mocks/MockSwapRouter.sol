// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

/// @notice Pulls `tokenIn` from caller (vault), forwards `amountIn` of `tokenOut` from this contract's balance.
contract MockSwapRouter {
    function swapExactIn(address tokenIn, address tokenOut, uint256 amountIn, address to) external {
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenOut).transfer(to, amountIn);
    }
}
