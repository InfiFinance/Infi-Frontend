import { ethers, Provider, BrowserProvider, Network, Contract } from 'ethers';
import { TokenInfo } from '@/services/tokenService';
import { getContracts, getReadContracts, sortTokens, getGasOptions, encodeSqrtPriceX96 } from './contracts';
import { fetchTokenInfo } from '@/services/tokenService';
import { ADDRESSES } from '@/constants/addresses';

// Helper functions for working with ticks
export const priceToTick = (price: number): number => {
  return Math.floor(Math.log(price) / Math.log(1.0001));
};

export const tickToPrice = (tick: number): number => {
  return Math.pow(1.0001, tick);
};

// ABI fragments needed for liquidity management
const NONFUNGIBLE_POSITION_MANAGER_ABI = [
  // Position management functions
  'function createAndInitializePoolIfNecessary(address token0, address token1, uint24 fee, uint160 sqrtPriceX96) payable returns (address pool)',
  'function mint(tuple(address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint256 amount0Desired, uint256 amount1Desired, uint256 amount0Min, uint256 amount1Min, address recipient, uint256 deadline) params) payable returns (uint256 tokenId, uint128 liquidity, uint256 amount0, uint256 amount1)',
  'function positions(uint256 tokenId) view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
];

const POOL_ABI = [
  // Pool state functions
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function fee() view returns (uint24)',
  'function slot0() view returns (uint160 sqrtPriceX96, int24 tick, uint16 observationIndex, uint16 observationCardinality, uint16 observationCardinalityNext, uint8 feeProtocol, bool unlocked)',
  'function liquidity() view returns (uint128)'
];

const ERC20_ABI = [
  // Standard ERC20 functions
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)'
];

// Contract addresses for our DEX
const CONTRACTS = {
  factory: '0x5f37a6Ea51351BBBED8bD7Ed78EBa923B8D60897',
  nonfungiblePositionManager: '0xA5ae22A0364c461Ee83868F12fc09616295925aA',
  weth9: '0xe356046C34B8e989E6a311FE6478E2736937699D',
  swapRouter: '0x11F22a8a07215d1691175A67cDf6630E874Bb17b',
  nftDescriptor: '0x217755D961eAcD4f5dEcd922d8F3e3dFbe053E19',
  tokenDescriptor: '0xBa42231Bd6C12547dFe82dBA830B49581305fedD'
};

export interface CreatePoolParams {
  token0: TokenInfo;
  token1: TokenInfo;
  poolFee: number;
  initialPrice: string;
  gasSettings?: { gasLimit: number; gasPrice: string };
}

export interface AddLiquidityParams {
  token0: TokenInfo;
  token1: TokenInfo;
  token0Amount: string;
  token1Amount: string;
  recipient: string;
  poolAddress: string;
  minPrice: string;
  maxPrice: string;
  poolFee: number;
}

export interface PoolInfo {
  token0: TokenInfo;
  token1: TokenInfo;
  fee: number;
  liquidity: bigint;
  sqrtPriceX96: bigint;
  tick: number;
  currentPrice: string;
}

