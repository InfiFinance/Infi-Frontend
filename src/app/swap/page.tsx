"use client";

import { Input, Popover, Radio, Modal, message } from 'antd';
const infiRouterAddress = require('../../contract/aggregator/pharos/InfiRouter.json').address
const infiRouterAbi = require('../../contract/aggregator/pharos/InfiRouter.json').abi
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
  const [tokenOne, setTokenOne] = useState<TokenInfo>(DEFAULT_TOKEN_LIST.tokens[0]);
  const [tokenTwo, setTokenTwo] = useState<TokenInfo>(DEFAULT_TOKEN_LIST.tokens[1]);
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
  const [estimatedGasFee, setEstimatedGasFee] = useState<string>('...');
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
      setTokenTwoAmount("0.00");
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
          setTokenTwoAmount("0.00"); // Handle no result
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
    setTokenOneAmount('0');
    setTokenTwoAmount('0');
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
    setTokenOneAmount('0');
    setTokenTwoAmount('0');
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
        if (address && ethersProvider) { // Ensure we still have address/provider
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

  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [transactionMode, setTransactionMode] = useState<string>('default');
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

  return (
    <>
      {/* Removed min-h-screen to prevent overflow */}
      <div className="flex justify-center items-start py-12">
        {contextHolder}
        <TokenSelectionModal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          onSelect={modifyToken}
          readOnlyProvider={readOnlyProvider}
        />

        <div className="w-full max-w-md p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h4 className="text-xl font-bold">Swap</h4>
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
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="text-gray-500 hover:text-white cursor-pointer transition-colors text-xl hover:cursor-pointer"
            >
              <SettingOutlined />
            </button>
          </div>

          <div className="relative space-y-2">
            <Input
              placeholder="0"
              value={tokenOneAmount}
              onChange={handleInputChange}
              disabled={false}
              className="bg-transparent border border-gray-700 rounded-xl p-4"
            />
            <div className="balanceDisplayOne">
              {/* Conditionally render balance */}
              {isConnected && (
                <span>Balance: {tokenOneBalance !== null ? tokenOneBalance : 'Loading...'}</span>
              )}
            </div>
            <Input
              placeholder="0"
              value={tokenTwoAmount}
              disabled={true}
              className="bg-transparent border border-gray-700 rounded-xl p-4"
            />
            <div className="balanceDisplayTwo">
              {/* Conditionally render balance */}
              {isConnected && (
                <span>Balance: {tokenTwoBalance !== null ? tokenTwoBalance : 'Loading...'}</span>
              )}
            </div>
            <button
              className="switchButton"
              onClick={switchTokens}
            >
              <ArrowDownOutlined className="text-gray-400" />
            </button>

            <button
              className=" assetOne"
              onClick={() => openModal(1)}
            >
              <img src={"/token.png"} alt={tokenOne.symbol} className="logo" />
              <span>{tokenOne.symbol}</span>
            </button>

            <button
              className="assetTwo"
              onClick={() => openModal(2)}
            >
              <img src={"/token.png"} alt={tokenTwo.symbol} className="logo" />
              <span>{tokenTwo.symbol}</span>
            </button>
          </div>

          {/* Transaction Details Dropdown */}
          {tokenOneAmount && tokenTwoAmount && tokenTwoAmount !== "0.00" && tokenOneAmount && tokenTwoAmount && tokenTwoAmount !== "0" && (
            <div className="bg-[#1f2639] rounded-lg p-4 space-y-3">
              <div className="flex justify-between items-center cursor-pointer" onClick={() => setIsDetailsOpen(!isDetailsOpen)}>
                <span className="text-sm text-gray-400 "> <span className="text-sm text-gray-400">Rate: </span>{`1 ${tokenOne.symbol} = ${(parseFloat(tokenTwoAmount) / parseFloat(tokenOneAmount)).toFixed(6)} ${tokenTwo.symbol}`}</span>
                <svg
                  className={`w-4 h-4 text-gray-400  transition-transform ${isDetailsOpen ? 'rotate-180' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {isDetailsOpen && (
                <div className="space-y-2">
                  {/* <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-400">Rate</span>
                  <span className="text-sm text-white">{`1 ${tokenOne.symbol} = ${(parseFloat(tokenTwoAmount) / parseFloat(tokenOneAmount)).toFixed(6)} ${tokenTwo.symbol}`}</span>
                </div> */}
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Network Fee (est.)</span>
                    <span className="text-sm text-white">~ {estimatedGasFee} ETH</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Slippage</span>
                    <span className="text-sm text-white">{slippage}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Route</span>
                    <span className="text-sm text-white">
                      {/* Replace the queryRes?.path check with routePath */}
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
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400">Router</span>
                    <span className="text-sm text-white">Infi Router</span>
                  </div>
                </div>
              )}
            </div>
          )}

          <button
            className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${ // Conditional Styling
              !isConnected
                ? 'bg-blue-900 text-blue-500 hover:bg-blue-800 hover:cursor-pointer' // Always active style when not connected
                : (!tokenOneAmount || isProcessingSwap) // Style when connected
                  ? 'bg-blue-900/40 text-blue-500/60 cursor-not-allowed' // Disabled style if no amount or processing
                  : 'bg-blue-900 text-blue-500 hover:bg-blue-800 hover:cursor-pointer' // Active style otherwise
              }`}
            onClick={handleButtonClick} // Use the new handler
            disabled={isProcessingSwap || (isConnected && !tokenOneAmount)} // Updated disabled logic
          >
            {/* Conditional Text */}
            {isConnected ? 'Swap' : 'Connect Wallet'}
          </button>
        </div>

      </div>
      <div className={`${audiowide.className} flex items-end justify-center mt-40 h-[30rem]`}>
        <TextHoverEffect text="Infi" />
      </div>



    </>
  );
}