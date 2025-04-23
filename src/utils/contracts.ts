import { ethers } from 'ethers';
import { ADDRESSES } from '@/constants/addresses';

// Basic ABI for ERC20 tokens
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 value) returns (bool)',
  'function transfer(address to, uint256 value) returns (bool)',
  'function transferFrom(address from, address to, uint256 value) returns (bool)',
];

// Simplified Factory ABI
export const FACTORY_ABI = [
  'function createPool(address tokenA, address tokenB, uint24 fee) external returns (address pool)',
  'function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)',
  'function owner() external view returns (address)',
];

// Simplified Pool ABI
export const POOL_ABI = [
  'function token0() external view returns (address)',
  'function token1() external view returns (address)',
  'function fee() external view returns (uint24)',
  'function slot0() external view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() external view returns (uint128)',
  'function initialize(uint160 sqrtPriceX96) external',
  'function tickSpacing() external view returns (int24)',
];

// Simplified SwapRouter ABI
export const SWAP_ROUTER_ABI = [
  'function exactInputSingle(tuple(address tokenIn, address tokenOut, uint24 fee, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum, uint160 sqrtPriceLimitX96)) external returns (uint256 amountOut)',
  'function exactInput(tuple(bytes path, address recipient, uint256 deadline, uint256 amountIn, uint256 amountOutMinimum)) external returns (uint256 amountOut)',
];

// Simplified NonfungiblePositionManager ABI
export const POSITION_MANAGER_ABI = [
  'function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline)) external returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)',
  'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max)) external returns (uint256 amount0, uint256 amount1)',
  'function increaseLiquidity(tuple(uint256 tokenId, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external returns (uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function decreaseLiquidity(tuple(uint256 tokenId, uint128 liquidity, uint256 amount0Min, uint256 amount1Min, uint256 deadline)) external returns (uint256 amount0, uint256 amount1)',
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) external payable returns (address pool)',
];

// Get contract instances for read-only operations
export const getReadContracts = (provider: ethers.Provider) => {
  const factory = new ethers.Contract(
    ADDRESSES.factory,
    FACTORY_ABI,
    provider
  );
  
  const swapRouter = new ethers.Contract(
    ADDRESSES.swapRouter,
    SWAP_ROUTER_ABI,
    provider
  );
  
  const positionManager = new ethers.Contract(
    ADDRESSES.positionManager,
    POSITION_MANAGER_ABI,
    provider
  );
  
  return {
    factory,
    swapRouter,
    positionManager,
    getERC20: (address: string) => new ethers.Contract(address, ERC20_ABI, provider),
    getPool: (address: string) => new ethers.Contract(address, POOL_ABI, provider),
  };
};

// Get contract instances with signer for writing operations
export const getContracts = async (provider: ethers.BrowserProvider) => {
  // Await the signer since getSigner returns a Promise in ethers v6
  const signer = await provider.getSigner();
  
  const factory = new ethers.Contract(
    ADDRESSES.factory,
    FACTORY_ABI,
    signer
  );
  
  const swapRouter = new ethers.Contract(
    ADDRESSES.swapRouter,
    SWAP_ROUTER_ABI,
    signer
  );
  
  const positionManager = new ethers.Contract(
    ADDRESSES.positionManager,
    POSITION_MANAGER_ABI,
    signer
  );
  
  return {
    factory,
    swapRouter,
    positionManager,
    getERC20: (address: string) => new ethers.Contract(address, ERC20_ABI, signer),
    getPool: (address: string) => new ethers.Contract(address, POOL_ABI, signer),
  };
};

// Calculate sqrt price for given price
export const encodeSqrtPriceX96 = (price: number): bigint => {
  // Proper calculation for Uniswap V3 sqrtPriceX96
  // sqrtPriceX96 = sqrt(price) * 2^96
  
  if (price <= 0) {
    throw new Error("Price must be greater than 0");
  }
  
  // For a 1:1 price, set the exact value known to work properly
  // This is particularly important for new pools
  if (Math.abs(price - 1.0) < 0.000001) {
    // This is the precise value for a 1:1 pool
    console.log("Using exact 1:1 price value");
    return BigInt("79228162514264337593543950336");
  }
  
  const priceSquareRoot = Math.sqrt(price);
  
  // Convert to BigNumber with proper decimal handling
  let sqrtPriceX96: bigint;
  
  try {
    // For small/normal prices, use this safer approach
    if (price < 1e6) {
      // Use string math for precision
      const priceInWei = ethers.parseEther(priceSquareRoot.toString());
      // Use BigInt arithmetic: BigInt(2)**BigInt(96) / BigInt(10)**BigInt(18)
      const factor = (BigInt(2) ** BigInt(96)) / (BigInt(10) ** BigInt(18));
      // Use BigInt multiplication
      sqrtPriceX96 = priceInWei * factor;
    } else {
      // For very large prices, use a smaller representation to avoid overflow
      const adjustedPrice = Math.sqrt(price / 1e6);
      const priceInWei = ethers.parseEther(adjustedPrice.toString());
      // Use BigInt arithmetic: BigInt(2)**BigInt(96) / BigInt(10)**BigInt(18)
      const factor = (BigInt(2) ** BigInt(96)) / (BigInt(10) ** BigInt(18));
      // Use BigInt multiplication, ensure 1000 is also BigInt (BigInt(1000))
      sqrtPriceX96 = priceInWei * factor * BigInt(1000);
    }
    
    // Ensure we never return zero or a value too small
    if (sqrtPriceX96 === BigInt(0) || sqrtPriceX96 < BigInt(1000)) {
      console.warn("Calculated sqrtPriceX96 was too small, using fallback");
      return BigInt("79228162514264337593543950336"); // Fallback to 1:1
    }
    
    console.log(`Calculated sqrtPriceX96: ${sqrtPriceX96.toString()}`);
    return sqrtPriceX96;
  } catch (error) {
    console.error("Error encoding sqrtPriceX96:", error);
    // Fallback to a reasonable default for price = 1
    return BigInt("79228162514264337593543950336");
  }
};

