"use client";

import { Input, Popover, Radio, Modal, message } from 'antd';
const infiRouterAddress = require('../../contract/aggregator/testnet/InfiRouter.json').address
const infiRouterAbi = require('../../contract/aggregator/testnet/InfiRouter.json').abi
import { TextHoverEffect } from "@/components/ui/text-hover-effect";
import { Audiowide } from 'next/font/google'

//@ts-ignore
import { ArrowDownOutlined, SettingOutlined } from '@ant-design/icons';
import { useState, useEffect, useRef, useMemo } from 'react';
import axios from 'axios';
import { TokenInfo, DEFAULT_TOKEN_LIST } from '../../services/tokenService';
import { TxDetails } from '@/types/token';
import TokenSelectionModal from '@/components/TokenSelectionModal';
import { useReadContract } from "wagmi";
import { useAppKitAccount, useAppKitProvider, useAppKit } from '@reown/appkit/react';
import { BrowserProvider, Contract, Eip1193Provider, ethers, formatUnits, JsonRpcProvider } from "ethers";
import FullPageLoader from '@/components/ui/FullPageLoader';
// Define a read-only RPC endpoint - Pointing to the FULL proxy URL for local dev
// const READ_ONLY_RPC_URL = 'https://devnet.dplabs-internal.com'; // Old direct URL
// const READ_ONLY_RPC_URL = '/api/rpc-proxy'; // Old relative path
const READ_ONLY_RPC_URL = process.env.NEXT_PUBLIC_READ_ONLY_RPC_URL || 'http://localhost:3000/api/rpc-proxy';

// Minimal ABI for fetching balance
const erc20AbiMinimal = [
  "function balanceOf(address owner) view returns (uint256)",
];
const audiowide = Audiowide({
  subsets: ['latin'],
  weight: '400', // Adjust based on font availability
})

// todo: swap - balance
interface SwapProps {
  address?: string;
  isConnected: boolean;
}

