import { NextRequest, NextResponse } from 'next/server';

const BLOCKCHAIN_BRIDGE_URL = 'http://localhost:9000';

interface BlockchainImageRequest {
  batchId: string;
  stageName: string; // Stage name (not stageId)
  imageUrl: string;
  isFirstImage: boolean;
  
  // Farmer details (always send)
  farmerDetails: {
    name: string;
    location: string;
  };
  
  // Only required for first image
  batchDetails?: {
    cropType: string;
    quantity: number;
    unit: string;
  };
}

interface BlockchainImageResponse {
  success: boolean;
  transactionId: string;
  blockNumber: number;
  blockHash: string;
  imageHash: string;
  timestamp: string;
}

/**
 * POST /api/blockchain/record-image
 * Records a verified image to blockchain
 * 
 * Flow:
 * 1. First image: Send farmer + batch + stage + image data
 * 2. Subsequent images: Send stageName + image data only (batch already exists)
 * 3. Returns blockchain transaction details
 */
export async function POST(request: NextRequest) {
  try {
    const body: BlockchainImageRequest = await request.json();
    
    console.log('📸 Recording image to blockchain:', {
      batchId: body.batchId,
      stageName: body.stageName,
      isFirstImage: body.isFirstImage
    });

    // Validate required fields
    if (!body.batchId || !body.stageName || !body.imageUrl || body.isFirstImage === undefined) {
      return NextResponse.json(
        { error: 'Missing required fields: batchId, stageName, imageUrl, isFirstImage' },
        { status: 400 }
      );
    }

    if (!body.farmerDetails?.name || !body.farmerDetails?.location) {
      return NextResponse.json(
        { error: 'farmerDetails with name and location are required' },
        { status: 400 }
      );
    }

    // If first image, validate batch details
    if (body.isFirstImage && !body.batchDetails) {
      return NextResponse.json(
        { error: 'First image requires batchDetails (cropType, quantity, unit)' },
        { status: 400 }
      );
    }

    // Prepare blockchain request (matches the new API format)
    const blockchainRequest: any = {
      batchId: body.batchId,
      isFirstImage: body.isFirstImage,
      stageName: body.stageName,
      farmerDetails: {
        name: body.farmerDetails.name,
        location: body.farmerDetails.location
      },
      imageUrl: body.imageUrl
    };

    // Add batchDetails only for first image
    if (body.isFirstImage && body.batchDetails) {
      blockchainRequest.batchDetails = {
        cropType: body.batchDetails.cropType,
        quantity: body.batchDetails.quantity,
        unit: body.batchDetails.unit
      };
    }

    console.log('🔗 Sending to Blockchain Bridge:', BLOCKCHAIN_BRIDGE_URL);
    console.log('📦 Request body:', JSON.stringify(blockchainRequest, null, 2));

    // Send directly to Blockchain Bridge (port 9000)
    const response = await fetch(`${BLOCKCHAIN_BRIDGE_URL}/record-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blockchainRequest)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Blockchain Bridge error:', errorText);
      
      return NextResponse.json({
        success: false,
        error: `Blockchain bridge error: ${errorText}`
      }, { status: response.status });
    }

    const blockchainResponse = await response.json();
    
    console.log('✅ Blockchain response:', {
      success: blockchainResponse.success,
      transactionId: blockchainResponse.transactionId,
      blockNumber: blockchainResponse.blockNumber
    });

    return NextResponse.json(blockchainResponse);

  } catch (error) {
    console.error('❌ Error recording image to blockchain:', error);
    
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    }, { status: 500 });
  }
}
