"use client";

import { Input, Popover, Radio, Modal, message } from 'antd';
import { ArrowDownOutlined, SettingOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import axios from 'axios';
import { Token, TokenPrice, TxDetails } from '@/types/token';
import TokenSelectionModal from '@/components/TokenSelectionModal';

interface SwapProps {
  address?: string;
  isConnected: boolean;
}

const tokenList: Token[] = [
  {
    ticker: "USDC",
    img: "https://cdn.moralis.io/eth/0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.png",
    name: "USD Coin",
    address: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
    decimals: 6
  },
  {
    ticker: "LINK",
    img: "https://cdn.moralis.io/eth/0x514910771af9ca656af840dff83e8264ecf986ca.png",
    name: "Chainlink",
    address: "0x514910771af9ca656af840dff83e8264ecf986ca",
    decimals: 18
  }
];

export default function Swap({ address, isConnected }: SwapProps) {
  const [slippage, setSlippage] = useState<number>(2.5);
  const [messageApi, contextHolder] = message.useMessage();
  const [tokenOneAmount, setTokenOneAmount] = useState<string>('0');
  const [tokenTwoAmount, setTokenTwoAmount] = useState<string>('0');
  const [tokenOne, setTokenOne] = useState<Token>(tokenList[0]);
  const [tokenTwo, setTokenTwo] = useState<Token>(tokenList[1]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [changeToken, setChangeToken] = useState<number>(1);
  const [prices, setPrices] = useState<TokenPrice | null>(null);
  const [txDetails, setTxDetails] = useState<TxDetails>({
    to: null,
    data: null,
    value: null
  });

  const handleSlippage = (e: any) => {
    setSlippage(e.target.value);
  };

  const changeAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTokenOneAmount(e.target.value);
    if (e.target.value && prices) {
      setTokenTwoAmount((Number(e.target.value) * prices.ratio).toFixed(2));
    } else {
      setTokenTwoAmount('0');
    }
  };

  const switchTokens = () => {
    setPrices(null);
    setTokenOneAmount('0');
    setTokenTwoAmount('0');
    setTokenOne(tokenTwo);
    setTokenTwo(tokenOne);
    fetchDexSwap(tokenTwo.address, tokenOne.address);
  };

  const openModal = (token: number) => {
    setChangeToken(token);
    setIsOpen(true);
  };

  const modifyToken = (i: number) => {
    setPrices(null);
    setTokenOneAmount('0');
    setTokenTwoAmount('0');
    if (changeToken === 1) {
      setTokenOne(tokenList[i]);
      fetchDexSwap(tokenList[i].address, tokenTwo.address);
    } else {
      setTokenTwo(tokenList[i]);
      fetchDexSwap(tokenOne.address, tokenList[i].address);
    }
    setIsOpen(false);
  };

  const fetchDexSwap = async (one: string, two: string) => {
    try {
      const res = await axios.get("https://dex-swap-clone.onrender.com/tokenPrice", {
        params: {
          addressOne: one,
          addressTwo: two
        }
      });
      setPrices(res.data);
    } catch (error) {
      console.error('Error fetching token prices:', error);
    }
  };

  const fetchDex = async () => {
    try {
      const allowance = await axios.get(
        `https://api.1inch.io/v5.0/1/approve/allowance?tokenAddress=${tokenOne.address}&walletAddress=${address}`
      );

      if (allowance.data.allowance === 0) {
        const approve = await axios.get(
          `https://api.1inch.io/v5.0/1/approve/transaction?tokenAddress=${tokenOne.address}&amount=100000000000`
        );
        setTxDetails(approve.data);
        return;
      }

      const swap = await axios.get(
        `https://api.1inch.io/v5.0/1/swap?fromTokenAddress=${tokenOne.address}&toTokenAddress=${tokenTwo.address}&amount=${tokenOneAmount.padEnd(tokenOne.decimals + tokenOneAmount.length, '0')}&fromAddress=${address}&slippage=${slippage}`
      );

      const decimals = Number(`1E${tokenTwo.decimals}`);
      setTokenTwoAmount((Number(swap?.data?.toTokenAmount) / decimals).toFixed(2));
      setTxDetails(swap?.data?.tx);
    } catch (error) {
      console.error('Error during swap:', error);
      messageApi.error('Swap failed');
    }
  };

  useEffect(() => {
    fetchDexSwap(tokenList[0].address, tokenList[1].address);
  }, []);

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
        tokens={tokenList}
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
            onChange={changeAmount}
            disabled={!prices}
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
            <img src={tokenOne.img} alt={tokenOne.ticker} className="logo" />
            <span>{tokenOne.ticker}</span>
          </button>

          <button
            className="assetTwo"
            onClick={() => openModal(2)}
          >
            <img src={tokenTwo.img} alt={tokenTwo.ticker} className="logo" />
            <span>{tokenTwo.ticker}</span>
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