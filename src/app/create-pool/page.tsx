"use client";

import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Input, message } from 'antd';
// import { Button } from "../ui/button";
// import TokenDisplay from "../tokens/TokenDisplay";
import suiIcon from "../../assets/sui.png";
// import Logo from "../../public/vercel.svg";
import TokenSelectionModal from '@/components/TokenSelectionModal';
import { TokenInfo, DEFAULT_TOKEN_LIST } from '@/services/tokenService';
import { ChevronDownIcon } from "lucide-react";
import { ethers } from "ethers";
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react'; 
import { BrowserProvider, Contract, Eip1193Provider, JsonRpcProvider, Provider } from "ethers";
import { ADDRESSES } from '@/constants/addresses';
import { 
    encodeSqrtPriceX96, 
    priceToTick, 
    sortTokens, 
    POOL_ABI, 
    ERC20_ABI, 
    POSITION_MANAGER_ABI, 
    FACTORY_ABI, // Import FACTORY_ABI for getPool call
    getGasOptions // Import getGasOptions
} from '@/utils/contracts'; 
import { processTickRange } from '@/utils/liquidityService';

// Define Tick constants - Ensure these are defined
const MIN_TICK = -887272;
const MAX_TICK = 887272;

// REMOVE local tokenList
// const tokenList: TokenInfo[] = [ ... ];

// Read-only provider setup (using proxy)
const READ_ONLY_RPC_URL = 'http://localhost:3000/api/rpc-proxy'; // Full URL for local development

