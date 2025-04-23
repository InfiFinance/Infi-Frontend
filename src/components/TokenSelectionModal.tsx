import { Modal, Input, Spin, Empty } from 'antd';
import { useState, useEffect, useMemo } from 'react';
import { useAccount, usePublicClient } from 'wagmi';
import { ethers } from 'ethers'; // Re-add ethers import
import { searchTokens, TokenInfo, DEFAULT_TOKEN_LIST } from '../services/tokenService'; // Using Ethers-based service now
import { useDebounce } from 'use-debounce';
// import { customNetwork } from '../config'; // No longer needed for manual client

// Helper function to convert Viem PublicClient to Ethers v5/v6 Provider
function publicClientToProvider(publicClient: any) {
  if (!publicClient) {
    return undefined;
  }
  
  try {
    const { chain, transport } = publicClient; 
    
    if (!chain || !transport) {
        console.error("[publicClientToProvider] Missing chain or transport property.");
        return undefined;
    }
    
    const network = {
      chainId: chain.id,
      name: chain.name,
      ensAddress: chain.contracts?.ensRegistry?.address,
    };
    
    let targetTransportUrl: string | undefined;

    if (transport.type === 'http' || transport.type === 'webSocket') {
      targetTransportUrl = (transport as any).url || (transport as any).config?.url;

    } else if (transport.type === 'fallback' && transport.transports) {
      const httpTransport = transport.transports.find((t: any) => t?.config?.key === 'http'); 
      
      if (httpTransport) {
        targetTransportUrl = httpTransport?.value?.url; 
      } else {
        console.warn("[publicClientToProvider] No underlying HTTP transport config found within fallback.");
      }

    } else {
      console.error(`[publicClientToProvider] Unsupported transport type: ${transport.type}`);
      return undefined;
    }

    if (targetTransportUrl) {
        return new ethers.JsonRpcProvider(targetTransportUrl, network);
    } else {
        console.error("[publicClientToProvider] Could not determine a suitable transport URL.");
        return undefined;
    }

  } catch (error) {
      console.error("[publicClientToProvider] Error during conversion:", error);
      return undefined;
  }
}

interface TokenSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (token: TokenInfo) => void;
}

export default function TokenSelectionModal({
  isOpen,
  onClose,
  onSelect,
}: TokenSelectionModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TokenInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [debouncedSearchQuery] = useDebounce(searchQuery, 300);

  const { chain, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: chain?.id });
  const provider = useMemo(() => publicClientToProvider(publicClient), [publicClient]);

  useEffect(() => {
    // Initial checks: modal open, connected, search query exists
    if (!isOpen || !isConnected || debouncedSearchQuery === '') {
      setSearchQuery(''); // Clear search if condition not met
      setSearchResults([]);
      setIsLoading(false);
      return;
    }

    // Check if essential data (chain, client, converted provider) is ready
    if (!chain?.id) {
      console.log("[Search Effect] Waiting for Chain ID...");
      // Optional: You could set isLoading true here if you want loading state while waiting
      // setIsLoading(true);
      return; // Exit effect if no chain ID
    }
    if (!publicClient) {
       console.log("[Search Effect] Waiting for PublicClient...");
       // setIsLoading(true);
       return; // Exit effect if no public client
    }
    if (!provider) {
       console.warn("[Search Effect] Waiting for Ethers Provider (conversion result)...");
        // setIsLoading(true);
       // This implies publicClientToProvider failed or publicClient wasn't ready
       return; // Exit effect if provider conversion failed
    }

    // --- If all checks pass, proceed with search --- 
    console.log("[Search Effect] All checks passed, performing search...");
    const performSearch = async () => {
      setIsLoading(true);
      try {
        const results = await searchTokens(debouncedSearchQuery, chain.id, provider);
        setSearchResults(results);
      } catch (error) {
        console.error("Error searching tokens:", error);
        setSearchResults([]);
      } finally {
        setIsLoading(false);
      }
    };

    // Only perform search if query exists
    if (debouncedSearchQuery) { 
      console.log("[Search Effect] Query detected, performing search...");
      performSearch();
    } else {
        // If query is empty, clear search results and loading state
        setSearchResults([]);
        setIsLoading(false);
    }

    // Dependencies include everything needed for the checks and the search call
  }, [debouncedSearchQuery, isOpen, isConnected, chain?.id, publicClient, provider]);

  // Determine which list to display: Search results or the default list
  const displayList: TokenInfo[] = debouncedSearchQuery ? searchResults : DEFAULT_TOKEN_LIST.tokens;

  const handleSelect = (token: TokenInfo) => {
    onSelect(token);
    onClose();
  };

  return (
    <Modal
      open={isOpen}
      footer={null}
      onCancel={onClose}
      title="Select a token"
      className="font-sans"
      maskClosable={true}
      closeIcon={true}
      afterClose={() => {
        setSearchQuery('');
        setSearchResults([]);
        setIsLoading(false);
      }}
    >
      <Input
        placeholder="Search name or paste address"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="my-4"
      />
      <div className="border-t border-gray-700 mt-4 space-y-2 max-h-[400px] overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Spin />
          </div>
        ) : displayList && displayList.length > 0 ? (
          displayList.map((token) => (
            <div
              key={token.address}
              className="flex items-center p-3 hover:bg-gray-800 cursor-pointer rounded-lg"
              onClick={() => handleSelect(token)}
            >
              <img
                 src={token.logoURI || '/token.png'}
                 alt={token.symbol}
                 className="w-10 h-10 rounded-full"
               />
              <div className="ml-3">
                <div className="text-base font-medium">{token.name}</div>
                <div className="text-sm text-gray-400">{token.symbol}</div>
              </div>
            </div>
          ))
        ) : (
           <div className="flex justify-center items-center h-32">
             <Empty description={debouncedSearchQuery ? "No tokens found" : "No default tokens"} />
           </div>
        )}
      </div>
    </Modal>
  );
}