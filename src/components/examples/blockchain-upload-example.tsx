/**
 * BLOCKCHAIN INTEGRATION EXAMPLE
 * 
 * This file demonstrates how to integrate blockchain recording
 * into your farmer image upload flow.
 */

import { useBlockchainRecord } from '@/hooks/useBlockchainRecord';
import { useImageUpload } from '@/hooks/useImageUpload';
import { useState } from 'react';

export function BlockchainImageUploadExample() {
  const { uploadImage } = useImageUpload();
  const { recordFirstImage, recordSubsequentImage, recording, error } = useBlockchainRecord();
  
  const [currentBatchId, setCurrentBatchId] = useState<string | null>(null);
  const [uploadCount, setUploadCount] = useState(0);

  // ========== SCENARIO 1: First Image Upload (Creates Batch) ==========
  const handleFirstImageUpload = async (
    imageFile: File,
    farmerName: string,
    location: string,
    cropType: string,
    quantity: number
  ) => {
    try {
      // Step 1: Upload image to storage (Supabase)
      console.log('📤 Uploading image to storage...');
      const uploadResult = await uploadImage(imageFile);
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error('Failed to upload image');
      }

      console.log('✅ Image uploaded:', uploadResult.url);

      // Step 2: Generate new batch ID
      const batchId = crypto.randomUUID();
      console.log('🆔 Generated batch ID:', batchId);

      // Step 3: Record to blockchain (FIRST IMAGE)
      console.log('🔗 Recording first image to blockchain...');
      const blockchainResult = await recordFirstImage(
        batchId,
        uploadResult.url,
        farmerName,
        location,
        cropType,
        quantity,
        'kg',
        'Land Preparation' // Stage name
      );

      if (!blockchainResult.success) {
        throw new Error(blockchainResult.error || 'Blockchain recording failed');
      }

      console.log('✅ Blockchain recording successful:', {
        transactionId: blockchainResult.transactionId,
        blockNumber: blockchainResult.blockNumber,
        imageHash: blockchainResult.imageHash
      });

      // Step 4: Save batch ID for future uploads
      setCurrentBatchId(batchId);
      localStorage.setItem('currentBatchId', batchId);
      setUploadCount(1);

      alert(`✅ First image recorded successfully!\n\nBatch ID: ${batchId}\nTransaction: ${blockchainResult.transactionId}\nBlock: ${blockchainResult.blockNumber}`);

    } catch (err) {
      console.error('❌ Error:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // ========== SCENARIO 2: Subsequent Image Upload (Add Stage) ==========
  const handleSubsequentImageUpload = async (
    imageFile: File,
    stageName: string,
    farmerName: string,
    location: string
  ) => {
    try {
      // Get existing batch ID
      const batchId = currentBatchId || localStorage.getItem('currentBatchId');
      
      if (!batchId) {
        throw new Error('No active batch. Please upload the first image to create a batch.');
      }

      // Step 1: Upload image to storage
      console.log('📤 Uploading image to storage...');
      const uploadResult = await uploadImage(imageFile);
      
      if (!uploadResult.success || !uploadResult.url) {
        throw new Error('Failed to upload image');
      }

      console.log('✅ Image uploaded:', uploadResult.url);

      // Step 2: Record to blockchain (SUBSEQUENT IMAGE)
      console.log('🔗 Recording subsequent image to blockchain...');
      const blockchainResult = await recordSubsequentImage(
        batchId,
        uploadResult.url,
        stageName, // "Sowing", "Growing", "Harvesting", etc.
        farmerName,
        location
      );

      if (!blockchainResult.success) {
        throw new Error(blockchainResult.error || 'Blockchain recording failed');
      }

      console.log('✅ Blockchain recording successful:', {
        transactionId: blockchainResult.transactionId,
        blockNumber: blockchainResult.blockNumber,
        stage: blockchainResult.stage
      });

      setUploadCount(prev => prev + 1);

      alert(`✅ Stage "${stageName}" recorded successfully!\n\nTransaction: ${blockchainResult.transactionId}\nBlock: ${blockchainResult.blockNumber}`);

    } catch (err) {
      console.error('❌ Error:', err);
      alert(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // ========== EXAMPLE USAGE ==========
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Blockchain Image Upload Example</h2>
      
      {/* Current Status */}
      <div className="bg-blue-50 p-4 rounded">
        <p><strong>Current Batch ID:</strong> {currentBatchId || 'None (Start with first image)'}</p>
        <p><strong>Images Uploaded:</strong> {uploadCount}</p>
        <p><strong>Status:</strong> {recording ? '⏳ Recording...' : '✅ Ready'}</p>
        {error && <p className="text-red-600"><strong>Error:</strong> {error}</p>}
      </div>

      {/* First Image Upload (Only show if no batch) */}
      {!currentBatchId && (
        <div className="border-2 border-green-500 p-4 rounded">
          <h3 className="text-xl font-semibold mb-3">Step 1: Upload First Image (Create Batch)</h3>
          <button
            onClick={() => {
              // Example with dummy data - replace with actual form
              const file = new File([''], 'land-prep.jpg', { type: 'image/jpeg' });
              handleFirstImageUpload(
                file,
                'Kush Farmer',
                'Karnataka, India',
                'Wheat',
                500
              );
            }}
            disabled={recording}
            className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
          >
            Upload First Image (Land Preparation)
          </button>
          <p className="text-sm text-gray-600 mt-2">
            This will create a new batch on the blockchain
          </p>
        </div>
      )}

      {/* Subsequent Image Uploads */}
      {currentBatchId && (
        <div className="border-2 border-blue-500 p-4 rounded space-y-3">
          <h3 className="text-xl font-semibold">Step 2+: Add More Stages</h3>
          
          {/* Example stage buttons */}
          {['Sowing', 'Growing', 'Fertilizer Application', 'Harvesting', 'Storage', 'Transport'].map((stage) => (
            <button
              key={stage}
              onClick={() => {
                // Example with dummy data - replace with actual form
                const file = new File([''], `${stage.toLowerCase()}.jpg`, { type: 'image/jpeg' });
                handleSubsequentImageUpload(
                  file,
                  stage,
                  'Kush Farmer',
                  'Karnataka, India'
                );
              }}
              disabled={recording}
              className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50 mr-2"
            >
              Upload {stage}
            </button>
          ))}
          
          <p className="text-sm text-gray-600 mt-2">
            These will add stages to the existing batch
          </p>
        </div>
      )}

      {/* Reset Button */}
      {currentBatchId && (
        <button
          onClick={() => {
            setCurrentBatchId(null);
            localStorage.removeItem('currentBatchId');
            setUploadCount(0);
          }}
          className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Start New Batch
        </button>
      )}
    </div>
  );
}

/**
 * INTEGRATION INTO YOUR FARMER DASHBOARD
 * 
 * To integrate this into your existing farmer-dashboard.tsx:
 * 
 * 1. Import the hook:
 *    import { useBlockchainRecord } from '@/hooks/useBlockchainRecord';
 * 
 * 2. In your component:
 *    const { recordFirstImage, recordSubsequentImage } = useBlockchainRecord();
 * 
 * 3. After image upload succeeds, call blockchain:
 *    // First image
 *    const result = await recordFirstImage(
 *      batchId, imageUrl, farmerName, location, cropType, quantity, unit, stageName
 *    );
 * 
 *    // Subsequent images
 *    const result = await recordSubsequentImage(
 *      batchId, imageUrl, stageName, farmerName, location
 *    );
 * 
 * 4. Handle the result:
 *    if (result.success) {
 *      // Store transaction details
 *      console.log('Transaction ID:', result.transactionId);
 *      console.log('Block Number:', result.blockNumber);
 *    }
 */

/**
 * STAGE NAMES (use these exact strings):
 * - "Land Preparation"
 * - "Sowing"
 * - "Growing"
 * - "Fertilizer Application"
 * - "Pest Control"
 * - "Irrigation"
 * - "Harvesting"
 * - "Storage"
 * - "Transport"
 */
