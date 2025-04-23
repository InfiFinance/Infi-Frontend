"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Input, message } from 'antd';
import TokenSelectionModal from '@/components/TokenSelectionModal';
import { TokenInfo } from '@/services/tokenService';
import { ChevronDownIcon } from "lucide-react";
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { BrowserProvider, Contract, Eip1193Provider, ethers } from "ethers";
import { ADDRESSES } from '@/constants/addresses';
import { 
    priceToTick, 
    sortTokens, 
    POOL_ABI, 
    ERC20_ABI, 
    POSITION_MANAGER_ABI, 
    FACTORY_ABI,
    decodeSqrtPriceX96
} from '@/utils/contracts';

const MIN_TICK = -887272;
const MAX_TICK = 887272;

const AddLiquidity = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedBaseToken, setSelectedBaseToken] = useState<TokenInfo | null>(null);
  const [selectedQuoteToken, setSelectedQuoteToken] = useState<TokenInfo | null>(null);
  const [selectedFeeTier, setSelectedFeeTier] = useState<string>("");
  const [rangeType, setRangeType] = useState("full");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [baseAmount, setBaseAmount] = useState<string>("");
  const [quoteAmount, setQuoteAmount] = useState<string>("");
  const [poolAddress, setPoolAddress] = useState<string | null>(null);
  const [poolExistsStatus, setPoolExistsStatus] = useState<'idle' | 'checking' | 'exists' | 'not_found'>('idle');
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [changeToken, setChangeToken] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [currentSqrtPriceX96, setCurrentSqrtPriceX96] = useState<bigint | null>(null);

  const [messageApi, contextHolder] = message.useMessage();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [ethersProvider, setEthersProvider] = useState<BrowserProvider | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (walletProvider) {
      try {
        const provider = new BrowserProvider(walletProvider as Eip1193Provider);
        setEthersProvider(provider);
        console.log("[AddLiquidity] Ethers Provider set.");
      } catch (error) {
         console.error("[AddLiquidity] Error creating Ethers Provider:", error);
         setEthersProvider(null); 
      }
    } else {
      setEthersProvider(null);
    }
  }, [walletProvider]);

  // --- Fetch Pool Address & Price Logic --- 
  const fetchPoolData = useCallback(async () => {
    if (!ethersProvider || !selectedBaseToken || !selectedQuoteToken || !selectedFeeTier) {
        setPoolExistsStatus('idle'); setPoolAddress(null); setCurrentSqrtPriceX96(null);
        return;
    }
    console.log("Queueing fetch for pool data...");
    setPoolExistsStatus('checking'); setPoolAddress(null); setCurrentSqrtPriceX96(null);
    if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);

    debounceTimeoutRef.current = setTimeout(async () => {
        console.log("Executing debounced pool data fetch...");
        try {
            const [token0Address, token1Address] = sortTokens(selectedBaseToken.address, selectedQuoteToken.address);
            const feeTierNumber = parseInt(selectedFeeTier, 10);
            if (isNaN(feeTierNumber)) { throw new Error("Invalid fee tier"); }

            console.log(`[fetchPoolData] Checking pool with: T0=${token0Address}, T1=${token1Address}, Fee=${feeTierNumber}`);
            const factory = new ethers.Contract(ADDRESSES.factory, FACTORY_ABI, ethersProvider);
            const existingPoolAddress = await factory.getPool(token0Address, token1Address, feeTierNumber);

            if (existingPoolAddress && existingPoolAddress !== ethers.ZeroAddress) {
                console.log("Pool found:", existingPoolAddress);
                setPoolAddress(existingPoolAddress);
                setPoolExistsStatus('exists');
                // Fetch slot0 for price
                try {
                    const poolContract = new ethers.Contract(existingPoolAddress, POOL_ABI, ethersProvider);
                    const slot0 = await poolContract.slot0();
                    const sqrtPrice = slot0[0]; 
                    setCurrentSqrtPriceX96(BigInt(sqrtPrice)); 
                    console.log("Pool sqrtPriceX96:", sqrtPrice.toString());
                } catch (priceError) {
                    console.error("Error fetching pool price (slot0):", priceError);
                    messageApi.error("Pool found, but failed to fetch price.");
                    setCurrentSqrtPriceX96(null); // Indicate price fetch failed
                }
            } else {
                console.log("Pool not found.");
                setPoolAddress(null); setPoolExistsStatus('not_found'); setCurrentSqrtPriceX96(null);
            }
        } catch (error) {
            console.error("Error fetching pool data:", error);
            setPoolAddress(null); setPoolExistsStatus('idle'); setCurrentSqrtPriceX96(null);
            messageApi.error("Could not fetch pool data.");
        }
    }, 750);
  }, [ethersProvider, selectedBaseToken, selectedQuoteToken, selectedFeeTier, messageApi]);

  // Trigger pool data fetch
  useEffect(() => {
    fetchPoolData();
    return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
  }, [fetchPoolData]);

  const handleContinue = async () => {
    if (!isConnected || !ethersProvider) {
        messageApi.error("Connect wallet");
        return;
    }

    try {
        if (currentStep === 1) {
            if (!selectedBaseToken || !selectedQuoteToken || !selectedFeeTier) throw new Error('Select tokens & fee.');
            if (poolExistsStatus !== 'exists' || !poolAddress) {
                if (poolExistsStatus === 'checking') throw new Error('Still checking for pool...');
                else if (poolExistsStatus === 'not_found') throw new Error('Pool not found for this pair/fee.');
                else throw new Error('Pool status unknown or not found.');
            }
            // Check if price was fetched
            if (currentSqrtPriceX96 === null) {
                 throw new Error("Pool price could not be determined. Cannot calculate ratios."); 
            }
            console.log("[handleContinue] Step 1 validation passed.");
            setCurrentStep(2);

        } else if (currentStep === 2) {
            if (!baseAmount || !quoteAmount || parseFloat(baseAmount) <= 0 || parseFloat(quoteAmount) <= 0) throw new Error('Enter valid deposit amounts.');
            if (rangeType === 'custom' && (!minPrice || !maxPrice || parseFloat(minPrice) < 0 || parseFloat(maxPrice) <= parseFloat(minPrice))) throw new Error('Invalid custom price range.');
            
            await handleLiquiditySubmit(); 
        }
    } catch (error: any) {
        console.error("Step Error:", error);
        messageApi.error({ content: `Error: ${error.message || 'An unexpected error occurred.'}`, key: 'stepChange', duration: 5 });
        if (isProcessing) setIsProcessing(false);
    }
  };

  const handleBaseTokenSelect = (tokenSymbol: string) => {
    console.warn(`handleBaseTokenSelect for ${tokenSymbol} needs update - local tokenList removed.`);
  };

  const openModal = (tokenIndex: number) => {
    setChangeToken(tokenIndex);
    setIsOpen(true);
  };

  const modifyToken = (token: TokenInfo) => {
    const selectedAddress = token.address;
    const otherTokenAddress = changeToken === 1 ? selectedQuoteToken?.address : selectedBaseToken?.address;
    
    if (selectedAddress === otherTokenAddress) {
      const tempBase = selectedBaseToken;
      const tempQuote = selectedQuoteToken;
      setSelectedBaseToken(tempQuote);
      setSelectedQuoteToken(tempBase);
    } else {
      if (changeToken === 1) setSelectedBaseToken(token);
      else setSelectedQuoteToken(token);
    }
    
    setIsOpen(false);
    setBaseAmount("");
    setQuoteAmount("");
    setPoolAddress(null); 
    setPoolExistsStatus('idle');
    setCurrentSqrtPriceX96(null);
  };

  const handleLiquiditySubmit = async () => {
    if (!ethersProvider || !address || !selectedBaseToken || !selectedQuoteToken || !selectedFeeTier || !baseAmount || !quoteAmount || !poolAddress) { 
        messageApi.error({ content: 'Internal Error: Missing required info.', key: 'addLiquidityAction' });
        return; 
    }

    setIsProcessing(true);
    const actionKey = 'addLiquidityAction';
    messageApi.loading({ content: 'Starting liquidity addition...', key: actionKey });
    let txSuccess = false;

    try {
        const signer = await ethersProvider.getSigner();
        const positionManager = new ethers.Contract(ADDRESSES.positionManager, POSITION_MANAGER_ABI, signer);
        const baseTokenContract = new ethers.Contract(selectedBaseToken.address, ERC20_ABI, signer);
        const quoteTokenContract = new ethers.Contract(selectedQuoteToken.address, ERC20_ABI, signer);

        let tickSpacing = 1;
        console.warn("Using assumed/default tickSpacing for calculation", tickSpacing);

        const [token0Address, token1Address] = sortTokens(selectedBaseToken.address, selectedQuoteToken.address);
        let tickLower: number, tickUpper: number;
        if (rangeType === 'full') {
            tickLower = Math.ceil(MIN_TICK / tickSpacing) * tickSpacing; 
            tickUpper = Math.floor(MAX_TICK / tickSpacing) * tickSpacing;
        } else { 
            if (!minPrice || !maxPrice || parseFloat(minPrice) < 0 || parseFloat(maxPrice) <= parseFloat(minPrice)) {
                throw new Error("Invalid custom price range provided for submission.");
            }
            let minP = parseFloat(minPrice); let maxP = parseFloat(maxPrice);
            if (selectedBaseToken.address.toLowerCase() !== token0Address.toLowerCase()) { 
                const invMin = 1 / maxP; const invMax = 1 / minP;
                minP = invMin; maxP = invMax;
            }
            tickLower = priceToTick(minP); tickUpper = priceToTick(maxP);
            tickLower = Math.ceil(tickLower / tickSpacing) * tickSpacing;
            tickUpper = Math.floor(tickUpper / tickSpacing) * tickSpacing;
        }
        tickLower = Math.max(MIN_TICK, tickLower); tickUpper = Math.min(MAX_TICK, tickUpper);
        console.log(`Submit Ticks: L=${tickLower}, U=${tickUpper}, Spacing=${tickSpacing}`);

        const baseAmt = ethers.parseUnits(baseAmount, selectedBaseToken.decimals);
        const quoteAmt = ethers.parseUnits(quoteAmount, selectedQuoteToken.decimals);
        const amount0 = selectedBaseToken.address.toLowerCase() === token0Address.toLowerCase() ? baseAmt : quoteAmt;
        const amount1 = selectedBaseToken.address.toLowerCase() === token0Address.toLowerCase() ? quoteAmt : baseAmt;

        messageApi.loading({ content: 'Checking approvals...', key: actionKey });
        const contract0 = selectedBaseToken.address.toLowerCase() === token0Address.toLowerCase() ? baseTokenContract : quoteTokenContract;
        const contract1 = selectedBaseToken.address.toLowerCase() === token0Address.toLowerCase() ? quoteTokenContract : baseTokenContract;
        const symbol0 = selectedBaseToken.address.toLowerCase() === token0Address.toLowerCase() ? selectedBaseToken.symbol : selectedQuoteToken.symbol;
        const symbol1 = selectedBaseToken.address.toLowerCase() === token0Address.toLowerCase() ? selectedQuoteToken.symbol : selectedBaseToken.symbol;
        
        const approveIfNeeded = async (contract: Contract, amt: bigint, sym: string) => {
            if (amt > BigInt(0)) {
               const allowance = await contract.allowance(address, ADDRESSES.positionManager);
               if (allowance < amt) {
                  messageApi.loading({ content: `Approving ${sym}...`, key: actionKey });
                  const approveTx = await contract.approve(ADDRESSES.positionManager, amt);
                  await approveTx.wait();
                  messageApi.success({content: `${sym} approved!`, key: actionKey, duration: 2});
               }
            }
        };
        await approveIfNeeded(contract0, amount0, symbol0);
        await approveIfNeeded(contract1, amount1, symbol1);
        
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
        const feeTierNumber = parseInt(selectedFeeTier, 10);
        const mintParams = {
            token0: token0Address, token1: token1Address, fee: feeTierNumber,
            tickLower, tickUpper, amount0Desired: amount0, amount1Desired: amount1, 
            amount0Min: BigInt(0), amount1Min: BigInt(0), 
            recipient: address, deadline,
        };
        messageApi.loading({ content: 'Adding liquidity...', key: actionKey });
        const mintTx = await positionManager.mint(mintParams);
        messageApi.loading({ content: 'Waiting for confirmation...', key: actionKey });
        const mintReceipt = await mintTx.wait();
        if (mintReceipt.status !== 1) throw new Error("Add liquidity transaction failed.");
        
        txSuccess = true; 
        messageApi.success({ content: 'Liquidity added successfully! 🎉', key: actionKey, duration: 5 });

    } catch (error: any) {
        console.error("Add Liq Error:", error);
        messageApi.error({ content: `Failed: ${error.reason || error.message || 'Unknown error'}`, key: actionKey, duration: 5 });
    } finally {
        if (!txSuccess) messageApi.destroy(actionKey); 
        setIsProcessing(false); 
    }
  };

  const handleBaseAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputBaseAmount = e.target.value;
    setBaseAmount(inputBaseAmount);

    if (!currentSqrtPriceX96 || !selectedBaseToken || !selectedQuoteToken || !inputBaseAmount) {
        setQuoteAmount(""); return;
    }

    try {
        const baseNum = parseFloat(inputBaseAmount);
        if (isNaN(baseNum) || baseNum <= 0) { setQuoteAmount(""); return; }
        
        const priceRatio = decodeSqrtPriceX96(currentSqrtPriceX96); 
        if (priceRatio <= 0) { setQuoteAmount(""); return; } 

        const [token0Address] = sortTokens(selectedBaseToken.address, selectedQuoteToken.address);
        const isBaseToken0 = selectedBaseToken.address.toLowerCase() === token0Address.toLowerCase();

        let otherTokenAmount: number;
        if (isBaseToken0) {
            otherTokenAmount = baseNum * priceRatio;
        } else {
            otherTokenAmount = baseNum / priceRatio;
        }
        setQuoteAmount(otherTokenAmount.toFixed(selectedQuoteToken.decimals > 8 ? 8 : selectedQuoteToken.decimals));

    } catch (error) {
        console.error("Error calculating quote amount from ratio:", error);
        setQuoteAmount("");
    }
  };

  const handleQuoteAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputQuoteAmount = e.target.value;
    setQuoteAmount(inputQuoteAmount);

    if (!currentSqrtPriceX96 || !selectedBaseToken || !selectedQuoteToken || !inputQuoteAmount) {
         setBaseAmount(""); return;
    }

    try {
        const quoteNum = parseFloat(inputQuoteAmount);
        if (isNaN(quoteNum) || quoteNum <= 0) { setBaseAmount(""); return; }

        const priceRatio = decodeSqrtPriceX96(currentSqrtPriceX96); 
        if (priceRatio <= 0) { setBaseAmount(""); return; }

        const [token0Address] = sortTokens(selectedBaseToken.address, selectedQuoteToken.address);
        const isQuoteToken0 = selectedQuoteToken.address.toLowerCase() === token0Address.toLowerCase();

        let otherTokenAmount: number;
        if (isQuoteToken0) {
            otherTokenAmount = quoteNum * priceRatio;
        } else {
            otherTokenAmount = quoteNum / priceRatio;
        }
        setBaseAmount(otherTokenAmount.toFixed(selectedBaseToken.decimals > 8 ? 8 : selectedBaseToken.decimals));

    } catch (error) {
        console.error("Error calculating base amount from ratio:", error);
        setBaseAmount("");
    }
  };

  return (
    <div className="flex w-full max-w-6xl mx-auto p-4 gap-8">
      {contextHolder}
      <div className="w-1/4 bg-[#1f2639] rounded-lg p-4 h-fit border border-[#21273a]">
        <div className="space-y-6">
          <div className={`flex items-start space-x-4 ${currentStep === 1 ? '' : 'opacity-50'}}}`}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">1</div>
            <div>
              <h3 className="font-medium text-white">Select token & fee tier</h3>
              <p className="text-sm text-gray-400">Select the token you want to provide liquidity for.</p>
            </div>
          </div>

          <div className={`flex items-start space-x-4 ${currentStep === 2 ? '' : 'opacity-50'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${currentStep === 2 ? 'bg-blue-500' : 'bg-[#2c3552]'} flex items-center justify-center text-white font-medium`}>2</div>
            <div>
              <h3 className="font-medium text-white">Deposit & Set Price Range</h3>
              <p className="text-sm text-gray-400">Enter deposit amounts and set price range.</p>
            </div>
          </div>
        </div>
        {currentStep > 1 && (
          <button
            onClick={() => setCurrentStep(currentStep - 1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors mt-4 px-2 py-1"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6"/>
            </svg>
            Back
          </button>
        )}
      </div>

      <div className="flex-1 bg-[#1f2639] rounded-lg p-6 border border-[#21273a]">
        {currentStep === 1 && (
          <div className="space-y-6">
            <h2 className="text-xl font-medium text-white">Select pair</h2>
            <p className="text-gray-400">Select the token you want to create a liquidity pool for.</p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white mb-2">Base token</label>
                <div className="bg-[#2c3552] rounded-lg p-3 cursor-pointer hover:bg-[#374264] transition-colors" onClick={() => openModal(1)}>
                  <div className="flex items-center justify-between text-gray-400">
                    {selectedBaseToken ? (
                      <div className="flex items-center gap-2">
                        <img 
                            src={selectedBaseToken.logoURI || "/vercel.svg"} 
                            alt={selectedBaseToken.symbol}
                            className="w-6 h-6 rounded-full" 
                         />
                        <span className="text-white">{selectedBaseToken.symbol}</span>
                      </div>
                    ) : (
                      <>
                        <span>Select token</span>
                        <ChevronDownIcon className="w-5 h-5" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Quote token</label>
                <div className="bg-[#2c3552] rounded-lg p-3 cursor-pointer hover:bg-[#374264] transition-colors" onClick={() => openModal(2)}>
                  <div className="flex items-center justify-between text-gray-400">
                    {selectedQuoteToken ? (
                      <div className="flex items-center gap-2">
                        <img 
                            src={selectedQuoteToken.logoURI || "/vercel.svg"} 
                            alt={selectedQuoteToken.symbol} 
                            className="w-6 h-6 rounded-full" 
                         />
                        <span className="text-white">{selectedQuoteToken.symbol}</span>
                      </div>
                    ) : (
                      <>
                        <span>Select token</span>
                        <ChevronDownIcon className="w-5 h-5" />
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-white mb-2">Fee tier</label>
                <p className="text-sm text-gray-400 mb-2">The % you will earn in fees.</p>
                <div className="relative">
                  <select
                    className="w-full bg-[#2c3552] text-white rounded-lg p-3 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-[#374264] transition-colors"
                    value={selectedFeeTier}
                    onChange={(e) => {
                        setSelectedFeeTier(e.target.value);
                        setPoolAddress(null); 
                        setPoolExistsStatus('idle');
                    }} 
                    disabled={isProcessing}
                  >
                    <option value="" disabled>Select fee tier</option>
                    <option value="100">0.01%</option>  
                    <option value="500">0.05%</option>
                    <option value="3000">0.30%</option>
                    <option value="10000">1.00%</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Pool Status Display */} 
            <div className="mt-4 h-6 text-sm">
                {poolExistsStatus === 'checking' && <span className="text-yellow-400">Checking for pool...</span>}
                {poolExistsStatus === 'exists' && currentSqrtPriceX96 === null && <span className="text-orange-400"> Pool found, but price unavailable.</span>}
                {poolExistsStatus === 'not_found' && <span className="text-red-400">Pool not found for this pair/fee.</span>}
            </div>
          </div>
        )}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-medium text-white">Deposit amounts</h2>
              <p className="text-gray-400">Enter the amounts you want to deposit.</p>

              <div className="space-y-4 mt-4">
                <div>
                  <div className="bg-[#2c3552] rounded-lg p-3 hover:bg-[#374264] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src={selectedBaseToken?.logoURI || "/vercel.svg"} alt={selectedBaseToken?.symbol} className="w-6 h-6 rounded-full" />
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{selectedBaseToken?.symbol || 'Select Token'}</span>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="0.0"
                        value={baseAmount}
                        onChange={handleBaseAmountChange}
                        disabled={isProcessing}
                        className="bg-transparent text-right outline-none w-1/2 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <div className="bg-[#2c3552] rounded-lg p-3 hover:bg-[#374264] transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <img src={selectedQuoteToken?.logoURI || "/vercel.svg"} alt={selectedQuoteToken?.symbol} className="w-6 h-6 rounded-full" />
                        <div className="flex flex-col">
                          <span className="font-medium text-white">{selectedQuoteToken?.symbol || 'Select Token'}</span>
                        </div>
                      </div>
                      <input
                        type="text"
                        placeholder="0.0"
                        value={quoteAmount}
                        onChange={handleQuoteAmountChange}
                        disabled={isProcessing}
                        className="bg-transparent text-right outline-none w-1/2 text-white placeholder-gray-400"
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-4">
                  <div className="text-sm text-gray-400 mb-2">Total Amount</div>
                  <div className="text-xl font-medium text-white">--</div>
                </div>

                <div className="mt-2">
                  <div className="text-sm text-gray-400 mb-2">Deposit Ratio</div>
                  <div className="flex items-center space-x-2 text-white">
                    <div className="flex items-center">
                      <img src={selectedBaseToken?.logoURI || "/vercel.svg"} alt={selectedBaseToken?.symbol} className="w-4 h-4 rounded-full mr-1" />
                      <span>{selectedBaseToken?.symbol} 50%</span>
                    </div>
                    <div className="flex items-center">
                      <img src={selectedQuoteToken?.logoURI || "/vercel.svg"} alt={selectedQuoteToken?.symbol} className="w-4 h-4 rounded-full mr-1" />
                      <span>{selectedQuoteToken?.symbol} 50%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-[#21273a] pt-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-medium text-white">Set Price Range</h2>
                <div className="flex items-center gap-2">
                  <button
                    className={`flex items-center gap-2 rounded-lg px-3 py-1 cursor-pointer ${selectedBaseToken?.symbol === 'ETH' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
                    onClick={() => handleBaseTokenSelect('ETH')}
                  >
                    <img src={selectedBaseToken?.logoURI || "/vercel.svg"} alt={selectedBaseToken?.symbol} className="w-5 h-5" />
                    <span>{selectedBaseToken?.symbol}</span>
                  </button>
                  <button
                    className={`flex items-center gap-2 rounded-lg px-3 py-1 cursor-pointer ${selectedBaseToken?.symbol === 'SUI' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
                    onClick={() => handleBaseTokenSelect('SUI')}
                  >
                    <img src={selectedQuoteToken?.logoURI || "/vercel.svg"} alt={selectedQuoteToken?.symbol} className="w-5 h-5" />
                    <span>{selectedQuoteToken?.symbol}</span>
                  </button>
                </div>
              </div>
              <p className="text-gray-400">Please specify a price range that you want to provide your liquidity within.</p>

              <div className="flex gap-4 mt-4">
                <button
                  className={`flex-1 py-3 rounded-lg ${rangeType === 'full' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
                  onClick={() => {
                    setRangeType('full');
                    setMinPrice('0');
                    setMaxPrice('∞');
                  }}
                >
                  Full Range
                </button>
                <button
                  className={`flex-1 py-3 rounded-lg ${rangeType === 'custom' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
                  onClick={() => setRangeType('custom')}
                >
                  Custom Range
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-4">
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Min Price</label>
                  <div className="relative">
                    <button 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      disabled={rangeType === 'full'}
                    >-</button>
                    <input
                      type="text"
                      value={minPrice}
                      onChange={(e) => setMinPrice(e.target.value)}
                      disabled={rangeType === 'full'}
                      className="w-full bg-[#2c3552] text-white rounded-lg p-3 pl-8 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#374264] transition-colors"
                    />
                    <button 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      disabled={rangeType === 'full'}
                    >+</button>
                    <div className="text-xs text-gray-400 text-center mt-1">{selectedQuoteToken?.symbol || 'QUOTE'} per {selectedBaseToken?.symbol || 'BASE'}</div>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-white mb-2">Max Price</label>
                  <div className="relative">
                    <button 
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                      disabled={rangeType === 'full'}
                    >-</button>
                    <input
                      type="text"
                      value={maxPrice}
                      onChange={(e) => setMaxPrice(e.target.value)}
                      disabled={rangeType === 'full'}
                      className="w-full bg-[#2c3552] text-white rounded-lg p-3 pl-8 pr-8 focus:outline-none focus:ring-2 focus:ring-blue-500 text-center disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#374264] transition-colors"
                    />
                    <button 
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                      disabled={rangeType === 'full'}
                    >+</button>
                    <div className="text-xs text-gray-400 text-center mt-1">{selectedQuoteToken?.symbol || 'QUOTE'} per {selectedBaseToken?.symbol || 'BASE'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          <button 
            className={`w-full bg-blue-900 text-blue-500 py-3 rounded-xl font-medium transition-colors ${isProcessing || !isConnected || (currentStep === 1 && (poolExistsStatus !== 'exists' || currentSqrtPriceX96 === null)) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-800'}`}
            onClick={handleContinue}
            disabled={isProcessing || !isConnected || (currentStep === 1 && (poolExistsStatus !== 'exists' || currentSqrtPriceX96 === null))}
          >
            {isProcessing ? 'Processing...' : (currentStep === 1 ? 'Continue' : 'Add Liquidity')}
          </button>
        </div>
      </div>

      <TokenSelectionModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSelect={modifyToken}
       />
    </div>
  );
};

export default AddLiquidity;