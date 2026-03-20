import { parseAbi } from "viem";

export const daovaultAbi = parseAbi([
  "error Paused()",
  "error MinShares()",
  "error BadBallot()",
  "error ReentrancyGuardReentrantCall()",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function totalSupply() view returns (uint256)",
  "function totalNAV() view returns (uint256)",
  "function cycleId() view returns (uint256)",
  "function executor() view returns (address)",
  "function pauseAll() view returns (bool)",
  "function pauseTrading() view returns (bool)",
  "function pauseDeposits() view returns (bool)",
  "function trackedAssetsLength() view returns (uint256)",
  "function trackedAssets(uint256) view returns (address)",
  "function ballotAssetsLength() view returns (uint256)",
  "function ballotAssets(uint256) view returns (address)",
  "function balanceOf(address account) view returns (uint256)",
  "function pricePerFullToken1e18(address) view returns (uint256)",
  "function isAssetAllowed(address) view returns (bool)",
  "function assetOracleConfig(address asset) view returns (address primaryAggregator, address secondaryAggregator, uint32 primaryHeartbeat, uint32 secondaryHeartbeat, uint256 minPrice1e18, uint256 maxPrice1e18, uint16 maxDeviationBps)",
  "function manualPrice(address asset) view returns (uint256 price1e18, uint64 expiresAt)",
  "function navPricePerFullToken1e18(address) view returns (uint256)",
  "function deposit(address asset, uint256 amount, address receiver)",
  "function castAllocationBallot(uint256[] weightsBps)",
  "event AllocationBallotCast(address indexed voter, uint256 indexed cycleId, uint256[] weightsBps)",
]);

export const erc20Abi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function name() view returns (string)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
]);

/** Canonical WETH9 — wrap native ETH before vault `deposit`. */
export const weth9Abi = parseAbi(["function deposit() payable"]);
