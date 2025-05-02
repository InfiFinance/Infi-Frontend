"use client";

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Input, message } from 'antd';
import TokenSelectionModal from '@/components/TokenSelectionModal';
import { TokenInfo, DEFAULT_TOKEN_LIST } from '@/services/tokenService';
import { ChevronDownIcon } from "lucide-react";
import { useSearchParams } from 'next/navigation';
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
    decodeSqrtPriceX96,
    getGasOptions
} from '@/utils/contracts';
import { LiquidityService, processTickRange } from '@/utils/liquidityService';

const MIN_TICK = -887272;
const MAX_TICK = 887272;

const AddLiquidity = () => {
  const searchParams = useSearchParams();
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
  const [poolTickSpacing, setPoolTickSpacing] = useState<number | null>(null);
  const [baseRatioPercent, setBaseRatioPercent] = useState<number | null>(null);
  const [quoteRatioPercent, setQuoteRatioPercent] = useState<number | null>(null);

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

  // --- Effect to read query params and set initial tokens ---
  useEffect(() => {
    const token0Symbol = searchParams.get('token0');
    const token1Symbol = searchParams.get('token1');

    if (token0Symbol && token1Symbol) {
      console.log(`[AddLiquidity] Found query params: token0=${token0Symbol}, token1=${token1Symbol}`);
      const baseToken = DEFAULT_TOKEN_LIST.tokens.find(t => t.symbol.toLowerCase() === token0Symbol.toLowerCase());
      const quoteToken = DEFAULT_TOKEN_LIST.tokens.find(t => t.symbol.toLowerCase() === token1Symbol.toLowerCase());

      if (baseToken) {
        console.log("[AddLiquidity] Setting base token from query param:", baseToken.symbol);
        setSelectedBaseToken(baseToken);
      } else {
        console.warn(`[AddLiquidity] Token symbol '${token0Symbol}' from query param not found in default list.`);
      }
      
      if (quoteToken) {
        console.log("[AddLiquidity] Setting quote token from query param:", quoteToken.symbol);
        setSelectedQuoteToken(quoteToken);
      } else {
        console.warn(`[AddLiquidity] Token symbol '${token1Symbol}' from query param not found in default list.`);
      }
    } else {
      console.log("[AddLiquidity] No token query parameters found.");
    }
  // Run only once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps 
  }, []); 

  // --- Fetch Pool Address & Price Logic --- 
  const fetchPoolData = useCallback(async () => {
    if (!ethersProvider || !selectedBaseToken || !selectedQuoteToken || !selectedFeeTier) {
        setPoolExistsStatus('idle'); setPoolAddress(null); setCurrentSqrtPriceX96(null); setPoolTickSpacing(null);
        return;
    }
    console.log("Queueing fetch for pool data...");
    setPoolExistsStatus('checking'); setPoolAddress(null); setCurrentSqrtPriceX96(null); setPoolTickSpacing(null);
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
                // Fetch details concurrently
                try {
                    const poolContract = new ethers.Contract(existingPoolAddress, POOL_ABI, ethersProvider);
                    const [slot0Result, tickSpacingResult] = await Promise.all([
                         poolContract.slot0(),
                         poolContract.tickSpacing()
                    ]);
                    // Process slot0
                    const sqrtPrice = slot0Result[0];
                    setCurrentSqrtPriceX96(BigInt(sqrtPrice));
                    console.log("Pool sqrtPriceX96:", sqrtPrice.toString());
                    // Process tickSpacing
                    const spacing = Number(tickSpacingResult);
                    setPoolTickSpacing(spacing);
                    console.log("Pool Tick Spacing:", spacing);
                } catch (dataError) {
                    console.error("Error fetching pool price/spacing:", dataError);
                    messageApi.error("Pool found, but failed to fetch details.");
                    setCurrentSqrtPriceX96(null); setPoolTickSpacing(null);
                }
            } else {
                console.log("Pool not found.");
                setPoolAddress(null); setPoolExistsStatus('not_found'); setCurrentSqrtPriceX96(null); setPoolTickSpacing(null);
            }
        } catch (error) {
            console.error("Error fetching pool data:", error);
            setPoolAddress(null); setPoolExistsStatus('idle'); setCurrentSqrtPriceX96(null); setPoolTickSpacing(null);
            messageApi.error("Could not fetch pool data.");
        }
    }, 750);
  }, [ethersProvider, selectedBaseToken, selectedQuoteToken, selectedFeeTier, messageApi]);

  // Trigger pool data fetch
  useEffect(() => {
    fetchPoolData();
    return () => { if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current); };
  }, [fetchPoolData]);

  // useEffect to calculate deposit ratio based on current pool price
  useEffect(() => {
    if (currentSqrtPriceX96 !== null && selectedBaseToken && selectedQuoteToken) {
        try {
            const [token0Address] = sortTokens(selectedBaseToken.address, selectedQuoteToken.address);
            let currentPrice = decodeSqrtPriceX96(currentSqrtPriceX96);
            // Adjust price based on which token is token0 for the UI display
            if (selectedBaseToken.address.toLowerCase() !== token0Address.toLowerCase()) {
                if (currentPrice !== 0) { // Avoid division by zero
                  currentPrice = 1 / currentPrice;
                }
            }

            if (!isNaN(currentPrice) && currentPrice > 0) {
                const basePercent = (1 / (1 + currentPrice)) * 100;
                const quotePercent = (currentPrice / (1 + currentPrice)) * 100;
                setBaseRatioPercent(basePercent);
                setQuoteRatioPercent(quotePercent);
            } else {
                setBaseRatioPercent(null); // Invalid price
                setQuoteRatioPercent(null);
            }
        } catch (error) {
            console.error("Error calculating ratio from sqrtPrice:", error);
            setBaseRatioPercent(null); // Error calculating
            setQuoteRatioPercent(null);
        }
    } else {
        setBaseRatioPercent(null); // Reset if inputs are missing
        setQuoteRatioPercent(null);
    }
}, [currentSqrtPriceX96, selectedBaseToken, selectedQuoteToken]);

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
            if (currentSqrtPriceX96 === null || poolTickSpacing === null) {
                 throw new Error("Pool details (price/spacing) could not be determined.");
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
    setPoolTickSpacing(null);
  };

  const handleLiquiditySubmit = async () => {
    if (!ethersProvider || !address || !selectedBaseToken || !selectedQuoteToken || !selectedFeeTier || !baseAmount || !quoteAmount || !poolAddress || poolTickSpacing === null) { 
        messageApi.error({ content: 'Internal Error: Missing required info.', key: 'addLiquidityAction' });
        return; 
    }

    setIsProcessing(true);
    const actionKey = 'addLiquidityAction';
    messageApi.loading({ content: 'Starting liquidity addition...', key: actionKey });
    let txSuccess = false;

    try {
        const feeTierNumber = parseInt(selectedFeeTier, 10);
        
        // Determine min/max price strings based on range type
        let minP: string, maxP: string;
        if (rangeType === 'full') {
            // LiquidityService might handle "full range" representation internally, 
            // but we can pass extreme ticks or it might infer from prices.
            // Passing 0 and 'Infinity' or similar might be expected by the service.
            // Let's assume it handles '0' and a very large number or specific string.
            // We need to check LiquidityService implementation details, but for now,
            // let's rely on it handling the core logic based on simple inputs.
            // We won't calculate ticks here anymore.
            
            // Placeholder - check how LiquidityService expects full range
            // For now, let's pass calculated extreme ticks based on priceToTick(0) and priceToTick(inf)
            // and let the service adjust if needed. This is less ideal than passing '0'/'Infinity'.
             const minTickFull = Math.ceil(MIN_TICK / poolTickSpacing) * poolTickSpacing; 
             const maxTickFull = Math.floor(MAX_TICK / poolTickSpacing) * poolTickSpacing;
             // We need actual *prices* for the service though.
             // Let's pass '0' and 'Infinity' and hope the service handles it.
             minP = '0';
             maxP = '∞'; // Use the infinity symbol expected by processTickRange
             console.log("Using Full Range - passing min/max price strings:", minP, maxP);

        } else { // Custom range
            if (!minPrice || !maxPrice || parseFloat(minPrice) < 0 || parseFloat(maxPrice) <= parseFloat(minPrice)) {
                throw new Error("Invalid custom price range provided for submission.");
            }
             minP = minPrice;
             maxP = maxPrice;
             console.log("Using Custom Range - passing min/max price strings:", minP, maxP);
        }


        // Call LiquidityService
        messageApi.loading({ content: 'Preparing transaction...', key: actionKey });

        // Note: LiquidityService likely handles approvals internally if needed.
        // We pass the signerProvider directly.

        console.log("--- Calling LiquidityService.addLiquidity ---");
        console.log("Params:", {
             token0: selectedBaseToken,
             token1: selectedQuoteToken,
             token0Amount: baseAmount,
             token1Amount: quoteAmount,
             recipient: address,
             poolAddress: poolAddress,
             minPrice: minP,
             maxPrice: maxP,
             poolFee: feeTierNumber,
             tickSpacing: poolTickSpacing // Pass tickSpacing for service to use if needed
        });

        const result = await LiquidityService.addLiquidity(
            ethersProvider, // Pass the BrowserProvider as required by the updated service
            {
             token0: selectedBaseToken,
             token1: selectedQuoteToken,
             token0Amount: baseAmount,
             token1Amount: quoteAmount,
             recipient: address,
             poolAddress: poolAddress,
             minPrice: minP, 
             maxPrice: maxP, 
             poolFee: feeTierNumber,
             // Pass tickSpacing explicitly if the service function requires it
             // tickSpacing: poolTickSpacing 
            }
            // Optional: Pass gas settings if service supports it
            // { gasLimit: 5000000 }
        );

        if (result.success) {
            txSuccess = true;
            messageApi.success({ content: `Liquidity added! Tx: ${result.txHash?.substring(0, 10)}...`, key: actionKey, duration: 5 });
            // Reset form state?
        } else {
            throw new Error(result.error || 'LiquidityService failed to add liquidity.');
        }

    } catch (error: any) {
        console.error("Add Liq Error (via LiquidityService):", error);
        // Check if error has a nested reason or message
        let errorMessage = 'Unknown error';
        if (error.reason) {
             errorMessage = error.reason;
        } else if (error.message) {
             errorMessage = error.message;
        } else if (typeof error === 'string') {
            errorMessage = error;
        }
        messageApi.error({ content: `Failed: ${errorMessage}`, key: actionKey, duration: 8 });
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
                            src={selectedBaseToken.logoURI || "/token.png"} 
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
                            src={selectedQuoteToken.logoURI || "/token.png"} 
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
                        <img src={selectedBaseToken?.logoURI || "/token.png"} alt={selectedBaseToken?.symbol} className="w-6 h-6 rounded-full" />
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
                        <img src={selectedQuoteToken?.logoURI || "/token.png"} alt={selectedQuoteToken?.symbol} className="w-6 h-6 rounded-full" />
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
                      <img src={selectedBaseToken?.logoURI || "/token.png"} alt={selectedBaseToken?.symbol} className="w-4 h-4 rounded-full mr-1" />
                      <span>{selectedBaseToken?.symbol} {baseRatioPercent !== null ? `${baseRatioPercent.toFixed(1)}%` : '--%'}</span>
                    </div>
                    <div className="flex items-center">
                      <img src={selectedQuoteToken?.logoURI || "/token.png"} alt={selectedQuoteToken?.symbol} className="w-4 h-4 rounded-full mr-1" />
                      <span>{selectedQuoteToken?.symbol} {quoteRatioPercent !== null ? `${quoteRatioPercent.toFixed(1)}%` : '--%'}</span>
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
                  >
                    <img src={selectedBaseToken?.logoURI || "/token.png"} alt={selectedBaseToken?.symbol} className="w-5 h-5" />
                    <span>{selectedBaseToken?.symbol}</span>
                  </button>
                  <button
                    className={`flex items-center gap-2 rounded-lg px-3 py-1 cursor-pointer ${selectedBaseToken?.symbol === 'SUI' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
                  >
                    <img src={selectedQuoteToken?.logoURI || "/token.png"} alt={selectedQuoteToken?.symbol} className="w-5 h-5" />
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
            className={`w-full bg-blue-900 text-blue-500 py-3 rounded-xl font-medium transition-colors ${isProcessing || !isConnected || (currentStep === 1 && (poolExistsStatus !== 'exists' || currentSqrtPriceX96 === null || poolTickSpacing === null)) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-800'}`}
            onClick={handleContinue}
            disabled={isProcessing || !isConnected || (currentStep === 1 && (poolExistsStatus !== 'exists' || currentSqrtPriceX96 === null || poolTickSpacing === null))}
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