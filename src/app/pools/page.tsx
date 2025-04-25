"use client";
import { useState } from "react";
import Link from 'next/link'
import { Search, Plus } from "lucide-react";
// import { Button } from "../ui/button";
// import suiIcon from "../../assets/sui.png";
// import usdcIcon from "../../assets/usdc.svg";
import { useNavigate } from "react-router-dom";
import Logo from '../../../public/vercel.svg';


const PoolsPage = () => {
    //   const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState("");
    const [showWatchlist, setShowWatchlist] = useState(false);
    const [showIncentivized, setShowIncentivized] = useState(false);
    const [showAllPools, setShowAllPools] = useState(false);
    const [activeTab, setActiveTab] = useState('pools');

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
                                <th className="text-left py-4 px-4">Pools</th>
                                <th className="text-right px-4">Liquidity</th>
                                <th className="text-right px-4">Volume (24H)</th>
                                <th className="text-right px-4">Fees (24H)</th>
                                <th className="text-center px-4">Fee earned</th>
                                <th className="text-right px-4">Clear Position</th>
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
                                    <td className="text-center px-4">
                                        <div className="flex items-center justify-center space-x-1">
                                            {pool.rewards.map((reward, i) => (
                                                <div key={i} className="flex items-center space-x-1">
                                                    <span className="text-white text-xs">100</span>
                                                    <span className="px-2 py-0.5 bg-blue-900/20 text-blue-500 rounded text-xs">
                                                        {reward}
                                                    </span>
                                                    {i < pool.rewards.length - 1 && <span className="text-gray-400">+</span>}
                                                </div>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="text-right px-4"> <button className="bg-red-900/50 text-red-400 px-4 py-1 rounded-xl text-sm font-medium hover:bg-red-800/50 transition-colors hover:cursor-pointer">
                                            Remove
                                        </button></td>
                                    <td className="text-right px-4">
                                        <button className="bg-blue-900 text-blue-500 px-4 py-1 rounded-xl text-sm font-medium hover:bg-blue-800 transition-colors hover:cursor-pointer">
                                            Claim
                                        </button>
                                    </td>
                                </tr>
                            ))}
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