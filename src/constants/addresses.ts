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
  id: 688688,
  name: "Pharos Testnet",
  rpcUrl: "https://testnet.dplabs-internal.com/",
  nativeCurrency: {
    name: "PHAROS",
    symbol: "PHRS",
    decimals: 18
  }
};

// Main contract addresses
export const ADDRESSES: ContractAddresses = {
  factory: "0xC429540d5358C24629179dF500a7d41C505896E8",
  weth9: "0xe356046C34B8e989E6a311FE6478E2736937699D",
  swapRouter: "0x59F222b758D16BabfCBcA2422882ee5ca688d9Aa",
  nftDescriptor: "0x73cD380BC0BD80c3283Aced25fcC8E0d00214787",
  tokenDescriptor: "0x89A38445249d083EFfB576574c7cD9dB4d5c25Af", 
  positionManager: "0xb03B98eb3446Cdc9EE83633522e946bA55742F88",
  nonfungiblePositionManager: "0xb03B98eb3446Cdc9EE83633522e946bA55742F88"
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