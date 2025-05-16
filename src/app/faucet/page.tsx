"use client";

import { useState } from 'react';
import { message } from 'antd';
import { useAppKitAccount } from '@reown/appkit/react';
import { TokenInfo, DEFAULT_TOKEN_LIST } from '@/services/tokenService';
import { CopyOutlined, DownOutlined } from '@ant-design/icons';
import { Dropdown } from 'antd';

export default function TestnetTokens() {
  const { isConnected, address } = useAppKitAccount();
  const [isRequesting, setIsRequesting] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(DEFAULT_TOKEN_LIST.tokens[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const handleRequestToken = async () => {
    if (!isConnected || !address) {
      messageApi.error('Please connect your wallet first and ensure address is available');
      return;
    }
    if (!selectedToken) {
      messageApi.error('Please select a token');
      return;
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
            messageApi.success({ content: `${result.token} minted successfully! Tx: ${result.txHash.substring(0, 10)}...`, duration: 5 });
          } else if (result.status === 'already_minted') {
            messageApi.info({ content: `${result.token}: ${result.message || 'Already claimed by your wallet.'}`, duration: 5 });
          } else if (result.status === 'system_error') {
            messageApi.error({ content: `System error processing ${result.token || 'request'}: ${result.error || 'Failed to update records.'}`, duration: 7 });
          } else {
            messageApi.error({ content: `Error minting ${result.token}: ${result.error || 'Unknown error'}`, duration: 5 });
          }
        });
      }
      messageApi.success({ content: 'Token request processed! Check messages above for details.', key: 'tokenRequest', duration: 5 });
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

  const tokenMenuItems = (DEFAULT_TOKEN_LIST.tokens as TokenInfo[]).map(token => ({
    key: token.symbol,
    label: (
      <div className="flex items-center gap-2">
        <img src={token.logoURI ?? '/token.png'} alt={token.symbol} className="w-5 h-5 rounded-full" />
        <span className="font-medium">{token.symbol}</span>
        <span className="text-xs text-gray-400 ml-1">{token.name}</span>
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
              You can request a testnet token every 24 hours from the Faucet.
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
                      const token = (DEFAULT_TOKEN_LIST.tokens as TokenInfo[]).find(t => t.symbol === key);
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
                    <DownOutlined className="ml-1 text-xs" />
                  </button>
                </Dropdown>
              </div>

              {/* Request Button */}
              <button
                onClick={handleRequestToken}
                disabled={!isConnected || isRequesting || !selectedToken}
                className={`w-full py-3 rounded-lg font-medium mt-2 ${
                  !isConnected || isRequesting || !selectedToken
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                }`}
              >
                {!isConnected
                  ? 'Connect Wallet'
                  : isRequesting
                    ? `Requesting...`
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