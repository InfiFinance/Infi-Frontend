import { ethers } from 'ethers';
import ERC20ABI from '../contract/abis/ERC20ABI.json';

// Define Token class locally to avoid dependency on @uniswap/sdk-core
export class Token {
  public readonly chainId: number;
  public readonly address: string;
  public readonly decimals: number;
  public readonly symbol: string;
  public readonly name: string;
  public readonly logoURI?: string;

  constructor(
    chainId: number,
    address: string,
    decimals: number,
    symbol: string,
    name: string,
    logoURI?: string
  ) {
    this.chainId = chainId;
    this.address = address;
    this.decimals = decimals;
    this.symbol = symbol;
    this.name = name;
    this.logoURI = logoURI;
  }
}

// Token list interface matching Token Standard
export interface TokenInfo {
  chainId: number;
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
}

export interface TokenList {
  name: string;
  tokens: TokenInfo[];
}

// Cache for token information to avoid repeated RPC calls
const TOKEN_CACHE: Record<string, TokenInfo> = {};

// Local storage keys
const RECENT_TOKENS_KEY = 'recent_tokens';

// Mock default token list
export const DEFAULT_TOKEN_LIST = {
  name: 'Default Token List',
  tokens: [
    {
      chainId: 688688,
      address: "0x9C102a3953f7605bd59e02A9FEF515523058dE00", // Existing GOCTO
      name: "GOCTO",
      symbol: "GOCTO",
      decimals: 18,
      // logoURI: "/tokens/gocto.png"
    },
    {
      chainId: 688688,
      address: "0xc4D6fC137A14CAEd1e51D9D83f9606c72a32dD30", // Existing INFI
      name: "INFI",
      symbol: "INFI",
      decimals: 18,
      // logoURI: "/tokens/infi.png"
    },
    {
      chainId: 688688,
      address: ethers.ZeroAddress, // PHRS Native Token
      name: "Pharos",
      symbol: "PHRS",
      decimals: 18,
      // logoURI: "/tokens/phrs.png"
    },
    {
      chainId: 688688,
      address: "0xAD902CF99C2dE2f1Ba5ec4D642Fd7E49cae9EE37", // CRITICAL: Replace with actual USDC address for chainId 688688
      name: "USD Coin",
      symbol: "USDC",
      decimals: 18,
      // logoURI: "/tokens/usdc.png"
    },
    {
      chainId: 688688,
      address: "0xEd59De2D7ad9C043442e381231eE3646FC3C2939", // CRITICAL: Replace with actual USDT address for chainId 688688
      name: "Tether USD",
      symbol: "USDT",
      decimals: 18,
      // logoURI: "/tokens/usdt.png"
    },
    {
      chainId: 688688,
      address: "0x76aaaDA469D23216bE5f7C596fA25F282Ff9b364", // CRITICAL: Replace with actual WPHRS address for chainId 688688
      name: "Wrapped Pharos",
      symbol: "WPHRS",
      decimals: 18,
      // logoURI: "/tokens/wphrs.png"
    },
    // {
    //   chainId: 688688,
    //   address: "0x9A741857be48C5069c7294f7c4232Ed0DD46E6Ce", // CRITICAL: Replace with actual OCTO address for chainId 688688
    //   name: "Octopus Token",
    //   symbol: "OCTO",
    //   decimals: 18,
    //   // logoURI: "/tokens/octo.png"
    // },
    // {
    //   chainId: 688688,
    //   address: "0xF74903096433b0a948848d79E7c835402897e4e8", // CRITICAL: Replace with actual SAILOR address for chainId 688688
    //   name: "Sailor Token",
    //   symbol: "SAILOR",
    //   decimals: 18,
    //   // logoURI: "/tokens/sailor.png"
    // }
  ]
};

// Faucet-specific token list
const faucetTokenSymbols = ["GOCTO", "INFI", "PHRS"];
export const FAUCET_PAGE_TOKEN_LIST: TokenList = {
  name: 'Faucet Page Token List',
  tokens: DEFAULT_TOKEN_LIST.tokens.filter(token => 
    token.chainId === 688688 && faucetTokenSymbols.includes(token.symbol)
  )
};

// Popular token addresses that we want to prioritize in search results


/**
 * Fetches token info from a token address using the ERC20 interface
 */
export async function fetchTokenInfo(tokenAddress: string, chainId: number, provider: ethers.Provider): Promise<TokenInfo | null> {
  if (!ethers.isAddress(tokenAddress)) {
    console.error(`Invalid address: ${tokenAddress}`);
    return null;
  }

  // Normalize the address
  const normalizedAddress = tokenAddress.toLowerCase();
  
  // Check cache first
  const cacheKey = `${chainId}:${normalizedAddress}`;
  if (TOKEN_CACHE[cacheKey]) {
    console.log(`Cache hit for ${normalizedAddress}`);
    return TOKEN_CACHE[cacheKey];
  }

  try {
    console.log(`Fetching token info for ${normalizedAddress} on chain ${chainId}`);
    const tokenContract = new ethers.Contract(tokenAddress, ERC20ABI, provider);
    
    // Check if the contract exists and has code at the address
    const code = await provider.getCode(tokenAddress);
    if (code === '0x' || code === '') {
      console.error(`No contract found at address ${tokenAddress}`);
      return null;
    }
    
    // Check if contract has basic ERC20 methods
    let isERC20 = false;
    try {
      // Try to call balanceOf to check if it's an ERC20
      await tokenContract.balanceOf(ethers.ZeroAddress);
      isERC20 = true;
    } catch (error) {
      console.warn(`Contract at ${tokenAddress} doesn't have balanceOf method, might not be an ERC20`);
    }
    
    if (!isERC20) {
      try {
        // Try transfer method as a backup check
        const transferFn = tokenContract.interface.getFunction('transfer');
        isERC20 = !!transferFn;
      } catch (error) {
        console.warn(`Contract at ${tokenAddress} doesn't have transfer method either`);
      }
    }
    
    if (!isERC20) {
      console.error(`Contract at ${tokenAddress} doesn't appear to implement ERC20 interface`);
      return null;
    }
    
    // Wrap each call in a try-catch to handle individual failures
    let name = 'Unknown Token';
    let symbol = 'UNKNOWN';
    let decimals = 18;
    
    try {
      name = await tokenContract.name();
    } catch (error) {
      console.warn(`Error or no name() method for ${tokenAddress}, using "Unknown Token"`);
    }
    
    try {
      symbol = await tokenContract.symbol();
    } catch (error) {
      console.warn(`Error or no symbol() method for ${tokenAddress}, using "UNKNOWN"`);
    }
    
    try {
      decimals = await tokenContract.decimals();
    } catch (error) {
      console.warn(`Error or no decimals() method for ${tokenAddress}, using 18`);
    }
    
    // Create token info - we now accept tokens with unknown name/symbol
    const tokenInfo: TokenInfo = {
      chainId,
      address: normalizedAddress,
      name,
      symbol,
      decimals,
      // No logo URL by default for custom tokens
    };

    console.log(`Found token: ${symbol} (${name}) - note: name/symbol may be defaults if not provided by contract`);
    
    // Cache the result
    TOKEN_CACHE[cacheKey] = tokenInfo;
    return tokenInfo;
  } catch (error) {
    console.error(`Error fetching info for token at ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Searches for tokens in our token lists and on-chain
 */
export async function searchTokens(
  query: string,
  chainId: number,
  provider: ethers.Provider
): Promise<TokenInfo[]> {
  const results: TokenInfo[] = [];
  const lowercaseQuery = query.toLowerCase().trim();
  
  console.log(`Searching for tokens matching "${query}" on chain ${chainId}`);

  // First check if the query is a valid address
  if (ethers.isAddress(query)) {
    console.log(`Query is a valid address: ${query}`);
    
    try {
      // Check if there's code at this address
      const code = await provider.getCode(query);
      if (code === '0x' || code === '') {
        console.warn(`No contract found at address ${query}`);
      } else {
        console.log(`Contract exists at ${query}, attempting to fetch token info`);
        const onChainToken = await fetchTokenInfo(query, chainId, provider);
        
        if (onChainToken) {
          console.log(`Found on-chain token: ${onChainToken.symbol}`);
          results.push(onChainToken);
          return results; // If we found exact address match, just return it
        } else {
          console.warn(`Contract exists at ${query} but doesn't appear to be a valid ERC20 token`);
        }
      }
    } catch (error) {
      console.error(`Error checking contract at ${query}:`, error);
    }
  }

  // Search default token list
  console.log(`Searching for token in default list with ${DEFAULT_TOKEN_LIST.tokens.length} tokens`);
  const defaultTokenMatches = DEFAULT_TOKEN_LIST.tokens
    .filter(token => 
      token.chainId === chainId && (
        token.symbol.toLowerCase().includes(lowercaseQuery) ||
        token.name.toLowerCase().includes(lowercaseQuery) ||
        token.address.toLowerCase() === lowercaseQuery
      )
    );
  
  if (defaultTokenMatches.length > 0) {
    console.log(`Found ${defaultTokenMatches.length} matches in default token list:`, 
      defaultTokenMatches.map(t => `${t.symbol} (${t.address})`));
    results.push(...defaultTokenMatches);
  } else {
    console.log(`No matches found in default token list`);
  }
  
  // If we have no results and the query is longer than 2 characters, try to find by address prefix
  if (results.length === 0 && lowercaseQuery.length >= 2 && !lowercaseQuery.startsWith('0x')) {
    // This is a more advanced implementation that would be in a production app
    // It would query a token subgraph or API for tokens that match the query
    console.log(`No matches found, would query a token API/subgraph in production`);
  }
  
  // Sort results with popular tokens first
  const sortedResults = results.sort((a, b) => {
    // const aIsPopular = POPULAR_TOKEN_ADDRESSES.includes(a.address.toLowerCase());
    // const bIsPopular = POPULAR_TOKEN_ADDRESSES.includes(b.address.toLowerCase());
    
    // if (aIsPopular && !bIsPopular) return -1;
    // if (!aIsPopular && bIsPopular) return 1;
    
    // Otherwise sort alphabetically by symbol
    return a.symbol.localeCompare(b.symbol);
  });
  
  console.log(`Returning ${sortedResults.length} search results`);
  return sortedResults;
}

/**
 * Attempt to look up any token by address, even if it's not in any list
 * This is essential for finding arbitrary tokens on-chain
 */
export async function lookupTokenByAddress(
  address: string,
  chainId: number,
  provider: ethers.Provider
): Promise<TokenInfo | null> {
  if (!ethers.isAddress(address)) {
    console.error(`Invalid address: ${address}`);
    return null;
  }
  
  // Try to find it in the default list first (faster)
  const defaultToken = DEFAULT_TOKEN_LIST.tokens.find(
    token => token.chainId === chainId && token.address.toLowerCase() === address.toLowerCase()
  );
  
  if (defaultToken) {
    return defaultToken;
  }
  
  // If not found, look it up on-chain
  return await fetchTokenInfo(address, chainId, provider);
}

/**
 * Converts a TokenInfo to a Token from @uniswap/sdk-core
 */
export function tokenInfoToToken(tokenInfo: TokenInfo): Token {
  return new Token(
    tokenInfo.chainId,
    tokenInfo.address,
    tokenInfo.decimals,
    tokenInfo.symbol,
    tokenInfo.name,
    tokenInfo.logoURI
  );
}

/**
 * Get recently used tokens from local storage
 */
export function getRecentTokens(chainId: number): TokenInfo[] {
  if (typeof window === 'undefined') return [];
  
  try {
    const storedTokens = localStorage.getItem(RECENT_TOKENS_KEY);
    if (!storedTokens) return [];
    
    const tokens: TokenInfo[] = JSON.parse(storedTokens);
    return tokens.filter(token => token.chainId === chainId);
  } catch (error) {
    console.error('Error getting recent tokens:', error);
    return [];
  }
}

/**
 * Add a token to the recent tokens list
 */
export function addToRecentTokens(token: TokenInfo): void {
  if (typeof window === 'undefined') return;
  
  try {
    const storedTokens = localStorage.getItem(RECENT_TOKENS_KEY);
    let tokens: TokenInfo[] = storedTokens ? JSON.parse(storedTokens) : [];
    
    // Remove existing entry if present
    tokens = tokens.filter(t => 
      !(t.chainId === token.chainId && t.address.toLowerCase() === token.address.toLowerCase())
    );
    
    // Add to beginning of array
    tokens.unshift(token);
    
    // Limit to 10 tokens
    if (tokens.length > 10) {
      tokens = tokens.slice(0, 10);
    }
    
    localStorage.setItem(RECENT_TOKENS_KEY, JSON.stringify(tokens));
  } catch (error) {
    console.error('Error adding token to recent list:', error);
  }
}

/**
 * Get tokens in user's portfolio
 * This is a mock implementation that would be replaced with actual blockchain queries
 */
export async function getUserPortfolioTokens(
  address: string | undefined,
  chainId: number,
  provider: ethers.Provider // provider might be needed if we were to fetch actual balances here
): Promise<TokenInfo[]> {
  if (!address) return [];
  
  // This function is a mock. In a real app, you would query an indexer or
  // fetch on-chain balances for tokens the user might hold.
  // For now, it returns all tokens from DEFAULT_TOKEN_LIST for the given chainId.
  // The swap component would then be responsible for fetching actual balances for these tokens.
  console.log(`getUserPortfolioTokens: Returning all default tokens for chain ${chainId} for user ${address}. Balance fetching is separate.`);
  return DEFAULT_TOKEN_LIST.tokens.filter(token => token.chainId === chainId);
} 