import { NextResponse, type NextRequest } from 'next/server';

// It's highly recommended to move this to environment variables (.env.local)
const TARGET_RPC_URL = process.env.READ_ONLY_RPC_URL || 'https://devnet.dplabs-internal.com';

export async function POST(request: NextRequest) {
  try {
    const requestBody = await request.json();

    console.log('[RPC Proxy] Forwarding request to:', TARGET_RPC_URL);
    // console.log('[RPC Proxy] Request body:', JSON.stringify(requestBody));

    const response = await fetch(TARGET_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add any other headers required by the target RPC, if necessary
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      console.error('[RPC Proxy] Error from target RPC:', response.status, response.statusText);
      const errorBody = await response.text();
      console.error('[RPC Proxy] Error body:', errorBody);
      // Return a structured error that ethers might understand, or at least the status
      return NextResponse.json(
        {
          error: {
            code: -32000, // Generic server error code
            message: `RPC request failed with status ${response.status}: ${response.statusText}`,
            data: errorBody,
          },
        },
        { status: response.status }
      );
    }

    const responseData = await response.json();
    // console.log('[RPC Proxy] Response data:', JSON.stringify(responseData));

    // Return the successful response from the target RPC
    return NextResponse.json(responseData);

  } catch (error: any) {
    console.error('[RPC Proxy] Internal error:', error);
    return NextResponse.json(
      {
        error: {
          code: -32603, // Internal JSON-RPC error
          message: error.message || 'Internal Server Error in RPC Proxy',
        },
      },
      { status: 500 }
    );
  }
}

// Optional: Add a GET handler for basic checks or health status if needed
export async function GET() {
  return NextResponse.json({ message: 'RPC Proxy is active' });
} 