// Calculate tick from price
export const priceToTick = (price: number): number => {
  return Math.floor(Math.log(price) / Math.log(1.0001));
};

// Helper to ensure correct token order for the pool
export const sortTokens = (tokenA: string, tokenB: string): [string, string] => {
  return tokenA.toLowerCase() < tokenB.toLowerCase() 
    ? [tokenA, tokenB] 
    : [tokenB, tokenA];
};

// Calculate gas options for transactions
export const getGasOptions = async (
  provider: ethers.BrowserProvider,
  customSettings?: { gasLimit?: number; gasPrice?: string }
): Promise<any> => {
  try {
    // If custom settings are provided, use them
    if (customSettings) {
      console.log('Using custom gas settings:', customSettings);
      
      return {
        gasLimit: customSettings.gasLimit || 250000,
        gasPrice: customSettings.gasPrice ? customSettings.gasPrice : (await provider.getFeeData()).gasPrice,
        // Use legacy transaction type for better compatibility with various networks
        type: 0 
      };
    }
    
    // Default behavior - get current gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice; // Note: gasPrice can be null if network doesn't support legacy gas pricing

    if (!gasPrice) {
        console.warn('Network gas price (legacy) not available, using null. Transaction might need EIP-1559 fields.');
    } else {
        console.log('Using network gas price:', ethers.formatUnits(gasPrice, 'gwei'), 'gwei');
    }
    
    // Use a more conservative gas limit for normal operations
    return {
      gasPrice: gasPrice, // Can be null
      gasLimit: 250000, // Conservative but reasonable gas limit
      type: 0 // Force legacy transaction type (pre-EIP-1559)
    };
  } catch (error) {
    console.error('Error getting gas price:', error);
    // Fallback to a conservative estimate
    return {
      gasLimit: customSettings?.gasLimit || 250000,
      type: 0 // Force legacy transaction type
    };
  }
};

// Check if pool exists and has liquidity
export const validatePool = async (
  poolAddress: string, 
  provider: ethers.BrowserProvider
): Promise<{ isValid: boolean; pool: ethers.Contract | null; message: string }> => {
  try {
    // getSigner requires BrowserProvider or similar, and await it
    const signer = await provider.getSigner();
    const pool = new ethers.Contract(poolAddress, POOL_ABI, signer);
    
    // Check if token addresses can be retrieved
    const token0 = await pool.token0();
    const token1 = await pool.token1();
    
    // Check pool liquidity
    const liquidity = await pool.liquidity();
    
    if (liquidity.toString() === '0') {
      return { 
        isValid: false, 
        pool, 
        message: 'Pool has no liquidity. Please add liquidity before swapping.' 
      };
    }
    
    return { isValid: true, pool, message: 'Pool is valid and has liquidity.' };
  } catch (error) {
    console.error('Error validating pool:', error);
    return { 
      isValid: false, 
      pool: null, 
      message: 'Error accessing pool. The pool might not exist or be initialized.' 
    };
  }
};

// Calculate price from sqrtPriceX96
// price = (sqrtPriceX96 / 2^96)^2
export const decodeSqrtPriceX96 = (sqrtPriceX96: bigint): number => {
  if (sqrtPriceX96 <= BigInt(0)) {
    console.error("Invalid sqrtPriceX96 <= 0");
    return 0; // Or throw error
  }
  try {
    const twoPow96 = BigInt(2) ** BigInt(96);
    const scaleFactor = BigInt(10) ** BigInt(18);
    // Calculate ratio = sqrtPriceX96 / 2^96 with scaling
    const ratioX192Scaled = (sqrtPriceX96 * scaleFactor) / twoPow96;
    // Calculate price = ratio^2, maintaining scale
    const priceX192ScaledSquared = (ratioX192Scaled * ratioX192Scaled);
    const scaleFactorSquared = scaleFactor * scaleFactor; // 10^36

    // Format using ethers, treating the scaled value as Wei (10^36)
    const priceString = ethers.formatUnits(priceX192ScaledSquared, 36); 

    return parseFloat(priceString);

  } catch (error) {
      console.error("Error decoding sqrtPriceX96:", error, "Input:", sqrtPriceX96.toString());
      return 0; // Fallback or throw
  }
}; 