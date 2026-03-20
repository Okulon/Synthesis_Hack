import { createPublicClient, http } from "viem";
import { base, baseSepolia } from "viem/chains";

export function chainFromId(chainId: number) {
  if (chainId === 84532) return baseSepolia;
  if (chainId === 8453) return base;
  return baseSepolia;
}

export function explorerBase(chainId: number): string {
  if (chainId === 84532) return "https://sepolia.basescan.org";
  if (chainId === 8453) return "https://basescan.org";
  return "https://sepolia.basescan.org";
}

export function createVaultClient(rpcUrl: string, chainId: number) {
  const chain = chainFromId(chainId);
  return createPublicClient({
    chain,
    transport: http(rpcUrl, { timeout: 25_000 }),
  });
}
