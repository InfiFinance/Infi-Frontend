"use client";
import { useState, useEffect } from "react";
import Link from 'next/link'
import { Search, Plus, Loader2 } from "lucide-react";
// import { Button } from "../ui/button";
// import suiIcon from "../../assets/sui.png";
// import usdcIcon from "../../assets/usdc.svg";
import { useNavigate } from "react-router-dom";
import Logo from '../../../public/vercel.svg';
import { ethers, BrowserProvider, Eip1193Provider, Contract } from 'ethers';
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { LiquidityService, tickToPrice } from '@/utils/liquidityService';
import { fetchTokenInfo } from '@/services/tokenService';
import { ADDRESSES } from '@/constants/addresses';
import { FACTORY_ABI, POOL_ABI, POSITION_MANAGER_ABI } from '@/utils/contracts';

interface TokenInfo {
  symbol: string;
  icon: string; // Or appropriate type for icon source
  decimals: number;
  address: string;
  logoURI?: string; // Add optional logoURI from token service
}

interface UnclaimedFees {
  amount0: bigint;
  amount1: bigint;
}

interface Position {
  tokenId: string;
  token0: TokenInfo;
  token1: TokenInfo;
  fee: number;
  liquidity: bigint; // Use bigint
  tickLower: number;
  tickUpper: number;
  inRange: boolean;
  unclaimedFees?: UnclaimedFees;
  // Optional UI state properties
  isLoading?: boolean;
  isCollecting?: boolean;
  collectMessage?: string;
  error?: string;
  txHash?: string;
}

// Type returned by the actual LiquidityService.getUserPositions (assuming structure)
// This helps with type safety when processing the result
interface RawPositionData {
    tokenId: string | bigint; // Allow both initially
    token0: string;
    token1: string;
    fee: number | string;
    liquidity: string | bigint;
    tickLower: number | string;
    tickUpper: number | string;
}

