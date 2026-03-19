// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

/// @notice Uniswap V3 core on Base mainnet — proves fork + real pool state (liquidity, slot0).
/// @dev Full swaps are built off-chain (`SwapStep` calldata) per `DAOVault`; this test avoids brittle router ABI drift.
interface IUniswapV3Factory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

interface IUniswapV3PoolMinimal {
    function slot0()
        external
        view
        returns (
            uint160 sqrtPriceX96,
            int24 tick,
            uint16 observationIndex,
            uint16 observationCardinality,
            uint16 observationCardinalityNext,
            uint8 feeProtocol,
            bool unlocked
        );

    function liquidity() external view returns (uint128);
}

contract UniswapBaseForkTest is Test {
    address internal constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address internal constant WETH = 0x4200000000000000000000000000000000000006;
    address internal constant V3_FACTORY = 0x33128a8fC17869897dcE68Ed026d694621f6FDfD;

    uint24 internal constant FEE_3000 = 3000;

    function testFork_USDC_WETH_pool_has_liquidity_on_Base() public {
        string memory rpc = vm.envOr("BASE_MAINNET_RPC_URL", string("https://mainnet.base.org"));
        vm.createSelectFork(rpc);

        address pool = IUniswapV3Factory(V3_FACTORY).getPool(USDC, WETH, FEE_3000);
        assertTrue(pool != address(0), "no pool for USDC/WETH fee tier");

        uint128 liq = IUniswapV3PoolMinimal(pool).liquidity();
        assertGt(liq, 0, "expected non-zero liquidity");

        (uint160 sqrtPriceX96,,,,,, bool unlocked) = IUniswapV3PoolMinimal(pool).slot0();
        assertGt(sqrtPriceX96, 0);
        assertTrue(unlocked);
    }
}
