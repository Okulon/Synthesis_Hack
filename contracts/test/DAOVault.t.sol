// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DAOVault} from "../src/DAOVault.sol";
import {ERC20Mock} from "openzeppelin-contracts/mocks/token/ERC20Mock.sol";
import {MockSwapRouter} from "./mocks/MockSwapRouter.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {IAccessControl} from "openzeppelin-contracts/access/IAccessControl.sol";

contract DAOVaultTest is Test {
    DAOVault internal vault;
    ERC20Mock internal tokenA;
    ERC20Mock internal tokenB;
    MockSwapRouter internal router;

    /// @dev `gov` = timelock stand-in; `guardian` = emergency multisig stand-in.
    address internal gov = address(this);
    address internal guardian = makeAddr("guardian");
    address internal alice = makeAddr("alice");

    function setUp() public {
        vm.warp(10_000_000);
        tokenA = new ERC20Mock();
        tokenB = new ERC20Mock();
        router = new MockSwapRouter();
        vault = new DAOVault(gov, guardian, "DAO Agent Vault Share", "dAGNT");

        vault.setExecutor(address(0xBEEF));
        vault.setAssetAllowed(address(tokenA), true);
        vault.setAssetAllowed(address(tokenB), true);
        vault.setRouterAllowed(address(router), true);

        _setFeed1to1(address(tokenA));
        _setFeed1to1(address(tokenB));

        tokenA.mint(alice, 1_000 ether);
        tokenB.mint(alice, 1_000 ether);
        tokenB.mint(address(router), 1_000 ether);
    }

    /// @notice 1e18 NAV units per 1 full token (18-decimals feed).
    function _setFeed1to1(address asset) internal {
        MockAggregatorV3 agg = new MockAggregatorV3(18, int256(1e18));
        vault.setAssetOracleConfig(
            asset,
            DAOVault.AssetOracleConfig({
                primaryAggregator: address(agg),
                secondaryAggregator: address(0),
                primaryHeartbeat: 86_400,
                secondaryHeartbeat: 0,
                minPrice1e18: 1e15,
                maxPrice1e18: 1e24,
                maxDeviationBps: 0
            })
        );
    }

    function test_deposit_first_mint_shares() public {
        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        vm.stopPrank();

        assertGt(vault.balanceOf(alice), 0);
        assertEq(tokenA.balanceOf(address(vault)), 100 ether);
    }

    function test_deposit_reverts_when_oracle_stale_and_no_fallback() public {
        MockAggregatorV3 dead = new MockAggregatorV3(18, int256(1e18));
        dead.setLatest(int256(1e18), block.timestamp - 10_000);

        vault.setAssetOracleConfig(
            address(tokenA),
            DAOVault.AssetOracleConfig({
                primaryAggregator: address(dead),
                secondaryAggregator: address(0),
                primaryHeartbeat: 3600,
                secondaryHeartbeat: 0,
                minPrice1e18: 1e15,
                maxPrice1e18: 1e24,
                maxDeviationBps: 0
            })
        );

        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vm.expectRevert(DAOVault.OracleUnavailable.selector);
        vault.deposit(address(tokenA), 100 ether, alice);
        vm.stopPrank();
    }

    function test_deposit_uses_secondary_when_primary_stale() public {
        MockAggregatorV3 stale = new MockAggregatorV3(18, int256(1e18));
        stale.setLatest(int256(1e18), block.timestamp - 10_000);
        MockAggregatorV3 fresh = new MockAggregatorV3(18, int256(1e18));

        vault.setAssetOracleConfig(
            address(tokenA),
            DAOVault.AssetOracleConfig({
                primaryAggregator: address(stale),
                secondaryAggregator: address(fresh),
                primaryHeartbeat: 3600,
                secondaryHeartbeat: 86_400,
                minPrice1e18: 1e15,
                maxPrice1e18: 1e24,
                maxDeviationBps: 0
            })
        );

        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        vm.stopPrank();
        assertGt(vault.balanceOf(alice), 0);
    }

    function test_oracle_deviation_reverts() public {
        MockAggregatorV3 p = new MockAggregatorV3(18, int256(1e18));
        MockAggregatorV3 s = new MockAggregatorV3(18, int256(2e18));

        vault.setAssetOracleConfig(
            address(tokenA),
            DAOVault.AssetOracleConfig({
                primaryAggregator: address(p),
                secondaryAggregator: address(s),
                primaryHeartbeat: 86_400,
                secondaryHeartbeat: 86_400,
                minPrice1e18: 1e15,
                maxPrice1e18: 1e24,
                maxDeviationBps: 100
            })
        );

        vm.expectRevert(DAOVault.OracleDeviation.selector);
        vault.pricePerFullToken1e18(address(tokenA));
    }

    function test_manual_price_after_vote_windows() public {
        MockAggregatorV3 dead = new MockAggregatorV3(18, int256(1e18));
        dead.setLatest(int256(1e18), block.timestamp - 10_000);

        vault.setAssetOracleConfig(
            address(tokenA),
            DAOVault.AssetOracleConfig({
                primaryAggregator: address(dead),
                secondaryAggregator: address(0),
                primaryHeartbeat: 60,
                secondaryHeartbeat: 0,
                minPrice1e18: 1e15,
                maxPrice1e18: 1e24,
                maxDeviationBps: 0
            })
        );

        vault.setManualPrice(address(tokenA), 1e18, uint64(block.timestamp + 1 days));

        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        vm.stopPrank();
        assertGt(vault.balanceOf(alice), 0);
    }

    function test_non_governance_cannot_set_oracle() public {
        address bob = makeAddr("bob");
        vm.startPrank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, vault.GOVERNANCE_ROLE())
        );
        vault.setAssetOracleConfig(
            address(tokenA),
            DAOVault.AssetOracleConfig({
                primaryAggregator: address(0),
                secondaryAggregator: address(0),
                primaryHeartbeat: 0,
                secondaryHeartbeat: 0,
                minPrice1e18: 0,
                maxPrice1e18: 0,
                maxDeviationBps: 0
            })
        );
        vm.stopPrank();
    }

    function test_guardian_can_pause_but_not_unpause() public {
        vm.prank(guardian);
        vault.guardianPauseTrading();
        assertTrue(vault.pauseTrading());

        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, guardian, vault.GOVERNANCE_ROLE())
        );
        vm.startPrank(guardian);
        vault.setPause(false, false, false);
        vm.stopPrank();

        vault.setPause(false, false, false);
        assertFalse(vault.pauseTrading());
    }

    function test_non_governance_cannot_pause_or_set_executor() public {
        address bob = makeAddr("bob");
        vm.startPrank(bob);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, vault.GOVERNANCE_ROLE())
        );
        vault.setPause(true, true, true);
        vm.expectRevert(
            abi.encodeWithSelector(IAccessControl.AccessControlUnauthorizedAccount.selector, bob, vault.GOVERNANCE_ROLE())
        );
        vault.setExecutor(bob);
        vm.stopPrank();
    }

    function test_redeem_single_asset_no_swaps() public {
        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        uint256 shares = vault.balanceOf(alice);

        DAOVault.SwapStep[] memory steps = new DAOVault.SwapStep[](0);
        vault.redeemToSingleAsset(shares, address(tokenA), 100 ether - 1, steps);
        vm.stopPrank();

        assertEq(vault.balanceOf(alice), 0);
        assertEq(tokenA.balanceOf(alice), 1_000 ether);
    }

    function test_redeem_single_asset_with_swap() public {
        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        tokenB.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        vault.deposit(address(tokenB), 100 ether, alice);
        uint256 shares = vault.balanceOf(alice);

        uint256 sliceA = 100 ether;
        bytes memory data = abi.encodeCall(MockSwapRouter.swapExactIn, (address(tokenA), address(tokenB), sliceA, address(vault)));

        DAOVault.SwapStep[] memory steps = new DAOVault.SwapStep[](1);
        steps[0] = DAOVault.SwapStep({tokenIn: address(tokenA), router: address(router), data: data});

        uint256 bBefore = tokenB.balanceOf(alice);
        vault.redeemToSingleAsset(shares, address(tokenB), 200 ether - 1, steps);
        uint256 bAfter = tokenB.balanceOf(alice);

        assertEq(vault.balanceOf(alice), 0);
        assertEq(bAfter - bBefore, 200 ether);
        vm.stopPrank();
    }

    function test_pause_trading_blocks_rebalance_but_not_redeem() public {
        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        vm.stopPrank();

        vault.setPause(false, true, false);
        assertTrue(vault.pauseTrading());

        tokenA.mint(address(vault), 50 ether);
        DAOVault.SwapStep[] memory steps = new DAOVault.SwapStep[](0);
        vm.prank(address(0xBEEF));
        vm.expectRevert(DAOVault.Paused.selector);
        vault.rebalance(steps);

        vm.startPrank(alice);
        uint256 shares = vault.balanceOf(alice);
        vault.redeemToSingleAsset(shares, address(tokenA), 0, new DAOVault.SwapStep[](0));
        vm.stopPrank();
        assertEq(vault.balanceOf(alice), 0);
    }

    function test_rebalance_only_executor() public {
        tokenA.mint(address(vault), 50 ether);
        DAOVault.SwapStep[] memory steps = new DAOVault.SwapStep[](0);

        vm.expectRevert(DAOVault.NotExecutor.selector);
        vault.rebalance(steps);

        tokenB.mint(address(router), 50 ether);
        bytes memory data = abi.encodeCall(
            MockSwapRouter.swapExactIn, (address(tokenA), address(tokenB), 50 ether, address(vault))
        );
        steps = new DAOVault.SwapStep[](1);
        steps[0] = DAOVault.SwapStep({tokenIn: address(tokenA), router: address(router), data: data});

        vm.prank(address(0xBEEF));
        vault.rebalance(steps);

        assertEq(tokenA.balanceOf(address(vault)), 0);
        assertEq(tokenB.balanceOf(address(vault)), 50 ether);
    }

    function test_pause_all_blocks_redeem() public {
        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        vm.stopPrank();

        vault.setPause(true, false, false);

        vm.startPrank(alice);
        uint256 aliceShares = vault.balanceOf(alice);
        DAOVault.SwapStep[] memory steps;
        vm.expectRevert(DAOVault.Paused.selector);
        vault.redeemToSingleAsset(aliceShares, address(tokenA), 0, steps);
        vm.stopPrank();
    }

    function test_closeCycle_emits() public {
        vm.expectEmit(true, true, true, true);
        emit DAOVault.CycleClosed(1, 1e18, 2e18, block.timestamp);
        vault.closeCycle(1e18, 2e18);
    }

    function test_castAllocationBallot() public {
        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        // Both allowlisted tokens are ballot slots even if only A is in the vault
        uint256[] memory w = new uint256[](2);
        w[0] = 6000;
        w[1] = 4000;
        vault.castAllocationBallot(w);
        vm.stopPrank();
    }

    function test_castAllocationBallot_reverts_bad_sum() public {
        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        uint256[] memory w = new uint256[](2);
        w[0] = 5000;
        w[1] = 1000;
        vm.expectRevert(DAOVault.BadBallot.selector);
        vault.castAllocationBallot(w);
        vm.stopPrank();
    }

    function test_castAllocationBallot_reverts_no_shares() public {
        uint256[] memory w = new uint256[](2);
        w[0] = 5000;
        w[1] = 5000;
        vm.expectRevert(DAOVault.MinShares.selector);
        vm.prank(alice);
        vault.castAllocationBallot(w);
    }

    /// @dev one asset deposited; still vote across all allowlisted (ballot) assets
    function test_castAllocationBallot_one_deposit_two_ballot_slots() public {
        vm.startPrank(alice);
        tokenA.approve(address(vault), 100 ether);
        vault.deposit(address(tokenA), 100 ether, alice);
        assertEq(vault.trackedAssetsLength(), 1);
        assertEq(vault.ballotAssetsLength(), 2);
        uint256[] memory w = new uint256[](2);
        w[0] = 10_000;
        w[1] = 0;
        vault.castAllocationBallot(w);
        w[0] = 7000;
        w[1] = 3000;
        vault.castAllocationBallot(w);
        vm.stopPrank();
    }
}
