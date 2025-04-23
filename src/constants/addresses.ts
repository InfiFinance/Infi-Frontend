/**
 * Contract addresses for p-Dex protocol
 * These addresses are used to interact with the core protocol contracts
 */

interface ContractAddresses {
  factory: string;
  weth9: string;
  swapRouter: string;
  nftDescriptor: string;
  tokenDescriptor: string;
  positionManager: string;
  nonfungiblePositionManager: string;
}

// Chain configuration
export const CHAIN_CONFIG = {
  id: 50002,
  name: "Pharos",
  rpcUrl: "https://devnet.dplabs-internal.com/",
  nativeCurrency: {
    name: "PHA",
    symbol: "PHA",
    decimals: 18
  }
};

// Main contract addresses
export const ADDRESSES: ContractAddresses = {
  factory: "0x5f37a6Ea51351BBBED8bD7Ed78EBa923B8D60897",
  weth9: "0xe356046C34B8e989E6a311FE6478E2736937699D",
  swapRouter: "0x11F22a8a07215d1691175A67cDf6630E874Bb17b",
  nftDescriptor: "0x217755D961eAcD4f5dEcd922d8F3e3dFbe053E19",
  tokenDescriptor: "0xBa42231Bd6C12547dFe82dBA830B49581305fedD",
  positionManager: "0xA5ae22A0364c461Ee83868F12fc09616295925aA",
  nonfungiblePositionManager: "0xA5ae22A0364c461Ee83868F12fc09616295925aA"
};

// Fee levels used by the protocol
export const FEE_AMOUNTS = {
  LOWEST: 100,    // 0.01%
  LOW: 500,       // 0.05%
  MEDIUM: 3000,   // 0.3%
  HIGH: 10000     // 1%
};

// Fee level to human-readable strings
export const FEE_AMOUNT_LABELS: Record<number, string> = {
  [FEE_AMOUNTS.LOWEST]: '0.01%',
  [FEE_AMOUNTS.LOW]: '0.05%',
  [FEE_AMOUNTS.MEDIUM]: '0.3%',
  [FEE_AMOUNTS.HIGH]: '1%'
};

// Only support Pharos chain
export const SUPPORTED_CHAIN_IDS = [CHAIN_CONFIG.id]; 