export default function Swap() {
  const [slippage, setSlippage] = useState<number>(2.5);
  const [messageApi, contextHolder] = message.useMessage();
  const [tokenOneAmount, setTokenOneAmount] = useState<string>('');
  const [tokenTwoAmount, setTokenTwoAmount] = useState<string>('');
  const [tokenOne, setTokenOne] = useState<TokenInfo>(DEFAULT_TOKEN_LIST.tokens.find(t => t.symbol === 'GOCTO') || DEFAULT_TOKEN_LIST.tokens[0]);
  const [tokenTwo, setTokenTwo] = useState<TokenInfo>(DEFAULT_TOKEN_LIST.tokens.find(t => t.symbol === 'USDC') || DEFAULT_TOKEN_LIST.tokens[1]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [changeToken, setChangeToken] = useState<number>(1);
  const [routePath, setRoutePath] = useState<string[]>([]);
  const [txDetails, setTxDetails] = useState<TxDetails>({
    to: null,
    data: null,
    value: null
  });

  const { address, caipAddress, isConnected, } = useAppKitAccount();
  const [ethersProvider, setEthersProvider] = useState<BrowserProvider | null>(null);
  const { walletProvider } = useAppKitProvider("eip155");

  // Balance states
  const [tokenOneBalance, setTokenOneBalance] = useState<string | null>(null);
  const [tokenTwoBalance, setTokenTwoBalance] = useState<string | null>(null);

  // Create read-only provider and router instances, memoized to prevent recreation
  const readOnlyProvider = useMemo(() => new JsonRpcProvider(READ_ONLY_RPC_URL), []);
  const readOnlyRouter = useMemo(() => new Contract(infiRouterAddress, infiRouterAbi, readOnlyProvider), [readOnlyProvider]);

  // Reusable function to fetch and update balances
  const updateTokenBalances = async (currentAddress: string, currentProvider: BrowserProvider, t1: TokenInfo, t2: TokenInfo) => {
    setTokenOneBalance("Loading..."); // Indicate loading
    setTokenTwoBalance("Loading...");
    try {
      const tokenOneContract = new Contract(t1.address, erc20AbiMinimal, currentProvider);
      const tokenTwoContract = new Contract(t2.address, erc20AbiMinimal, currentProvider);

      const [balOneWei, balTwoWei] = await Promise.all([
        tokenOneContract.balanceOf(currentAddress),
        tokenTwoContract.balanceOf(currentAddress)
      ]);

      const balOneFormatted = parseFloat(formatUnits(balOneWei, t1.decimals)).toFixed(4);
      const balTwoFormatted = parseFloat(formatUnits(balTwoWei, t2.decimals)).toFixed(4);

      setTokenOneBalance(balOneFormatted);
      setTokenTwoBalance(balTwoFormatted);

    } catch (error) {
      console.error("Error fetching balances:", error);
      setTokenOneBalance("N/A"); // Indicate error
      setTokenTwoBalance("N/A"); // Indicate error
    }
  };

  const [isQuerying, setIsQuerying] = useState(false); // Optional: for loading indicator
  const [isProcessingSwap, setIsProcessingSwap] = useState(false); // State for swap button disabling
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref to store timeout ID
  const [estimatedGasFee, setEstimatedGasFee] = useState<string>('0.000000');
  const [transactionMode, setTransactionMode] = useState<string>('default');
  const [progress, setProgress] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);

  const [isEarnDropdownOpen, setIsEarnDropdownOpen] = useState<boolean>(false);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    // Only create the BrowserProvider if walletProvider is available
    if (walletProvider) {
      try {
        // The type assertion might still be useful if your hook doesn't type it perfectly
        const provider = new BrowserProvider(walletProvider as Eip1193Provider);
        setEthersProvider(provider);
        console.log("Ethers BrowserProvider created successfully.");
      } catch (error) {
        console.error("Error creating BrowserProvider:", error);
        setEthersProvider(null); // Reset on error
      }
    } else {
      // Reset provider if wallet disconnects or isn't available
      setEthersProvider(null);
      console.log("Wallet provider not available.");
    }
    // Re-run this effect if the walletProvider changes (e.g., user connects/disconnects)
  }, [walletProvider]);
  useEffect(() => {
    console.log("test1");
    const updateGasEstimate = async () => {
      if (!ethersProvider) return;
      try {
        console.log("test2");
        const feeData = await ethersProvider.getFeeData();
        const baseGasPrice = feeData.gasPrice;
        if (baseGasPrice) {
          // Estimate gas usage for swap (typical gas limit)
          const estimatedGasLimit = 250000;
          console.log("test1");
          const gasCostWei = baseGasPrice * BigInt(estimatedGasLimit);
          const gasCostEth = ethers.formatEther(gasCostWei);
          setEstimatedGasFee(parseFloat(gasCostEth).toFixed(6));
        }
      } catch (error) {
        console.error('Error estimating gas:', error);
        setEstimatedGasFee('...');
      }
    };
    updateGasEstimate();
  }, []);

  // Function to call the findBestPath method on a given router instance
  async function callFindBestPath(routerInstance: Contract, tknFrom: string, tknTo: string, amountIn: bigint) {
    const maxHops = 3
    const gasPrice = ethers.parseUnits('225', 'gwei') // This might not be strictly necessary for read-only queries but kept for consistency
    return routerInstance.findBestPathWithGas(
      amountIn,
      tknFrom,
      tknTo,
      maxHops,
      gasPrice,
      { gasLimit: 1e9 } // Gas limit might also be less critical for static calls
    )
  }

  // --- Wallet-connected Router Instance (Initialized conditionally) ---
  // We still need the connected router for transactions later
  const getConnectedRouter = (): Contract | null => {
    if (!ethersProvider) return null;
    // We need a signer for transactions, getSigner() is async,
    // but for now, just passing the provider works for contract setup.
    // Signer will be obtained inside fetchDex when needed.
    return new Contract(infiRouterAddress, infiRouterAbi, ethersProvider);
  }
  // Note: Direct use of 'InfiRouter' for transactions will be replaced with calls needing a signer inside fetchDex

  const { open } = useAppKit(); // Use 'open' provided by useAppKit

  async function query(tknFrom: string, tknTo: string, amountIn: any) {
    const maxHops = 3
    const gasPrice = ethers.parseUnits('225', 'gwei')
    return readOnlyRouter.findBestPathWithGas(
      amountIn,
      tknFrom,
      tknTo,
      maxHops,
      gasPrice,
      { gasLimit: 1e9 }
    )
  }

  const handleSlippage = (e: any) => {
    setSlippage(e.target.value);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const currentInputStr = e.target.value;
    setTokenOneAmount(currentInputStr); // Update input immediately
    setRoutePath([]); // Reset route path when input changes

    // Clear previous debounce timer
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Basic validation before setting timeout
    if (!currentInputStr || isNaN(parseFloat(currentInputStr)) || parseFloat(currentInputStr) <= 0) {
      setTokenTwoAmount("");
      setIsQuerying(false); // Stop querying if input is invalid
      return;
    }

    setIsQuerying(true); // Indicate loading/querying

    // Set a new timer
    debounceTimeoutRef.current = setTimeout(async () => {
      try {
        // Remove the check for ethersProvider as we are using readOnlyProvider for quotes
        /*
        // Ensure provider is ready
        if (!ethersProvider) {
           console.error("Provider not ready for query");
           setIsQuerying(false);
           return;
        }
        */
        // Ensure amount is valid BigInt parsable string
        const amountInWei = ethers.parseUnits(currentInputStr, tokenOne.decimals);

        console.log(`Debounced query for: ${currentInputStr}`); // Logging
        // Use the read-only router for querying quotes
        const res = await callFindBestPath(readOnlyRouter, tokenOne.address, tokenTwo.address, amountInWei);

        if (res && res.amounts && res.amounts.length > 0) {
          const estimatedOutputWei = res.amounts[res.amounts.length - 1];
          const estimatedOutputFormatted = ethers.formatUnits(
            estimatedOutputWei,
            tokenTwo.decimals
          );
          setTokenTwoAmount(parseFloat(estimatedOutputFormatted).toFixed(6));
          setRoutePath(res.path || []); // Store the route path
        } else {
          setTokenTwoAmount(""); // Handle no result
          setRoutePath([]); // Clear route path if no result
        }
      } catch (err: any) {
        console.error("Error during debounced query:", err);
        // Handle specific errors, e.g., invalid input format for parseUnits
        if (err.code === 'INVALID_ARGUMENT') {
          setTokenTwoAmount("Invalid input")
        } else {
          setTokenTwoAmount("Error");
        }

      } finally {
        setIsQuerying(false); // Done querying
      }
    }, 500); // 500ms debounce delay
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const switchTokens = () => {
    setTokenOneAmount('');
    setTokenTwoAmount('');
    setRoutePath([]); // Clear route path when switching tokens
    const tempToken = tokenOne;
    setTokenOne(tokenTwo);
    setTokenTwo(tempToken);
  };

  const openModal = (token: number) => {
    setChangeToken(token);
    setIsOpen(true);
  };

  const modifyToken = (token: TokenInfo) => {
    setTokenOneAmount('');
    setTokenTwoAmount('');
    setRoutePath([]); // Clear route path when modifying tokens

    if (changeToken === 1) {
      if (token.address === tokenTwo.address) {
        switchTokens();
        setIsOpen(false);
        return;
      }
      setTokenOne(token);
    } else {
      if (token.address === tokenOne.address) {
        switchTokens();
        setIsOpen(false);
        return;
      }
      setTokenTwo(token);
    }
    setIsOpen(false);
  };
  useEffect(() => {

    const updateGasEstimate = async () => {
      if (!ethersProvider) return;
      try {

        const feeData = await ethersProvider.getFeeData();
        const baseGasPrice = feeData.gasPrice;
        console.log("basegas", baseGasPrice)
        if (baseGasPrice) {
          // Estimate gas usage for swap (typical gas limit)
          const estimatedGasLimit = 440000;

          const gasCostWei = baseGasPrice * BigInt(estimatedGasLimit);
          console.log("gasfeeWei", gasCostWei)
          const gasCostEth = ethers.formatEther(gasCostWei);
          console.log("gasfeeeth", gasCostEth)
          setEstimatedGasFee(parseFloat(gasCostEth).toFixed(6));
        }
      } catch (error) {
        console.error('Error estimating gas:', error);
        setEstimatedGasFee('...');
      }
    };
    updateGasEstimate();
  }, [ethersProvider]);

  const fetchDex = async () => {
    try {
      setIsProcessingSwap(true);
      // Ensure provider and signer are ready
      if (!ethersProvider) {
        messageApi.error('Please connect your wallet to perform a swap.');
        return;
      }
      const signer = await ethersProvider.getSigner();
      if (!signer) {
        messageApi.error('Signer not available.');
        return;
      }
      if (!tokenOneAmount || parseFloat(tokenOneAmount) <= 0) {
        messageApi.error('Please enter a valid amount to swap.');
        return;
      }


      console.log("Fetching swap data for:", tokenOneAmount, tokenOne.symbol);

      // 1. Parse amountIn to BigInt
      const amountInWei = ethers.parseUnits(tokenOneAmount, tokenOne.decimals);

      // 2. Query the router using the read-only instance first
      // const queryRes = await query(tokenOne.address, tokenTwo.address, amountInWei); // Old query
      const queryRes = await callFindBestPath(readOnlyRouter, tokenOne.address, tokenTwo.address, amountInWei);
      console.log("Query Result:", queryRes);

      // Validate query response
      if (!queryRes || !queryRes.amounts || queryRes.amounts.length === 0 || !queryRes.path || !queryRes.adapters) {
        messageApi.error('Failed to get a valid swap route from the router.');
        return;
      }

      // 3. Get expected amountOut (last amount from query)
      const expectedAmountOut = queryRes.amounts[queryRes.amounts.length - 1];

      // --- START SLIPPAGE CALCULATION ---
      // Convert slippage percentage to basis points (e.g., 2.5% -> 250 bps)
      const slippageBps = BigInt(Math.round(slippage * 100)); // Ensure slippage is treated as percentage
      const BPS_DIVISOR = BigInt(10000);

      // Calculate the minimum amount out considering slippage
      // amountOutMin = expectedAmountOut * (10000 - slippageBps) / 10000
      const amountOutMinWithSlippage = (BigInt(expectedAmountOut) * (BPS_DIVISOR - slippageBps)) / BPS_DIVISOR;

      console.log(`Expected Amount Out: ${ethers.formatUnits(expectedAmountOut, tokenTwo.decimals)} ${tokenTwo.symbol}`);
      console.log(`Slippage: ${slippage}% (${slippageBps} bps)`);
      console.log(`Minimum Amount Out (Wei): ${amountOutMinWithSlippage.toString()}`);
      console.log(`Minimum Amount Out: ${ethers.formatUnits(amountOutMinWithSlippage, tokenTwo.decimals)} ${tokenTwo.symbol}`);
      // --- END SLIPPAGE CALCULATION ---

      const fee = 0; // Assuming fee is always 0 based on previous examples

      // --- START GAS PRICE CALCULATION ---
      let txOptions: { gasPrice?: bigint, gasLimit?: number } = {}; // Initialize empty overrides
      try {



        const feeData = await ethersProvider.getFeeData();
        const baseGasPrice = feeData.gasPrice;

        if (baseGasPrice) {
          console.log(`Base estimated gas price: ${ethers.formatUnits(baseGasPrice, 'gwei')} gwei`);
          if (transactionMode === 'fast') {
            const fastGasPrice = (baseGasPrice * BigInt(130)) / BigInt(100);
            txOptions.gasPrice = fastGasPrice;
            console.log(`Using FAST gas price: ${ethers.formatUnits(fastGasPrice, 'gwei')} gwei`);
          } else {
            txOptions.gasPrice = baseGasPrice; // Use default
            console.log(`Using DEFAULT gas price: ${ethers.formatUnits(baseGasPrice, 'gwei')} gwei`);
          }
        } else {
          console.warn("Could not fetch gas price from provider. Wallet will use default.");
        }
      } catch (gasError) {
        console.warn("Error fetching fee data:", gasError);
      }
      // --- END GAS PRICE CALCULATION ---

      // 4. Check allowance
      const tokenContract = new ethers.Contract(
        tokenOne.address,
        [
          "function approve(address spender, uint256 amount) public returns (bool)",
          "function allowance(address owner, address spender) external view returns (uint256)"
        ],
        signer
      )

      const allowance = await tokenContract.allowance(address, infiRouterAddress);
      console.log("Current allowance (Wei):", allowance.toString());

      // 5. Approve if necessary (Compare BigInts correctly)
      if (allowance < amountInWei) {
        console.log(`Allowance is ${allowance.toString()}, need ${amountInWei.toString()}. Approving...`);
        messageApi.info('Approval required. Please confirm in your wallet.');
        try {
          // Keep existing gasLimit for approve, but add calculated gasPrice
          const approveOptions = { ...txOptions, gasLimit: 100000 };
          const approveTx = await (tokenContract.connect(signer) as ethers.Contract).approve(
            infiRouterAddress,
            amountInWei,
            approveOptions // <<< Pass combined options
          );
          console.log("Approval tx sent:", approveTx.hash);
          await approveTx.wait();
          console.log("Approval confirmed.");
          messageApi.success('Approval successful!');
        } catch (approveError: any) {
          console.error('Error during approval:', approveError);
          messageApi.error(`Approval failed: ${approveError.reason || approveError.message}`);
          return; // Stop if approval fails
        }
      } else {
        console.log("Sufficient allowance already granted.");
      }

      // 6. Prepare arguments for swapNoSplit
      const pathCopy = [...queryRes.path];
      const adaptersCopy = [...queryRes.adapters];
      const tradeArgs = [
        amountInWei,              // amountIn (BigInt)
        amountOutMinWithSlippage, // <<< Use amount calculated with slippage
        pathCopy,                 // path (copied array)
        adaptersCopy              // adapters (copied array)
      ];

      console.log("Executing swap with args:", tradeArgs);
      messageApi.info('Executing swap. Please confirm in your wallet.');

      // 7. Execute Swap (Use connected router instance with signer)
      const connectedRouter = getConnectedRouter();
      if (!connectedRouter) {
        messageApi.error("Failed to get connected router instance.");
        return;
      }
      // Connect the signer for the transaction
      const swapTx = await (connectedRouter.connect(signer) as ethers.Contract).swapNoSplit(
        tradeArgs,
        signer.address, // recipient
        fee,
        txOptions // <<< Pass options with calculated gasPrice
      );

      console.log("Swap tx sent:", swapTx.hash);
      messageApi.loading({ content: 'Waiting for swap confirmation...', key: 'swapStatus' });

      const receipt = await swapTx.wait();
      console.log("Swap receipt:", receipt);

      if (receipt.status === 1) {
        messageApi.success({ content: 'Swap successful!', key: 'swapStatus', duration: 5 });
        // --- Update output amount ---
        // Option 1: Use the estimated amount from the query (less accurate after execution)
        // const estimatedOutputFormatted = ethers.formatUnits(amountOutMinWithSlippage, tokenTwo.decimals);
        // setTokenTwoAmount(parseFloat(estimatedOutputFormatted).toFixed(6));

        // Option 2: Try to parse logs from the receipt (More Robust)
        // This requires knowing the exact event emitted by the router/adapter upon swap completion
        // e.g., const swapEvent = receipt.events?.find(e => e.event === 'Swap');
        // if (swapEvent && swapEvent.args) {
        //    const actualAmountOut = swapEvent.args.amountOut; // Adjust names based on actual event
        //    setTokenTwoAmount(ethers.utils.formatUnits(actualAmountOut, tokenTwo.decimals).toFixed(6));
        // }

        // Clear input amount after successful swap?
        setTokenOneAmount('');
        setTokenTwoAmount('');

        // --- Re-fetch balances after successful swap ---
        if (address && ethersProvider) {
          updateTokenBalances(address, ethersProvider, tokenOne, tokenTwo);
        }
        // --- End Re-fetch --- 

      } else {
        messageApi.error({ content: 'Swap transaction failed (reverted).', key: 'swapStatus', duration: 5 });
      }


    } catch (error: any) {
      console.error('Error during swap process:', error);
      messageApi.error({ content: `Swap failed: ${error.reason || error.message || 'Unknown error'}`, key: 'swapStatus', duration: 5 });
      // Reset loading message if swap fails before sending
      messageApi.destroy('swapStatus');
    } finally {
      setIsProcessingSwap(false);
    }
  };

  const handleButtonClick = () => {
    if (!isConnected) {
      open?.(); // Try using the open function provided by useAppKit
    } else {
      fetchDex(); // Otherwise, proceed with the swap
    }
  };

  // Handle setting token amount to half of balance
  const handleHalfBalance = () => {
    if (!tokenOneBalance || !isConnected) return;
    
    try {
      const balanceValue = parseFloat(tokenOneBalance);
      if (isNaN(balanceValue) || balanceValue <= 0) return;
      
      // Calculate half of balance and format it properly
      const halfBalance = (balanceValue / 2).toString();
      setTokenOneAmount(halfBalance);
      
      // Trigger exchange rate calculation
      const event = { target: { value: halfBalance } } as React.ChangeEvent<HTMLInputElement>;
      handleInputChange(event);
    } catch (error) {
      console.error("Error calculating half balance:", error);
    }
  };

  // Handle setting token amount to max balance
  const handleMaxBalance = () => {
    if (!tokenOneBalance || !isConnected) return;
    
    try {
      const balanceValue = parseFloat(tokenOneBalance);
      if (isNaN(balanceValue) || balanceValue <= 0) return;
      
      // Use entire balance
      setTokenOneAmount(tokenOneBalance);
      
      // Trigger exchange rate calculation
      const event = { target: { value: tokenOneBalance } } as React.ChangeEvent<HTMLInputElement>;
      handleInputChange(event);
    } catch (error) {
      console.error("Error setting max balance:", error);
    }
  };

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [customSlippage, setCustomSlippage] = useState<string>('');
  const [mevProtection, setMevProtection] = useState<boolean>(false);
  const [isDetailsOpen, setIsDetailsOpen] = useState<boolean>(false);
  const settingsContent = (
    <div className="bg-[#1f2639] rounded-lg p-6 border border-[#21273a] w-[400px]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-white">Settings</h3>
        <button onClick={() => setIsSettingsOpen(false)}
          className="text-gray-400 hover:text-white hover:cursor-pointer">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white mb-2">Slippage Tolerance</label>
          <div className="flex gap-2 mb-2">
            <button
              onClick={() => { setSlippage(0.5); setCustomSlippage(''); }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${slippage === 0.5 ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors hover:cursor-pointer`}
            >
              0.5%
            </button>
            <button
              onClick={() => { setSlippage(2.5); setCustomSlippage(''); }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${slippage === 2.5 ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors hover:cursor-pointer`}
            >
              2.5%
            </button>
            <button
              onClick={() => { setSlippage(5.0); setCustomSlippage(''); }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${slippage === 5.0 ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors hover:cursor-pointer`}
            >
              5.0%
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              placeholder="Custom"
              value={customSlippage}
              onChange={(e) => {
                setCustomSlippage(e.target.value);
                const value = parseFloat(e.target.value);
                if (!isNaN(value)) setSlippage(value);
              }}
              className="w-full bg-[#2c3552] text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500 text-right pr-8"
            />
            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400">%</span>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-white mb-2">Transaction Mode</label>
          <div className="flex gap-2">
            <button
              onClick={() => setTransactionMode('default')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${transactionMode === 'default' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors hover:cursor-pointer`}
            >
              Default
            </button>
            <button
              onClick={() => setTransactionMode('fast')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${transactionMode === 'fast' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors hover:cursor-pointer`}
            >
              Fast Mode
            </button>
          </div>
          <p className="text-sm text-gray-400 mt-1">Standard gas based on real-time network conditions</p>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-sm font-medium text-white">MEV Protect</label>
              <p className="text-sm text-gray-400">Enable MEV Protection</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={mevProtection}
                onChange={(e) => setMevProtection(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-[#2c3552] peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-500"></div>
            </label>
          </div>
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <button
          onClick={() => setIsSettingsOpen(false)}
          className="bg-blue-900 text-blue-500 px-6 py-2 rounded-xl font-medium hover:bg-blue-800 transition-colors hover:cursor-pointer"
        >
          Save
        </button>
      </div>
    </div>
  );

  // Effect to fetch balances when connection status, address, tokens, or provider change
  useEffect(() => {
    if (isConnected && address && ethersProvider) {
      updateTokenBalances(address, ethersProvider, tokenOne, tokenTwo);
    } else {
      // Reset balances if wallet disconnects or address/provider not available
      setTokenOneBalance(null);
      setTokenTwoBalance(null);
    }
  }, [isConnected, address, ethersProvider, tokenOne.address, tokenTwo.address, tokenOne.decimals, tokenTwo.decimals]); // Dependencies remain the same

  // Progress bar animation - runs every 15 seconds
  useEffect(() => {
    // Start progress animation
    const startProgressAnimation = () => {
      // Clear any existing interval
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
      
      setProgress(0);
      setIsRefreshing(true);
      
      // Update progress every 150ms to complete in 15 seconds
      // 15000ms / 150ms = 100 steps to reach 100%
      progressInterval.current = setInterval(() => {
        setProgress(prevProgress => {
          const newProgress = prevProgress + 0.01;
          
          // When it hits 100%, reset and trigger refresh
          if (newProgress >= 1) {
            clearInterval(progressInterval.current!);
            setIsRefreshing(false);
            
            // Refresh the quote
            if (tokenOneAmount && parseFloat(tokenOneAmount) > 0) {
              const event = { target: { value: tokenOneAmount } } as React.ChangeEvent<HTMLInputElement>;
              handleInputChange(event);
            }
            
            // Restart the animation
            setTimeout(startProgressAnimation, 100);
            return 0;
          }
          
          return newProgress;
        });
      }, 150);
    };
    
    // Start the animation initially
    startProgressAnimation();
    
    // Cleanup on unmount
    return () => {
      if (progressInterval.current) {
        clearInterval(progressInterval.current);
      }
    };
  }, [tokenOneAmount]); // Re-initialize when tokenOneAmount changes

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <>
      {/* Main Content */}
      <div className="flex justify-center items-start py-6">
        {contextHolder}
        <TokenSelectionModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSelect={modifyToken}
          readOnlyProvider={readOnlyProvider}
        />

        <div className="flex flex-col">
          {/* Header with Swap title and settings row */}
          <div className="flex flex-col mb-5">
            {/* Swap heading */}
            <h4 className="text-2xl font-bold text-white mb-3">Swap</h4>
            
            {/* Controls row */}
            <div className="flex justify-between items-center">
              {/* Aggregator Mode toggle on the left */}
              <div 
                className="flex items-center bg-[#0c111b] px-3 py-1.5 rounded-md cursor-pointer" 
                onClick={() => {/* Future implementation */}}
              >
                <span className="text-white text-sm mr-2">Aggregator Mode</span>
                <div className={`relative w-10 h-5 bg-[#171f2e] rounded-md transition-colors ${true ? 'bg-blue-600' : 'bg-gray-600'}`}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${true ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
                <svg 
                  className="ml-2 text-gray-400" 
                  width="12" 
                  height="12" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                >
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </div>
              
              {/* Right side controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="text-gray-400 hover:text-white cursor-pointer transition-colors flex items-center text-sm px-2 py-1 rounded-lg bg-[#171f2e]"
                >
                  <SettingOutlined style={{ fontSize: '14px', marginRight: '4px' }} />
                  <span>{slippage}%</span>
                </button>
                
                <button
                  className="text-gray-400 hover:text-white cursor-pointer transition-colors flex items-center justify-center w-8 h-8 rounded-lg bg-[#171f2e]"
                  onClick={() => {
                    // Reset progress and restart animation
                    setProgress(0);
                    
                    // Refresh quote
                    if (tokenOneAmount && parseFloat(tokenOneAmount) > 0) {
                      const event = { target: { value: tokenOneAmount } } as React.ChangeEvent<HTMLInputElement>;
                      handleInputChange(event);
                    }
                  }}
                >
                  {/* Circular progress bar */}
                  <svg width="20" height="20" viewBox="0 0 24 24">
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="2"
                      fill="none"
                      className="text-[#1a1e27]"
                    />
                    <circle
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="#3b82f6"
                      strokeWidth="2"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray="62.83"
                      strokeDashoffset={62.83 * (1 - progress)}
                      transform="rotate(-90 12 12)"
                    />
                  </svg>
                </button>
              </div>
            </div>
            
            <Modal
              open={isSettingsOpen}
              onCancel={() => setIsSettingsOpen(false)}
              footer={null}
              closable={false}
              centered
              className="settings-modal"
            >
              {settingsContent}
            </Modal>
          </div>

          {/* Selling Section */}
          <div className="mb-6">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Selling</span>
              <span className="text-gray-400 text-sm">
                {isConnected ? (tokenOneBalance !== null ? `${tokenOneBalance} ${tokenOne.symbol}` : 'Loading...') : `0 ${tokenOne.symbol}`}
              </span>
            </div>

            <div className="bg-[#0e1420] rounded-lg p-4 border border-[#1b2131]">
              <div className="flex items-center space-x-2 mb-3">
                <button 
                  className="flex items-center space-x-1 bg-[#171f2e] rounded-full px-3 py-1.5"
                  onClick={() => openModal(1)}
                >
                  <img src="/token.png" alt={tokenOne.symbol} className="w-5 h-5" />
                  <span className="text-white text-sm">{tokenOne.symbol}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
                
                <button 
                  className="text-xs bg-[#171f2e] text-gray-400 px-2 py-0.5 rounded hover:bg-[#232e47] transition-colors"
                  onClick={handleHalfBalance}
                  disabled={!isConnected || !tokenOneBalance}
                >
                  HALF
                </button>
                <button 
                  className="text-xs bg-[#171f2e] text-gray-400 px-2 py-0.5 rounded hover:bg-[#232e47] transition-colors"
                  onClick={handleMaxBalance}
                  disabled={!isConnected || !tokenOneBalance}
                >
                  MAX
                </button>
              </div>

              <div className="text-right">
                <input
                  type="text"
                  value={tokenOneAmount}
                  onChange={handleInputChange}
                  className="w-full bg-transparent text-white text-4xl font-medium text-right border-none outline-none p-0"
                  placeholder="0"
                />
                <div className="text-gray-400 text-sm">${tokenOneAmount}</div>
              </div>
            </div>
          </div>

          {/* Switch Button */}
          <div className="flex justify-center -my-3 z-10">
            <button 
              onClick={switchTokens}
              className="bg-[#0c111b] rounded-full p-2"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M19 14l-7 7-7-7" />
                <path d="M5 10l7-7 7 7" />
              </svg>
            </button>
          </div>

          {/* Buying Section */}
          <div className="mb-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-gray-400 text-sm">Buying</span>
              <span className="text-gray-400 text-sm">
                {isConnected ? (tokenTwoBalance !== null ? `${tokenTwoBalance} ${tokenTwo.symbol}` : 'Loading...') : `0 ${tokenTwo.symbol}`}
              </span>
            </div>

            <div className="bg-[#0e1420] rounded-lg p-4 border border-[#1b2131]">
              <div className="flex items-center mb-3">
                <button 
                  className="flex items-center space-x-1 bg-[#171f2e] rounded-full px-3 py-1.5"
                  onClick={() => openModal(2)}
                >
                  <img src="/token.png" alt={tokenTwo.symbol} className="w-5 h-5" />
                  <span className="text-white text-sm">{tokenTwo.symbol}</span>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="ml-1">
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>
              </div>

              <div className="text-right">
                <div className="text-white text-4xl font-medium">{tokenTwoAmount}</div>
                <div className="text-gray-400 text-sm">${(parseFloat(tokenTwoAmount || "0") * 142.53).toFixed(2)}</div>
              </div>
            </div>
          </div>

          {/* Swap Button */}
          <button
            onClick={handleButtonClick}
            disabled={isProcessingSwap || (isConnected && (!tokenOneAmount || parseFloat(tokenOneAmount) <= 0))}
            className={`w-full py-3 rounded-lg font-medium mt-2 ${
              isProcessingSwap 
                ? "bg-gray-700 text-gray-400 cursor-not-allowed" 
                : isConnected 
                  ? (tokenOneAmount && parseFloat(tokenOneAmount) > 0)
                    ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                    : "bg-gray-700 text-gray-400 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
            }`}
          >
            {isProcessingSwap 
              ? "Processing..." 
              : isConnected 
                ? (tokenOneAmount && parseFloat(tokenOneAmount) > 0) 
                  ? "Swap" 
                  : "Enter an amount"
                : "Connect Wallet"
            }
          </button>

          {/* Details Section - Only shown when there is valid input */}
          {tokenOneAmount && 
           tokenOneAmount !== "0" && 
           tokenOneAmount !== "0.00" && 
           !isNaN(parseFloat(tokenOneAmount)) && 
           parseFloat(tokenOneAmount) > 0 && (
            <div className="mt-4 text-sm">
              {/* Rate header - Always visible */}
              <div 
                className="flex justify-between items-center py-3 cursor-pointer" 
                onClick={() => setIsDetailsOpen(!isDetailsOpen)}
              >
                <span className="text-white">Rate: 1 {tokenOne.symbol} = {(parseFloat(tokenTwoAmount || "0") / parseFloat(tokenOneAmount || "1")).toFixed(7)} {tokenTwo.symbol}</span>
                <svg 
                  width="16" 
                  height="16" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  className={`transform transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}
                >
                  <path d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Collapsible content */}
              {isDetailsOpen && (
                <div>
                  <div className="flex justify-between items-center py-2 border-t border-gray-800 mt-1">
                    <span className="text-gray-400">Network Fee (est.)</span>
                    <span className="text-white">~ {estimatedGasFee} ETH</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-t border-gray-800">
                    <span className="text-gray-400">Slippage</span>
                    <span className="text-white">{slippage}%</span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-t border-gray-800">
                    <span className="text-gray-400">Route</span>
                    <span className="text-white">
                      {routePath.length > 0 ? (
                        routePath.map((token, index) => (
                          <span key={token}>
                            {index > 0 && " → "}
                            {DEFAULT_TOKEN_LIST.tokens.find(t => t.address.toLowerCase() === token.toLowerCase())?.symbol || token.slice(0, 6) + '...'}
                          </span>
                        ))
                      ) : (
                        `${tokenOne.symbol} → ${tokenTwo.symbol}`
                      )}
                    </span>
                  </div>

                  <div className="flex justify-between items-center py-2 border-t border-gray-800">
                    <span className="text-gray-400">Router</span>
                    <span className="text-white">Infi Router</span>
                  </div>
                </div>
              )}
            </div>
           )}
         </div>
      </div>
    </>
  );
}