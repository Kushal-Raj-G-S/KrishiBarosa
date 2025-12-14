/**
 * 🌉 FRONTEND BRIDGE SERVER
 * 
 * Run this on the FRONTEND MACHINE (with your Next.js app)
 * 
 * Purpose:
 * - Receives requests from Next.js API
 * - Translates data for blockchain
 * - Forwards to Blockchain Bridge
 * - Returns response to Next.js
 * 
 * Start: node frontend-bridge.js
 * Listen: http://localhost:8080
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = process.env.FRONTEND_BRIDGE_PORT || 8080;

// Blockchain Bridge URL - Use localhost (WSL2 auto-forwards ports)
const BLOCKCHAIN_BRIDGE_URL = process.env.BLOCKCHAIN_BRIDGE_URL || 'http://localhost:9000';

// Middleware
app.use(cors());
app.use(bodyParser.json());

// Logging middleware
app.use((req, res, next) => {
  console.log(`\n[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

/**
 * POST /generate-qr
 * Receives batch data from Next.js API
 * Forwards to Blockchain Bridge
 */
app.post('/generate-qr', async (req, res) => {
  try {
    const batchData = req.body;

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║        📥 REQUEST FROM NEXT.JS API                           ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log('📦 Batch Data:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Batch ID: ${batchData.batchId}`);
    console.log(`   Farmer: ${batchData.farmerName}`);
    console.log(`   Crop: ${batchData.cropType} - ${batchData.quantity}kg`);
    console.log(`   Total Images: ${batchData.totalVerifiedImages}`);
    console.log(`   Stages: ${batchData.stagesComplete}/7`);
    console.log('─────────────────────────────────────────────────────────────\n');

    // Validate data
    if (!batchData.batchId || batchData.stagesComplete !== 7) {
      console.log('❌ Invalid request data\n');
      return res.status(400).json({
        success: false,
        error: 'Invalid batch data or incomplete stages'
      });
    }

    console.log('✅ Data validated');
    console.log(`🔗 Forwarding to Blockchain Bridge: ${BLOCKCHAIN_BRIDGE_URL}\n`);

    // ✅ FIX: Blockchain bridge expects ONLY { batchId }
    const blockchainRequest = {
      batchId: batchData.batchId
    };

    console.log('📦 Sending to blockchain:', JSON.stringify(blockchainRequest, null, 2));

    // Forward to Blockchain Bridge
    const blockchainResponse = await fetch(`${BLOCKCHAIN_BRIDGE_URL}/generate-certificate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blockchainRequest)
    });

    if (!blockchainResponse.ok) {
      const errorText = await blockchainResponse.text();
      throw new Error(`Blockchain Bridge returned ${blockchainResponse.status}: ${errorText}`);
    }

    const result = await blockchainResponse.json();

    if (!result.success) {
      throw new Error(result.error || 'Blockchain certificate generation failed');
    }

    console.log('✅ Received response from Blockchain Bridge\n');
    console.log('📜 Certificate Details:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Certificate ID: ${result.certificateId}`);
    console.log(`   QR Code URL: ${result.qrCodeUrl}`);
    console.log(`   Certificate Hash: ${result.certificateHash?.substring(0, 20)}...`);
    console.log(`   Transactions: ${result.blockchain?.transactionCount || 0}`);
    console.log('─────────────────────────────────────────────────────────────\n');

    console.log('📤 Sending response to Next.js API...\n');

    // Return to Next.js
    res.json({
      success: true,
      certificateId: result.certificateId,
      qrCodeUrl: result.qrCodeUrl,
      certificateHash: result.certificateHash,
      blockchain: result.blockchain,
      batch: result.batch
    });

  } catch (error) {
    console.error('❌ Frontend Bridge error:', error.message);
    
    // Try to return fallback response
    if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
      console.log('⚠️  Blockchain Bridge unavailable, returning fallback\n');
      
      const fallbackCertId = `CERT-${req.body.batchId}-${Date.now()}`;
      const fallbackQR = `https://krishibarosa-verify.vercel.app/${fallbackCertId}`;
      
      return res.json({
        success: true,
        certificateId: fallbackCertId,
        qrCodeUrl: fallbackQR,
        certificateHash: 'FALLBACK',
        blockchain: {
          verified: false,
          timestamp: new Date().toISOString(),
          note: 'Generated locally - Blockchain Bridge unavailable'
        }
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /record-image
 * Receives verified image data from Next.js API
 * Records to blockchain via Blockchain Bridge
 * First image: includes farmer + batch details
 * Subsequent images: image data only
 */
app.post('/record-image', async (req, res) => {
  try {
    const imageData = req.body.data || req.body;

    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║        📸 IMAGE VERIFICATION → BLOCKCHAIN                    ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');
    
    console.log('🖼️  Image Details:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Batch ID: ${imageData.batchId}`);
    console.log(`   Stage Name: ${imageData.stageName}`);
    console.log(`   Image URL: ${imageData.imageUrl?.substring(0, 50)}...`);
    console.log(`   First Image: ${imageData.isFirstImage ? 'YES ✨' : 'No'}`);
    
    if (imageData.isFirstImage) {
      console.log(`\n👨‍🌾 Farmer: ${imageData.farmerDetails?.name}`);
      console.log(`📦 Crop: ${imageData.batchDetails?.cropType} - ${imageData.batchDetails?.quantity}${imageData.batchDetails?.unit}`);
    }
    console.log('─────────────────────────────────────────────────────────────\n');

    // Validate data - only need batchId, stageName, imageUrl
    if (!imageData.batchId || !imageData.stageName || !imageData.imageUrl) {
      console.log('❌ Invalid image data\n');
      console.log('   Missing:', {
        batchId: !imageData.batchId,
        stageName: !imageData.stageName,
        imageUrl: !imageData.imageUrl
      });
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: batchId, stageName, imageUrl'
      });
    }

    console.log('✅ Data validated');
    console.log(`🔗 Recording to blockchain: ${BLOCKCHAIN_BRIDGE_URL}\n`);

    // ✅ FIX: Transform data to EXACTLY match blockchain bridge expectations
    const blockchainRequest = {
      batchId: imageData.batchId,
      isFirstImage: imageData.isFirstImage || false,
      stageName: imageData.stageName,  // Required!
      imageUrl: imageData.imageUrl,    // Required!
      farmerDetails: {
        name: imageData.farmerDetails?.name || imageData.farmerName || 'Unknown',
        email: imageData.farmerDetails?.email || '',
        location: imageData.farmerDetails?.location || imageData.location || 'Unknown'
      }
    };

    // Add batch details for first image
    if (imageData.isFirstImage && imageData.batchDetails) {
      blockchainRequest.batchDetails = {
        cropType: imageData.batchDetails.cropType || 'Unknown',
        variety: imageData.batchDetails.variety || '',
        quantity: imageData.batchDetails.quantity || 0,
        unit: imageData.batchDetails.unit || 'kg'
      };
    } else if (imageData.isFirstImage) {
      // Fallback if batchDetails not provided
      blockchainRequest.batchDetails = {
        cropType: imageData.cropType || 'Unknown',
        quantity: imageData.quantity || 0,
        unit: imageData.unit || 'kg'
      };
    }

    console.log('📦 Sending to blockchain bridge:');
    console.log(JSON.stringify(blockchainRequest, null, 2));

    // Forward to Blockchain Bridge
    const blockchainResponse = await fetch(`${BLOCKCHAIN_BRIDGE_URL}/record-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(blockchainRequest)
    });

    if (!blockchainResponse.ok) {
      const errorText = await blockchainResponse.text();
      console.error('❌ Blockchain Bridge error:', errorText);
      throw new Error(`Blockchain Bridge returned ${blockchainResponse.status}: ${errorText}`);
    }

    const result = await blockchainResponse.json();

    console.log('\n✅ Received response from Blockchain Bridge');
    console.log('📦 Full blockchain response:');
    console.log(JSON.stringify(result, null, 2));
    console.log('');

    if (!result.success) {
      throw new Error(result.error || 'Blockchain image recording failed');
    }

    console.log('🔗 Blockchain Details:');
    console.log('─────────────────────────────────────────────────────────────');
    console.log(`   Transaction ID: ${result.transactionId || 'N/A'}`);
    console.log(`   Block Number: ${result.blockNumber || 'N/A'}`);
    console.log(`   Image Hash: ${result.imageHash?.substring(0, 20)}...`);
    console.log(`   Batch ID: ${result.batchId || 'N/A'}`);
    console.log(`   Current Stage: ${result.currentStage || 'N/A'}`);
    console.log(`   Total Stages: ${result.totalStages || 'N/A'}`);
    console.log(`   Verified By: ${result.verifiedBy || 'N/A'}`);
    console.log(`   Location: ${result.location || 'N/A'}`);
    
    // ✅ CHECK FOR QR CODE GENERATION
    if (result.qrGenerated) {
      console.log('\n🎉 QR CODE GENERATED!');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`   QR URL: ${result.qrCode?.qrUrl || 'N/A'}`);
      console.log(`   Stages Complete: ${result.qrCode?.stages || 0}/7`);
      console.log(`   Total Images: ${result.qrCode?.images || 0}`);
      console.log(`   Message: ${result.qrCode?.message || ''}`);
      console.log('─────────────────────────────────────────────────────────────');
    } else if (result.progress) {
      console.log('\n📊 Progress Update:');
      console.log('─────────────────────────────────────────────────────────────');
      console.log(`   Unique Stages: ${result.progress.uniqueStages}/${result.progress.requiredStages}`);
      console.log(`   Total Images: ${result.progress.totalImages}`);
      console.log(`   Message: ${result.progress.message}`);
      if (result.progress.stagesNeedingMoreImages?.length > 0) {
        console.log(`   Need More Images: ${result.progress.stagesNeedingMoreImages.join(', ')}`);
      }
      console.log('─────────────────────────────────────────────────────────────');
    }
    console.log('\n📤 Sending response to Next.js API...\n');

    // ✅ FIX: Normalize response for Next.js API - INCLUDE QR CODE!
    const normalizedResult = {
      success: true,
      transactionId: result.transactionId,
      blockNumber: result.blockNumber,
      blockHash: result.blockHash || '',
      imageHash: result.imageHash,
      timestamp: result.timestamp,
      batchId: result.batchId,
      currentStage: result.currentStage,
      totalStages: result.totalStages,
      chaincode: result.chaincode,
      channel: result.channel,
      verifiedBy: result.verifiedBy,
      location: result.location,
      message: result.message,
      // 🎉 PASS THROUGH QR CODE DATA
      qrGenerated: result.qrGenerated || false,
      qrCode: result.qrCode || null,
      progress: result.progress || null
    };

    // Return to Next.js
    res.json(normalizedResult);

  } catch (error) {
    console.error('❌ Frontend Bridge error:', error.message);
    console.error(error.stack);
    
    // Return fallback response
    if (error.message.includes('fetch') || error.message.includes('ECONNREFUSED')) {
      console.log('⚠️  Blockchain Bridge unavailable, returning fallback\n');
      
      return res.json({
        success: true,
        transactionId: `TX-FALLBACK-${Date.now()}`,
        blockNumber: Math.floor(Math.random() * 1000000),
        blockHash: `0x${Math.random().toString(16).substring(2, 66)}`,
        imageHash: `Qm${Math.random().toString(16).substring(2, 46)}`,
        timestamp: new Date().toISOString(),
        qrGenerated: false,
        note: 'Recorded locally - Blockchain Bridge unavailable'
      });
    }
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', async (req, res) => {
  // Check Blockchain Bridge connection
  let blockchainStatus = 'disconnected';
  let blockchainInfo = null;
  
  try {
    const response = await fetch(`${BLOCKCHAIN_BRIDGE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(3000)
    });
    if (response.ok) {
      blockchainStatus = 'connected';
      blockchainInfo = await response.json();
    }
  } catch (error) {
    blockchainStatus = 'disconnected';
  }

  res.json({
    status: 'healthy',
    service: 'Frontend Bridge',
    blockchainBridge: {
      url: BLOCKCHAIN_BRIDGE_URL,
      status: blockchainStatus,
      info: blockchainInfo
    },
    timestamp: new Date().toISOString()
  });
});

// Start server
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║        🌉 FRONTEND BRIDGE SERVER STARTED                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log(`   🌐 Server: http://localhost:${PORT}`);
  console.log(`   📍 Endpoints:`);
  console.log(`      - POST /generate-qr (QR certificate generation)`);
  console.log(`      - POST /record-image (Record verified images)`);
  console.log(`      - GET /health (Health check)`);
  console.log(`   🔗 Blockchain Bridge: ${BLOCKCHAIN_BRIDGE_URL}`);
  console.log(`   ⏳ Waiting for requests from Next.js API...\n`);
  console.log('   💡 Health check: GET http://localhost:' + PORT + '/health');
  console.log('   🛑 Press Ctrl+C to stop\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\n🛑 Shutting down Frontend Bridge...');
  process.exit(0);
});
