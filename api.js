/**
 * 🌐 Trading Bot API Module
 * Version: 2.1.0
 * 
 * 📡 Features:
 * - Multi-exchange support (Binance, Upbit, Bybit, OKX)
 * - REST & WebSocket APIs
 * - Authentication & Signatures
 * - Rate limiting & Throttling
 * - Auto retry & Failover
 * - Request/Response interceptors
 * - Caching system
 * - Real-time data streaming
 * - API health monitoring
 * - Order management
 * - Market data feeds
 */

import { EventEmitter } from '../core/event-emitter.js';

class APIModule extends EventEmitter {
    constructor(tradingBot) {
        super();
        this.bot = tradingBot;
        this.config = tradingBot.config.api || this.getDefaultConfig();
        
        // Exchange instances
        this.exchanges = new Map();
        this.activeExchange = null;
        
        // WebSocket connections
        this.wsConnections = new Map();
        
        // Request queues
        this.requestQueue = [];
        this.rateLimiters = new Map();
        
        // Cache
        this.cache = new Map();
        this.cacheTimers = new Map();
        
        // Interceptors
        this.requestInterceptors = [];
        this.responseInterceptors = [];
        
        // Health monitoring
        this.healthChecks = new Map();
        this.apiStatus = new Map();
        
        // Statistics
        this.stats = {
            requests: 0,
            errors: 0,
            avgLatency: 0,
            totalVolume: 0
        };
        
        this.init();
    }
    
    getDefaultConfig() {
        return {
            exchanges: {
                binance: {
                    name: 'Binance',
                    restUrl: 'https://api.binance.com',
                    wsUrl: 'wss://stream.binance.com:9443/ws',
                    testnet: {
                        restUrl: 'https://testnet.binance.vision',
                        wsUrl: 'wss://testnet.binance.vision/ws'
                    }
                },
                upbit: {
                    name: 'Upbit',
                    restUrl: 'https://api.upbit.com',
                    wsUrl: 'wss://api.upbit.com/websocket/v1'
                },
                bybit: {
                    name: 'Bybit',
                    restUrl: 'https://api.bybit.com',
                    wsUrl: 'wss://stream.bybit.com/realtime'
                },
                okx: {
                    name: 'OKX',
                    restUrl: 'https://www.okx.com',
                    wsUrl: 'wss://ws.okx.com:8443/ws/v5/public'
                }
            },
            defaultExchange: 'binance',
            testMode: false,
            rateLimits: {
                binance: { requests: 1200, interval: 60000 }, // 1200 per minute
                upbit: { requests: 30, interval: 1000 },      // 30 per second
                bybit: { requests: 50, interval: 1000 },      // 50 per second
                okx: { requests: 20, interval: 2000 }         // 20 per 2 seconds
            },
            timeout: 30000,
            retries: 3,
            retryDelay: 1000,
            cache: {
                enabled: true,
                ttl: 60000, // 1 minute default
                maxSize: 1000
            },
            websocket: {
                reconnect: true,
                reconnectDelay: 5000,
                maxReconnectAttempts: 10,
                pingInterval: 30000,
                pongTimeout: 10000
            }
        };
    }
    
    async init() {
        try {
            // Initialize exchanges
            await this.initializeExchanges();
            
            // Setup interceptors
            this.setupDefaultInterceptors();
            
            // Start health monitoring
            this.startHealthMonitoring();
            
            // Initialize WebSocket connections
            await this.initializeWebSockets();
            
            // Setup rate limiters
            this.setupRateLimiters();
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('API module initialization failed:', error);
            this.emit('error', { type: 'init_failed', error });
        }
    }
    
    async initializeExchanges() {
        // Get credentials from secure storage
        const credentials = await this.bot.security.getCredentials();
        
        for (const [exchangeId, config] of Object.entries(this.config.exchanges)) {
            const exchange = {
                id: exchangeId,
                config: config,
                credentials: credentials[exchangeId] || {},
                client: null,
                status: 'disconnected',
                lastUpdate: null
            };
            
            // Create exchange-specific client
            exchange.client = this.createExchangeClient(exchangeId, exchange);
            
            this.exchanges.set(exchangeId, exchange);
        }
        
        // Set active exchange
        this.activeExchange = this.config.defaultExchange;
    }
    
