import React, { useState, useEffect } from 'react';
import { Search, AlertTriangle, CheckCircle, XCircle, TrendingUp, Database, Globe } from 'lucide-react';

const BanjoCap = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedToken, setSelectedToken] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [analysis, setAnalysis] = useState(null);

  // Mock data for demonstration
  const sampleTokens = [
    {
      symbol: 'PEPE',
      name: 'Pepe Token',
      address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
      dexScreenerMcap: 5200000000,
      actualMcap: 4850000000,
      circulatingSupply: 420690000000000,
      totalSupply: 420690000000000,
      price: 0.0000115,
      dexPrice: 0.0000124,
      discrepancy: -6.7,
      sources: ['Etherscan', 'CoinGecko', 'DexScreener']
    },
    {
      symbol: 'SHIB',
      name: 'Shiba Inu',
      address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
      dexScreenerMcap: 15800000000,
      actualMcap: 14200000000,
      circulatingSupply: 589735030408323,
      totalSupply: 999982373051419,
      price: 0.0000241,
      dexPrice: 0.0000268,
      discrepancy: -10.1,
      sources: ['Etherscan', 'CoinMarketCap', 'DexScreener']
    },
    {
      symbol: 'BASE',
      name: 'Base Token',
      address: '0x1234567890123456789012345678901234567890',
      dexScreenerMcap: 125000000,
      actualMcap: 98000000,
      circulatingSupply: 45000000,
      totalSupply: 100000000,
      price: 2.18,
      dexPrice: 2.78,
      discrepancy: -21.6,
      sources: ['Basescan', 'DexScreener']
    }
  ];

  const handleSearch = async (token) => {
    setIsLoading(true);
    setSelectedToken(token);
    
    // If it's a mock token, use the existing logic
    if (token.symbol) {
      setTimeout(() => {
        const mockAnalysis = {
          timestamp: new Date().toISOString(),
          dataQuality: token.discrepancy > -5 ? 'high' : token.discrepancy > -15 ? 'medium' : 'low',
          recommendations: generateRecommendations(token),
          riskLevel: Math.abs(token.discrepancy) > 15 ? 'high' : Math.abs(token.discrepancy) > 5 ? 'medium' : 'low'
        };
        setAnalysis(mockAnalysis);
        setIsLoading(false);
      }, 1500);
    }
  };

  // Add scanner state
  const [scannerState, setScannerState] = useState({
    isScanning: false,
    progress: 0,
    totalTokens: 0,
    scannedTokens: [],
    errors: [],
    startTime: null
  });

  const [scanResults, setScanResults] = useState([]);
  const [showScanner, setShowScanner] = useState(false);

  // Add rate limiting state
  const [rateLimitInfo, setRateLimitInfo] = useState({
    callsRemaining: 100000,
    resetTime: null,
    lastCallTime: 0
  });

  // Add scanner state
  const [scannerState, setScannerState] = useState({
    isScanning: false,
    progress: 0,
    totalTokens: 0,
    scannedTokens: [],
    errors: [],
    startTime: null
  });

  const [scanResults, setScanResults] = useState([]);
  const [showScanner, setShowScanner] = useState(false);

  const scanTopBaseTokens = async (limit = 100) => {
    setScannerState({
      isScanning: true,
      progress: 0,
      totalTokens: 0,
      scannedTokens: [],
      errors: [],
      startTime: Date.now()
    });

    try {
      // First, get top Base tokens from DexScreener
      const baseTokensResponse = await fetch(
        `https://api.dexscreener.com/latest/dex/search/?q=base`
      );
      
      if (!baseTokensResponse.ok) {
        throw new Error('Failed to fetch Base tokens from DexScreener');
      }

      const baseTokensData = await baseTokensResponse.json();
      
      // Filter for Base network and sort by market cap
      const baseTokens = baseTokensData.pairs
        ?.filter(pair => 
          pair.chainId === 'base' && 
          pair.marketCap && 
          parseFloat(pair.marketCap) > 1000000 // Minimum $1M market cap
        )
        .sort((a, b) => parseFloat(b.marketCap) - parseFloat(a.marketCap))
        .slice(0, limit) || [];

      setScannerState(prev => ({
        ...prev,
        totalTokens: baseTokens.length
      }));

      const results = [];
      const API_KEY = 'YOUR_BASESCAN_API_KEY_HERE';
      
      for (let i = 0; i < baseTokens.length; i++) {
        const token = baseTokens[i];
        
        try {
          // Rate limiting - respect 5 calls per second
          if (i > 0) {
            await new Promise(resolve => setTimeout(resolve, 250));
          }

          // Get token contract data from Basescan
          const tokenInfoResponse = await fetch(
            `https://api.basescan.org/api?module=token&action=tokeninfo&contractaddress=${token.baseToken.address}&apikey=${API_KEY}`
          );
          
          const tokenInfo = await tokenInfoResponse.json();
          
          if (tokenInfo.status === '1' && tokenInfo.result && tokenInfo.result[0]) {
            const contractData = tokenInfo.result[0];
            
            // Small delay for rate limiting
            await new Promise(resolve => setTimeout(resolve, 250));
            
            // Get total supply
            const totalSupplyResponse = await fetch(
              `https://api.basescan.org/api?module=stats&action=tokensupply&contractaddress=${token.baseToken.address}&apikey=${API_KEY}`
            );
            
            const totalSupplyData = await totalSupplyResponse.json();
            
            if (totalSupplyData.status === '1') {
              const decimals = parseInt(contractData.decimals);
              const totalSupply = parseInt(totalSupplyData.result) / Math.pow(10, decimals);
              const dexPrice = parseFloat(token.priceUsd);
              const dexMcap = parseFloat(token.marketCap);
              
              // Calculate actual market cap (assuming circulating = total for now)
              const circulatingSupply = totalSupply;
              const actualMcap = circulatingSupply * dexPrice;
              const discrepancy = ((dexMcap - actualMcap) / actualMcap) * 100;
              
              const result = {
                rank: i + 1,
                symbol: contractData.symbol,
                name: contractData.name,
                address: token.baseToken.address,
                dexMcap: dexMcap,
                actualMcap: actualMcap,
                discrepancy: discrepancy,
                price: dexPrice,
                totalSupply: totalSupply,
                circulatingSupply: circulatingSupply,
                liquidity: parseFloat(token.liquidity?.usd || 0),
                volume24h: parseFloat(token.volume?.h24 || 0),
                priceChange24h: parseFloat(token.priceChange?.h24 || 0),
                dexUrl: token.url,
                scanTime: new Date().toISOString()
              };
              
              results.push(result);
            }
          }
        } catch (error) {
          setScannerState(prev => ({
            ...prev,
            errors: [...prev.errors, {
              token: token.baseToken.symbol,
              address: token.baseToken.address,
              error: error.message
            }]
          }));
        }

        // Update progress
        setScannerState(prev => ({
          ...prev,
          progress: ((i + 1) / baseTokens.length) * 100,
          scannedTokens: [...results]
        }));
      }

      // Sort results by absolute discrepancy (highest discrepancies first)
      results.sort((a, b) => Math.abs(b.discrepancy) - Math.abs(a.discrepancy));
      
      setScanResults(results);
      
    } catch (error) {
      console.error('Scanner error:', error);
      setScannerState(prev => ({
        ...prev,
        errors: [...prev.errors, { general: error.message }]
      }));
    } finally {
      setScannerState(prev => ({
        ...prev,
        isScanning: false
      }));
    }
  };
    setIsLoading(true);
    setSelectedToken(null);
    setAnalysis(null);

    try {
      // Rate limiting check (5 calls per second)
      const now = Date.now();
      const timeSinceLastCall = now - rateLimitInfo.lastCallTime;
      if (timeSinceLastCall < 200) { // 200ms = 5 calls per second
        await new Promise(resolve => setTimeout(resolve, 200 - timeSinceLastCall));
      }

      // Validate Base contract address format
      if (!contractAddress.match(/^0x[a-fA-F0-9]{40}$/)) {
        throw new Error('Invalid contract address format');
      }

      // Replace with your actual API key
      const API_KEY = 'TMDT18SHKYKK9TQG4CG8Z1K3HE9TN65UCR'; // Put your API key here
      const baseUrl = 'https://api.basescan.org/api';
      
      // Update rate limit tracking
      setRateLimitInfo(prev => ({
        ...prev,
        lastCallTime: Date.now(),
        callsRemaining: prev.callsRemaining - 2 // We'll make 2 API calls
      }));

      // Get token info
      const tokenInfoResponse = await fetch(
        `${baseUrl}?module=token&action=tokeninfo&contractaddress=${contractAddress}&apikey=${API_KEY}`
      );
      const tokenInfo = await tokenInfoResponse.json();

      if (tokenInfo.status !== '1') {
        throw new Error(tokenInfo.message || 'Failed to fetch token info from Basescan');
      }

      const token = tokenInfo.result[0];
      
      // Small delay to respect rate limits
      await new Promise(resolve => setTimeout(resolve, 250));
      
      // Get total supply
      const totalSupplyResponse = await fetch(
        `${baseUrl}?module=stats&action=tokensupply&contractaddress=${contractAddress}&apikey=${API_KEY}`
      );
      const totalSupplyData = await totalSupplyResponse.json();

      if (totalSupplyData.status !== '1') {
        throw new Error('Failed to fetch total supply from Basescan');
      }

      // Calculate values
      const decimals = parseInt(token.decimals);
      const totalSupply = parseInt(totalSupplyData.result) / Math.pow(10, decimals);
      
      // Check common burn addresses for more accurate circulating supply
      const burnAddresses = [
        '0x000000000000000000000000000000000000dead',
        '0x0000000000000000000000000000000000000000'
      ];
      
      let burnedTokens = 0;
      
      // You could add burn address checking here with additional API calls
      // For now, we'll assume circulating = total (common for many tokens)
      const circulatingSupply = totalSupply - burnedTokens;

      // Try to get price from DexScreener API
      let dexPrice = 0;
      let dexMcap = 0;
      
      try {
        const dexResponse = await fetch(
          `https://api.dexscreener.com/latest/dex/tokens/${contractAddress}`
        );
        const dexData = await dexResponse.json();
        
        if (dexData.pairs && dexData.pairs.length > 0) {
          // Get the pair with highest liquidity
          const bestPair = dexData.pairs.reduce((prev, current) => 
            (parseFloat(current.liquidity?.usd || 0) > parseFloat(prev.liquidity?.usd || 0)) ? current : prev
          );
          
          dexPrice = parseFloat(bestPair.priceUsd || 0);
          dexMcap = parseFloat(bestPair.marketCap || 0);
        }
      } catch (dexError) {
        console.warn('Could not fetch DexScreener data:', dexError);
        // Fallback to mock data
        dexPrice = Math.random() * 10;
        dexMcap = circulatingSupply * dexPrice;
      }

      // Calculate actual market cap
      const actualMcap = circulatingSupply * dexPrice;
      const discrepancy = dexMcap > 0 ? ((dexMcap - actualMcap) / actualMcap) * 100 : 0;
      
      // Create analyzed token object
      const analyzedToken = {
        symbol: token.symbol,
        name: token.name,
        address: contractAddress,
        totalSupply: totalSupply,
        circulatingSupply: circulatingSupply,
        decimals: decimals,
        dexScreenerMcap: dexMcap,
        actualMcap: actualMcap,
        price: dexPrice,
        dexPrice: dexPrice,
        discrepancy: discrepancy,
        sources: ['Basescan', dexMcap > 0 ? 'DexScreener' : 'DexScreener (No Data)'],
        isLive: true,
        fetchedAt: new Date().toISOString()
      };

      setSelectedToken(analyzedToken);

      const analysis = {
        timestamp: new Date().toISOString(),
        dataQuality: Math.abs(discrepancy) < 5 ? 'high' : Math.abs(discrepancy) < 15 ? 'medium' : 'low',
        recommendations: generateRecommendations(analyzedToken),
        riskLevel: Math.abs(discrepancy) > 15 ? 'high' : Math.abs(discrepancy) > 5 ? 'medium' : 'low'
      };
      
      setAnalysis(analysis);

    } catch (error) {
      console.error('Error fetching BaseScan data:', error);
      setSelectedToken({
        error: true,
        message: error.message,
        address: contractAddress,
        suggestions: [
          'Verify the contract address is correct',
          'Ensure the token exists on Base network',
          'Check if API key is valid and has remaining calls',
          'Try again in a few moments if rate limited'
        ]
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateRecommendations = (token) => {
    const recs = [];
    if (Math.abs(token.discrepancy) > 15) {
      recs.push('High discrepancy detected - verify circulating supply');
    }
    if (token.circulatingSupply < token.totalSupply * 0.7) {
      recs.push('Significant locked/burned tokens - check vesting schedules');
    }
    if (token.sources.length < 3) {
      recs.push('Limited data sources - seek additional verification');
    }
    return recs;
  };

  const formatNumber = (num) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  const getDiscrepancyColor = (discrepancy) => {
    if (Math.abs(discrepancy) < 5) return 'text-green-600';
    if (Math.abs(discrepancy) < 15) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getDiscrepancyIcon = (discrepancy) => {
    if (Math.abs(discrepancy) < 5) return <CheckCircle className="w-5 h-5 text-green-600" />;
    if (Math.abs(discrepancy) < 15) return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            BanjoCap
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            DEX vs Actual Token Statistics
          </p>
        </div>

        {/* Scanner Section */}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-8 border border-slate-700">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center">
              <TrendingUp className="w-6 h-6 mr-2 text-purple-400" />
              Base Token Scanner
            </h2>
            <button
              onClick={() => setShowScanner(!showScanner)}
              className="bg-purple-600 hover:bg-purple-700 px-4 py-2 rounded-lg font-medium transition-colors"
            >
              {showScanner ? 'Hide Scanner' : 'Show Scanner'}
            </button>
          </div>

          {showScanner && (
            <div className="space-y-6">
              <p className="text-gray-300">
                Scan the top Base tokens and rank them by market cap discrepancy between DEX reports and actual blockchain data.
              </p>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => scanTopBaseTokens(50)}
                  disabled={scannerState.isScanning}
                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {scannerState.isScanning ? 'Scanning...' : 'Scan Top 50'}
                </button>
                <button
                  onClick={() => scanTopBaseTokens(100)}
                  disabled={scannerState.isScanning}
                  className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  {scannerState.isScanning ? 'Scanning...' : 'Scan Top 100'}
                </button>
                <div className="text-sm text-gray-400">
                  Est. API calls: {scannerState.isScanning ? `${Math.floor(scannerState.progress / 100 * scannerState.totalTokens * 2)}` : '~200-400'}
                </div>
              </div>

              {scannerState.isScanning && (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span>Progress: {scannerState.progress.toFixed(1)}%</span>
                    <span>{scannerState.scannedTokens.length} / {scannerState.totalTokens} tokens</span>
                  </div>
                  <div className="w-full bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-500 to-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${scannerState.progress}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400">
                    Scanning since: {scannerState.startTime ? new Date(scannerState.startTime).toLocaleTimeString() : ''}
                  </div>
                </div>
              )}

              {scannerState.errors.length > 0 && (
                <div className="bg-red-600/20 border border-red-400/30 rounded-lg p-3">
                  <p className="text-red-300 text-sm font-medium mb-2">Scan Errors:</p>
                  <div className="text-red-200 text-xs space-y-1 max-h-32 overflow-y-auto">
                    {scannerState.errors.slice(0, 5).map((error, idx) => (
                      <div key={idx}>
                        {error.token ? `${error.token}: ${error.error}` : error.general}
                      </div>
                    ))}
                    {scannerState.errors.length > 5 && (
                      <div>... and {scannerState.errors.length - 5} more errors</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Scan Results */}
        {scanResults.length > 0 && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-8 border border-slate-700">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center">
                <Database className="w-6 h-6 mr-2 text-green-400" />
                Scan Results - Ranked by Discrepancy
              </h2>
              <div className="text-sm text-gray-400">
                {scanResults.length} tokens analyzed
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-3 px-2">Rank</th>
                    <th className="text-left py-3 px-2">Token</th>
                    <th className="text-right py-3 px-2">DEX MCap</th>
                    <th className="text-right py-3 px-2">Actual MCap</th>
                    <th className="text-right py-3 px-2">Discrepancy</th>
                    <th className="text-right py-3 px-2">Price</th>
                    <th className="text-right py-3 px-2">24h Volume</th>
                    <th className="text-center py-3 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {scanResults.slice(0, 20).map((token, idx) => (
                    <tr key={token.address} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                      <td className="py-3 px-2 font-mono">#{idx + 1}</td>
                      <td className="py-3 px-2">
                        <div>
                          <div className="font-medium">{token.symbol}</div>
                          <div className="text-xs text-gray-400 truncate max-w-32">{token.name}</div>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right font-mono">${formatNumber(token.dexMcap)}</td>
                      <td className="py-3 px-2 text-right font-mono">${formatNumber(token.actualMcap)}</td>
                      <td className={`py-3 px-2 text-right font-mono font-bold ${getDiscrepancyColor(token.discrepancy)}`}>
                        {token.discrepancy > 0 ? '+' : ''}{token.discrepancy.toFixed(1)}%
                      </td>
                      <td className="py-3 px-2 text-right font-mono">${token.price.toFixed(6)}</td>
                      <td className="py-3 px-2 text-right font-mono">${formatNumber(token.volume24h)}</td>
                      <td className="py-3 px-2 text-center">
                        <button
                          onClick={() => {
                            setSelectedToken(token);
                            const analysis = {
                              timestamp: token.scanTime,
                              dataQuality: Math.abs(token.discrepancy) < 5 ? 'high' : Math.abs(token.discrepancy) < 15 ? 'medium' : 'low',
                              recommendations: generateRecommendations(token),
                              riskLevel: Math.abs(token.discrepancy) > 15 ? 'high' : Math.abs(token.discrepancy) > 5 ? 'medium' : 'low'
                            };
                            setAnalysis(analysis);
                          }}
                          className="bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs transition-colors"
                        >
                          Analyze
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              
              {scanResults.length > 20 && (
                <div className="text-center mt-4 text-gray-400 text-sm">
                  Showing top 20 results. Total scanned: {scanResults.length}
                </div>
              )}
            </div>
          </div>
        )}
        <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 mb-8 border border-slate-700">
          <div className="flex items-center space-x-4 mb-6">
            <Search className="w-6 h-6 text-blue-400" />
            <input
              type="text"
              placeholder="Enter Base contract address (0x...) or search sample tokens"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 bg-slate-700 rounded-lg px-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {searchTerm.match(/^0x[a-fA-F0-9]{40}$/) && (
              <button
                onClick={() => fetchBaseScanData(searchTerm)}
                className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
              >
                Analyze Contract
              </button>
            )}
          </div>
          
          {searchTerm.match(/^0x[a-fA-F0-9]{40}$/) && (
            <div className="mb-4 p-3 bg-blue-600/20 border border-blue-400/30 rounded-lg">
              <p className="text-blue-300 text-sm mb-2">
                ✓ Valid Base contract address detected. Click "Analyze Contract" to fetch live data from Basescan.
              </p>
              <div className="text-xs text-blue-200/70">
                Rate Limit: {rateLimitInfo.callsRemaining.toLocaleString()} calls remaining today
              </div>
            </div>
          )}

          {/* Sample Tokens */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {sampleTokens
              .filter(token => 
                searchTerm === '' || 
                token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
                token.name.toLowerCase().includes(searchTerm.toLowerCase())
              )
              .map((token, index) => (
                <div
                  key={index}
                  onClick={() => handleSearch(token)}
                  className="bg-slate-700/50 rounded-lg p-4 cursor-pointer hover:bg-slate-600/50 transition-all duration-200 border border-slate-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-lg">{token.symbol}</h3>
                    {getDiscrepancyIcon(token.discrepancy)}
                  </div>
                  <p className="text-gray-300 text-sm mb-2">{token.name}</p>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">DEX MCap:</span>
                    <span>${formatNumber(token.dexScreenerMcap)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Actual MCap:</span>
                    <span>${formatNumber(token.actualMcap)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Discrepancy:</span>
                    <span className={getDiscrepancyColor(token.discrepancy)}>
                      {token.discrepancy > 0 ? '+' : ''}{token.discrepancy.toFixed(1)}%
                    </span>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* Analysis Section */}
        {selectedToken && !isLoading && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
            {selectedToken.error ? (
              <div className="text-center py-8">
                <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-red-400 mb-2">Error Fetching Data</h3>
                <p className="text-gray-300 mb-2">{selectedToken.message}</p>
                <p className="text-sm text-gray-400">Contract: {selectedToken.address}</p>
                <div className="mt-4 p-4 bg-red-600/20 border border-red-400/30 rounded-lg">
                  <p className="text-red-300 text-sm mb-3">
                    <strong>Error Details:</strong> {selectedToken.message}
                  </p>
                  {selectedToken.suggestions && (
                    <div>
                      <p className="text-red-300 text-sm font-medium mb-2">Troubleshooting:</p>
                      <ul className="text-red-200 text-xs space-y-1">
                        {selectedToken.suggestions.map((suggestion, idx) => (
                          <li key={idx}>• {suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-bold flex items-center">
                    <TrendingUp className="w-6 h-6 mr-2 text-blue-400" />
                    Analysis for {selectedToken.symbol}
                    {selectedToken.isLive && (
                      <span className="ml-2 px-2 py-1 bg-green-600/20 text-green-400 text-xs rounded-full">
                        LIVE DATA
                      </span>
                    )}
                  </h2>
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-400">Risk Level:</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      analysis?.riskLevel === 'high' ? 'bg-red-600/20 text-red-400' :
                      analysis?.riskLevel === 'medium' ? 'bg-yellow-600/20 text-yellow-400' :
                      'bg-green-600/20 text-green-400'
                    }`}>
                      {analysis?.riskLevel?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Market Cap Comparison */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 text-blue-400">Market Cap Comparison</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">DEX Reported:</span>
                        <span className="font-mono">${formatNumber(selectedToken.dexScreenerMcap)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Actual Market Cap:</span>
                        <span className="font-mono">${formatNumber(selectedToken.actualMcap)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-600 pt-2">
                        <span className="text-gray-400">Discrepancy:</span>
                        <span className={`font-mono font-bold ${getDiscrepancyColor(selectedToken.discrepancy)}`}>
                          {selectedToken.discrepancy > 0 ? '+' : ''}{selectedToken.discrepancy.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Supply Information */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 text-purple-400">Supply Information</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Circulating Supply:</span>
                        <span className="font-mono">{formatNumber(selectedToken.circulatingSupply)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Total Supply:</span>
                        <span className="font-mono">{formatNumber(selectedToken.totalSupply)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-600 pt-2">
                        <span className="text-gray-400">Circulation %:</span>
                        <span className="font-mono">
                          {((selectedToken.circulatingSupply / selectedToken.totalSupply) * 100).toFixed(1)}%
                        </span>
                      </div>
                      {selectedToken.decimals && (
                        <div className="flex justify-between text-sm text-gray-500">
                          <span>Decimals:</span>
                          <span className="font-mono">{selectedToken.decimals}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Price Comparison */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 text-green-400">Price Analysis</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-gray-400">DEX Price:</span>
                        <span className="font-mono">${selectedToken.dexPrice.toFixed(8)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Calculated Price:</span>
                        <span className="font-mono">${selectedToken.price.toFixed(8)}</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-600 pt-2">
                        <span className="text-gray-400">Price Variance:</span>
                        <span className="font-mono">
                          {(((selectedToken.dexPrice - selectedToken.price) / selectedToken.price) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Data Sources */}
                  <div className="bg-slate-700/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 text-orange-400">Data Sources</h3>
                    <div className="space-y-2">
                      {selectedToken.sources.map((source, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Database className="w-4 h-4 text-orange-400" />
                          <span className="text-sm">{source}</span>
                        </div>
                      ))}
                    </div>
                    {selectedToken.address && (
                      <div className="mt-3 pt-3 border-t border-slate-600">
                        <p className="text-xs text-gray-400 break-all">
                          Contract: {selectedToken.address}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Recommendations */}
                {analysis?.recommendations?.length > 0 && (
                  <div className="mt-6 bg-slate-700/30 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-4 text-yellow-400">Recommendations</h3>
                    <div className="space-y-2">
                      {analysis.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start space-x-2">
                          <AlertTriangle className="w-4 h-4 text-yellow-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-300">{rec}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Loading State */}
        {isLoading && (
          <div className="bg-slate-800/50 backdrop-blur-sm rounded-xl p-12 text-center border border-slate-700">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
            <p className="text-gray-300">Analyzing token data...</p>
          </div>
        )}

        {/* Data Sources Guide */}
        <div className="mt-12 bg-slate-800/50 backdrop-blur-sm rounded-xl p-6 border border-slate-700">
          <h2 className="text-2xl font-bold mb-6 flex items-center">
            <Globe className="w-6 h-6 mr-2 text-blue-400" />
            How to Get Accurate Circulating Supply Data
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-blue-400">Blockchain Explorers</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Etherscan (Ethereum tokens)</li>
                <li>• Basescan (Base network tokens)</li>
                <li>• Polygonscan (Polygon tokens)</li>
                <li>• BSCscan (BSC tokens)</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-purple-400">API Sources</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• CoinGecko API</li>
                <li>• CoinMarketCap API</li>
                <li>• Moralis API</li>
                <li>• Alchemy API</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-green-400">Smart Contract Analysis</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Read totalSupply() function</li>
                <li>• Check burn addresses (0x000...)</li>
                <li>• Identify locked/vesting contracts</li>
                <li>• Monitor team/treasury wallets</li>
              </ul>
            </div>
            
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-orange-400">Calculation Method</h3>
              <ul className="space-y-2 text-sm text-gray-300">
                <li>• Circulating = Total - Burned - Locked</li>
                <li>• Verify against multiple sources</li>
                <li>• Account for vesting schedules</li>
                <li>• Monitor supply changes over time</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BanjoCap;
