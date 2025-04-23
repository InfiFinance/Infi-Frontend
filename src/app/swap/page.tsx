"use client";

import { Input, Popover, Radio, Modal, message } from 'antd';
const infiRouterAddress = require('../../contract/aggregator/pharos/InfiRouter.json').address
const infiRouterAbi = require('../../contract/aggregator/pharos/InfiRouter.json').abi

//@ts-ignore
import { ArrowDownOutlined, SettingOutlined } from '@ant-design/icons';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { TokenInfo, DEFAULT_TOKEN_LIST } from '../../services/tokenService';
import { TxDetails } from '@/types/token';
import TokenSelectionModal from '@/components/TokenSelectionModal';
import { useReadContract } from "wagmi";
import { useAppKitAccount, useAppKitProvider } from '@reown/appkit/react';
import { BrowserProvider, Contract, Eip1193Provider, ethers, formatUnits } from "ethers";

interface SwapProps {
  address?: string;
  isConnected: boolean;
}

export default function Swap() {
  const [slippage, setSlippage] = useState<number>(2.5);
  const [messageApi, contextHolder] = message.useMessage();
  const [tokenOneAmount, setTokenOneAmount] = useState<string>('0');
  const [tokenTwoAmount, setTokenTwoAmount] = useState<string>('0');
  const [tokenOne, setTokenOne] = useState<TokenInfo>(DEFAULT_TOKEN_LIST.tokens[0]);
  const [tokenTwo, setTokenTwo] = useState<TokenInfo>(DEFAULT_TOKEN_LIST.tokens[1]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [changeToken, setChangeToken] = useState<number>(1);
  const [txDetails, setTxDetails] = useState<TxDetails>({
    to: null,
    data: null,
    value: null
  });

  const { address, caipAddress, isConnected,  } = useAppKitAccount();
  const [ethersProvider, setEthersProvider] = useState<BrowserProvider | null>(null);
  const { walletProvider } = useAppKitProvider("eip155");

  const [isQuerying, setIsQuerying] = useState(false); // Optional: for loading indicator
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref to store timeout ID

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

  const InfiRouter = new Contract(
    infiRouterAddress, 
    infiRouterAbi, 
    ethersProvider
)

  async function query(tknFrom:string, tknTo:string, amountIn:any) {
    const maxHops = 3
    const gasPrice = ethers.parseUnits('225', 'gwei')
    return InfiRouter.findBestPathWithGas(
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
        // Ensure provider is ready
        if (!ethersProvider) {
           console.error("Provider not ready for query");
           setIsQuerying(false);
           return;
        }
         // Ensure amount is valid BigInt parsable string
         const amountInWei = ethers.parseUnits(currentInputStr, tokenOne.decimals);

        console.log(`Debounced query for: ${currentInputStr}`); // Logging
        const res = await query(tokenOne.address, tokenTwo.address, amountInWei); // Pass BigInt amount

        if (res && res.amounts && res.amounts.length > 0) {
          const estimatedOutputWei = res.amounts[res.amounts.length - 1];
          const estimatedOutputFormatted = ethers.formatUnits(
            estimatedOutputWei,
            tokenTwo.decimals
          );
          // -- Simple Multiplication (See previous caveat about precision) --
          // This part assumes the rate is somewhat constant for different inputs
          // A better approach might involve BigInt division if you have the input Wei used for the query
          // For display, simple ratio might be okay.
          // Let's just display the direct query result for the debounced input for accuracy:
           setTokenTwoAmount(parseFloat(estimatedOutputFormatted).toFixed(6)); // Show more precision
           // setTokenTwoAmount(calculatedAmountNumber.toFixed(2)); // Previous calculation
        } else {
          setTokenTwoAmount("0.00"); // Handle no result
        }
      } catch (err: any) {
         console.error("Error during debounced query:", err);
         // Handle specific errors, e.g., invalid input format for parseUnits
         if (err.code === 'INVALID_ARGUMENT'){
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

    if (changeToken === 1) {
       if(token.address === tokenTwo.address) {
         switchTokens();
         setIsOpen(false);
         return;
       }
      setTokenOne(token);
    } else {
       if(token.address === tokenOne.address) {
          switchTokens();
          setIsOpen(false);
          return;
       }
      setTokenTwo(token);
    }
    setIsOpen(false);
  };


  const fetchDex = async () => {
    try {
      // Ensure provider and signer are ready
      if (!ethersProvider) {
        messageApi.error('Wallet provider not available.');
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

      // 2. Query the router
      const queryRes = await query(tokenOne.address, tokenTwo.address, amountInWei);
      console.log("Query Result:", queryRes);

      // Validate query response
      if (!queryRes || !queryRes.amounts || queryRes.amounts.length === 0 || !queryRes.path || !queryRes.adapters) {
         messageApi.error('Failed to get a valid swap route from the router.');
         return;
      }

      // 3. Get amountOutMin (last amount from query) and fee
      const amountOutMin = queryRes.amounts[queryRes.amounts.length - 1];
      const fee = 0; // Assuming fee is always 0 based on previous examples

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
      if (allowance < amountInWei) { // Use < for BigInt comparison
        console.log(`Allowance is ${allowance.toString()}, need ${amountInWei.toString()}. Approving...`);
        messageApi.info('Approval required. Please confirm in your wallet.');
        try {
            // Use connect(signer) to get a Contract instance associated with the signer
            // Cast to Contract to satisfy TS about the approve method
            const approveTx = await (tokenContract.connect(signer) as ethers.Contract).approve(infiRouterAddress, amountInWei, { // Use amountInWei
                 gasLimit: 100000, // Optional: Set a gas limit for approve
                 // gasPrice: ethers.utils.parseUnits("1", 'gwei') // Optional: Set gas price
            });
            console.log("Approval tx sent:", approveTx.hash);
            await approveTx.wait(); // Wait for approval confirmation
            console.log("Approval confirmed.");
            messageApi.success('Approval successful!');
            // Potentially pause here or proceed directly to swap
        } catch (approveError: any) {
             console.error('Error during approval:', approveError);
             messageApi.error(`Approval failed: ${approveError.reason || approveError.message}`);
             return; // Stop if approval fails
        }

      } else {
         console.log("Sufficient allowance already granted.");
      }

      // 6. Prepare arguments for swapNoSplit (Create COPIES of arrays)
      const pathCopy = [...queryRes.path];
      const adaptersCopy = [...queryRes.adapters];
      const tradeArgs = [
            amountInWei,      // amountIn (BigInt)
            amountOutMin,     // amountOutMin (BigInt)
            pathCopy,         // path (copied array)
            adaptersCopy      // adapters (copied array)
      ];

      console.log("Executing swap with args:", tradeArgs);
      messageApi.info('Executing swap. Please confirm in your wallet.');

      // 7. Execute Swap
      // Use connect(signer) to get a Contract instance associated with the signer
      // Cast to Contract to satisfy TS about the swapNoSplit method
      const swapTx = await (InfiRouter.connect(signer) as ethers.Contract).swapNoSplit(
        tradeArgs,
        signer.address, // recipient
        fee
        // Optional: Add gas overrides if needed
        // { gasLimit: 5000000, gasPrice: ethers.utils.parseUnits("1", 'gwei') }
      );

      console.log("Swap tx sent:", swapTx.hash);
      messageApi.loading({ content: 'Waiting for swap confirmation...', key: 'swapStatus' });

      const receipt = await swapTx.wait();
      console.log("Swap receipt:", receipt);

      if (receipt.status === 1) {
         messageApi.success({ content: 'Swap successful!', key: 'swapStatus', duration: 5 });
          // --- Update output amount ---
          // Option 1: Use the estimated amount from the query (less accurate after execution)
          const estimatedOutputFormatted = ethers.formatUnits(amountOutMin, tokenTwo.decimals);
          setTokenTwoAmount(parseFloat(estimatedOutputFormatted).toFixed(6));

          // Option 2: Try to parse logs from the receipt (More Robust)
          // This requires knowing the exact event emitted by the router/adapter upon swap completion
          // e.g., const swapEvent = receipt.events?.find(e => e.event === 'Swap');
          // if (swapEvent && swapEvent.args) {
          //    const actualAmountOut = swapEvent.args.amountOut; // Adjust names based on actual event
          //    setTokenTwoAmount(ethers.utils.formatUnits(actualAmountOut, tokenTwo.decimals).toFixed(6));
          // }

          // Clear input amount after successful swap?
          // setTokenOneAmount('0');

      } else {
          messageApi.error({ content: 'Swap transaction failed (reverted).', key: 'swapStatus', duration: 5 });
      }


    } catch (error: any) {
      console.error('Error during swap process:', error);
      messageApi.error({ content: `Swap failed: ${error.reason || error.message || 'Unknown error'}`, key: 'swapStatus', duration: 5 });
       // Reset loading message if swap fails before sending
       messageApi.destroy('swapStatus');
    }
  };


  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [transactionMode, setTransactionMode] = useState<string>('default');
  const [customSlippage, setCustomSlippage] = useState<string>('');
  const [mevProtection, setMevProtection] = useState<boolean>(false);
  const settingsContent = (
    <div className="bg-[#1f2639] rounded-lg p-6 border border-[#21273a] w-[400px]">
      <div className="flex justify-between items-center mb-6">
        <h3 className="text-lg font-medium text-white">Settings</h3>
        <button onClick={() => setIsSettingsOpen(false)} className="text-gray-400 hover:text-white">
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
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${slippage === 0.5 ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
            >
              0.5%
            </button>
            <button
              onClick={() => { setSlippage(2.5); setCustomSlippage(''); }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${slippage === 2.5 ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
            >
              2.5%
            </button>
            <button
              onClick={() => { setSlippage(5.0); setCustomSlippage(''); }}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${slippage === 5.0 ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
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
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${transactionMode === 'default' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
            >
              Default
            </button>
            <button
              onClick={() => setTransactionMode('fast')}
              className={`flex-1 py-2 px-4 rounded-lg font-medium ${transactionMode === 'fast' ? 'bg-blue-500 text-white' : 'bg-[#2c3552] text-gray-400'} hover:bg-[#374264] transition-colors`}
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
          className="bg-blue-900 text-blue-500 px-6 py-2 rounded-xl font-medium hover:bg-blue-800 transition-colors"
        >
          Save
        </button>
      </div>
    </div>
  );

  return (
    <>
    <div className="min-h-screen flex justify-center items-start py-12">
      {contextHolder}
      <TokenSelectionModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        onSelect={modifyToken}
      />

      <div className="w-full max-w-md bg-[#0E111B] border-2 border-[#21273a] rounded-2xl p-6 space-y-4">
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
            className="text-gray-500 hover:text-white cursor-pointer transition-colors text-xl"
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
          <Input
            placeholder="0"
            value={tokenTwoAmount}
            disabled={true}
            className="bg-transparent border border-gray-700 rounded-xl p-4"
          />

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
            <img src={tokenOne.logoURI} alt={tokenOne.symbol} className="logo" />
            <span>{tokenOne.symbol}</span>
          </button>

          <button
            className="assetTwo"
            onClick={() => openModal(2)}
          >
            <img src={tokenTwo.logoURI} alt={tokenTwo.symbol} className="logo" />
            <span>{tokenTwo.symbol}</span>
          </button>
        </div>

        <button
          className={`w-full py-4 rounded-xl font-bold text-lg transition-colors ${!tokenOneAmount || !isConnected
            ? 'bg-blue-900/40 text-blue-500/60 cursor-not-allowed'
            : 'bg-blue-900 text-blue-500 hover:bg-blue-800'}`}
          onClick={fetchDex}
          disabled={!tokenOneAmount || !isConnected}
        >
          Swap
        </button>
      </div>
      </div>
    </>
  );
}