const PoolsPage = () => {
    //   const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showIncentivized, setShowIncentivized] = useState(false);
    const [showAllPools, setShowAllPools] = useState(false);
    const [activeTab, setActiveTab] = useState('positions');

    // State for positions tab
    const [positions, setPositions] = useState<Position[]>([]);
    const [loadingPositions, setLoadingPositions] = useState<boolean>(true);
    const { address, isConnected } = useAppKitAccount();
    const { walletProvider } = useAppKitProvider("eip155");
    const [provider, setProvider] = useState<BrowserProvider | null>(null);

    // Effect to create ethers provider
    useEffect(() => {
        if (walletProvider) {
            // Cast walletProvider to Eip1193Provider
            const ethersProvider = new ethers.BrowserProvider(walletProvider as Eip1193Provider);
            setProvider(ethersProvider);
        } else {
            setProvider(null);
        }
    }, [walletProvider]);

    // Dummy data for pools
    const pools = [
        {
            token1: { symbol: "SUI", icon: Logo },
            token2: { symbol: "USDC", icon: Logo },
            fee: "0.25%",
            liquidity: "$21,168,128.11",
            volume24h: "$38,452,728.49",
            fees24h: "$96,131.82",
            rewards: ["CETUS", "SUI"],
            apr: "175.44%"
        },
        {
            token1: { symbol: "WAL", icon: Logo },
            token2: { symbol: "SUI", icon: Logo },
            fee: "0.25%",
            liquidity: "$6,317,011.56",
            volume24h: "$29,346,114.31",
            fees24h: "$73,365.28",
            rewards: ["SUI", "WAL"],
            apr: "628.7%"
        },
        {
            token1: { symbol: "suiUSDT", icon: Logo },
            token2: { symbol: "USDC", icon: Logo },
            fee: "0.01%",
            liquidity: "$35,223,855.02",
            volume24h: "$15,036,404.82",
            fees24h: "$1,503.64",
            rewards: ["SUI", "CETUS"],
            apr: "12.09%"
        },
        {
            token1: { symbol: "haSUI", icon: Logo },
            token2: { symbol: "USDC", icon: Logo },
            fee: "0.05%",
            liquidity: "$1,162,215.71",
            volume24h: "$10,826,740.12",
            fees24h: "$5,313.37",
            rewards: [],
            apr: "166.59%"
        },
        {
            token1: { symbol: "haSUI", icon: Logo },
            token2: { symbol: "SUI", icon: Logo },
            fee: "0.01%",
            liquidity: "$28,062,131.5",
            volume24h: "$8,326,486.81",
            fees24h: "$832.64",
            rewards: ["SUI"],
            apr: "1.11%"
        },
    ];

    // Fetch User Positions Logic (Re-added)
    useEffect(() => {
        const fetchUserPositions = async () => {
            if (!isConnected || !address || !provider) {
                setLoadingPositions(false);
                setPositions([]);
                return;
            }

            setLoadingPositions(true);
            try {
                const result = await LiquidityService.getUserPositions(provider, address);

                if (!result.success || !result.positions) {
                    throw new Error(result.error || 'Failed to fetch positions');
                }

                const positionsWithLiquidity = result.positions.filter(
                    (position: RawPositionData) => BigInt(position.liquidity) !== BigInt(0)
                );

                const factory = new Contract(ADDRESSES.factory, FACTORY_ABI, provider);

                const enhancedPositionsPromises = positionsWithLiquidity.map(async (position: RawPositionData): Promise<Position | null> => {
                    try {
                        const network = await provider.getNetwork();
                        const chainId = network.chainId;

                        const [token0InfoResult, token1InfoResult] = await Promise.all([
                            fetchTokenInfo(position.token0, Number(chainId), provider),
                            fetchTokenInfo(position.token1, Number(chainId), provider)
                        ]);

                        if (!token0InfoResult || !token1InfoResult) {
                            console.error(`Failed to fetch token info for pair ${position.token0}/${position.token1}`);
                            return null;
                        }

                        const token0Data: TokenInfo = {
                            symbol: token0InfoResult.symbol,
                            icon: token0InfoResult.logoURI || '../../../public/vercel.svg',
                            decimals: token0InfoResult.decimals,
                            address: position.token0,
                            logoURI: token0InfoResult.logoURI
                        };
                        const token1Data: TokenInfo = {
                            symbol: token1InfoResult.symbol,
                            icon: token1InfoResult.logoURI || '../../../public/vercel.svg',
                            decimals: token1InfoResult.decimals,
                            address: position.token1,
                            logoURI: token1InfoResult.logoURI
                        };

                        const feesResult = await LiquidityService.getUnclaimedFees(
                            provider,
                            position.tokenId.toString(),
                            address
                        );

                        const poolAddress = await factory.getPool(
                            position.token0,
                            position.token1,
                            Number(position.fee)
                        );

                        let inRange = false;
                        if (poolAddress && poolAddress !== ethers.ZeroAddress) {
                            const pool = new Contract(poolAddress, POOL_ABI, provider);
                            try {
                                const slot0 = await pool.slot0();
                                const currentTick = Number(slot0.tick);
                                inRange = currentTick >= Number(position.tickLower) && currentTick <= Number(position.tickUpper);
                            } catch (error) {
                                console.error('Error getting pool state for pool:', poolAddress, error);
                                inRange = false;
                            }
                        }

                        const posTokenId = position.tokenId.toString();
                        const posFee = Number(position.fee);
                        const posLiquidity = BigInt(position.liquidity);
                        const posTickLower = Number(position.tickLower);
                        const posTickUpper = Number(position.tickUpper);

                        return {
                            tokenId: posTokenId,
                            token0: token0Data,
                            token1: token1Data,
                            fee: posFee,
                            liquidity: posLiquidity,
                            tickLower: posTickLower,
                            tickUpper: posTickUpper,
                            inRange,
                            unclaimedFees: (feesResult.success && feesResult.fees) ? {
                                amount0: BigInt(feesResult.fees.amount0),
                                amount1: BigInt(feesResult.fees.amount1)
                            } : undefined
                        };
                    } catch (mapError) {
                        console.error("Error processing position:", position.tokenId, mapError);
                        return null;
                    }
                });

                const enhancedPositionsResults = await Promise.all(enhancedPositionsPromises);
                setPositions(enhancedPositionsResults.filter((p): p is Position => p !== null));

            } catch (error) {
                console.error('Error fetching positions:', error);
                setPositions([]);
            } finally {
                setLoadingPositions(false);
            }
        };

        fetchUserPositions();
    }, [isConnected, address, provider]);

    // Handle remove liquidity (Re-added)
    const handleRemoveLiquidity = async (positionId: string) => {
        if (!provider || !address) return;

        setPositions(positions.map(p =>
            p.tokenId === positionId ? { ...p, isLoading: true, error: undefined, collectMessage: undefined, txHash: undefined } : p
        ));

        try {
            const result = await LiquidityService.removeLiquidity(
                provider,
                positionId,
                address
            );

            if (result.success) {
                setPositions(prev => prev.filter(p => p.tokenId !== positionId));
            } else {
                setPositions(positions.map(p =>
                    p.tokenId === positionId ? { ...p, isLoading: false, error: result.error || 'Failed to remove liquidity' } : p
                ));
            }
        } catch (error: any) {
            console.error('Error removing liquidity:', error);
            setPositions(positions.map(p =>
                p.tokenId === positionId ? { ...p, isLoading: false, error: error.message || 'Failed to remove liquidity' } : p
            ));
        }
    };

    // Handle collect fees (Re-added)
    const handleCollectFees = async (position: Position) => {
        if (!provider || !address) return;

        setPositions(positions.map(p =>
            p.tokenId === position.tokenId ? {
                ...p,
                isCollecting: true,
                collectMessage: 'Preparing collection...',
                error: undefined,
                txHash: undefined
            } : p
        ));

        try {
            const signer = await provider.getSigner();
            const positionManager = new Contract(
                ADDRESSES.positionManager,
                POSITION_MANAGER_ABI,
                signer
            );

            const MAX_UINT128 = (BigInt(1) << BigInt(128)) - BigInt(1);

            const collectParams = {
                tokenId: position.tokenId,
                recipient: address,
                amount0Max: MAX_UINT128,
                amount1Max: MAX_UINT128
            };

            console.log("Collecting fees with params:", collectParams);
            setPositions(positions.map(p =>
                p.tokenId === position.tokenId ? { ...p, collectMessage: 'Please confirm in wallet...' } : p
            ));

            const tx = await positionManager.collect(collectParams);

            setPositions(positions.map(p =>
                p.tokenId === position.tokenId ? {
                    ...p,
                    collectMessage: 'Transaction pending...',
                    txHash: tx.hash
                } : p
            ));

            console.log("Collect tx sent:", tx.hash);
            const receipt = await tx.wait();
            console.log("Collect tx confirmed:", receipt);

            const feesResult = await LiquidityService.getUnclaimedFees(
                provider,
                position.tokenId,
                address
            );

            setPositions(positions.map(p =>
                p.tokenId === position.tokenId ? {
                    ...p,
                    isCollecting: false,
                    collectMessage: 'Fees Collected!',
                    unclaimedFees: (feesResult.success && feesResult.fees) ? {
                        amount0: BigInt(feesResult.fees.amount0),
                        amount1: BigInt(feesResult.fees.amount1)
                    } : p.unclaimedFees,
                    txHash: tx.hash
                } : p
            ));

        } catch (error: any) {
            console.error('Error collecting fees:', error);
            let errorMessage = 'Failed to collect fees';
            if (error.reason) {
                errorMessage = error.reason;
            } else if (error.message) {
                errorMessage = error.message;
            }
            setPositions(positions.map(p =>
                p.tokenId === position.tokenId ? {
                    ...p,
                    isCollecting: false,
                    collectMessage: undefined,
                    error: errorMessage
                } : p
            ));
        }
    };

    // Helper to format price values adaptively (Re-added)
    const formatPriceValue = (price: number): string => {
        if (!isFinite(price) || price > 1e18) {
            return "∞";
        } else if (price < 1e-9 && price > 0) {
            return "< 0.00001";
        } else if (price === 0) {
            return "0";
        } else {
            return price.toLocaleString(undefined, { maximumSignificantDigits: 5 });
        }
    };

    // Format price range using helper (Re-added)
    const formatPriceRange = (position: Position) => {
        try {
            const minPriceValue = tickToPrice(position.tickLower);
            const maxPriceValue = tickToPrice(position.tickUpper);
            const formattedMin = formatPriceValue(minPriceValue);
            const formattedMax = formatPriceValue(maxPriceValue);
            return `${formattedMin} - ${formattedMax} ${position.token1.symbol} per ${position.token0.symbol}`;
        } catch (e) {
            console.error("Error formatting price range:", e);
            return "Error";
        }
    };

    // Format unclaimed fees using bigint (Re-added)
    const formatUnclaimedFees = (position: Position) => {
        if (position.isCollecting && position.collectMessage) return position.collectMessage;
        if (position.error) return <span className="text-red-500">{position.error}</span>;
        if (!position.unclaimedFees) return 'Loading...';

        try {
            const amount0 = ethers.formatUnits(position.unclaimedFees.amount0, position.token0.decimals);
            const amount1 = ethers.formatUnits(position.unclaimedFees.amount1, position.token1.decimals);
            const displayAmount0 = parseFloat(amount0) < 0.000001 ? '< 0.000001' : parseFloat(amount0).toFixed(6);
            const displayAmount1 = parseFloat(amount1) < 0.000001 ? '< 0.000001' : parseFloat(amount1).toFixed(6);
            return `${displayAmount0} ${position.token0.symbol} + ${displayAmount1} ${position.token1.symbol}`;
        } catch (e) {
            console.error("Error formatting fees: ", e);
            return "Error";
        }
    };

    return (
        <div className="w-full max-w-7xl mx-auto p-4 space-y-6 min-h-screen mt-12">
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1f2639] p-6 rounded-lg border border-[#21273a]">
                    <h3 className="text-gray-400 mb-2">Trading Volume (24H)</h3>
                    <p className="text-2xl font-semibold text-white">$173,726,575.29</p>
                </div>
                <div className="bg-[#1f2639] p-6 rounded-lg border border-[#21273a]">
                    <h3 className="text-gray-400 mb-2">Total Value Locked</h3>
                    <p className="text-2xl font-semibold text-white">$145,322,318.79</p>
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center space-x-4">
                    <div className="flex bg-[#1f2639] rounded-lg overflow-hidden">
                        <button 
                            className={`px-6 py-2 ${activeTab === 'pools' ? 'bg-blue-500 text-white hover:cursor-pointer'  : 'hover:cursor-pointer text-gray-400 hover:text-white'} font-medium transition-colors`}
                            disabled={true}
                            onClick={() => setActiveTab('pools')}
                        >
                            Pools
                        </button>
                        <button 
                            className={`px-6 py-2 ${activeTab === 'positions' ? 'bg-blue-500 text-white hover:cursor-pointer' : 'hover:cursor-pointer text-gray-400 hover:text-white'} font-medium transition-colors`}
                            onClick={() => setActiveTab('positions')}
                        >
                            Positions
                        </button>
                    </div>
                </div>
                <div className="flex items-center space-x-3">
                    <Link href='/pools/add' className='link'>
                        <button className="bg-blue-900 text-blue-500 px-4 py-2 rounded-xl font-medium hover:bg-blue-800 transition-colors flex items-center gap-2 hover:cursor-pointer">
                            Add Liquidity
                            <Plus size={16} />
                        </button>
                    </Link>
                    <Link href='/pools/create' className='link'>
                        <button className="bg-blue-900 text-blue-500 px-4 py-2 rounded-xl font-medium hover:bg-blue-800 transition-colors flex items-center gap-2 hover:cursor-pointer">
                            Create new pool
                            <Plus size={16} />
                        </button>
                    </Link>
                </div>
            </div>

            <div className="flex items-center justify-between mb-6">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Filter by token"
                        className="pl-10 pr-4 py-2 bg-[#1f2639] border border-[#21273a] rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-white"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
                <div className="flex items-center space-x-4">
                    {/* <label className="flex items-center space-x-2 text-sm cursor-pointer text-gray-300">
                        <input
                            type="checkbox"
                            checked={showWatchlist}
                            onChange={(e) => setShowWatchlist(e.target.checked)}
                            className="form-checkbox text-blue-500 rounded bg-[#1f2639] border-[#21273a]"
                        />
                        <span>Watchlist</span>
                    </label> */}
                    {/* <label className="flex items-center space-x-2 text-sm cursor-pointer text-gray-300">
                        <input
                            type="checkbox"
                            checked={showIncentivized}
                            onChange={(e) => setShowIncentivized(e.target.checked)}
                            className="form-checkbox text-blue-500 rounded bg-[#1f2639] border-[#21273a]"
                        />
                        <span>Incentivized Only</span>
                    </label> */}
                    <label className="flex items-center space-x-2 text-sm cursor-pointer text-gray-300">
                        <span>All pools</span>
                        <div className="relative inline-block w-10 mr-2 align-middle select-none">
                            <input 
                                type="checkbox" 
                                checked={showAllPools}
                                onChange={(e) => setShowAllPools(e.target.checked)}
                                className={`toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer transition-transform duration-200 ease-in-out ${showAllPools ? 'transform translate-x-full border-blue-500' : 'border-gray-300'}`}
                            />
                            <label className={`toggle-label block overflow-hidden h-6 rounded-full cursor-pointer transition-colors duration-200 ease-in-out ${showAllPools ? 'bg-blue-500' : 'bg-gray-300'}`}></label>
                        </div>
                    </label>
                    <button className="text-gray-400 hover:text-white transition-colors">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38"/>
                        </svg>
                    </button>
                </div>
            </div>

            {activeTab === 'pools' ? (
                <div className="overflow-x-auto bg-[#1f2639] rounded-lg border border-[#21273a]">
                    <table className="w-full">
                        <thead>
                            <tr className="text-gray-400 text-sm border-b border-[#21273a]">
                                <th className="text-left py-4 px-4">Pools</th>
                                <th className="text-right px-4">Liquidity</th>
                                <th className="text-right px-4">Volume (24H)</th>
                                <th className="text-right px-4">Fees (24H)</th>
                                {/* <th className="text-center px-4">Rewards</th> */}
                                {/* <th className="text-right px-4">Clear</th> */}
                                <th className="text-right px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pools.map((pool, index) => (
                                <tr key={index} className="border-b border-[#21273a] hover:bg-[#2c3552] transition-colors">
                                    <td className="py-4 px-4">
                                        <div className="flex items-center space-x-2">
                                            <div className="flex -space-x-2">
                                                <img src={"/vercel.svg"} alt={pool.token1.symbol} className="w-6 h-6 rounded-full ring-2 ring-[#1f2639]" />
                                                <img src={"/vercel.svg"} alt={pool.token2.symbol} className="w-6 h-6 rounded-full ring-2 ring-[#1f2639]" />
                                            </div>
                                            <span className="text-white">{pool.token1.symbol} - {pool.token2.symbol}</span>
                                            <span className="text-gray-400 text-sm">{pool.fee}</span>
                                        </div>
                                    </td>
                                    <td className="text-right px-4 text-white">{pool.liquidity}</td>
                                    <td className="text-right px-4 text-white">{pool.volume24h}</td>
                                    <td className="text-right px-4 text-white">{pool.fees24h}</td>
                                    {/* <td className="text-center px-4">
                                        <div className="flex items-center justify-center space-x-1">
                                            {pool.rewards.map((reward, i) => (
                                                <span key={i} className="px-2 py-0.5 bg-blue-900/20 text-blue-500 rounded text-xs">
                                                    {reward}
                                                </span>
                                            ))}
                                        </div>
                                    </td> */}
                                    {/* <td className="text-right px-4 text-blue-500">{pool.apr}</td>  */}
                                    <td className="text-right px-4">
                                        <button className="bg-blue-900 text-blue-500 px-4 py-1 rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors hover:cursor-pointer">
                                            Deposit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <div className="overflow-x-auto bg-[#1f2639] rounded-lg border border-[#21273a]">
                    <table className="w-full">
                        <thead>
                            <tr className="text-gray-400 text-sm border-b border-[#21273a]">
                                <th className="text-left py-4 px-4">My Positions</th>
                                <th className="text-right px-4">Range Status</th>
                                <th className="text-right px-4">Price Range</th>
                                <th className="text-right px-4">Fee earned</th>
                                <th className="text-center px-4">Clear Position</th>
                                <th className="text-center px-4">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loadingPositions ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-400">
                                        <div className="flex justify-center items-center space-x-2">
                                            <Loader2 className="h-5 w-5 animate-spin" />
                                            <span>Loading positions...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : !isConnected ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-400">Please connect your wallet to view positions.</td>
                                </tr>
                            ) : positions.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="text-center py-8 text-gray-400">No positions found.</td>
                                </tr>
                            ) : (
                                positions
                                    .filter(pos => {
                                        if (!searchQuery) return true;
                                        const queryLower = searchQuery.toLowerCase();
                                        return pos.token0.symbol.toLowerCase().includes(queryLower) ||
                                               pos.token1.symbol.toLowerCase().includes(queryLower) ||
                                               pos.token0.address.toLowerCase() === queryLower ||
                                               pos.token1.address.toLowerCase() === queryLower;
                                    })
                                    .map((position) => (
                                        <tr key={position.tokenId} className="border-b border-[#21273a] hover:bg-[#2c3552] transition-colors">
                                            <td className="py-4 px-4">
                                                <div className="flex items-center space-x-2">
                                                    <div className="flex -space-x-2">
                                                        <img src={"/token.png"} alt={position.token0.symbol} className="w-6 h-6 rounded-full ring-2 ring-[#1f2639] bg-white" />
                                                        <img src={"/token.png"} alt={position.token1.symbol} className="w-6 h-6 rounded-full ring-2 ring-[#1f2639] bg-white" />
                                                    </div>
                                                    <span className="text-white font-medium">{position.token0.symbol} / {position.token1.symbol}</span>
                                                    <span className="text-gray-400 text-sm bg-[#2c3552] px-2 py-0.5 rounded">{position.fee / 10000}%</span>
                                                </div>
                                            </td>
                                            <td className="text-right px-4">
                                                <span className={`px-2 py-1 rounded text-xs font-medium ${position.inRange ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                                                    {position.inRange ? 'In Range' : 'Out of Range'}
                                                </span>
                                            </td>
                                            <td className="text-right px-4 text-white text-sm">
                                                {formatPriceRange(position)}
                                            </td>
                                            <td className="text-right px-4 text-white text-sm">
                                                {formatUnclaimedFees(position)}
                                                {position.txHash && (
                                                    <a href={`https://sepolia.etherscan.io/tx/${position.txHash}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 text-xs ml-1 hover:underline">(view tx)</a>
                                                )}
                                            </td>
                                            <td className="text-center px-4">
                                                <button
                                                    onClick={() => handleRemoveLiquidity(position.tokenId)}
                                                    disabled={position.isLoading || position.liquidity === BigInt(0)}
                                                    className={`bg-red-900 text-red-500 px-3 py-1 rounded-xl text-sm font-medium transition-colors hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${position.isLoading ? 'animate-pulse' : 'hover:bg-red-800'}`}
                                                >
                                                    {position.isLoading ? <Loader2 className="h-4 w-4 animate-spin inline-block"/> : 'Remove'}
                                                </button>
                                            </td>
                                            <td className="text-center px-4">
                                                <button
                                                    onClick={() => handleCollectFees(position)}
                                                    disabled={position.isCollecting || !!position.error || !position.unclaimedFees || (position.unclaimedFees.amount0 === BigInt(0) && position.unclaimedFees.amount1 === BigInt(0))}
                                                    className={`bg-blue-900 text-blue-500 px-3 py-1 rounded-xl text-sm font-medium transition-colors hover:cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${position.isCollecting ? 'animate-pulse' : 'hover:bg-blue-800'}`}
                                                >
                                                    {position.isCollecting ? <Loader2 className="h-4 w-4 animate-spin inline-block"/> : 'Claim'}
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

export default PoolsPage;
// export default function Pools() {
//   return (
//     <div className="min-h-screen flex justify-center items-start py-12">
//       <div className="w-full max-w-6xl bg-[#0E111B] border-2 border-[#21273a] rounded-2xl p-6 space-y-4">
//         <div className="flex justify-between items-center">
//           <h4 className="text-xl font-bold">Liquidity Pools</h4>
//         </div>

//         <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
//           {/* Pool cards will be added here */}
//           <div className="bg-[#1f2639] p-4 rounded-xl border border-[#21273a]">
//             <div className="flex items-center justify-between mb-4">
//               <div className="flex items-center gap-2">
//                 <div className="w-8 h-8 bg-blue-500 rounded-full"></div>
//                 <div className="w-8 h-8 bg-green-500 rounded-full -ml-2"></div>
//                 <span className="font-medium">ETH/USDC</span>
//               </div>
//               <span className="text-sm text-gray-400">APR: 12.5%</span>
//             </div>
//             <div className="space-y-2">
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-400">TVL:</span>
//                 <span>$1,234,567</span>
//               </div>
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-400">Volume 24h:</span>
//                 <span>$123,456</span>
//               </div>
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-400">My Liquidity:</span>
//                 <span>$0.00</span>
//               </div>
//             </div>
//             <button className="w-full mt-4 py-2 bg-blue-900 text-blue-500 rounded-xl font-medium hover:bg-blue-800 transition-colors">
//               Add Liquidity
//             </button>
//           </div>

//           {/* Example pool card */}
//           <div className="bg-[#1f2639] p-4 rounded-xl border border-[#21273a]">
//             <div className="flex items-center justify-between mb-4">
//               <div className="flex items-center gap-2">
//                 <div className="w-8 h-8 bg-purple-500 rounded-full"></div>
//                 <div className="w-8 h-8 bg-yellow-500 rounded-full -ml-2"></div>
//                 <span className="font-medium">LINK/USDT</span>
//               </div>
//               <span className="text-sm text-gray-400">APR: 8.2%</span>
//             </div>
//             <div className="space-y-2">
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-400">TVL:</span>
//                 <span>$987,654</span>
//               </div>
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-400">Volume 24h:</span>
//                 <span>$76,543</span>
//               </div>
//               <div className="flex justify-between text-sm">
//                 <span className="text-gray-400">My Liquidity:</span>
//                 <span>$0.00</span>
//               </div>
//             </div>
//             <button className="w-full mt-4 py-2 bg-blue-900 text-blue-500 rounded-xl font-medium hover:bg-blue-800 transition-colors">
//               Add Liquidity
//             </button>
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }