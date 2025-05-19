import { NextResponse } from 'next/server';
import { ethers } from 'ethers';
import dbConnect from '@/utils/dbConnect';
import User from '@/lib/models/User';

// Define the ERC20 ABI fragment needed for minting and getting decimals
const ERC20_ABI = [
  "function mint(address to, uint256 amount) public",
  "function decimals() view returns (uint8)"
];

const TOKENS_TO_MINT = [
    { address: "0x9C102a3953f7605bd59e02A9FEF515523058dE00", symbol: "GOCTO", decimals: 18, baseAmount: "100" },
    // { address: "0x9A741857be48C5069c7294f7c4232Ed0DD46E6Ce", symbol: "OCTOPUS", decimals: 18, baseAmount: "10000000" },
    { address: "0xc4D6fC137A14CAEd1e51D9D83f9606c72a32dD30", symbol: "INFI", decimals: 18, baseAmount: "100" },
    // { address: "0xF74903096433b0a948848d79E7c835402897e4e8", symbol: "SAILOR", decimals: 18, baseAmount: "10000000" },
    { address: ethers.ZeroAddress, symbol: "PHRS", decimals: 18, baseAmount: "0.1" }
];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const recipientAddress = searchParams.get('walletAddress');
  const selectedTokenSymbol = searchParams.get('token');

  if (!recipientAddress) {
    return NextResponse.json({ error: 'Wallet address is required in query parameters (walletAddress)' }, { status: 400 });
  }

  if (!ethers.isAddress(recipientAddress)) {
    return NextResponse.json({ error: 'Invalid wallet address provided' }, { status: 400 });
  }

  const privateKey = process.env.SENDER_PRIVATE_KEY;
  const rpcUrl = process.env.RPC_PROXY_TARGET_URL;

  if (!privateKey) {
    console.error('SENDER_PRIVATE_KEY environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: Missing sender private key' }, { status: 500 });
  }
  if (!rpcUrl) {
    console.error('RPC_PROXY_TARGET_URL environment variable is not set.');
    return NextResponse.json({ error: 'Server configuration error: Missing RPC URL' }, { status: 500 });
  }

  try {
    await dbConnect();

    let user = await User.findOne({ walletAddress: recipientAddress });
    let userJustCreated = false;
    if (!user) {
      user = new User({ 
        walletAddress: recipientAddress, 
        mintedTokens: [],
      });
      userJustCreated = true;
      console.log(`User not found for ${recipientAddress}, will create if tokens are minted.`);
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`Using sender address: ${wallet.address}`);

    const results = [];
    let newTokensMintedForUserCount = 0;

    const tokensToProcess = selectedTokenSymbol
      ? TOKENS_TO_MINT.filter(t => t.symbol.toLowerCase() === selectedTokenSymbol.toLowerCase())
      : TOKENS_TO_MINT;

    if (selectedTokenSymbol && tokensToProcess.length === 0) {
      return NextResponse.json({ error: `Token symbol '${selectedTokenSymbol}' not found.` }, { status: 400 });
    }

    for (const tokenInfo of tokensToProcess) {
      console.log(`\nProcessing token: ${tokenInfo.symbol} (${tokenInfo.address})`);

      if (tokenInfo.address === ethers.ZeroAddress) {
        // Native currency transfer (e.g., PHRS)
        console.log(`  - Processing native currency transfer for ${tokenInfo.symbol}`);
        try {
          const amountToSend = ethers.parseUnits(tokenInfo.baseAmount, tokenInfo.decimals);
          console.log(`  - Calculated send amount (with ${tokenInfo.decimals} decimals): ${amountToSend.toString()} for ${tokenInfo.baseAmount} base units`);

          const feeData = await provider.getFeeData();
          const gasPrice = feeData.gasPrice;
          if (!gasPrice) {
            console.error(`  - Error: Could not retrieve gasPrice for native send. feeData: ${JSON.stringify(feeData)}`);
            throw new Error("Failed to retrieve gas price for native send.");
          }

          console.log(`  - Sending ${tokenInfo.baseAmount} ${tokenInfo.symbol} to ${recipientAddress}...`);
          const tx = await wallet.sendTransaction({
            to: recipientAddress,
            value: amountToSend,
            gasPrice: gasPrice,
          });

          console.log(`    - Transaction sent for ${tokenInfo.symbol}: ${tx.hash}`);
          const receipt = await tx.wait();
          if (!receipt) {
            throw new Error(`Transaction receipt not found for ${tokenInfo.symbol} hash: ${tx.hash}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000)); // Short delay
          console.log(`    - Transaction for ${tokenInfo.symbol} confirmed in block: ${receipt.blockNumber}`);

          if (user) {
            if (!user.mintedTokens) { user.mintedTokens = []; }
            if (!user.mintedTokens.includes(tokenInfo.symbol)) {
              user.mintedTokens.push(tokenInfo.symbol);
              newTokensMintedForUserCount++;
            }
          }

          results.push({
            token: tokenInfo.symbol,
            status: 'success',
            txHash: tx.hash,
            recipient: recipientAddress,
            amount: amountToSend.toString(),
            blockNumber: receipt.blockNumber
          });
        } catch (error: any) {
          console.error(`    - Error sending native ${tokenInfo.symbol} to ${recipientAddress}: ${error.message}`);
          results.push({
            token: tokenInfo.symbol,
            status: 'error',
            recipient: recipientAddress,
            error: error.message
          });
        }
      } else {
        // ERC20 token minting
        console.log(`  - Processing ERC20 mint for ${tokenInfo.symbol}`);
        const tokenContract = new ethers.Contract(tokenInfo.address, ERC20_ABI, wallet);
        let decimalsForParse: number | bigint = tokenInfo.decimals;

        try {
          const fetchedContractDecimals: bigint = await tokenContract.decimals();
          // Standard ERC20 decimals() returns uint8, which fits in number.
          // ethers.js v6 returns bigint for contract calls.
          if (fetchedContractDecimals !== BigInt(tokenInfo.decimals)) {
            console.warn(`  - Warning: Contract decimals (${fetchedContractDecimals}) for ${tokenInfo.symbol} differ from config (${tokenInfo.decimals}). Using contract value.`);
            decimalsForParse = fetchedContractDecimals; 
          } else {
            console.log(`  - Token decimals from contract match config: ${decimalsForParse}`);
          }
        } catch (error: any) {
          console.warn(`  - Warning: Could not fetch decimals for token ${tokenInfo.symbol}. Using predefined ${tokenInfo.decimals}. Error: ${error.message}`);
        }

        const finalAmount = ethers.parseUnits(tokenInfo.baseAmount, decimalsForParse);
        console.log(`  - Calculated mint amount (with ${decimalsForParse} decimals): ${finalAmount.toString()} for ${tokenInfo.baseAmount} base units`);

        console.log(`  - Minting ${tokenInfo.baseAmount} ${tokenInfo.symbol} tokens to ${recipientAddress}...`);
        try {
          const feeData = await provider.getFeeData();
          const gasPrice = feeData.gasPrice;

          if (!gasPrice) {
            console.error(`  - Error: Could not retrieve gasPrice for ERC20 mint. feeData: ${JSON.stringify(feeData)}`);
            throw new Error("Failed to retrieve gas price for ERC20 mint.");
          }

          const estimatedGas = await tokenContract.mint.estimateGas(recipientAddress, finalAmount);
          
          const tx = await tokenContract.mint(recipientAddress, finalAmount, {
            gasPrice: gasPrice,
            gasLimit: estimatedGas 
          });

          console.log(`    - Transaction sent for ${tokenInfo.symbol}: ${tx.hash}`);
          const receipt = await tx.wait();
          if (!receipt) {
            throw new Error(`Transaction receipt not found for ${tokenInfo.symbol} hash: ${tx.hash}`);
          }
          await new Promise(resolve => setTimeout(resolve, 1000)); 
          console.log(`    - Transaction for ${tokenInfo.symbol} confirmed in block: ${receipt.blockNumber}`);
          
          if (user) {
            if (!user.mintedTokens) { user.mintedTokens = []; }
            if (!user.mintedTokens.includes(tokenInfo.symbol)) {
              user.mintedTokens.push(tokenInfo.symbol);
              newTokensMintedForUserCount++;
            }
          }

          results.push({ 
            token: tokenInfo.symbol, 
            status: 'success', 
            txHash: tx.hash, 
            recipient: recipientAddress, 
            amount: finalAmount.toString(),
            blockNumber: receipt.blockNumber
          });
        } catch (error: any) {
          console.error(`    - Error minting ${tokenInfo.symbol} to ${recipientAddress}: ${error.message}`);
          results.push({ 
            token: tokenInfo.symbol, 
            status: 'error', 
            recipient: recipientAddress, 
            error: error.message 
          });
        }
      }
    }

    if (user && (newTokensMintedForUserCount > 0 || userJustCreated)) {
        try {
            await user.save();
            console.log(`User ${recipientAddress} updated with minted tokens: ${user.mintedTokens.join(', ')}`);
        } catch (dbError: any) {
            console.error(`Error saving user ${recipientAddress} after operations: ${dbError.message}`);
            results.push({ 
                token: '-', 
                status: 'system_error', 
                error: 'Failed to save user token operation status to database.',
                details: dbError.message
            });
        }
    }

    console.log("\nToken processing finished.");

    const allOperationsSuccessful = results.every(result => result.status === 'success');

    return NextResponse.json({
        message: allOperationsSuccessful ? 'All token operations successful.' : 'Token processing completed, some operations may have failed.',
        allOperationsSuccessful,
        results 
    }, { status: 200 });

  } catch (error: any) {
    console.error('An unexpected error occurred during the token processing:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
} 