const CreatePool = () => {
  const [currentStep, setCurrentStep] = useState(1);
  // Initialize state to null
  const [selectedBaseToken, setSelectedBaseToken] = useState<TokenInfo | null>(null); 
  const [selectedQuoteToken, setSelectedQuoteToken] = useState<TokenInfo | null>(null);
  const [selectedFeeTier, setSelectedFeeTier] = useState<string>("");
  const [initialPrice, setInitialPrice] = useState<string>("");
  const [rangeType, setRangeType] = useState("full");
  const [minPrice, setMinPrice] = useState<string>("");
  const [maxPrice, setMaxPrice] = useState<string>("");
  const [baseAmount, setBaseAmount] = useState<string>("");
  const [quoteAmount, setQuoteAmount] = useState<string>("");
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [changeToken, setChangeToken] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [poolExistsStatus, setPoolExistsStatus] = useState<'idle' | 'checking' | 'exists' | 'not_found'>('idle');
  const [baseRatioPercent, setBaseRatioPercent] = useState<number | null>(null);
  const [quoteRatioPercent, setQuoteRatioPercent] = useState<number | null>(null);

  const [messageApi, contextHolder] = message.useMessage();
  const { address, isConnected } = useAppKitAccount();
  const { walletProvider } = useAppKitProvider("eip155");
  const [ethersProvider, setEthersProvider] = useState<BrowserProvider | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Memoized read-only provider instance
  const readOnlyProvider = useMemo(() => new JsonRpcProvider(READ_ONLY_RPC_URL), []);

  useEffect(() => {
    if (walletProvider) {
      try {
        const provider = new BrowserProvider(walletProvider as Eip1193Provider);
        setEthersProvider(provider);
        console.log("[CreatePool] Ethers BrowserProvider created.");
      } catch (error) {
         console.error("[CreatePool] Error creating BrowserProvider:", error);
         setEthersProvider(null); 
      }
    } else {
      setEthersProvider(null);
    }
  }, [walletProvider]);

  const checkPoolExists = useCallback(async () => {
      if (!ethersProvider || !selectedBaseToken || !selectedQuoteToken || !selectedFeeTier) {
          setPoolExistsStatus('idle');
          return;
      }

      console.log("Queueing pool existence check...");
      setPoolExistsStatus('checking');
      if (debounceTimeoutRef.current) {
           clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(async () => {
          console.log("Executing debounced pool existence check...");
          try {
              const [token0Address, token1Address] = sortTokens(selectedBaseToken.address, selectedQuoteToken.address);
              const feeTierNumber = parseInt(selectedFeeTier, 10);
              if (isNaN(feeTierNumber)) { throw new Error("Invalid fee tier"); }

              const factory = new ethers.Contract(ADDRESSES.factory, FACTORY_ABI, ethersProvider);
              const existingPoolAddress = await factory.getPool(token0Address, token1Address, feeTierNumber);

              if (existingPoolAddress && existingPoolAddress !== ethers.ZeroAddress) {
                  console.log("Pool exists at:", existingPoolAddress);
                  setPoolExistsStatus('exists');
              } else {
                  console.log("Pool does not exist.");
                  setPoolExistsStatus('not_found');
              }
          } catch (error) {
              console.error("Error checking pool existence:", error);
              setPoolExistsStatus('idle'); 
              messageApi.error("Could not check if pool exists.");
          }
      }, 750);
  }, [ethersProvider, selectedBaseToken, selectedQuoteToken, selectedFeeTier, messageApi]);

  useEffect(() => {
      checkPoolExists();
       return () => {
        if (debounceTimeoutRef.current) {
            clearTimeout(debounceTimeoutRef.current);
        }
      };
  }, [checkPoolExists]);

  useEffect(() => {
    if (initialPrice && selectedBaseToken && selectedQuoteToken) {
        try {
            const priceNum = parseFloat(initialPrice);
            if (!isNaN(priceNum) && priceNum > 0) {
                const basePercent = (1 / (1 + priceNum)) * 100;
                const quotePercent = (priceNum / (1 + priceNum)) * 100;
                setBaseRatioPercent(basePercent);
                setQuoteRatioPercent(quotePercent);
            } else {
                 setBaseRatioPercent(null);
                 setQuoteRatioPercent(null);
            }
        } catch {
             setBaseRatioPercent(null);
             setQuoteRatioPercent(null);
        }
    } else {
        setBaseRatioPercent(null);
        setQuoteRatioPercent(null);
    }
}, [initialPrice, selectedBaseToken, selectedQuoteToken]);

  const handleContinue = async () => {
    if (!isConnected || !ethersProvider) {
        messageApi.error("Please connect your wallet.");
        return;
    }

    setIsProcessing(true);
    messageApi.loading({ content: 'Processing...', key: 'stepProcessing' });

    try {
      if (currentStep === 1) {
          if (!selectedBaseToken || !selectedQuoteToken || !selectedFeeTier) {
              throw new Error('Please select both tokens and a fee tier.');
          }
          if (poolExistsStatus !== 'not_found') {
               if (poolExistsStatus === 'exists') throw new Error('Pool already exists. Use Add Liquidity page.');
               else if (poolExistsStatus === 'checking') throw new Error('Still checking pool existence...');
               else throw new Error('Could not determine pool status.');
          }
          setCurrentStep(2);
          messageApi.success({ content: 'Pair selected.', key: 'stepProcessing', duration: 2 });
          setIsProcessing(false);

      } else if (currentStep === 2) {
          if (!initialPrice || parseFloat(initialPrice) <= 0) {
              throw new Error('Please set a valid initial price.');
          }
          if (rangeType === 'custom' && (!minPrice || !maxPrice || parseFloat(minPrice) < 0 || parseFloat(maxPrice) <= parseFloat(minPrice))) throw new Error('Invalid custom price range.');
          // Validation passed for Step 2, proceed to Step 3
          setCurrentStep(3);
          messageApi.success({ content: 'Price set.', key: 'stepProcessing', duration: 2 });
          setIsProcessing(false);

      } else if (currentStep === 3) {
           if (!baseAmount || !quoteAmount || parseFloat(baseAmount) <= 0 || parseFloat(quoteAmount) <= 0) {
              throw new Error('Please enter valid deposit amounts for both tokens.');
          }
          console.log("Proceeding to add liquidity...");
          await handleCreateAndAddLiquidity();
      }
    } catch (error: any) {
        console.error("Error during step transition:", error);
        messageApi.error({ content: `Error: ${error.message || 'An unexpected error occurred.'}`, key: 'stepProcessing', duration: 5 });
        setIsProcessing(false);
    }
  };

  const handleCreateAndAddLiquidity = async () => {
      if (!ethersProvider || !address || !selectedBaseToken || !selectedQuoteToken || !selectedFeeTier || !initialPrice || !baseAmount || !quoteAmount) {
          messageApi.error("Internal Error: Missing required information.");
          return;
      }
      
      setIsProcessing(true);
      const actionKey = 'createAndAdd';
      messageApi.loading({ content: 'Starting process...', key: actionKey });

      let txSuccess = false;
      try {
          const signer = await ethersProvider.getSigner();
          const positionManager = new ethers.Contract(ADDRESSES.positionManager, POSITION_MANAGER_ABI, signer);
          const baseTokenContract = new ethers.Contract(selectedBaseToken.address, ERC20_ABI, signer);
          const quoteTokenContract = new ethers.Contract(selectedQuoteToken.address, ERC20_ABI, signer);

          messageApi.loading({ content: 'Creating pool contract...', key: actionKey });
          const [token0Address, token1Address] = sortTokens(selectedBaseToken.address, selectedQuoteToken.address);
          const feeTierNumber = parseInt(selectedFeeTier, 10);
          let priceNumber = parseFloat(initialPrice);
          if (selectedBaseToken.address.toLowerCase() !== token0Address.toLowerCase()) priceNumber = 1 / priceNumber;
          const sqrtPriceX96 = encodeSqrtPriceX96(priceNumber);

          console.log(`Creating pool: T0=${token0Address}, T1=${token1Address}, Fee=${feeTierNumber}, SqrtPrice=${sqrtPriceX96}`);
          
          const gasOptions = await getGasOptions(ethersProvider);
          
          const createTx = await positionManager.createAndInitializePoolIfNecessary(
              token0Address, token1Address, feeTierNumber, sqrtPriceX96, {gasLimit: 5000000, gasPrice: gasOptions.gasPrice  }
          );
          messageApi.loading({ content: 'Waiting for pool creation...', key: actionKey });
          const createReceipt = await createTx.wait();
          if (createReceipt.status !== 1) throw new Error("Pool creation transaction failed.");
          messageApi.success({ content: 'Pool created!', key: actionKey, duration: 2 });

          messageApi.loading({ content: 'Preparing liquidity addition...', key: actionKey });

          const factory = new ethers.Contract(ADDRESSES.factory, FACTORY_ABI, ethersProvider);
          const actualPoolAddress = await factory.getPool(token0Address, token1Address, feeTierNumber);
          if (!actualPoolAddress || actualPoolAddress === ethers.ZeroAddress) throw new Error("Pool address not found after creation.");
          console.log("Confirmed Pool Address:", actualPoolAddress);
          const poolContract = new ethers.Contract(actualPoolAddress, POOL_ABI, ethersProvider);

          const actualPoolFeeBigInt = await poolContract.fee();
          const actualPoolFee = Number(actualPoolFeeBigInt);
          const slot0 = await poolContract.slot0();
          const currentTick = Number(slot0.tick);
          const currentPrice = Math.pow(1.0001, currentTick); 
          console.log(`Pool actual fee: ${actualPoolFee}, currentTick: ${currentTick}`);
          
          if (feeTierNumber !== actualPoolFee) {
              console.warn(`Warning: UI fee tier (${feeTierNumber}) does not match actual pool fee (${actualPoolFee}). Using actual pool fee for tick calculation.`);
          }

          console.log(`Range type selected: ${rangeType}`);
          const minPriceStr = rangeType === 'full' ? '0' : minPrice;
          const maxPriceStr = rangeType === 'full' ? '∞' : maxPrice;

          const { tickLower, tickUpper } = processTickRange(
              minPriceStr,
              maxPriceStr,
              currentPrice,
              actualPoolFee
          );
          console.log(`Processed Ticks: L=${tickLower}, U=${tickUpper} (using actual pool fee: ${actualPoolFee})`);

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
                    const approveTx = await contract.approve(ADDRESSES.positionManager, amt, gasOptions);
                    await approveTx.wait();
                    messageApi.success({content: `${sym} approved!`, key: actionKey, duration: 2});
                 }
              }
          };
          await approveIfNeeded(contract0, amount0, symbol0);
          await approveIfNeeded(contract1, amount1, symbol1);
          
          const deadline = Math.floor(Date.now() / 1000) + 60 * 10;
          const mintParams = {
              token0: token0Address, token1: token1Address, fee: actualPoolFee,
              tickLower, tickUpper,
              amount0Desired: amount0, amount1Desired: amount1, 
              amount0Min: BigInt(0), amount1Min: BigInt(0),
              recipient: address, deadline,
          };
          messageApi.loading({ content: 'Adding liquidity...', key: actionKey });
          const mintTx = await positionManager.mint(
              mintParams,
              gasOptions
          );
          messageApi.loading({ content: 'Waiting for liquidity addition...', key: actionKey });
          const mintReceipt = await mintTx.wait();
          if (mintReceipt.status !== 1) throw new Error("Add liquidity transaction failed.");
          
          txSuccess = true;
          messageApi.success({ content: 'Pool created & liquidity added! 🎉', key: actionKey, duration: 5 });
          
      } catch (error: any) {
          console.error("Create/Add Liq Error:", error);
          messageApi.error({ content: `Failed: ${error.reason || error.message || 'Unknown error'}`, key: actionKey, duration: 5 });
      } finally {
          if (!txSuccess) messageApi.destroy(actionKey);
          setIsProcessing(false);
      }
  };

  const handleBaseAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputAmount = e.target.value;
      setBaseAmount(inputAmount);
      if (!initialPrice || !selectedBaseToken || !selectedQuoteToken || !inputAmount) {
          setQuoteAmount(""); return;
      }
      try {
          const baseNum = parseFloat(inputAmount);
          const priceNum = parseFloat(initialPrice);
          if (!isNaN(baseNum) && baseNum > 0 && !isNaN(priceNum) && priceNum > 0) {
              const calculatedQuote = baseNum * priceNum;
              setQuoteAmount(calculatedQuote.toFixed(selectedQuoteToken.decimals > 8 ? 8 : selectedQuoteToken.decimals)); 
          } else {
              setQuoteAmount("");
          }
      } catch { setQuoteAmount(""); }
  };

  const handleQuoteAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const inputAmount = e.target.value;
      setQuoteAmount(inputAmount);
      if (!initialPrice || !selectedBaseToken || !selectedQuoteToken || !inputAmount) {
          setBaseAmount(""); return;
      }
      try {
          const quoteNum = parseFloat(inputAmount);
          const priceNum = parseFloat(initialPrice);
          if (!isNaN(quoteNum) && quoteNum > 0 && !isNaN(priceNum) && priceNum > 0) {
              const calculatedBase = quoteNum / priceNum;
              setBaseAmount(calculatedBase.toFixed(selectedBaseToken.decimals > 8 ? 8 : selectedBaseToken.decimals)); 
          } else {
              setBaseAmount("");
          }
      } catch { setBaseAmount(""); }
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
      if (changeToken === 1) {
        setSelectedBaseToken(token);
      } else {
        setSelectedQuoteToken(token);
      }
    }
    setIsOpen(false);
    setBaseAmount("");
    setQuoteAmount("");
    setInitialPrice(""); 
    setMinPrice("");
    setMaxPrice("");
    setPoolExistsStatus('idle');
  };

  const baseTokenForDisplay = selectedBaseToken;
  const quoteTokenForDisplay = selectedQuoteToken;

  return (
    <div className="flex w-full max-w-6xl mx-auto p-4 gap-8 mt-12">
      {contextHolder}
      
      <div className="w-1/4 bg-[#1f2639] rounded-lg p-4 h-fit border border-[#21273a]">
        <div className="space-y-6">
          <div className={`flex items-start space-x-4 ${currentStep === 1 ? '' : 'opacity-50'}`}>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">1</div>
            <div>
              <h3 className="font-medium text-white">Select Pair & Fee</h3>
              <p className="text-sm text-gray-400">Choose tokens and fee tier.</p>
            </div>
          </div>

          <div className={`flex items-start space-x-4 ${currentStep >= 2 ? '' : 'opacity-50'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${currentStep >= 2 ? 'bg-blue-500' : 'bg-[#2c3552]'} flex items-center justify-center text-white font-medium`}>2</div>
            <div>
              <h3 className="font-medium text-white">Set Price & Range</h3>
              <p className="text-sm text-gray-400">Set initial price and liquidity range.</p>
            </div>
          </div>

          <div className={`flex items-start space-x-4 ${currentStep === 3 ? '' : 'opacity-50'}`}>
            <div className={`flex-shrink-0 w-8 h-8 rounded-full ${currentStep === 3 ? 'bg-blue-500' : 'bg-[#2c3552]'} flex items-center justify-center text-white font-medium`}>3</div>
            <div>
              <h3 className="font-medium text-white">Deposit Amounts</h3>
              <p className="text-sm text-gray-400">Enter deposit amounts.</p>
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
              <path d="m15 18-6-6 6-6" />
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
                    onChange={(e) => setSelectedFeeTier(e.target.value)}
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

            <div className="mt-4 h-6 text-sm">
                {poolExistsStatus === 'checking' && <span className="text-yellow-400">Checking if pool exists...</span>}
                {poolExistsStatus === 'exists' && <span className="text-red-400">Pool already exists! Go to 'Add Liquidity'.</span>}
                {poolExistsStatus === 'not_found' && <span className="text-green-400">Pool doesn't exist. Ready to create.</span>}
            </div>
          </div>
        )}
        {currentStep === 2 && (
          <div className="space-y-6">
            <h2 className="text-xl font-medium text-white">Set Initial Price</h2>
            <p className="text-gray-400">Please set an initial price for this new pool to start.</p>

            <div className="space-y-2">
              <input
                type="text"
                value={initialPrice}
                onChange={(e) => setInitialPrice(e.target.value)}
                className="w-full bg-[#2c3552] text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-[#374264] transition-colors"
              />
              <div className="text-right text-gray-400">
                Current Price: 1 {selectedBaseToken?.symbol || 'BASE'} = {initialPrice} {selectedQuoteToken?.symbol || 'QUOTE'}
              </div>
            </div>

            <h2 className="text-xl font-medium text-white mt-8">Set Price Range</h2>
            <p className="text-gray-400">Please specify a price range that you want to provide your liquidity within.</p>

            <div className="flex gap-4">
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

            <div className="grid grid-cols-2 gap-4">
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
                    disabled={rangeType === 'full' || isProcessing}
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
                    disabled={rangeType === 'full' || isProcessing}
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
        )}
        {currentStep === 3 && (
          <div className="space-y-6">
            <h2 className="text-xl font-medium text-white">Deposit amounts</h2>
            <p className="text-gray-400">Enter the amounts you want to deposit.</p>

            <div className="space-y-4">
              <div>
                <div className="bg-[#2c3552] rounded-lg p-3 hover:bg-[#374264] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <img src={selectedBaseToken?.logoURI || "/token.png"} alt={selectedBaseToken?.symbol || "Base"} className="w-6 h-6 rounded-full" />
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{selectedBaseToken?.symbol || 'Select Token'}</span>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="0.0"
                      className="bg-transparent text-right outline-none w-1/2 text-white placeholder-gray-400"
                      value={baseAmount}
                      onChange={handleBaseAmountChange}
                      disabled={isProcessing}
                    />
                  </div>
                </div>
              </div>

              <div>
                <div className="bg-[#2c3552] rounded-lg p-3 hover:bg-[#374264] transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <img src={selectedQuoteToken?.logoURI || "/token.png"} alt={selectedQuoteToken?.symbol || "Quote"} className="w-6 h-6 rounded-full" />
                      <div className="flex flex-col">
                        <span className="font-medium text-white">{selectedQuoteToken?.symbol || 'Select Token'}</span>
                      </div>
                    </div>
                    <input
                      type="text"
                      placeholder="0.0"
                      className="bg-transparent text-right outline-none w-1/2 text-white placeholder-gray-400"
                      value={quoteAmount}
                      onChange={handleQuoteAmountChange}
                      disabled={isProcessing}
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
                    <img src={selectedBaseToken?.logoURI || "/token.png"} alt={selectedBaseToken?.symbol || "Base"} className="w-4 h-4 rounded-full mr-1" />
                    <span>{selectedBaseToken?.symbol || 'BASE'} {baseRatioPercent !== null ? `${baseRatioPercent.toFixed(1)}%` : '--%'}</span>
                  </div>
                  <div className="flex items-center">
                    <img src={selectedQuoteToken?.logoURI || "/token.png"} alt={selectedQuoteToken?.symbol || "Quote"} className="w-4 h-4 rounded-full mr-1" />
                    <span>{selectedQuoteToken?.symbol || 'QUOTE'} {quoteRatioPercent !== null ? `${quoteRatioPercent.toFixed(1)}%` : '--%'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8">
          <button
            className={`w-full bg-blue-900 text-blue-500 py-3 rounded-xl font-medium hover:bg-blue-800 transition-colors ${isProcessing || !isConnected || (currentStep === 1 && poolExistsStatus !== 'not_found') ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleContinue}
            disabled={isProcessing || !isConnected || (currentStep === 1 && poolExistsStatus !== 'not_found')}
          >
            {isProcessing ? 'Processing...' : (currentStep === 3 ? 'Create Pool & Add Liquidity' : 'Continue')}
          </button>
        </div>
      </div>

      <TokenSelectionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={modifyToken}
        readOnlyProvider={readOnlyProvider}
      />
    </div>
  );
};

export default CreatePool;
