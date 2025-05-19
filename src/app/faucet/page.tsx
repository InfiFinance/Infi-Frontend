"use client";

import { useState, useEffect, useCallback } from 'react';
import { message } from 'antd';
import { useAppKitAccount } from '@reown/appkit/react';
import { TokenInfo, FAUCET_PAGE_TOKEN_LIST, DEFAULT_TOKEN_LIST } from '@/services/tokenService';
import { CopyOutlined, DownOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';

const LOCAL_STORAGE_COOLDOWN_KEY = 'tokenCooldowns';

export default function TestnetTokens() {
  const { isConnected, address } = useAppKitAccount();
  const [isRequesting, setIsRequesting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  // const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(FAUCET_PAGE_TOKEN_LIST.tokens[0] || null);

  const availableTokens = FAUCET_PAGE_TOKEN_LIST.tokens.filter(token => token.symbol !== 'PHRS');
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(availableTokens[0] || null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [cooldowns, setCooldowns] = useState<{ [key: string]: number }>({}); // Stores remaining hours

  const getStoredCooldowns = useCallback(() => {
    if (!address) return {};
    const stored = localStorage.getItem(`${LOCAL_STORAGE_COOLDOWN_KEY}_${address}`);
    return stored ? JSON.parse(stored) : {};
  }, [address]);

  const updateAndStoreCooldowns = useCallback(() => {
    if (!address) return;
    const storedCooldowns = getStoredCooldowns();
    const now = Date.now();
    const newCooldowns: { [key: string]: number } = {};
    let needsUpdate = false;

    FAUCET_PAGE_TOKEN_LIST.tokens.forEach(token => {
      const mintTime = storedCooldowns[token.symbol];
      if (mintTime) {
        const hoursSinceLastMint = (now - mintTime) / (1000 * 60 * 60);
        if (hoursSinceLastMint < 24) {
          newCooldowns[token.symbol] = 24 - hoursSinceLastMint;
        } else {
          delete storedCooldowns[token.symbol];
          needsUpdate = true;
        }
      }
    });

    setCooldowns(newCooldowns);
    if (needsUpdate || Object.keys(storedCooldowns).length === 0 && Object.keys(getStoredCooldowns()).length > 0) {
        localStorage.setItem(`${LOCAL_STORAGE_COOLDOWN_KEY}_${address}`, JSON.stringify(storedCooldowns));
    }
  }, [address, getStoredCooldowns]);

  useEffect(() => {
    if (address) {
      updateAndStoreCooldowns();
      const interval = setInterval(updateAndStoreCooldowns, 60000);
      return () => clearInterval(interval);
    }
  }, [address, updateAndStoreCooldowns]);

  useEffect(() => {
  //   if (FAUCET_PAGE_TOKEN_LIST.tokens.length > 0 && !selectedToken) {
  //     setSelectedToken(FAUCET_PAGE_TOKEN_LIST.tokens[0]);
  //   } else if (selectedToken && !FAUCET_PAGE_TOKEN_LIST.tokens.find(t => t.symbol === selectedToken.symbol)) {
  //     setSelectedToken(FAUCET_PAGE_TOKEN_LIST.tokens[0] || null);
  //   }
  // }, [selectedToken]);
    if (availableTokens.length > 0 && !selectedToken) {
      setSelectedToken(availableTokens[0]);
    } else if (selectedToken && !availableTokens.find(t => t.symbol === selectedToken.symbol)) {
      setSelectedToken(availableTokens[0] || null);
    }
  }, [selectedToken, availableTokens]);

  const formatTimeRemaining = (hours: number) => {
    if (hours <= 0) return "Ready";
    const wholeHours = Math.floor(hours);
    const minutes = Math.floor((hours - wholeHours) * 60);
    return `${wholeHours}h ${minutes}m`;
  };

  const handleRequestToken = async () => {
    if (!isConnected || !address) {
      messageApi.error('Please connect your wallet first and ensure address is available');
      return;
    }
    if (!selectedToken) {
      messageApi.error('Please select a token');
      return;
    }

    // Temporarily disable PHRS token requests for testing
    // if (selectedToken.symbol === 'PHRS') {
    //   messageApi.info({
    //     content: 'PHRS token requests are temporarily disabled for testing.',
    //     duration: 5,
    //   });
    //   return;
    // }

    // Client-side cooldown check before sending request
    const now = Date.now();
    const storedCooldowns = getStoredCooldowns();
    const lastMintTime = storedCooldowns[selectedToken.symbol];
    if (lastMintTime) {
      const hoursSinceLastMint = (now - lastMintTime) / (1000 * 60 * 60);
      if (hoursSinceLastMint < 24) {
        const hoursRemaining = 24 - hoursSinceLastMint;
        messageApi.info({
          content: `Please wait ${formatTimeRemaining(hoursRemaining)} before requesting ${selectedToken.symbol} again.`,
          duration: 5,
        });
        return;
      }
    }

    setIsRequesting(true);
    messageApi.loading({ content: `Requesting ${selectedToken.symbol}... This may take a moment.`, key: 'tokenRequest' });
    try {
      const response = await fetch(`/api/send-erc20?walletAddress=${address}&token=${selectedToken.symbol}`);
      const data = await response.json();
      if (!response.ok) {
        messageApi.error({ content: `Error: ${data.error || 'Failed to request token.'} (HTTP ${response.status})`, key: 'tokenRequest' });
        setIsRequesting(false);
        return;
      }
      if (data.results && Array.isArray(data.results)) {
        data.results.forEach((result: any) => {
          if (result.status === 'success') {
            // const amount = selectedToken.symbol === 'PHRS' ? '0.1' : '100';
            let amount = '100'; // Default amount
            if (selectedToken.symbol === 'PHRS') {
              // This part will effectively be skipped due to the check above,
              // but commenting out the specific PHRS amount logic as requested.
              // amount = '0.1'; 
            }
            messageApi.success({ 
              content: `${amount} ${result.token} minted successfully! Tx: ${result.txHash.substring(0, 10)}...`, 
              duration: 5 
            });
            // Set cooldown in localStorage
            const currentCooldowns = getStoredCooldowns();
            currentCooldowns[selectedToken.symbol] = Date.now();
            localStorage.setItem(`${LOCAL_STORAGE_COOLDOWN_KEY}_${address}`, JSON.stringify(currentCooldowns));
            updateAndStoreCooldowns(); // Refresh UI
          } else if (result.status === 'system_error') { // Backend errors
            messageApi.error({ 
              content: `System error processing ${result.token || 'request'}: ${result.error || 'Failed to update records.'}`, 
              duration: 7 
            });
          } else { // Other backend errors
            messageApi.error({ 
              content: `Error minting ${result.token}: ${result.error || 'Unknown error'}`, 
              duration: 5 
            });
          }
        });
      } else {
        // Handle cases where data.results is not as expected or general success message if needed
        messageApi.success({ content: 'Token request processed! Check messages above for details.', key: 'tokenRequest', duration: 5 });
      }
      
    } catch (error) {
      messageApi.error({ content: 'An unexpected error occurred while requesting token. Please check the console.', key: 'tokenRequest' });
    }
    setIsRequesting(false);
  };

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      messageApi.success('Address copied!');
    }
  };

  // const tokenMenuItems = (FAUCET_PAGE_TOKEN_LIST.tokens as TokenInfo[]).map(token => ({
  const tokenMenuItems = availableTokens.map(token => ({
    key: token.symbol,
    label: (
      <div className="flex items-center gap-2">
        <img src={token.logoURI ?? '/token.png'} alt={token.symbol} className="w-5 h-5 rounded-full" />
        <span className="font-medium">{token.symbol}</span>
        <span className="text-xs text-gray-400 ml-1">{token.name}</span>
        {cooldowns[token.symbol] > 0 && (
          <span className="text-xs text-yellow-400 ml-auto">
            {formatTimeRemaining(cooldowns[token.symbol])} left
          </span>
        )}
      </div>
    ),
  }));

  return (
    <>
      {contextHolder}
      <div className="flex justify-center items-start py-6">
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex flex-col mb-5">
            <h4 className="text-2xl font-bold text-white mb-3">Faucet</h4>
            <p className="text-gray-400 text-sm mb-6">
              You can request testnet tokens every 24 hours from the Faucet.
            </p>
          </div>

          {/* Main Content */}
          <div className="bg-[#0e1420] rounded-lg p-6 border border-[#1b2131] w-[400px]">
            <div className="space-y-6">
              {/* Wallet Address and Token Dropdown */}
              <div className="flex items-center gap-2 bg-[#171f2e] rounded-lg px-4 py-3 border border-[#2c3552]">
                <span className="text-white font-mono text-sm truncate flex-1" title={address || ''}>
                  {address ? address : 'Not connected'}
                </span>
                {address && (
                  <button onClick={handleCopy} className="ml-2 text-gray-400 hover:text-white" title="Copy address">
                    <CopyOutlined />
                  </button>
                )}
                <Dropdown
                  menu={{
                    items: tokenMenuItems,
                    selectable: true,
                    selectedKeys: [selectedToken?.symbol || ''],
                    onClick: ({ key }) => {
                      // const token = (FAUCET_PAGE_TOKEN_LIST.tokens as TokenInfo[]).find(t => t.symbol === key);
                      const token = availableTokens.find(t => t.symbol === key);
                      if (token) setSelectedToken(token);
                      setDropdownOpen(false);
                    },
                  }}
                  trigger={["click"]}
                  open={dropdownOpen}
                  onOpenChange={setDropdownOpen}
                >
                  <button className="flex items-center gap-2 ml-4 px-3 py-1 rounded-lg bg-[#232b3d] hover:bg-[#2c3552] border border-[#2c3552] text-white">
                    <img src={selectedToken?.logoURI ?? '/token.png'} alt={selectedToken?.symbol} className="w-5 h-5 rounded-full" />
                    <span className="font-medium">{selectedToken?.symbol}</span>
                    {selectedToken && cooldowns[selectedToken.symbol] > 0 && (
                      <span className="text-xs text-yellow-400 ml-1">
                        ({formatTimeRemaining(cooldowns[selectedToken.symbol])} left)
                      </span>
                    )}
                    <DownOutlined className="ml-1 text-xs" />
                  </button>
                </Dropdown>
              </div>

              {/* Request Button */}
              <button
                onClick={handleRequestToken}
                disabled={!isConnected || isRequesting || !selectedToken || (selectedToken && cooldowns[selectedToken.symbol] > 0)}
                className={`w-full py-3 rounded-lg font-medium mt-2 ${
                  !isConnected || isRequesting || !selectedToken || (selectedToken && cooldowns[selectedToken.symbol] > 0)
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                }`}
              >
                {!isConnected
                  ? 'Connect Wallet'
                  : isRequesting
                    ? `Requesting...`
                    : selectedToken && cooldowns[selectedToken.symbol] > 0
                      ? `Wait ${formatTimeRemaining(cooldowns[selectedToken.symbol])}`
                      : `Request ${selectedToken?.symbol}`}
              </button>

              {/* Instructions */}
              <div className="space-y-3">
                <h5 className="text-white font-medium">Instructions</h5>
                <ul className="text-gray-400 text-sm space-y-2">
                  <li className="flex items-start">
                    <span className="mr-2">1.</span>
                    Connect your wallet if not already connected
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">2.</span>
                    Select the token you want to receive from the dropdown
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">3.</span>
                    Click "Request Token"
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">4.</span>
                    Wait for the token to be sent to your wallet
                  </li>
                </ul>
              </div>

              {/* Token Amounts */}
              <div className="space-y-2">
                <h5 className="text-white font-medium">Available Amounts</h5>
                <ul className="text-gray-400 text-sm space-y-1">
                  <li>GOCTO: 100 tokens</li>
                  <li>INFI: 100 tokens</li>
                  {/* <li>PHRS: 0.1 tokens</li> */}
                </ul>
              </div>

              {/* Note */}
              <p className="text-gray-500 text-sm text-center">
                Note: Testnet tokens have no real value and are for testing purposes only.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 