    createExchangeClient(exchangeId, exchange) {
        const client = {
            exchange: exchangeId,
            baseUrl: this.config.testMode && exchange.config.testnet ? 
                     exchange.config.testnet.restUrl : 
                     exchange.config.restUrl,
            wsUrl: this.config.testMode && exchange.config.testnet ?
                   exchange.config.testnet.wsUrl :
                   exchange.config.wsUrl,
            
            // Generic request method
            request: async (method, endpoint, params = {}, signed = false) => {
                return this.makeRequest(exchangeId, method, endpoint, params, signed);
            },
            
            // Market data methods
            getTicker: async (symbol) => {
                return this[`get${this.capitalizeFirst(exchangeId)}Ticker`](symbol);
            },
            
            getOrderBook: async (symbol, limit = 100) => {
                return this[`get${this.capitalizeFirst(exchangeId)}OrderBook`](symbol, limit);
            },
            
            getTrades: async (symbol, limit = 500) => {
                return this[`get${this.capitalizeFirst(exchangeId)}Trades`](symbol, limit);
            },
            
            getKlines: async (symbol, interval, limit = 500) => {
                return this[`get${this.capitalizeFirst(exchangeId)}Klines`](symbol, interval, limit);
            },
            
            // Account methods
            getBalance: async () => {
                return this[`get${this.capitalizeFirst(exchangeId)}Balance`]();
            },
            
            // Trading methods
            createOrder: async (order) => {
                return this[`create${this.capitalizeFirst(exchangeId)}Order`](order);
            },
            
            cancelOrder: async (orderId, symbol) => {
                return this[`cancel${this.capitalizeFirst(exchangeId)}Order`](orderId, symbol);
            },
            
            getOrder: async (orderId, symbol) => {
                return this[`get${this.capitalizeFirst(exchangeId)}Order`](orderId, symbol);
            },
            
            getOpenOrders: async (symbol) => {
                return this[`get${this.capitalizeFirst(exchangeId)}OpenOrders`](symbol);
            }
        };
        
        return client;
    }
    
    // ===== REQUEST HANDLING =====
    async makeRequest(exchangeId, method, endpoint, params = {}, signed = false) {
        const exchange = this.exchanges.get(exchangeId);
        if (!exchange) {
            throw new Error(`Exchange ${exchangeId} not found`);
        }
        
        // Check rate limit
        await this.checkRateLimit(exchangeId);
        
        // Build request
        const url = `${exchange.client.baseUrl}${endpoint}`;
        const headers = this.getHeaders(exchangeId);
        
        let requestConfig = {
            method: method.toUpperCase(),
            headers: headers,
            timeout: this.config.timeout
        };
        
        // Handle parameters
        if (method.toUpperCase() === 'GET') {
            const queryString = this.buildQueryString(params);
            if (queryString) {
                requestConfig.url = `${url}?${queryString}`;
            } else {
                requestConfig.url = url;
            }
        } else {
            requestConfig.url = url;
            requestConfig.body = JSON.stringify(params);
            headers['Content-Type'] = 'application/json';
        }
        
        // Sign request if needed
        if (signed) {
            requestConfig = await this.signRequest(exchangeId, requestConfig, params);
        }
        
        // Apply request interceptors
        for (const interceptor of this.requestInterceptors) {
            requestConfig = await interceptor(requestConfig);
        }
        
        // Check cache
        const cacheKey = this.getCacheKey(requestConfig);
        if (!signed && this.config.cache.enabled) {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                this.stats.requests++;
                return cached;
            }
        }
        
        // Make request with retry
        let lastError;
        for (let attempt = 0; attempt <= this.config.retries; attempt++) {
            try {
                const startTime = Date.now();
                
                const response = await fetch(requestConfig.url, {
                    method: requestConfig.method,
                    headers: requestConfig.headers,
                    body: requestConfig.body,
                    signal: AbortSignal.timeout(this.config.timeout)
                });
                
                const latency = Date.now() - startTime;
                this.updateLatency(latency);
                
                // Parse response
                let data;
                const contentType = response.headers.get('content-type');
                if (contentType && contentType.includes('application/json')) {
                    data = await response.json();
                } else {
                    data = await response.text();
                }
                
                // Check for errors
                if (!response.ok) {
                    throw new APIError(response.status, data);
                }
                
                // Apply response interceptors
                for (const interceptor of this.responseInterceptors) {
                    data = await interceptor(data, response);
                }
                
                // Cache successful responses
                if (!signed && this.config.cache.enabled) {
                    this.addToCache(cacheKey, data);
                }
                
                // Update stats
                this.stats.requests++;
                this.updateApiStatus(exchangeId, 'online', latency);
                
                return data;
                
            } catch (error) {
                lastError = error;
                this.stats.errors++;
                
                // Handle rate limit errors
                if (error.status === 429) {
                    await this.handleRateLimit(exchangeId, error);
                }
                
                // Retry logic
                if (attempt < this.config.retries) {
                    const delay = this.config.retryDelay * Math.pow(2, attempt);
                    await this.sleep(delay);
                    continue;
                }
                
                // Update status
                this.updateApiStatus(exchangeId, 'error', 0, error);
            }
        }
        
