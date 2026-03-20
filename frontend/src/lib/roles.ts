import { keccak256, stringToBytes, type Hex } from "viem";

/** Matches `DAOVault.GOVERNANCE_ROLE` */
export const GOVERNANCE_ROLE: Hex = keccak256(stringToBytes("GOVERNANCE_ROLE"));

/** Matches `DAOVault.GUARDIAN_ROLE` */
export const GUARDIAN_ROLE: Hex = keccak256(stringToBytes("GUARDIAN_ROLE"));

/** OpenZeppelin `AccessControl.DEFAULT_ADMIN_ROLE` */
export const DEFAULT_ADMIN_ROLE: Hex =
  "0x0000000000000000000000000000000000000000000000000000000000000000";
