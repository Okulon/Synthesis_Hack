// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "openzeppelin-contracts/token/ERC20/ERC20.sol";
import {ERC20Burnable} from "openzeppelin-contracts/token/ERC20/extensions/ERC20Burnable.sol";
import {IERC20Metadata} from "openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "openzeppelin-contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";
import {AccessControl} from "openzeppelin-contracts/access/AccessControl.sol";
import {ReentrancyGuard} from "openzeppelin-contracts/utils/ReentrancyGuard.sol";
import {Math} from "openzeppelin-contracts/utils/math/Math.sol";
import {IAggregatorV3} from "./interfaces/IAggregatorV3.sol";

/// @title DAOVault
/// @notice Multi-asset pooled vault (share ERC-20). NAV uses governance-approved Chainlink-style feeds (+ optional cross-check / fallback), manual override with expiry, or legacy fixed price.
/// @dev Parameter changes (`GOVERNANCE_ROLE`) → timelock after **share-weighted votes**. **`GUARDIAN_ROLE`** may only **escalate** pauses (never clear them). Unpause only via governance `setPause`. The bot `executor` only `rebalance`s.
contract DAOVault is ERC20, ERC20Burnable, AccessControl, ReentrancyGuard {
    using SafeERC20 for IERC20;

    bytes32 public constant GOVERNANCE_ROLE = keccak256("GOVERNANCE_ROLE");
    bytes32 public constant GUARDIAN_ROLE = keccak256("GUARDIAN_ROLE");

    uint8 internal constant DECIMALS_OFFSET = 3;

    struct SwapStep {
        address tokenIn;
        address router;
        bytes data;
    }

    struct AssetOracleConfig {
        address primaryAggregator;
        address secondaryAggregator;
        uint32 primaryHeartbeat;
        uint32 secondaryHeartbeat;
        uint256 minPrice1e18;
        uint256 maxPrice1e18;
        /// @dev If both feeds return a price, revert when relative diff exceeds this (basis points). 0 = skip cross-check.
        uint16 maxDeviationBps;
    }

    struct ManualPrice {
        uint256 price1e18;
        uint64 expiresAt;
    }

    address public executor;

    bool public pauseAll;
    bool public pauseTrading;
    bool public pauseDeposits;

    mapping(address => bool) public isAssetAllowed;
    mapping(address => bool) public isRouterAllowed;
    /// @notice Deprecated path: fixed NAV unit per full token when no oracle is configured. Prefer `assetOracleConfig` + feeds. Governed.
    mapping(address => uint256) public navPricePerFullToken1e18;

    mapping(address => AssetOracleConfig) public assetOracleConfig;
    mapping(address => ManualPrice) public manualPrice;

    address[] public trackedAssets;
    mapping(address => bool) public isTrackedAsset;

    /// @notice Allocation ballots use this order: assets governance has allowlisted (`setAssetAllowed`), independent of vault balances.
    address[] public ballotAssets;
    mapping(address => bool) public isBallotAssetListed;

    uint256 public cycleId;

    event Deposit(address indexed caller, address indexed receiver, address indexed asset, uint256 amount, uint256 shares);
    event RedeemSingle(
        address indexed user, address indexed assetOut, uint256 shares, uint256 amountOut, uint256 minAmountOut
    );
    event Rebalance(address indexed executor, uint256 steps);
    event CycleClosed(uint256 indexed cycleId, uint256 navStart, uint256 navEnd, uint256 timestamp);
    event ExecutorUpdated(address indexed previousExecutor, address indexed newExecutor);
    event AssetAllowed(address indexed asset, bool allowed);
    event RouterAllowed(address indexed router, bool allowed);
    event NavPriceUpdated(address indexed asset, uint256 price1e18);
    event AssetOracleConfigUpdated(address indexed asset, AssetOracleConfig config);
    event ManualPriceUpdated(address indexed asset, uint256 price1e18, uint64 expiresAt);
    event ManualPriceCleared(address indexed asset);
    event PauseUpdated(bool pauseAll, bool pauseTrading, bool pauseDeposits);
    event GuardianPause(address indexed guardian, string kind);

    /// @notice On-chain allocation ballot for the current `cycleId`. `weightsBps[i]` aligns with `ballotAssets[i]` (allowlisted assets); must sum to 10_000 (100.00%). Latest log per voter wins off-chain.
    event AllocationBallotCast(address indexed voter, uint256 indexed cycleId, uint256[] weightsBps);

    error ZeroAddress();
    error AssetNotAllowed();
    error RouterNotAllowed();
    error ZeroAmount();
    error MinShares();
    error MinOut();
    error IncompleteRedeem();
    error BadStep();
    error Paused();
    error NotExecutor();
    error OracleUnavailable();
    error OracleDeviation();
    error BadBallot();

    /// @param governance Timelock after votes — `GOVERNANCE_ROLE` + `DEFAULT_ADMIN_ROLE` (can grant `GUARDIAN_ROLE`).
    /// @param guardian Optional multisig / committee for **emergency pause only** (`address(0)` to add guardians later via governance).
    constructor(address governance, address guardian, string memory name_, string memory symbol_) ERC20(name_, symbol_) {
        if (governance == address(0)) revert ZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, governance);
        _grantRole(GOVERNANCE_ROLE, governance);
        if (guardian != address(0)) {
            _grantRole(GUARDIAN_ROLE, guardian);
        }
    }

    function decimals() public pure override returns (uint8) {
        return 18;
    }

    modifier whenDepositOpen() {
        if (pauseAll || pauseDeposits) revert Paused();
        _;
    }

    modifier whenRedeemOpen() {
        if (pauseAll) revert Paused();
        _;
    }

    modifier onlyExecutor() {
        if (msg.sender != executor) revert NotExecutor();
        _;
    }

    modifier whenTradingOpen() {
        if (pauseAll || pauseTrading) revert Paused();
        _;
    }

    // --- Governance (vote → timelock should hold this role in production) ---

    function setAssetOracleConfig(address asset, AssetOracleConfig calldata cfg) external onlyRole(GOVERNANCE_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        assetOracleConfig[asset] = cfg;
        emit AssetOracleConfigUpdated(asset, cfg);
    }

    /// @notice Temporary USD-1e18 price per full token when feeds are dead; requires governance vote to set. Expires automatically.
    function setManualPrice(address asset, uint256 price1e18, uint64 expiresAt) external onlyRole(GOVERNANCE_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        manualPrice[asset] = ManualPrice({price1e18: price1e18, expiresAt: expiresAt});
        emit ManualPriceUpdated(asset, price1e18, expiresAt);
    }

    function clearManualPrice(address asset) external onlyRole(GOVERNANCE_ROLE) {
        delete manualPrice[asset];
        emit ManualPriceCleared(asset);
    }

    function setNavPrice(address asset, uint256 price1e18) external onlyRole(GOVERNANCE_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        navPricePerFullToken1e18[asset] = price1e18;
        emit NavPriceUpdated(asset, price1e18);
    }

    function setAssetAllowed(address asset, bool allowed) external onlyRole(GOVERNANCE_ROLE) {
        if (asset == address(0)) revert ZeroAddress();
        isAssetAllowed[asset] = allowed;
        emit AssetAllowed(asset, allowed);
        if (allowed) _addBallotAsset(asset);
        else _removeBallotAsset(asset);
    }

    function setRouterAllowed(address router, bool allowed) external onlyRole(GOVERNANCE_ROLE) {
        if (router == address(0)) revert ZeroAddress();
        isRouterAllowed[router] = allowed;
        emit RouterAllowed(router, allowed);
    }

    // --- Governance: executor, pause, cycle (same vote path as oracles / allowlists) ---

    function setExecutor(address newExecutor) external onlyRole(GOVERNANCE_ROLE) {
        if (newExecutor == address(0)) revert ZeroAddress();
        emit ExecutorUpdated(executor, newExecutor);
        executor = newExecutor;
    }

    /// @notice Full pause control including **unpause** — governance / timelock only (after votes).
    function setPause(bool all_, bool trading_, bool deposits_) external onlyRole(GOVERNANCE_ROLE) {
        pauseAll = all_;
        pauseTrading = trading_;
        pauseDeposits = deposits_;
        emit PauseUpdated(all_, trading_, deposits_);
    }

    /// @notice One-way: guardians can only **turn on** pause flags (cannot unpause).
    function guardianPauseTrading() external onlyRole(GUARDIAN_ROLE) {
        pauseTrading = true;
        emit PauseUpdated(pauseAll, pauseTrading, pauseDeposits);
        emit GuardianPause(msg.sender, "trading");
    }

    function guardianPauseDeposits() external onlyRole(GUARDIAN_ROLE) {
        pauseDeposits = true;
        emit PauseUpdated(pauseAll, pauseTrading, pauseDeposits);
        emit GuardianPause(msg.sender, "deposits");
    }

    /// @notice Nuclear: blocks rebalances, deposits, **and** redemptions (see modifiers).
    function guardianPauseAll() external onlyRole(GUARDIAN_ROLE) {
        pauseAll = true;
        pauseTrading = true;
        pauseDeposits = true;
        emit PauseUpdated(pauseAll, pauseTrading, pauseDeposits);
        emit GuardianPause(msg.sender, "all");
    }

    function closeCycle(uint256 navStart, uint256 navEnd) external onlyRole(GOVERNANCE_ROLE) {
        cycleId += 1;
        emit CycleClosed(cycleId, navStart, navEnd, block.timestamp);
    }

    /// @notice Record an allocation ballot for the current `cycleId`. UI/indexers should use the latest `AllocationBallotCast` per voter per cycle.
    function castAllocationBallot(uint256[] calldata weightsBps) external nonReentrant {
        if (pauseAll) revert Paused();
        if (balanceOf(msg.sender) == 0) revert MinShares();
        uint256 n = ballotAssets.length;
        if (n == 0) revert BadBallot();
        if (weightsBps.length != n) revert BadBallot();
        uint256 sum;
        for (uint256 i; i < n; ++i) {
            if (!isAssetAllowed[ballotAssets[i]]) revert BadBallot();
            sum += weightsBps[i];
        }
        if (sum != 10_000) revert BadBallot();
        emit AllocationBallotCast(msg.sender, cycleId, weightsBps);
    }

    // --- Views ---

    function ballotAssetsLength() external view returns (uint256) {
        return ballotAssets.length;
    }

    function trackedAssetsLength() external view returns (uint256) {
        return trackedAssets.length;
    }

    /// @notice Price of one full token (`10**decimals` units) in NAV 1e18 units (interpret as USD scale for product/docs).
    function pricePerFullToken1e18(address asset) public view returns (uint256) {
        ManualPrice memory m = manualPrice[asset];
        if (m.price1e18 != 0 && m.expiresAt != 0 && block.timestamp <= m.expiresAt) {
            return m.price1e18;
        }

        AssetOracleConfig memory c = assetOracleConfig[asset];
        uint256 pPrimary = _tryReadAggregator(c.primaryAggregator, c.primaryHeartbeat, c.minPrice1e18, c.maxPrice1e18);
        uint256 pSecondary =
            _tryReadAggregator(c.secondaryAggregator, c.secondaryHeartbeat, c.minPrice1e18, c.maxPrice1e18);

        if (pPrimary != 0 && pSecondary != 0 && c.maxDeviationBps != 0) {
            uint256 hi = Math.max(pPrimary, pSecondary);
            uint256 lo = Math.min(pPrimary, pSecondary);
            if ((hi - lo) * 10_000 > uint256(c.maxDeviationBps) * hi) revert OracleDeviation();
        }

        if (pPrimary != 0) return pPrimary;
        if (pSecondary != 0) return pSecondary;

        return navPricePerFullToken1e18[asset];
    }

    function _tryReadAggregator(address agg, uint32 heartbeat, uint256 minP, uint256 maxP)
        internal
        view
        returns (uint256 price1e18)
    {
        if (agg == address(0)) return 0;
        if (heartbeat == 0) return 0;

        try IAggregatorV3(agg).latestRoundData() returns (
            uint80, int256 answer, uint256, uint256 updatedAt, uint80
        ) {
            if (answer <= 0) return 0;
            if (block.timestamp > updatedAt && block.timestamp - updatedAt > heartbeat) return 0;

            uint8 d = IAggregatorV3(agg).decimals();
            uint256 a = uint256(answer);
            if (d <= 18) {
                price1e18 = a * (10 ** uint256(18 - uint256(d)));
            } else {
                price1e18 = a / (10 ** uint256(uint256(d) - 18));
            }

            if (price1e18 < minP || price1e18 > maxP) return 0;
        } catch {
            return 0;
        }
    }

    function _rawNAV() internal view returns (uint256 sum1e18) {
        uint256 n = trackedAssets.length;
        for (uint256 i; i < n; ++i) {
            address asset = trackedAssets[i];
            uint256 bal = IERC20(asset).balanceOf(address(this));
            if (bal == 0) continue;
            sum1e18 += _valueOf(asset, bal);
        }
    }

    function totalNAV() external view returns (uint256) {
        return _rawNAV();
    }

    function _valueOf(address asset, uint256 amount) internal view returns (uint256) {
        uint256 price = pricePerFullToken1e18(asset);
        if (price == 0) return 0;
        uint256 dec = IERC20Metadata(asset).decimals();
        return Math.mulDiv(amount, price, 10 ** dec, Math.Rounding.Floor);
    }

    function _convertToShares(uint256 valueIn, uint256 navBefore) internal view returns (uint256) {
        uint256 supply = totalSupply();
        if (supply == 0) {
            return Math.mulDiv(valueIn, 10 ** DECIMALS_OFFSET, 1, Math.Rounding.Floor);
        }
        return Math.mulDiv(valueIn, supply + 10 ** DECIMALS_OFFSET, navBefore + 1, Math.Rounding.Floor);
    }

    function _track(address asset) internal {
        if (!isTrackedAsset[asset]) {
            isTrackedAsset[asset] = true;
            trackedAssets.push(asset);
        }
    }

    function _addBallotAsset(address asset) internal {
        if (!isBallotAssetListed[asset]) {
            isBallotAssetListed[asset] = true;
            ballotAssets.push(asset);
        }
    }

    function _removeBallotAsset(address asset) internal {
        if (!isBallotAssetListed[asset]) return;
        isBallotAssetListed[asset] = false;
        uint256 n = ballotAssets.length;
        for (uint256 i; i < n; ++i) {
            if (ballotAssets[i] == asset) {
                ballotAssets[i] = ballotAssets[n - 1];
                ballotAssets.pop();
                return;
            }
        }
    }

    // --- User: deposit ---

    function deposit(address asset, uint256 amount, address receiver) external nonReentrant whenDepositOpen {
        if (!isAssetAllowed[asset]) revert AssetNotAllowed();
        if (amount == 0) revert ZeroAmount();

        uint256 price = pricePerFullToken1e18(asset);
        if (price == 0) revert OracleUnavailable();

        uint256 valueIn = _valueOf(asset, amount);
        if (valueIn == 0) revert ZeroAmount();

        IERC20(asset).safeTransferFrom(msg.sender, address(this), amount);
        _track(asset);

        uint256 navTotal = _rawNAV();
        uint256 navBefore = navTotal - valueIn;
        uint256 shares = _convertToShares(valueIn, navBefore);
        if (shares == 0) revert MinShares();

        _mint(receiver, shares);
        emit Deposit(msg.sender, receiver, asset, amount, shares);
    }

    // --- User: redeem (unchanged logic) ---

    function redeemToSingleAsset(uint256 shares, address assetOut, uint256 minAmountOut, SwapStep[] calldata steps)
        external
        nonReentrant
        whenRedeemOpen
    {
        if (shares == 0) revert ZeroAmount();
        if (!isAssetAllowed[assetOut]) revert AssetNotAllowed();
        uint256 supplyBefore = totalSupply();
        if (supplyBefore == 0) revert ZeroAmount();

        uint256 n = trackedAssets.length;
        uint256[] memory rem = new uint256[](n);
        for (uint256 i; i < n; ++i) {
            address a = trackedAssets[i];
            uint256 bal = IERC20(a).balanceOf(address(this));
            rem[i] = bal == 0 ? 0 : Math.mulDiv(bal, shares, supplyBefore, Math.Rounding.Floor);
        }

        uint256 outIdx = type(uint256).max;
        for (uint256 i; i < n; ++i) {
            if (trackedAssets[i] == assetOut) {
                outIdx = i;
                break;
            }
        }
        if (outIdx == type(uint256).max) revert AssetNotAllowed();

        uint256 outStart = IERC20(assetOut).balanceOf(address(this));
        uint256 sOut = rem[outIdx];

        _burn(msg.sender, shares);

        for (uint256 j; j < steps.length; ++j) {
            SwapStep calldata s = steps[j];
            if (!isRouterAllowed[s.router]) revert RouterNotAllowed();
            if (!isAssetAllowed[s.tokenIn]) revert AssetNotAllowed();

            uint256 idxIn = type(uint256).max;
            for (uint256 i; i < n; ++i) {
                if (trackedAssets[i] == s.tokenIn) {
                    idxIn = i;
                    break;
                }
            }
            if (idxIn == type(uint256).max) revert BadStep();

            uint256 budget = rem[idxIn];
            if (budget == 0) revert BadStep();

            IERC20(s.tokenIn).forceApprove(s.router, budget);
            uint256 beforeIn = IERC20(s.tokenIn).balanceOf(address(this));
            (bool ok,) = s.router.call(s.data);
            if (!ok) revert BadStep();
            IERC20(s.tokenIn).forceApprove(s.router, 0);

            uint256 afterIn = IERC20(s.tokenIn).balanceOf(address(this));
            uint256 used = beforeIn - afterIn;
            if (used > budget) revert BadStep();
            rem[idxIn] = budget - used;
        }

        for (uint256 i; i < n; ++i) {
            if (i == outIdx) continue;
            if (rem[i] != 0) revert IncompleteRedeem();
        }

        uint256 O2 = IERC20(assetOut).balanceOf(address(this));
        if (O2 < outStart - sOut) revert MinOut();
        uint256 userGets = O2 - (outStart - sOut);
        if (userGets < minAmountOut) revert MinOut();

        IERC20(assetOut).safeTransfer(msg.sender, userGets);

        emit RedeemSingle(msg.sender, assetOut, shares, userGets, minAmountOut);
    }

    function redeemProRata(uint256 shares, address[] calldata assetsHint) external nonReentrant whenRedeemOpen {
        if (shares == 0) revert ZeroAmount();
        uint256 supplyBefore = totalSupply();
        if (supplyBefore == 0) revert ZeroAmount();
        uint256 n = assetsHint.length;
        if (n != trackedAssets.length) revert BadStep();
        for (uint256 i; i < n; ++i) {
            if (assetsHint[i] != trackedAssets[i]) revert BadStep();
        }

        _burn(msg.sender, shares);

        for (uint256 i; i < n; ++i) {
            address a = trackedAssets[i];
            uint256 bal = IERC20(a).balanceOf(address(this));
            if (bal == 0) continue;
            uint256 slice = Math.mulDiv(bal, shares, supplyBefore, Math.Rounding.Floor);
            if (slice > 0) IERC20(a).safeTransfer(msg.sender, slice);
        }
    }

    // --- Executor ---

    function rebalance(SwapStep[] calldata steps) external nonReentrant onlyExecutor whenTradingOpen {
        uint256 n = steps.length;
        for (uint256 j; j < n; ++j) {
            SwapStep calldata s = steps[j];
            if (!isRouterAllowed[s.router]) revert RouterNotAllowed();
            if (!isAssetAllowed[s.tokenIn]) revert AssetNotAllowed();
            uint256 beforeIn = IERC20(s.tokenIn).balanceOf(address(this));
            IERC20(s.tokenIn).forceApprove(s.router, beforeIn);
            (bool ok,) = s.router.call(s.data);
            if (!ok) revert BadStep();
            IERC20(s.tokenIn).forceApprove(s.router, 0);
        }
        emit Rebalance(msg.sender, n);
    }
}
