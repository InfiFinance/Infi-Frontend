"use client";

import { useState, useEffect } from 'react';
import { message } from 'antd';
import { useAppKitAccount } from '@reown/appkit/react';
import { ethers } from 'ethers';
import MyTokenArtifact from '@/contract/abis/Token.json';
import { CopyOutlined } from '@ant-design/icons';

// Define a type for the created token data
interface CreatedToken {
  name: string;
  symbol: string;
  address: string;
  imageUrl?: string; // Optional: if you want to store and display the image later
}

const LOCAL_STORAGE_CREATED_TOKENS_KEY = 'createdTokensByUser';

export default function CreateTokens() {
  const { isConnected, address } = useAppKitAccount();
  const [isCreating, setIsCreating] = useState(false);
  const [messageApi, contextHolder] = message.useMessage();

  // Form state
  const [tokenName, setTokenName] = useState('');
  const [tokenSymbol, setTokenSymbol] = useState('');
  const [tokenImage, setTokenImage] = useState('');
  const [isValidImageUrl, setIsValidImageUrl] = useState(false);

  // State for displaying created tokens
  const [createdTokens, setCreatedTokens] = useState<CreatedToken[]>([]);
  const [isTokenListVisible, setIsTokenListVisible] = useState(false);

  // Load created tokens from local storage when address changes
  useEffect(() => {
    if (address) {
      const storedData = localStorage.getItem(LOCAL_STORAGE_CREATED_TOKENS_KEY);
      if (storedData) {
        try {
          const allUserTokens = JSON.parse(storedData);
          setCreatedTokens(allUserTokens[address.toLowerCase()] || []);
        } catch (e) {
          console.error("Error parsing created tokens from local storage:", e);
          setCreatedTokens([]);
        }
      } else {
        setCreatedTokens([]);
      }
    } else {
      setCreatedTokens([]); // Clear list if no address
    }
  }, [address]);

  const validateImageUrl = (url: string) => {
    try {
      const parsedUrl = new URL(url);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleImageUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    setTokenImage(url);
    setIsValidImageUrl(validateImageUrl(url));
  };

  const handleCreateToken = async () => {
    if (!isConnected || !address) {
      messageApi.error('Please connect your wallet first and ensure an address is available.');
      return;
    }

    if (!tokenName || !tokenSymbol || !tokenImage) {
      messageApi.error('Please fill in all fields');
      return;
    }

    if (!isValidImageUrl) {
      messageApi.error('Please enter a valid image URL (must start with http:// or https://)');
      return;
    }

    setIsCreating(true);
    messageApi.loading({ content: 'Deploying token... This may take a few moments.', key: 'deployToken', duration: 0 });

    try {
      // Ensure window.ethereum is available (MetaMask or similar provider)
      if (typeof window.ethereum === 'undefined') {
        messageApi.error({ content: 'Please install MetaMask or a similar Ethereum wallet provider.', key: 'deployToken' });
        setIsCreating(false);
        return;
      }

      // Create a new ethers provider from window.ethereum
      const provider = new ethers.BrowserProvider(window.ethereum as any);
      
      // Request account access if needed (though useAppKitAccount should handle this)
      // await provider.send("eth_requestAccounts", []); // Usually handled by wallet connection button

      // Get the signer
      const signer = await provider.getSigner();
      const deployerAddress = await signer.getAddress();

      if (deployerAddress.toLowerCase() !== address.toLowerCase()) {
        messageApi.error({ content: 'Connected wallet address does not match the expected deployer address. Please ensure the correct account is selected in your wallet.', key: 'deployToken'});
        setIsCreating(false);
        return;
      }
      
      console.log(`Deploying token with account: ${deployerAddress}`);

      const factory = new ethers.ContractFactory(
        MyTokenArtifact.abi,
        MyTokenArtifact.bytecode,
        signer
      );

      console.log("Deploying with Name:", tokenName, "Symbol:", tokenSymbol);
      messageApi.loading({ content: `Deploying ${tokenName} (${tokenSymbol})... Please confirm the transaction in your wallet.`, key: 'deployToken', duration: 0 });
      
      const contract = await factory.deploy(tokenName, tokenSymbol);
      const deploymentTx = contract.deploymentTransaction();

      if (!deploymentTx) {
        console.error("Deployment transaction is unexpectedly null.");
        throw new Error("Failed to get deployment transaction object from contract.");
      }
      
      messageApi.loading({ content: `Transaction sent: ${deploymentTx.hash}. Waiting for confirmation...`, key: 'deployToken', duration: 0 });
      console.log(`Deployment transaction sent: ${deploymentTx.hash}`);

      // Wait for the deployment transaction to be mined (1 confirmation)
      const receipt = await deploymentTx.wait(1);

      if (!receipt) {
        console.error("Transaction receipt is unexpectedly null after waiting.");
        throw new Error("Failed to get transaction receipt after deployment.");
      }

      const contractAddress = receipt.contractAddress;
      const transactionHash = receipt.hash;

      if (!contractAddress) {
        console.error("Contract address is null in the transaction receipt.");
        throw new Error("Contract address not found in deployment receipt.");
      }

      console.log(`Contract deployed successfully at address: ${contractAddress}`);
      console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
      
      messageApi.success({
        content: `Token "${tokenName}" deployed successfully! Address: ${contractAddress}`,
        key: 'deployToken',
        duration: 10
      });

      // --- Store created token in local storage ---
      if (address && contractAddress) {
        const newToken: CreatedToken = {
          name: tokenName,
          symbol: tokenSymbol,
          address: contractAddress,
          imageUrl: tokenImage // Storing the image URL as well
        };
        try {
          const storedData = localStorage.getItem(LOCAL_STORAGE_CREATED_TOKENS_KEY);
          let allUserTokens = storedData ? JSON.parse(storedData) : {};
          
          // Ensure there's an array for the current user
          const userSpecificAddress = address.toLowerCase(); // Use a variable for clarity
          if (!allUserTokens[userSpecificAddress]) {
            allUserTokens[userSpecificAddress] = [];
          }
          
          // Add the new token to this user's array
          allUserTokens[userSpecificAddress].push(newToken);
          
          localStorage.setItem(LOCAL_STORAGE_CREATED_TOKENS_KEY, JSON.stringify(allUserTokens));
          
          // Update state with the complete list for the current user from the updated allUserTokens object
          setCreatedTokens(allUserTokens[userSpecificAddress]); 
        } catch (e) {
          console.error("Error saving token to local storage:", e);
          messageApi.error("Failed to save token details locally. Deployment was successful.");
        }
      }
      // --- End store token ---

      // Optionally, you can clear the form or redirect the user
      setTokenName('');
      setTokenSymbol('');
      setTokenImage('');
      setIsValidImageUrl(false);

    } catch (error: any) {
      console.error("Deployment failed:", error);
      const errorMessage = error.reason || error.message || "An unknown error occurred during deployment.";
      messageApi.error({ content: `Deployment failed: ${errorMessage}`, key: 'deployToken', duration: 10 });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      {contextHolder}
      <div className="flex justify-center items-start py-6">
        <div className="flex flex-col">
          {/* Header */}
          <div className="flex flex-col mb-5">
            <h4 className="text-2xl font-bold text-white mb-3">Create Token</h4>
            <p className="text-gray-400 text-sm mb-6">
              Deploy your own token on the testnet. Fill in the details below to get started.
            </p>
          </div>

          {/* Main Content */}
          <div className="bg-[#0e1420] rounded-lg p-6 border border-[#1b2131] w-[400px]">
            <div className="space-y-6">
              {/* Token Creation Form */}
              <div className="space-y-4">
                {/* Token Name */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Token Name
                  </label>
                  <input
                    type="text"
                    value={tokenName}
                    onChange={(e) => setTokenName(e.target.value)}
                    placeholder="e.g., My Awesome Token"
                    className="w-full bg-[#171f2e] text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Token Symbol */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Token Symbol
                  </label>
                  <input
                    type="text"
                    value={tokenSymbol}
                    onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
                    placeholder="e.g., MAT"
                    className="w-full bg-[#171f2e] text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                {/* Token Image */}
                <div>
                  <label className="block text-white text-sm font-medium mb-2">
                    Token Image URL
                  </label>
                  <div className="space-y-3">
                    <input
                      type="url"
                      value={tokenImage}
                      onChange={handleImageUrlChange}
                      placeholder="e.g., https://example.com/token-image.png"
                      className="w-full bg-[#171f2e] text-white rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    {tokenImage && isValidImageUrl && (
                      <div className="w-12 h-12 bg-[#171f2e] rounded-lg overflow-hidden">
                        <img
                          src={tokenImage}
                          alt="Token preview"
                          className="w-full h-full object-cover"
                          onError={() => {
                            messageApi.error('Failed to load image. Please check the URL.');
                            setIsValidImageUrl(false);
                          }}
                        />
                      </div>
                    )}
                    {tokenImage && !isValidImageUrl && (
                      <p className="text-red-500 text-sm">
                        Please enter a valid image URL (must start with http:// or https://)
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Create Button */}
              <button
                onClick={handleCreateToken}
                disabled={!isConnected || isCreating || !tokenName || !tokenSymbol || !tokenImage || !isValidImageUrl}
                className={`w-full py-3 rounded-lg font-medium ${
                  !isConnected || isCreating || !tokenName || !tokenSymbol || !tokenImage || !isValidImageUrl
                    ? 'bg-gray-700 text-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                }`}
              >
                {!isConnected
                  ? 'Connect Wallet'
                  : isCreating
                    ? 'Creating Token...'
                    : 'Create Token'}
              </button>

              {/* Collapsible Created Tokens Section - Moved inside the card */}
              {isConnected && address && (
                <div className="mt-6 pt-6 border-t border-[#1b2131]">
                  <button 
                    onClick={() => setIsTokenListVisible(!isTokenListVisible)}
                    className="flex justify-between items-center w-full text-left text-white font-medium mb-3 hover:text-blue-400 transition-colors"
                  >
                    <span>Your Created Tokens</span>
                    <span className={`transform transition-transform duration-200 ${isTokenListVisible ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {isTokenListVisible && (
                    createdTokens.length > 0 ? (
                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                        {createdTokens.map((token, index) => (
                          <div key={index} className="bg-[#171f2e] rounded-lg p-3 border border-[#2c3552]">
                            <div className="flex items-center">
                              {token.imageUrl && (
                                <img 
                                  src={token.imageUrl} 
                                  alt={token.name} 
                                  className="w-7 h-7 rounded-full mr-2.5 object-cover" 
                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                              )}
                              <div className="flex-grow min-w-0">
                                <h5 className="text-sm font-semibold text-white truncate">{token.name} ({token.symbol})</h5>
                                <p className="text-xs text-gray-400 break-all">{token.address}</p>
                              </div>
                              <button 
                                onClick={() => {
                                  navigator.clipboard.writeText(token.address);
                                  messageApi.success('Token address copied!');
                                }}
                                className="ml-2 text-gray-400 hover:text-white flex-shrink-0"
                                title="Copy address"
                              >
                                <CopyOutlined />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-400 text-sm">You haven't created any tokens yet.</p>
                    )
                  )}
                </div>
              )}

              {/* Instructions */}
              <div className="space-y-3 mt-6 pt-6 border-t border-[#1b2131]">
                <h5 className="text-white font-medium">Instructions</h5>
                <ul className="text-gray-400 text-sm space-y-2">
                  <li className="flex items-start">
                    <span className="mr-2">1.</span>
                    Connect your wallet if not already connected
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">2.</span>
                    Fill in the token details (name, symbol, and image URL)
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">3.</span>
                    Click "Create Token" and confirm the transaction
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">4.</span>
                    Wait for the token creation process to complete
                  </li>
                  <li className="flex items-start">
                    <span className="mr-2">5.</span>
                    Once created, copy the token address and paste it in the "create pool" page another token to make your token tradeable
                  </li>
                </ul>
              </div>

              {/* Note */}
              <p className="text-gray-500 text-sm text-center">
                Note: Token creation requires a small amount of testnet PHRS for gas fees.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 