        throw lastError;
    }
    
    // ===== AUTHENTICATION =====
    async signRequest(exchangeId, requestConfig, params) {
        const exchange = this.exchanges.get(exchangeId);
        const { apiKey, apiSecret } = exchange.credentials;
        
        if (!apiKey || !apiSecret) {
            throw new Error('API credentials not configured');
        }
        
        switch (exchangeId) {
            case 'binance':
                return this.signBinanceRequest(requestConfig, params, apiKey, apiSecret);
            case 'upbit':
                return this.signUpbitRequest(requestConfig, params, apiKey, apiSecret);
            case 'bybit':
                return this.signBybitRequest(requestConfig, params, apiKey, apiSecret);
            case 'okx':
                return this.signOKXRequest(requestConfig, params, apiKey, apiSecret);
            default:
                throw new Error(`Signing not implemented for ${exchangeId}`);
        }
    }
    
    async signBinanceRequest(requestConfig, params, apiKey, apiSecret) {
        // Add timestamp
        params.timestamp = Date.now();
        params.recvWindow = 5000;
        
        // Create signature
        const queryString = this.buildQueryString(params);
        const signature = await this.createHmacSignature(queryString, apiSecret);
        
        // Add signature to params
        const signedQuery = `${queryString}&signature=${signature}`;
        
        // Update URL
        if (requestConfig.method === 'GET') {
            requestConfig.url = requestConfig.url.split('?')[0] + '?' + signedQuery;
        } else {
            requestConfig.body = JSON.stringify({ ...params, signature });
        }
        
        // Add API key header
        requestConfig.headers['X-MBX-APIKEY'] = apiKey;
        
        return requestConfig;
    }
    
    async signUpbitRequest(requestConfig, params, apiKey, apiSecret) {
        const timestamp = Date.now();
        const nonce = this.generateNonce();
        
        // Create JWT token
        const payload = {
            access_key: apiKey,
            nonce: nonce,
            timestamp: timestamp
        };
        
        const token = await this.createJWT(payload, apiSecret);
        
        requestConfig.headers['Authorization'] = `Bearer ${token}`;
        
        return requestConfig;
    }
    
    async signBybitRequest(requestConfig, params, apiKey, apiSecret) {
        const timestamp = Date.now();
        params.api_key = apiKey;
        params.timestamp = timestamp;
        
        // Sort parameters
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((acc, key) => {
                acc[key] = params[key];
                return acc;
            }, {});
        
        // Create signature string
        const signString = this.buildQueryString(sortedParams);
        const signature = await this.createHmacSignature(signString, apiSecret);
        
        params.sign = signature;
        
        if (requestConfig.method === 'GET') {
            requestConfig.url = requestConfig.url.split('?')[0] + '?' + this.buildQueryString(params);
        } else {
            requestConfig.body = JSON.stringify(params);
        }
        
        return requestConfig;
    }
    
    async signOKXRequest(requestConfig, params, apiKey, apiSecret, passphrase) {
        const timestamp = new Date().toISOString();
        const method = requestConfig.method;
        const path = new URL(requestConfig.url).pathname;
        
        // Create signature
        const signString = timestamp + method + path + (requestConfig.body || '');
        const signature = await this.createHmacSignature(signString, apiSecret, 'base64');
        
        // Add headers
        requestConfig.headers['OK-ACCESS-KEY'] = apiKey;
        requestConfig.headers['OK-ACCESS-SIGN'] = signature;
        requestConfig.headers['OK-ACCESS-TIMESTAMP'] = timestamp;
        requestConfig.headers['OK-ACCESS-PASSPHRASE'] = passphrase;
        
        return requestConfig;
    }
    
    // ===== EXCHANGE-SPECIFIC METHODS =====
    
    // Binance
    async getBinanceTicker(symbol) {
        const endpoint = '/api/v3/ticker/24hr';
        const data = await this.makeRequest('binance', 'GET', endpoint, { symbol });
        
        return {
            symbol: data.symbol,
            price: parseFloat(data.lastPrice),
            volume: parseFloat(data.volume),
            high: parseFloat(data.highPrice),
            low: parseFloat(data.lowPrice),
            change: parseFloat(data.priceChangePercent),
            bid: parseFloat(data.bidPrice),
            ask: parseFloat(data.askPrice),
            timestamp: data.closeTime
        };
    }
    
    async getBinanceOrderBook(symbol, limit = 100) {
        const endpoint = '/api/v3/depth';
        const data = await this.makeRequest('binance', 'GET', endpoint, { symbol, limit });
        
        return {
            bids: data.bids.map(([price, quantity]) => ({
                price: parseFloat(price),
                quantity: parseFloat(quantity)
            })),
            asks: data.asks.map(([price, quantity]) => ({
                price: parseFloat(price),
                quantity: parseFloat(quantity)
            })),
            timestamp: Date.now()
        };
    }
    
    async getBinanceKlines(symbol, interval, limit = 500) {
        const endpoint = '/api/v3/klines';
        const data = await this.makeRequest('binance', 'GET', endpoint, {
            symbol,
            interval,
            limit
        });
        
        return data.map(candle => ({
            timestamp: candle[0],
            open: parseFloat(candle[1]),
            high: parseFloat(candle[2]),
            low: parseFloat(candle[3]),
            close: parseFloat(candle[4]),
            volume: parseFloat(candle[5])
        }));
    }
    
    async getBinanceBalance() {
        const endpoint = '/api/v3/account';
        const data = await this.makeRequest('binance', 'GET', endpoint, {}, true);
        
        return data.balances
            .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
            .map(balance => ({
                asset: balance.asset,
                free: parseFloat(balance.free),
                locked: parseFloat(balance.locked),
                total: parseFloat(balance.free) + parseFloat(balance.locked)
            }));
    }
    
    async createBinanceOrder(order) {
        const endpoint = '/api/v3/order';
        const params = {
            symbol: order.symbol,
            side: order.side.toUpperCase(),
            type: order.type.toUpperCase(),
            quantity: order.quantity
        };
        
        if (order.type !== 'MARKET') {
            params.price = order.price;
            params.timeInForce = order.timeInForce || 'GTC';
        }
        
        const data = await this.makeRequest('binance', 'POST', endpoint, params, true);
        
        return {
            orderId: data.orderId,
            symbol: data.symbol,
            side: data.side,
            type: data.type,
            price: parseFloat(data.price || 0),
            quantity: parseFloat(data.origQty),
            status: data.status,
            timestamp: data.transactTime
        };
    }
    
    // Upbit
    async getUpbitTicker(symbol) {
        const endpoint = '/v1/ticker';
        const data = await this.makeRequest('upbit', 'GET', endpoint, { 
            markets: symbol 
        });
        
        const ticker = data[0];
        return {
            symbol: ticker.market,
            price: ticker.trade_price,
            volume: ticker.acc_trade_volume_24h,
            high: ticker.high_price,
            low: ticker.low_price,
            change: ticker.signed_change_rate * 100,
            bid: ticker.highest_bid_price,
            ask: ticker.lowest_ask_price,
            timestamp: ticker.timestamp
        };
    }
    
    // Add more exchange-specific methods...
    
    // ===== WEBSOCKET MANAGEMENT =====
    async initializeWebSockets() {
        // Initialize WebSocket for active exchange
        const exchange = this.exchanges.get(this.activeExchange);
        if (!exchange) return;
        
        const ws = await this.createWebSocket(this.activeExchange);
        this.wsConnections.set(this.activeExchange, ws);
    }
    
    createWebSocket(exchangeId) {
        return new Promise((resolve, reject) => {
            const exchange = this.exchanges.get(exchangeId);
            const wsUrl = exchange.client.wsUrl;
            
            const ws = new WebSocket(wsUrl);
            
            const wsData = {
                ws: ws,
                exchangeId: exchangeId,
                subscriptions: new Set(),
                reconnectAttempts: 0,
                pingInterval: null,
                pongTimeout: null,
                lastPong: Date.now()
            };
            
            ws.onopen = () => {
                console.log(`WebSocket connected to ${exchangeId}`);
                this.emit('ws:connected', { exchange: exchangeId });
                
                // Start ping/pong
                this.startPingPong(wsData);
                
                // Reset reconnect attempts
                wsData.reconnectAttempts = 0;
                
                resolve(wsData);
            };
            
            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleWebSocketMessage(exchangeId, data);
                } catch (error) {
                    console.error('WebSocket message parse error:', error);
                }
            };
            
            ws.onerror = (error) => {
                console.error(`WebSocket error for ${exchangeId}:`, error);
                this.emit('ws:error', { exchange: exchangeId, error });
            };
            
            ws.onclose = () => {
                console.log(`WebSocket disconnected from ${exchangeId}`);
                this.emit('ws:disconnected', { exchange: exchangeId });
                
                // Clean up ping/pong
                this.stopPingPong(wsData);
                
                // Attempt reconnection
                if (this.config.websocket.reconnect) {
                    this.reconnectWebSocket(wsData);
                }
            };
        });
    }
    
    async reconnectWebSocket(wsData) {
        if (wsData.reconnectAttempts >= this.config.websocket.maxReconnectAttempts) {
            console.error(`Max reconnection attempts reached for ${wsData.exchangeId}`);
            this.emit('ws:reconnect_failed', { exchange: wsData.exchangeId });
            return;
        }
        
        wsData.reconnectAttempts++;
        const delay = this.config.websocket.reconnectDelay * wsData.reconnectAttempts;
        
        console.log(`Reconnecting to ${wsData.exchangeId} in ${delay}ms...`);
        
        setTimeout(async () => {
            try {
                const newWsData = await this.createWebSocket(wsData.exchangeId);
                
                // Restore subscriptions
                for (const sub of wsData.subscriptions) {
                    await this.resubscribe(newWsData, sub);
                }
                
                this.wsConnections.set(wsData.exchangeId, newWsData);
                
            } catch (error) {
                console.error('Reconnection failed:', error);
                this.reconnectWebSocket(wsData);
            }
        }, delay);
    }
    
    startPingPong(wsData) {
        // Send ping
        wsData.pingInterval = setInterval(() => {
            if (wsData.ws.readyState === WebSocket.OPEN) {
                wsData.ws.send(JSON.stringify({ ping: Date.now() }));
                
                // Set pong timeout
                wsData.pongTimeout = setTimeout(() => {
                    console.warn(`Pong timeout for ${wsData.exchangeId}`);
                    wsData.ws.close();
                }, this.config.websocket.pongTimeout);
            }
        }, this.config.websocket.pingInterval);
    }
    
    stopPingPong(wsData) {
        if (wsData.pingInterval) {
            clearInterval(wsData.pingInterval);
        }
        if (wsData.pongTimeout) {
            clearTimeout(wsData.pongTimeout);
        }
    }
    
    handleWebSocketMessage(exchangeId, data) {
        // Handle pong
        if (data.pong) {
            const wsData = this.wsConnections.get(exchangeId);
            if (wsData && wsData.pongTimeout) {
                clearTimeout(wsData.pongTimeout);
                wsData.lastPong = Date.now();
            }
            return;
        }
        
        // Route message based on type
        if (data.e) { // Binance format
            this.handleBinanceMessage(data);
        } else if (data.type) { // Upbit format
            this.handleUpbitMessage(data);
        } else if (data.topic) { // Bybit format
            this.handleBybitMessage(data);
        } else if (data.channel) { // OKX format
            this.handleOKXMessage(data);
        }
    }
    
    // WebSocket subscription methods
    async subscribeTicker(symbol, callback) {
        const wsData = this.wsConnections.get(this.activeExchange);
        if (!wsData) throw new Error('WebSocket not connected');
        
        const subscription = {
            type: 'ticker',
            symbol: symbol,
            callback: callback
        };
        
        // Exchange-specific subscription
        switch (this.activeExchange) {
            case 'binance':
                wsData.ws.send(JSON.stringify({
                    method: 'SUBSCRIBE',
                    params: [`${symbol.toLowerCase()}@ticker`],
                    id: Date.now()
                }));
                break;
            case 'upbit':
                wsData.ws.send(JSON.stringify([
                    { ticket: 'unique_ticket' },
                    { type: 'ticker', codes: [symbol] }
                ]));
                break;
            // Add other exchanges...
        }
        
        wsData.subscriptions.add(subscription);
        
        // Store callback
        this.on(`ticker:${symbol}`, callback);
    }
    
    async subscribeOrderBook(symbol, callback) {
        const wsData = this.wsConnections.get(this.activeExchange);
        if (!wsData) throw new Error('WebSocket not connected');
        
        const subscription = {
            type: 'orderbook',
            symbol: symbol,
            callback: callback
        };
        
        // Exchange-specific subscription
        switch (this.activeExchange) {
            case 'binance':
                wsData.ws.send(JSON.stringify({
                    method: 'SUBSCRIBE',
                    params: [`${symbol.toLowerCase()}@depth20@100ms`],
                    id: Date.now()
                }));
                break;
            // Add other exchanges...
        }
        
        wsData.subscriptions.add(subscription);
        this.on(`orderbook:${symbol}`, callback);
    }
    
    async subscribeTrades(symbol, callback) {
        const wsData = this.wsConnections.get(this.activeExchange);
        if (!wsData) throw new Error('WebSocket not connected');
        
        const subscription = {
            type: 'trades',
            symbol: symbol,
            callback: callback
        };
        
        // Exchange-specific subscription
        switch (this.activeExchange) {
            case 'binance':
                wsData.ws.send(JSON.stringify({
                    method: 'SUBSCRIBE',
                    params: [`${symbol.toLowerCase()}@trade`],
                    id: Date.now()
                }));
                break;
            // Add other exchanges...
        }
        
        wsData.subscriptions.add(subscription);
        this.on(`trade:${symbol}`, callback);
    }
    
    // ===== RATE LIMITING =====
    setupRateLimiters() {
        for (const [exchangeId, limits] of Object.entries(this.config.rateLimits)) {
            this.rateLimiters.set(exchangeId, {
                requests: [],
                limit: limits.requests,
                interval: limits.interval
            });
        }
    }
    
    async checkRateLimit(exchangeId) {
        const limiter = this.rateLimiters.get(exchangeId);
        if (!limiter) return;
        
        const now = Date.now();
        const cutoff = now - limiter.interval;
        
        // Remove old requests
        limiter.requests = limiter.requests.filter(time => time > cutoff);
        
        // Check if limit exceeded
        if (limiter.requests.length >= limiter.limit) {
            const oldestRequest = limiter.requests[0];
            const waitTime = oldestRequest + limiter.interval - now;
            
            if (waitTime > 0) {
                console.warn(`Rate limit reached for ${exchangeId}, waiting ${waitTime}ms`);
                await this.sleep(waitTime);
            }
        }
        
        // Add current request
        limiter.requests.push(now);
    }
    
    async handleRateLimit(exchangeId, error) {
        const retryAfter = error.headers?.get('Retry-After');
        const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
        
        console.warn(`Rate limit hit for ${exchangeId}, waiting ${waitTime}ms`);
        this.emit('rateLimit', { exchange: exchangeId, waitTime });
        
        await this.sleep(waitTime);
    }
    
    // ===== CACHING =====
    getCacheKey(config) {
        return `${config.method}:${config.url}`;
    }
    
    getFromCache(key) {
        const cached = this.cache.get(key);
        if (!cached) return null;
        
        if (Date.now() > cached.expires) {
            this.cache.delete(key);
            return null;
        }
        
        return cached.data;
    }
    
    addToCache(key, data, ttl = this.config.cache.ttl) {
        // Check cache size
        if (this.cache.size >= this.config.cache.maxSize) {
            // Remove oldest entry
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
        }
        
        this.cache.set(key, {
            data: data,
            expires: Date.now() + ttl
        });
        
        // Set cleanup timer
        if (this.cacheTimers.has(key)) {
            clearTimeout(this.cacheTimers.get(key));
        }
        
        const timer = setTimeout(() => {
            this.cache.delete(key);
            this.cacheTimers.delete(key);
        }, ttl);
        
        this.cacheTimers.set(key, timer);
    }
    
    clearCache(pattern) {
        if (!pattern) {
            // Clear all
            this.cache.clear();
            this.cacheTimers.forEach(timer => clearTimeout(timer));
            this.cacheTimers.clear();
        } else {
            // Clear matching keys
            for (const [key, timer] of this.cacheTimers) {
                if (key.includes(pattern)) {
                    this.cache.delete(key);
                    clearTimeout(timer);
                    this.cacheTimers.delete(key);
                }
            }
        }
    }
    
    // ===== INTERCEPTORS =====
    setupDefaultInterceptors() {
        // Request logger
        this.addRequestInterceptor(async (config) => {
            console.log(`API Request: ${config.method} ${config.url}`);
            return config;
        });
        
        // Response logger
        this.addResponseInterceptor(async (data, response) => {
            console.log(`API Response: ${response.status} ${response.url}`);
            return data;
        });
        
        // Error handler
        this.addResponseInterceptor(async (data, response) => {
            if (response.status >= 400) {
                const error = new APIError(response.status, data);
                this.emit('api:error', error);
                throw error;
            }
            return data;
        });
    }
    
    addRequestInterceptor(interceptor) {
        this.requestInterceptors.push(interceptor);
    }
    
    addResponseInterceptor(interceptor) {
        this.responseInterceptors.push(interceptor);
    }
    
    // ===== HEALTH MONITORING =====
    startHealthMonitoring() {
        // Check API health every minute
        setInterval(() => {
            this.checkAllAPIs();
        }, 60000);
        
        // Initial check
        this.checkAllAPIs();
    }
    
    async checkAllAPIs() {
        for (const exchangeId of this.exchanges.keys()) {
            this.checkAPIHealth(exchangeId);
        }
    }
    
    async checkAPIHealth(exchangeId) {
        try {
            const startTime = Date.now();
            
            // Simple ping endpoint
            const ticker = await this.exchanges.get(exchangeId).client.getTicker('BTCUSDT');
            
            const latency = Date.now() - startTime;
            
            this.updateApiStatus(exchangeId, 'online', latency);
            
        } catch (error) {
            this.updateApiStatus(exchangeId, 'error', 0, error);
        }
    }
    
    updateApiStatus(exchangeId, status, latency = 0, error = null) {
        const currentStatus = this.apiStatus.get(exchangeId) || {};
        
        this.apiStatus.set(exchangeId, {
            status: status,
            latency: latency,
            lastCheck: Date.now(),
            error: error,
            uptime: status === 'online' ? (currentStatus.uptime || 0) + 1 : 0
        });
        
        this.emit('api:status', {
            exchange: exchangeId,
            status: this.apiStatus.get(exchangeId)
        });
    }
    
    // ===== UTILITIES =====
    getHeaders(exchangeId) {
        const headers = {
            'User-Agent': 'TradingBot/2.1.0',
            'Accept': 'application/json'
        };
        
        // Add exchange-specific headers
        switch (exchangeId) {
            case 'binance':
                headers['X-MBX-APIKEY'] = '';
                break;
            case 'upbit':
                headers['Accept'] = 'application/json';
                break;
            // Add other exchanges...
        }
        
        return headers;
    }
    
    buildQueryString(params) {
        return Object.keys(params)
            .filter(key => params[key] !== undefined && params[key] !== null)
            .map(key => `${key}=${encodeURIComponent(params[key])}`)
            .join('&');
    }
    
    async createHmacSignature(message, secret, encoding = 'hex') {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(secret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            encoder.encode(message)
        );
        
        if (encoding === 'base64') {
            return btoa(String.fromCharCode(...new Uint8Array(signature)));
        } else {
            return Array.from(new Uint8Array(signature))
                .map(b => b.toString(16).padStart(2, '0'))
                .join('');
        }
    }
    
    async createJWT(payload, secret) {
        // Simple JWT implementation
        const header = {
            alg: 'HS256',
            typ: 'JWT'
        };
        
        const encodedHeader = btoa(JSON.stringify(header));
        const encodedPayload = btoa(JSON.stringify(payload));
        
        const message = `${encodedHeader}.${encodedPayload}`;
        const signature = await this.createHmacSignature(message, secret, 'base64');
        
        return `${message}.${signature}`;
    }
    
    generateNonce() {
        return Date.now() + Math.random().toString(36).substring(2);
    }
    
    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    updateLatency(latency) {
        // Exponential moving average
        const alpha = 0.1;
        this.stats.avgLatency = this.stats.avgLatency * (1 - alpha) + latency * alpha;
    }
    
    // ===== PUBLIC API =====
    async switchExchange(exchangeId) {
        if (!this.exchanges.has(exchangeId)) {
            throw new Error(`Exchange ${exchangeId} not configured`);
        }
        
        // Close current WebSocket
        const currentWs = this.wsConnections.get(this.activeExchange);
        if (currentWs) {
            currentWs.ws.close();
        }
        
        // Switch exchange
        this.activeExchange = exchangeId;
        
        // Initialize new WebSocket
        await this.initializeWebSockets();
        
        this.emit('exchange:switched', { exchange: exchangeId });
    }
    
    getActiveExchange() {
        return this.exchanges.get(this.activeExchange);
    }
    
    getStats() {
        return {
            ...this.stats,
            apiStatus: Object.fromEntries(this.apiStatus),
            cacheSize: this.cache.size,
            activeConnections: this.wsConnections.size
        };
    }
    
    // ===== CLEANUP =====
    destroy() {
        // Close all WebSocket connections
        this.wsConnections.forEach(wsData => {
            this.stopPingPong(wsData);
            wsData.ws.close();
        });
        
        // Clear cache
        this.clearCache();
        
        // Clear timers
        this.healthChecks.forEach(timer => clearInterval(timer));
        
        // Clear maps
        this.exchanges.clear();
        this.wsConnections.clear();
        this.rateLimiters.clear();
        this.cache.clear();
        this.cacheTimers.clear();
        this.apiStatus.clear();
        
        // Remove listeners
        this.removeAllListeners();
    }
}

// Custom API Error class
class APIError extends Error {
    constructor(status, data) {
        super(data.msg || data.message || `API Error: ${status}`);
        this.name = 'APIError';
        this.status = status;
        this.code = data.code;
        this.data = data;
    }
}

export default APIModule;