import { http, createConfig } from "wagmi";
import { baseSepolia } from "wagmi/chains";
import { injected } from "wagmi/connectors";

const rpc = (import.meta.env.VITE_RPC_URL as string | undefined)?.trim();

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  /** Rabby / MetaMask / etc. — whoever owns `window.ethereum` */
  connectors: [injected()],
  transports: {
    [baseSepolia.id]: http(rpc || undefined),
  },
});
