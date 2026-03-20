/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID: string;
  readonly VITE_RPC_URL: string;
  readonly VITE_VAULT_ADDRESS: string;
  /** Optional: block to scan RoleGranted/Revoked from (smaller range = faster on some RPCs) */
  readonly VITE_ROLE_LOGS_FROM_BLOCK: string;
  /** Optional: block to scan holder Transfer logs from */
  readonly VITE_HOLDER_LOGS_FROM_BLOCK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
