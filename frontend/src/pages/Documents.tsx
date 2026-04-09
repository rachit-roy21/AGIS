import { useState, useRef } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useVault } from '../hooks/useVault';
import { getApiClient, generateProcessingId } from '../utils/api';

export function Documents() {
  const { session, isSessionValid } = useSession();
  const { vault, ready: vaultReady } = useVault();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const apiClient = getApiClient();

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!session.isActive || !isSessionValid()) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Authentication Required</h2>
        <p className="text-gray-600 mb-8">Please start a session to access document processing.</p>
        <button
          onClick={() => window.location.href = '/test'}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Start Session
        </button>
      </div>
    );
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.includes('pdf') && !file.type.includes('text')) {
        setError('Only PDF and text files are supported');
        return;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError('File size must be less than 10MB');
        return;
      }

      setSelectedFile(file);
      setError(null);
      setResult(null);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !vaultReady || !vault || !session.id) {
      return;
    }

    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const processingId = generateProcessingId();

      if (selectedFile.type === 'application/pdf') {
        const response = await apiClient.sanitizePdf(session.id, processingId, selectedFile);

        // Store tokens in vault
        if (Object.keys(response.tokens).length > 0) {
          await vault.storeFromTokenMap(response.tokens);
        }

        setResult({
          filename: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          processingId,
          tokens: response.tokens,
          pages: response.pages,
          processingTime: response.processing_time_sec,
          geminiCalls: response.gemini_calls,
          pdf_bytes: btoa(String.fromCharCode(...new Uint8Array(response.pdf_bytes))),
        });
      } else {
        // Handle text file
        const text = await selectedFile.text();
        const response = await apiClient.sanitizeText(session.id, processingId, text);

        if (Object.keys(response.tokens).length > 0) {
          await vault.storeFromTokenMap(response.tokens);
        }

        setResult({
          filename: selectedFile.name,
          size: selectedFile.size,
          type: selectedFile.type,
          processingId,
          tokens: response.tokens,
          sanitizedText: response.sanitized_text,
          engine: response.engine,
        });
      }

      setSelectedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setProcessing(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Document Processing</h1>
        <p className="mt-2 text-gray-600">
          Upload and sanitize documents with automatic tokenization
        </p>
      </div>

      {/* Upload Section */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Upload Document</h2>

        <div className="space-y-4">
          {/* File Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File (PDF or Text, max 10MB)
            </label>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              accept=".pdf,.txt,.text"
              className="block w-full text-sm text-gray-900 border border-gray-300 rounded-lg cursor-pointer bg-gray-50 focus:outline-none focus:border-blue-500"
              disabled={processing}
            />
          </div>

          {/* Selected File Info */}
          {selectedFile && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-900">{selectedFile.name}</p>
                  <p className="text-sm text-gray-500">
                    {formatFileSize(selectedFile.size)} • {selectedFile.type}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSelectedFile(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                  className="text-red-600 hover:text-red-800"
                  disabled={processing}
                >
                  Remove
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700">{error}</p>
            </div>
          )}

          {/* Upload Button */}
          <button
            onClick={handleUpload}
            disabled={!selectedFile || processing || !vaultReady}
            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {processing ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing...
              </div>
            ) : (
              'Upload & Process'
            )}
          </button>
        </div>
      </div>

      {/* Results Section */}
      {result && (
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Processing Results</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* File Info */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">File Information</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Name:</span> {result.filename}</div>
                <div><span className="font-medium">Size:</span> {formatFileSize(result.size)}</div>
                <div><span className="font-medium">Type:</span> {result.type}</div>
                <div><span className="font-medium">Processing ID:</span> {result.processingId}</div>
              </div>
            </div>

            {/* Processing Stats */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-3">Processing Statistics</h3>
              <div className="space-y-2 text-sm">
                <div><span className="font-medium">Pages:</span> {result.pages || 'N/A'}</div>
                <div><span className="font-medium">Tokens Found:</span> {Object.keys(result.tokens || {}).length}</div>
                <div><span className="font-medium">Processing Time:</span> {result.processing_time_sec}s</div>
                <div><span className="font-medium">Gemini Calls:</span> {result.gemini_calls || 0}</div>
              </div>
            </div>
          </div>

          {/* Tokens Stored */}
          {result.tokens && Object.keys(result.tokens).length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Tokens Secured in Vault</h3>
              <div className="p-3 bg-green-50 border border-green-200 rounded-md">
                <p className="text-green-700 text-sm">
                  ✅ {Object.keys(result.tokens).length} tokens have been securely stored in your vault
                </p>
              </div>
            </div>
          )}

          {/* Download Sanitized */}
          {result.pdf_bytes && (
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 mb-3">Download Sanitized Document</h3>
              <button
                onClick={() => {
                  const binaryString = atob(result.pdf_bytes);
                  const bytes = new Uint8Array(binaryString.length);
                  for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                  }
                  const blob = new Blob([bytes], { type: 'application/pdf' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `sanitized_${result.filename}`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
              >
                Download Sanitized PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* Instructions */}
      <div className="bg-blue-50 p-6 rounded-lg">
        <h2 className="text-lg font-bold text-blue-900 mb-3">How It Works</h2>
        <ol className="list-decimal list-inside space-y-2 text-blue-800">
          <li>Upload a PDF or text file containing sensitive information</li>
          <li>Our AI system detects and redacts personally identifiable information (PII)</li>
          <li>Detected PII is replaced with secure tokens (TOKEN_ABC123)</li>
          <li>Tokens are immediately stored in your encrypted client vault</li>
          <li>Download the sanitized document with tokens replacing sensitive data</li>
          <li>Your vault can later detokenize the document for viewing</li>
        </ol>
      </div>
    </div>
  );
}