// Process price range and convert to ticks
export function processTickRange(
  minPrice: string,
  maxPrice: string,
  currentPrice: number,
  poolFee: number
): { tickLower: number; tickUpper: number } {
  let tickLower: number;
  let tickUpper: number;
  
  // Calculate tickSpacing based on poolFee
  let tickSpacing: number;
  switch (poolFee) {
    case 100:   tickSpacing = 1; break;  // 0.01%
    case 500:   tickSpacing = 10; break; // 0.05%
    case 3000:  tickSpacing = 60; break; // 0.3%
    case 10000: tickSpacing = 200; break;// 1%
    default:
        console.warn(`Unknown fee tier ${poolFee}, defaulting tickSpacing to 60.`);
        tickSpacing = 60; // Default to 0.3% spacing if fee tier is unknown
  }
  
  // Globally aligned min/max ticks
  const minTickGlobalAligned = Math.ceil(-887272 / tickSpacing) * tickSpacing;
  const maxTickGlobalAligned = Math.floor(887272 / tickSpacing) * tickSpacing;
  
  // Determine tick range based on price range
  if (minPrice === '0' && maxPrice === '∞') {
    // Full range: Use globally aligned min/max ticks
    tickLower = minTickGlobalAligned;
    tickUpper = maxTickGlobalAligned;
  } else {
    // Custom range: Convert prices to ticks
    // Use very small/large numbers if min/max are 0/infinity but not full range
    const minPriceValue = minPrice === '0' ? Number.MIN_VALUE : parseFloat(minPrice);
    const maxPriceValue = maxPrice === '∞' ? Number.MAX_VALUE : parseFloat(maxPrice);
    
    // Convert prices to ticks
    tickLower = priceToTick(minPriceValue);
    tickUpper = priceToTick(maxPriceValue);
    
    // Ensure tick spacing alignment
    tickLower = Math.ceil(tickLower / tickSpacing) * tickSpacing;
    tickUpper = Math.floor(tickUpper / tickSpacing) * tickSpacing;
    
    // Clamp ticks to the globally aligned min/max AFTER spacing alignment
    tickLower = Math.max(minTickGlobalAligned, tickLower);
    tickUpper = Math.min(maxTickGlobalAligned, tickUpper);
    
    // Ensure lower tick is less than upper tick after alignment
    if (tickLower >= tickUpper) {
        console.warn(`Invalid tick range after alignment: Lower ${tickLower} >= Upper ${tickUpper}. Falling back to full range.`);
        tickLower = minTickGlobalAligned;
        tickUpper = maxTickGlobalAligned;
    }
  }
  
  return { tickLower, tickUpper };
}

// Find the address of a pool
export async function findPoolAddress(
  provider: BrowserProvider,
  token0: TokenInfo,
  token1: TokenInfo,
  fee: number
): Promise<string | null> {
  try {
    // Use the findPool utility
    // const { findPoolAddress } = await import('./findPool'); // Commented out missing import
    // return await findPoolAddress(provider, token0, token1, fee); // Commented out usage
    console.warn("findPoolAddress functionality is disabled due to missing './findPool' module.");
    return null; // Return null as the module is missing
  } catch (error) {
    console.error('Error finding pool address:', error);
    return null;
  }
}

// Handle token approvals for adding liquidity
export async function approveTokens(
  provider: BrowserProvider,
  token0: TokenInfo,
  token1: TokenInfo,
  amount0Desired: string,
  amount1Desired: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const signer = await provider.getSigner();
    const signerAddress = await signer.getAddress();
    
    // Create token contracts
    const token0Contract = new ethers.Contract(
      token0.address,
      ERC20_ABI,
      signer
    );
    
    const token1Contract = new ethers.Contract(
      token1.address,
      ERC20_ABI,
      signer
    );
    
    // Check allowances
    const amount0Value = ethers.parseUnits(amount0Desired, token0.decimals);
    const amount1Value = ethers.parseUnits(amount1Desired, token1.decimals);
    
    const allowance0 = await token0Contract.allowance(signerAddress, CONTRACTS.nonfungiblePositionManager);
    const allowance1 = await token1Contract.allowance(signerAddress, CONTRACTS.nonfungiblePositionManager);
    
    // Approve tokens if needed
    if (allowance0 < amount0Value) {
      console.log(`Approving ${token0.symbol} for position manager...`);
      const tx0 = await token0Contract.approve(
        CONTRACTS.nonfungiblePositionManager, 
        amount0Value,
        {
          gasLimit: 200000,
          gasPrice: ethers.parseUnits("5", "gwei")
        }
      );
      const receipt0 = await tx0.wait();
      console.log(`Approval confirmed in block ${receipt0.blockNumber}`);
    }
    
    if (allowance1 < amount1Value) {
      console.log(`Approving ${token1.symbol} for position manager...`);
      const tx1 = await token1Contract.approve(
        CONTRACTS.nonfungiblePositionManager, 
        amount1Value,
        {
          gasLimit: 200000,
          gasPrice: ethers.parseUnits("5", "gwei")
        }
      );
      const receipt1 = await tx1.wait();
      console.log(`Approval confirmed in block ${receipt1.blockNumber}`);
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('Error approving tokens:', error);
    return {
      success: false,
      error: error.message || 'Error approving tokens'
    };
  }
}

// Interface for position info
interface PositionInfo {
  tokenId: string;
  tickLower: number;
  tickUpper: number;
  liquidity: bigint;
  token0: string;
  token1: string;
  fee: number;
  feeGrowthInside0LastX128: bigint;
  feeGrowthInside1LastX128: bigint;
  tokensOwed0: bigint;
  tokensOwed1: bigint;
}

export const LiquidityService = {
  /**
   * Get information about a pool
   */
  getPoolInfo: async (
    provider: Provider,
    poolAddress: string
  ): Promise<{ success: boolean; poolInfo?: PoolInfo; error?: string }> => {
    try {
      // Get contract using the read-only contracts function
      const { getPool } = getReadContracts(provider);
      const pool = getPool(poolAddress);
      
      // Fetch pool data
      const [token0Address, token1Address, fee, liquidity, slot0] = await Promise.all([
        pool.token0(),
        pool.token1(),
        pool.fee(),
        pool.liquidity(),
        pool.slot0()
      ]);
      
      // Get token information
      const network = await provider.getNetwork();
      const chainId = network.chainId;
      const chainIdNum = Number(chainId);
      const [token0Info, token1Info] = await Promise.all([
        fetchTokenInfo(token0Address, chainIdNum, provider),
        fetchTokenInfo(token1Address, chainIdNum, provider)
      ]);
      
      if (!token0Info || !token1Info) {
        return { 
          success: false, 
          error: 'Failed to fetch token information for pool' 
        };
      }
      
      const sqrtPriceX96 = slot0.sqrtPriceX96;
      const tick = slot0.tick;
      
      // Convert tick to price
      const price = Math.pow(1.0001, tick);
      const formattedPrice = price.toFixed(4);
      
      const poolInfo: PoolInfo = {
        token0: token0Info,
        token1: token1Info,
        fee: Number(fee),
        liquidity: liquidity,
        sqrtPriceX96: sqrtPriceX96,
        tick: tick,
        currentPrice: formattedPrice,
      };
      
      return {
        success: true,
        poolInfo
      };
    } catch (error) {
      console.error('Error getting pool info:', error);
      return {
        success: false,
        error: 'Failed to get pool information'
      };
    }
  },
  
  /**
   * Create a new pool
   */
  createPool: async (
    provider: BrowserProvider,
    params: CreatePoolParams
  ): Promise<{ success: boolean; poolAddress?: string; error?: string; txHash?: string }> => {
    try {
      const { token0, token1, poolFee, initialPrice, gasSettings } = params;
      
      // Get signer directly 
      const signer = await provider.getSigner();
      const factoryAddress = ADDRESSES.factory;
      const positionManagerAddress = CONTRACTS.nonfungiblePositionManager;
      
      // Sort tokens and get addresses
      const [sortedToken0Address, sortedToken1Address] = sortTokens(
        token0.address,
        token1.address
      );
      
      console.log(`Creating/initializing pool for ${token0.symbol} and ${token1.symbol} with fee ${poolFee}`);
      
      // Check if pool already exists
      const factory = new ethers.Contract(
        factoryAddress,
        ['function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)'],
        signer
      );
      
      const existingPool = await factory.getPool(
        sortedToken0Address,
        sortedToken1Address,
        poolFee
      );
      
      if (existingPool !== ethers.ZeroAddress) {
        console.log(`Pool already exists at ${existingPool}`);
        // Check if pool is already initialized
        try {
          const pool = new ethers.Contract(
            existingPool,
            POOL_ABI,
            provider
          );
          await pool.slot0();
          console.log('Pool is already initialized');
          return {
            success: true,
            poolAddress: existingPool
          };
        } catch (err) {
          console.log('Pool exists but is not initialized, will initialize it');
          // Continue with initialization
        }
      }
      
      // Convert price to sqrtPriceX96 format
      const price = parseFloat(initialPrice);
      const sqrtPriceX96 = encodeSqrtPriceX96 ? 
        encodeSqrtPriceX96(price) : 
        BigInt('79228162514264337593543950336'); // Default value if helper not available
      
      console.log('Initial price:', price);
      console.log('SqrtPriceX96:', sqrtPriceX96.toString());
      
      // Create and initialize the pool in a single transaction using the nonfungible position manager
      const positionManager = new ethers.Contract(
        positionManagerAddress,
        NONFUNGIBLE_POSITION_MANAGER_ABI,
        signer
      );
      
      // Build transaction parameters
      const txParams: any = {
        gasLimit: gasSettings?.gasLimit || 5000000, // Default high gas limit
      };
      
      if (gasSettings?.gasPrice) {
        txParams.gasPrice = BigInt(gasSettings.gasPrice);
      }
      
      // Use createAndInitializePoolIfNecessary to create and initialize in one call
      console.log('Creating and initializing pool in a single transaction...');
      const tx = await positionManager.createAndInitializePoolIfNecessary(
        sortedToken0Address,
        sortedToken1Address,
        poolFee,
        sqrtPriceX96,
        txParams
      );
      
      console.log('Transaction sent:', tx.hash);
      
      // Wait for the transaction to be mined
      const receipt = await tx.wait();
      console.log('Transaction confirmed in block:', receipt.blockNumber);
      
      // Get the pool address (should be created now)
      const poolAddress = await factory.getPool(
        sortedToken0Address,
        sortedToken1Address,
        poolFee
      );
      
      console.log('Pool created and initialized at:', poolAddress);
      
      return {
        success: true,
        poolAddress,
        txHash: tx.hash
      };
    } catch (error: any) {
      console.error('Error creating/initializing pool:', error);
      return {
        success: false,
        error: error.message || 'Failed to create/initialize pool'
      };
    }
  },
  
  /**
   * Add liquidity to a pool
   */
  addLiquidity: async (
    provider: BrowserProvider,
    params: AddLiquidityParams
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    try {
      const { 
        token0, 
        token1, 
        token0Amount, 
        token1Amount, 
        recipient, 
        poolAddress,
        minPrice,
        maxPrice,
        poolFee
      } = params;
      
      const signer = await provider.getSigner();
      const { positionManager } = await getContracts(provider);
      
      // Get token information
      const [token0Contract, token1Contract] = [
        new ethers.Contract(token0.address, ERC20_ABI, signer),
        new ethers.Contract(token1.address, ERC20_ABI, signer)
      ];
      
      // Parse token amounts
      const amount0Desired = ethers.parseUnits(token0Amount, token0.decimals);
      const amount1Desired = ethers.parseUnits(token1Amount, token1.decimals);
      
      // Approve tokens
      const approvalResult = await approveTokens(
        provider,
        token0,
        token1,
        token0Amount,
        token1Amount
      );
      
      if (!approvalResult.success) {
        return {
          success: false,
          error: approvalResult.error || 'Failed to approve tokens'
        };
      }
      
      // Get pool info to calculate price range
      const poolContract = new ethers.Contract(poolAddress, POOL_ABI, provider);
      const slot0 = await poolContract.slot0();
      const currentTick = Number(slot0.tick);
      const currentPrice = Math.pow(1.0001, currentTick);
      
      const actualPoolFeeBigInt = await poolContract.fee();
      const actualPoolFee = Number(actualPoolFeeBigInt);
      
      // Process tick range
      const { tickLower, tickUpper } = processTickRange(
        minPrice,
        maxPrice,
        currentPrice,
        actualPoolFee
      );
      
      console.log(`Adding liquidity with tick range: ${tickLower} to ${tickUpper} (using actual pool fee: ${actualPoolFee})`);
      
      // Get actual token0 and token1 from pool to ensure correct order
      const poolToken0 = await poolContract.token0();
      const poolToken1 = await poolContract.token1();
      
      // Prepare params according to the actual pool token order
      const mintParams = {
        token0: poolToken0,
        token1: poolToken1,
        fee: actualPoolFee,
        tickLower,
        tickUpper,
        amount0Desired: token0.address.toLowerCase() === poolToken0.toLowerCase() ? amount0Desired : amount1Desired,
        amount1Desired: token0.address.toLowerCase() === poolToken0.toLowerCase() ? amount1Desired : amount0Desired,
        amount0Min: BigInt(0),
        amount1Min: BigInt(0),
        recipient,
        deadline: Math.floor(Date.now() / 1000) + 1800
      };
      
      // Set explicit gas settings
      const gasOptions = await getGasOptions(provider);
      
      // Execute mint transaction
      const tx = await positionManager.mint(mintParams, gasOptions);
      console.log(`Mint transaction sent: ${tx.hash}`);
      
      // Wait for transaction to confirm
      const receipt = await tx.wait();
      console.log(`Mint transaction confirmed in block ${receipt.blockNumber}`);
      
      return {
        success: true,
        txHash: tx.hash
      };
    } catch (error: any) {
      console.error('Error adding liquidity:', error);
      return {
        success: false,
        error: error.reason || error.message || 'Failed to add liquidity'
      };
    }
  },
  
  /**
   * Remove liquidity from a pool
   */
  removeLiquidity: async (
    provider: BrowserProvider,
    tokenId: string,
    recipient: string
  ): Promise<{ success: boolean; txHash?: string; error?: string }> => {
    try {
      const signer = await provider.getSigner();
      const { positionManager } = await getContracts(provider);
      
      // First, get position information
      const position = await positionManager.positions(tokenId);
      console.log(`Removing liquidity for position #${tokenId}`);
      
      // Prepare decrease liquidity params
      const decreaseLiquidityParams = {
        tokenId,
        liquidity: position.liquidity,
        amount0Min: 0, // In production, calculate min amounts based on slippage
        amount1Min: 0,
        deadline: Math.floor(Date.now() / 1000) + 1800 // 30 minutes deadline
      };
      
      // Get gas options
      const gasOptions = await getGasOptions(provider);
      
      // Execute decrease liquidity transaction
      const decreaseTx = await positionManager.decreaseLiquidity(decreaseLiquidityParams, gasOptions);
      console.log(`Decrease liquidity transaction sent: ${decreaseTx.hash}`);
      
      // Wait for transaction to confirm
      await decreaseTx.wait();
      
      // Use MAX_UINT128 for amount0Max and amount1Max
      const MAX_UINT128 = BigInt(2)**BigInt(128) - BigInt(1);
      
      // Collect tokens after decreasing liquidity
      const collectParams = {
        tokenId,
        recipient,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128
      };
      
      // Execute collect transaction
      const collectTx = await positionManager.collect(collectParams, gasOptions);
      console.log(`Collect transaction sent: ${collectTx.hash}`);
      
      // Wait for transaction to confirm
      const collectReceipt = await collectTx.wait();
      console.log(`Collect transaction confirmed in block ${collectReceipt.blockNumber}`);
      
      // Burn the position NFT to fully remove it
      try {
        // Update contract with burn function in the ABI
        const positionManagerWithBurn = new ethers.Contract(
          CONTRACTS.nonfungiblePositionManager,
          [
            ...positionManager.interface.fragments,
            'function burn(uint256 tokenId) external payable'
          ],
          signer
        );
        
        const burnTx = await positionManagerWithBurn.burn(tokenId, gasOptions);
        console.log(`Burn transaction sent: ${burnTx.hash}`);
        
        // Wait for burn transaction to confirm
        const burnReceipt = await burnTx.wait();
        console.log(`Position #${tokenId} burned in block ${burnReceipt.blockNumber}`);
        
        return {
          success: true,
          txHash: burnTx.hash
        };
      } catch (burnError: any) {
        console.warn(`Failed to burn position #${tokenId}: ${burnError.message}`);
        console.warn("This is expected if the position had already collected fees in the past");
        
        // Even if burn fails, we've still removed liquidity and collected tokens
        return {
          success: true,
          txHash: collectTx.hash
        };
      }
    } catch (error: any) {
      console.error('Error removing liquidity:', error);
      return {
        success: false,
        error: error.message || 'Failed to remove liquidity'
      };
    }
  },

  /**
   * Get all positions for a user
   */
  getUserPositions: async (
    provider: BrowserProvider,
    userAddress: string
  ): Promise<{ success: boolean; positions?: PositionInfo[]; error?: string }> => {
    try {
      const signer = await provider.getSigner();
      const positionManager = new ethers.Contract(
        CONTRACTS.nonfungiblePositionManager,
        [
          'function balanceOf(address owner) external view returns (uint256)',
          'function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)',
          'function positions(uint256 tokenId) external view returns (uint96 nonce, address operator, address token0, address token1, uint24 fee, int24 tickLower, int24 tickUpper, uint128 liquidity, uint256 feeGrowthInside0LastX128, uint256 feeGrowthInside1LastX128, uint128 tokensOwed0, uint128 tokensOwed1)'
        ],
        signer
      );

      // Get number of positions
      const balance = await positionManager.balanceOf(userAddress);
      
      if (balance === BigInt(0)) {
        return { success: true, positions: [] };
      }

      // Get all position IDs
      const positionIds: bigint[] = [];
      const balanceNum = Number(balance);
      for (let i = 0; i < balanceNum; i++) {
        const tokenId = await positionManager.tokenOfOwnerByIndex(userAddress, i);
        positionIds.push(tokenId);
      }

      // Get position details
      const positionCalls = positionIds.map(id => positionManager.positions(id));
      const positionResponses = await Promise.all(positionCalls);

      // Map responses to PositionInfo interface
      const positions: PositionInfo[] = positionResponses.map((position, index) => ({
        tokenId: positionIds[index].toString(),
        tickLower: Number(position.tickLower),
        tickUpper: Number(position.tickUpper),
        liquidity: position.liquidity,
        token0: position.token0,
        token1: position.token1,
        fee: Number(position.fee),
        feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
        feeGrowthInside1LastX128: position.feeGrowthInside1LastX128,
        tokensOwed0: position.tokensOwed0,
        tokensOwed1: position.tokensOwed1
      }));

      return {
        success: true,
        positions
      };
    } catch (error: any) {
      console.error('Error fetching user positions:', error);
      return {
        success: false,
        error: error.message || 'Failed to fetch user positions'
      };
    }
  },

  /**
   * Get unclaimed fees for a position
   */
  getUnclaimedFees: async (
    provider: BrowserProvider,
    tokenId: string,
    userAddress: string
  ): Promise<{ success: boolean; fees?: { amount0: string; amount1: string }; error?: string }> => {
    try {
      const signer = await provider.getSigner();
      const positionManager = new ethers.Contract(
        CONTRACTS.nonfungiblePositionManager,
        [
          'function collect(tuple(uint256 tokenId, address recipient, uint128 amount0Max, uint128 amount1Max) params) external payable returns (uint256 amount0, uint256 amount1)'
        ],
        signer
      );

      // Use callStatic to simulate the collect call and get unclaimed fees
      const MAX_UINT128 = BigInt(2)**BigInt(128) - BigInt(1);
      
      const result = await positionManager.collect.staticCall({
        tokenId: tokenId,
        recipient: userAddress,
        amount0Max: MAX_UINT128,
        amount1Max: MAX_UINT128
      });

      return {
        success: true,
        fees: {
          amount0: result.amount0.toString(),
          amount1: result.amount1.toString()
        }
      };
    } catch (error: any) {
      console.error('Error getting unclaimed fees:', error);
      return {
        success: false,
        error: error.message || 'Failed to get unclaimed fees'
      };
    }
  }
}; 