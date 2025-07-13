/**
 * 💰 Trading Bot Trading Engine Module
 * Version: 2.1.0
 * 
 * 🚀 Features:
 * - Advanced order management
 * - Multi-strategy execution
 * - Real-time position tracking
 * - Risk management integration
 * - Market data processing
 * - Performance analytics
 * - Backtesting support
 * 
 * ⚡ Performance:
 * - Low-latency execution
 * - Order queue optimization
 * - Efficient memory usage
 * - WebSocket streaming
 */

'use strict';

/**
 * Trading Engine Class
 */
class TradingEngine {
    constructor(app) {
        this.app = app;
        
        // Engine state
        this.isRunning = false;
        this.isPaused = false;
        this.currentStrategy = null;
        this.strategies = new Map();
        
        // Market data
        this.marketData = new Map();
        this.orderBooks = new Map();
        this.tickers = new Map();
        this.candles = new Map();
        
        // Trading data
        this.orders = new Map();
        this.positions = new Map();
        this.trades = [];
        this.balance = {
            total: 0,
            available: 0,
            locked: 0,
            currency: 'USDT'
        };
        
        // Performance tracking
        this.performance = {
            totalTrades: 0,
            winningTrades: 0,
            losingTrades: 0,
            totalProfit: 0,
            totalLoss: 0,
            maxDrawdown: 0,
            sharpeRatio: 0,
            startBalance: 0,
            peakBalance: 0
        };
        
        // Order management
        this.orderQueue = [];
        this.orderProcessing = false;
        this.maxOrdersPerSecond = 10;
        this.orderNonce = 0;
        
        // WebSocket connections
        this.dataStream = null;
        this.tradingStream = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Risk management
        this.riskManager = null;
        this.positionSizer = null;
        
        // Event handlers
        this.eventHandlers = new Map();
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize trading engine
     */
    async init() {
        try {
            console.log('💰 Initializing trading engine...');
            
            // Load strategies
            await this.loadStrategies();
            
            // Initialize risk manager
            this.initializeRiskManager();
            
            // Initialize position sizer
            this.initializePositionSizer();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            console.log('✅ Trading engine initialized');
            
        } catch (error) {
            console.error('Failed to initialize trading engine:', error);
            throw error;
        }
    }
    
    /**
     * Load trading strategies
     */
    async loadStrategies() {
        // Built-in strategies
        const strategies = {
            grid: new GridStrategy(this),
            dca: new DCAStrategy(this),
            momentum: new MomentumStrategy(this),
            scalping: new ScalpingStrategy(this),
            arbitrage: new ArbitrageStrategy(this),
            ml: new MLStrategy(this)
        };
        
        for (const [name, strategy] of Object.entries(strategies)) {
            this.strategies.set(name, strategy);
            console.log(`📊 Strategy loaded: ${name}`);
        }
    }
    
    /**
     * Initialize risk manager
     */
    initializeRiskManager() {
        this.riskManager = {
            checkOrderRisk: (order) => this.checkOrderRisk(order),
            checkPositionRisk: (position) => this.checkPositionRisk(position),
            checkPortfolioRisk: () => this.checkPortfolioRisk(),
            calculateStopLoss: (entry, direction) => this.calculateStopLoss(entry, direction),
            calculateTakeProfit: (entry, direction) => this.calculateTakeProfit(entry, direction),
            shouldClosePosition: (position) => this.shouldClosePosition(position)
        };
    }
    
    /**
     * Initialize position sizer
     */
    initializePositionSizer() {
        this.positionSizer = {
            calculatePositionSize: (signal) => this.calculatePositionSize(signal),
            adjustForRisk: (size, risk) => this.adjustPositionForRisk(size, risk),
            getMaxPositionSize: (symbol) => this.getMaxPositionSize(symbol),
            getOptimalLeverage: (symbol) => this.getOptimalLeverage(symbol)
        };
    }
    
    /**
     * Start trading engine
     */
    async start(strategyName) {
        try {
            if (this.isRunning) {
                throw new Error('Trading engine already running');
            }
            
            console.log(`🚀 Starting trading engine with strategy: ${strategyName}`);
            
            // Validate strategy
            const strategy = this.strategies.get(strategyName);
            if (!strategy) {
                throw new Error(`Strategy not found: ${strategyName}`);
            }
            
            // Check prerequisites
            await this.checkPrerequisites();
            
            // Set current strategy
            this.currentStrategy = strategy;
            
            // Initialize strategy
            await strategy.initialize();
            
            // Connect to exchange
            await this.connectToExchange();
            
            // Start data feeds
            await this.startDataFeeds();
            
            // Load existing positions
            await this.loadExistingPositions();
            
            // Start order processor
            this.startOrderProcessor();
            
            // Start strategy execution
            await strategy.start();
            
            // Update state
            this.isRunning = true;
            this.performance.startBalance = this.balance.total;
            this.performance.peakBalance = this.balance.total;
            
            // Emit event
            this.app.emit('trading:started', {
                strategy: strategyName,
                balance: this.balance
            });
            
            console.log('✅ Trading engine started successfully');
            
        } catch (error) {
            console.error('Failed to start trading engine:', error);
            await this.stop();
            throw error;
        }
    }
    
    /**
     * Stop trading engine
     */
    async stop() {
        try {
            console.log('🛑 Stopping trading engine...');
            
            this.isRunning = false;
            
            // Stop current strategy
            if (this.currentStrategy) {
                await this.currentStrategy.stop();
            }
            
            // Cancel all open orders
            await this.cancelAllOrders();
            
            // Disconnect from exchange
            await this.disconnectFromExchange();
            
            // Stop order processor
            this.stopOrderProcessor();
            
            // Clear market data
            this.clearMarketData();
            
            // Emit event
            this.app.emit('trading:stopped', {
                performance: this.getPerformanceSummary()
            });
            
            console.log('✅ Trading engine stopped');
            
        } catch (error) {
            console.error('Error stopping trading engine:', error);
        }
    }
    
    /**
     * Pause trading
     */
    pause() {
        this.isPaused = true;
        if (this.currentStrategy && this.currentStrategy.pause) {
            this.currentStrategy.pause();
        }
        console.log('⏸️ Trading paused');
    }
    
    /**
     * Resume trading
     */
    resume() {
        this.isPaused = false;
        if (this.currentStrategy && this.currentStrategy.resume) {
            this.currentStrategy.resume();
        }
        console.log('▶️ Trading resumed');
    }
    
    /**
     * Create order
     */
    async createOrder(params) {
        try {
            if (!this.isRunning || this.isPaused) {
                throw new Error('Trading engine not running');
            }
            
            // Validate order
            this.validateOrder(params);
            
            // Risk check
            const riskApproved = await this.riskManager.checkOrderRisk(params);
            if (!riskApproved) {
                throw new Error('Order rejected by risk manager');
            }
            
            // Create order object
            const order = {
                id: this.generateOrderId(),
                ...params,
                status: 'PENDING',
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            
            // Add to queue
            this.orderQueue.push(order);
            
            // Process immediately if not busy
            if (!this.orderProcessing) {
                this.processOrderQueue();
            }
            
            return order;
            
        } catch (error) {
            console.error('Failed to create order:', error);
            throw error;
        }
    }
    
    /**
     * Cancel order
     */
    async cancelOrder(orderId) {
        try {
            const order = this.orders.get(orderId);
            if (!order) {
                throw new Error(`Order not found: ${orderId}`);
            }
            
            if (order.status !== 'OPEN') {
                throw new Error(`Cannot cancel ${order.status} order`);
            }
            
            // Cancel on exchange
            await this.app.modules.get('api').cancelOrder(order.exchangeId);
            
            // Update order
            order.status = 'CANCELLED';
            order.updatedAt = Date.now();
            
            // Emit event
            this.emitOrderEvent('cancelled', order);
            
            return order;
            
        } catch (error) {
            console.error('Failed to cancel order:', error);
            throw error;
        }
    }
    
    /**
     * Cancel all orders
     */
    async cancelAllOrders(symbol = null) {
        const orders = Array.from(this.orders.values()).filter(order => 
            order.status === 'OPEN' && (!symbol || order.symbol === symbol)
        );
        
        const results = await Promise.allSettled(
            orders.map(order => this.cancelOrder(order.id))
        );
        
        const cancelled = results.filter(r => r.status === 'fulfilled').length;
        console.log(`🚫 Cancelled ${cancelled}/${orders.length} orders`);
        
        return cancelled;
    }
    
    /**
     * Get open orders
     */
    getOpenOrders(symbol = null) {
        return Array.from(this.orders.values()).filter(order =>
            order.status === 'OPEN' && (!symbol || order.symbol === symbol)
        );
    }
    
    /**
     * Get positions
     */
    getPositions(symbol = null) {
        if (symbol) {
            return this.positions.get(symbol) || null;
        }
        return Array.from(this.positions.values());
    }
    
    /**
     * Close position
     */
    async closePosition(symbol, percentage = 100) {
        try {
            const position = this.positions.get(symbol);
            if (!position) {
                throw new Error(`No position for ${symbol}`);
            }
            
            const closeQuantity = (position.quantity * percentage) / 100;
            
            // Create market order to close
            const order = await this.createOrder({
                symbol: symbol,
                side: position.side === 'BUY' ? 'SELL' : 'BUY',
                type: 'MARKET',
                quantity: closeQuantity,
                reduceOnly: true
            });
            
            return order;
            
        } catch (error) {
            console.error('Failed to close position:', error);
            throw error;
        }
    }
    
    /**
     * Close all positions
     */
    async closeAllPositions() {
        const positions = this.getPositions();
        const results = await Promise.allSettled(
            positions.map(pos => this.closePosition(pos.symbol))
        );
        
        const closed = results.filter(r => r.status === 'fulfilled').length;
        console.log(`🔚 Closed ${closed}/${positions.length} positions`);
        
        return closed;
    }
    
    /**
     * Process order queue
     */
    async processOrderQueue() {
        if (this.orderProcessing || this.orderQueue.length === 0) {
            return;
        }
        
        this.orderProcessing = true;
        
        try {
            while (this.orderQueue.length > 0) {
                const order = this.orderQueue.shift();
                
                try {
                    // Submit to exchange
                    const result = await this.submitOrderToExchange(order);
                    
                    // Update order
                    order.exchangeId = result.orderId;
                    order.status = result.status;
                    order.filledQuantity = result.filledQuantity || 0;
                    order.avgPrice = result.avgPrice || 0;
                    
                    // Store order
                    this.orders.set(order.id, order);
                    
                    // Emit event
                    this.emitOrderEvent('created', order);
                    
                    // Rate limiting
                    await this.delay(1000 / this.maxOrdersPerSecond);
                    
                } catch (error) {
                    console.error('Order submission failed:', error);
                    order.status = 'REJECTED';
                    order.error = error.message;
                    this.emitOrderEvent('rejected', order);
                }
            }
        } finally {
            this.orderProcessing = false;
        }
    }
    
    /**
     * Submit order to exchange
     */
    async submitOrderToExchange(order) {
        const api = this.app.modules.get('api');
        
        const params = {
            symbol: order.symbol,
            side: order.side,
            type: order.type,
            quantity: order.quantity
        };
        
        // Add price for limit orders
        if (order.type === 'LIMIT' || order.type === 'STOP_LIMIT') {
            params.price = order.price;
        }
        
        // Add stop price for stop orders
        if (order.type === 'STOP_LOSS' || order.type === 'STOP_LIMIT') {
            params.stopPrice = order.stopPrice;
        }
        
        // Add time in force
        params.timeInForce = order.timeInForce || 'GTC';
        
        // Add reduce only flag
        if (order.reduceOnly) {
            params.reduceOnly = true;
        }
        
        return await api.createOrder(params);
    }
    
    /**
     * Connect to exchange
     */
    async connectToExchange() {
        const api = this.app.modules.get('api');
        const config = this.app.config.get('api');
        
        // Connect to data stream
        this.dataStream = await api.connectDataStream({
            symbols: config.trading.watchlist,
            channels: ['ticker', 'depth', 'trades']
        });
        
        // Connect to user data stream
        this.tradingStream = await api.connectUserStream();
        
        // Setup stream handlers
        this.setupStreamHandlers();
        
        console.log('🔗 Connected to exchange streams');
    }
    
    /**
     * Disconnect from exchange
     */
    async disconnectFromExchange() {
        if (this.dataStream) {
            await this.dataStream.close();
            this.dataStream = null;
        }
        
        if (this.tradingStream) {
            await this.tradingStream.close();
            this.tradingStream = null;
        }
        
        console.log('🔌 Disconnected from exchange');
    }
    
    /**
     * Setup stream handlers
     */
    setupStreamHandlers() {
        // Market data handlers
        if (this.dataStream) {
            this.dataStream.on('ticker', (data) => this.handleTickerUpdate(data));
            this.dataStream.on('depth', (data) => this.handleDepthUpdate(data));
            this.dataStream.on('trade', (data) => this.handleTradeUpdate(data));
            this.dataStream.on('error', (error) => this.handleStreamError('data', error));
            this.dataStream.on('close', () => this.handleStreamClose('data'));
        }
        
        // User data handlers
        if (this.tradingStream) {
            this.tradingStream.on('executionReport', (data) => this.handleOrderUpdate(data));
            this.tradingStream.on('balanceUpdate', (data) => this.handleBalanceUpdate(data));
            this.tradingStream.on('error', (error) => this.handleStreamError('trading', error));
            this.tradingStream.on('close', () => this.handleStreamClose('trading'));
        }
    }
    
    /**
     * Handle ticker update
     */
    handleTickerUpdate(data) {
        const ticker = {
            symbol: data.symbol,
            price: parseFloat(data.price),
            volume: parseFloat(data.volume),
            high: parseFloat(data.high),
            low: parseFloat(data.low),
            change: parseFloat(data.priceChange),
            changePercent: parseFloat(data.priceChangePercent),
            timestamp: data.timestamp
        };
        
        this.tickers.set(data.symbol, ticker);
        
        // Update positions with current price
        this.updatePositionValues(data.symbol, ticker.price);
        
        // Notify strategy
        if (this.currentStrategy && this.currentStrategy.onTickerUpdate) {
            this.currentStrategy.onTickerUpdate(ticker);
        }
    }
    
    /**
     * Handle depth update
     */
    handleDepthUpdate(data) {
        const orderBook = {
            symbol: data.symbol,
            bids: data.bids.map(b => ({ price: parseFloat(b[0]), quantity: parseFloat(b[1]) })),
            asks: data.asks.map(a => ({ price: parseFloat(a[0]), quantity: parseFloat(a[1]) })),
            timestamp: data.timestamp
        };
        
        this.orderBooks.set(data.symbol, orderBook);
        
        // Notify strategy
        if (this.currentStrategy && this.currentStrategy.onDepthUpdate) {
            this.currentStrategy.onDepthUpdate(orderBook);
        }
    }
    
    /**
     * Handle trade update
     */
    handleTradeUpdate(data) {
        const trade = {
            symbol: data.symbol,
            price: parseFloat(data.price),
            quantity: parseFloat(data.quantity),
            side: data.isBuyerMaker ? 'SELL' : 'BUY',
            timestamp: data.timestamp
        };
        
        // Store recent trades
        if (!this.marketData.has(data.symbol)) {
            this.marketData.set(data.symbol, { trades: [] });
        }
        
        const marketData = this.marketData.get(data.symbol);
        marketData.trades.push(trade);
        
        // Keep only recent trades
        if (marketData.trades.length > 1000) {
            marketData.trades = marketData.trades.slice(-500);
        }
        
        // Notify strategy
        if (this.currentStrategy && this.currentStrategy.onTradeUpdate) {
            this.currentStrategy.onTradeUpdate(trade);
        }
    }
    
    /**
     * Handle order update
     */
    handleOrderUpdate(data) {
        const orderId = this.findOrderByExchangeId(data.orderId);
        if (!orderId) return;
        
        const order = this.orders.get(orderId);
        if (!order) return;
        
        // Update order status
        const previousStatus = order.status;
        order.status = data.orderStatus;
        order.filledQuantity = parseFloat(data.filledQuantity);
        order.avgPrice = parseFloat(data.avgPrice || 0);
        order.updatedAt = Date.now();
        
        // Handle order fills
        if (data.orderStatus === 'FILLED' || data.orderStatus === 'PARTIALLY_FILLED') {
            this.handleOrderFill(order, data);
        }
        
        // Emit appropriate event
        if (previousStatus !== order.status) {
            if (order.status === 'FILLED') {
                this.emitOrderEvent('filled', order);
            } else if (order.status === 'PARTIALLY_FILLED') {
                this.emitOrderEvent('partiallyFilled', order);
            } else if (order.status === 'CANCELLED') {
                this.emitOrderEvent('cancelled', order);
            } else if (order.status === 'REJECTED') {
                this.emitOrderEvent('rejected', order);
            }
        }
    }
    
    /**
     * Handle order fill
     */
    handleOrderFill(order, fillData) {
        const trade = {
            id: this.generateTradeId(),
            orderId: order.id,
            symbol: order.symbol,
            side: order.side,
            price: parseFloat(fillData.price),
            quantity: parseFloat(fillData.quantity),
            fee: parseFloat(fillData.fee || 0),
            feeAsset: fillData.feeAsset,
            timestamp: fillData.timestamp,
            profit: 0
        };
        
        // Calculate profit if closing position
        const position = this.positions.get(order.symbol);
        if (position && order.side !== position.side) {
            trade.profit = this.calculateTradeProfit(trade, position);
        }
        
        // Store trade
        this.trades.push(trade);
        
        // Update position
        this.updatePosition(trade);
        
        // Update performance
        this.updatePerformance(trade);
        
        // Notify strategy
        if (this.currentStrategy && this.currentStrategy.onOrderFill) {
            this.currentStrategy.onOrderFill(order, trade);
        }
    }
    
    /**
     * Handle balance update
     */
    handleBalanceUpdate(data) {
        if (data.asset === this.balance.currency) {
            this.balance.available = parseFloat(data.free);
            this.balance.locked = parseFloat(data.locked);
            this.balance.total = this.balance.available + this.balance.locked;
            
            // Update peak balance
            if (this.balance.total > this.performance.peakBalance) {
                this.performance.peakBalance = this.balance.total;
            }
            
            // Calculate drawdown
            const drawdown = ((this.performance.peakBalance - this.balance.total) / 
                              this.performance.peakBalance) * 100;
            
            if (drawdown > this.performance.maxDrawdown) {
                this.performance.maxDrawdown = drawdown;
            }
            
            // Emit event
            this.app.emit('balance:updated', this.balance);
        }
    }
    
    /**
     * Update position
     */
    updatePosition(trade) {
        const position = this.positions.get(trade.symbol) || {
            symbol: trade.symbol,
            side: null,
            quantity: 0,
            avgPrice: 0,
            value: 0,
            unrealizedPnL: 0,
            realizedPnL: 0,
            openTime: null
        };
        
        if (position.quantity === 0) {
            // New position
            position.side = trade.side;
            position.quantity = trade.quantity;
            position.avgPrice = trade.price;
            position.openTime = trade.timestamp;
        } else if (position.side === trade.side) {
            // Adding to position
            const totalValue = (position.quantity * position.avgPrice) + 
                              (trade.quantity * trade.price);
            position.quantity += trade.quantity;
            position.avgPrice = totalValue / position.quantity;
        } else {
            // Reducing position
            const closeQuantity = Math.min(position.quantity, trade.quantity);
            const profit = this.calculatePositionProfit(
                position.avgPrice,
                trade.price,
                closeQuantity,
                position.side
            );
            
            position.realizedPnL += profit;
            position.quantity -= closeQuantity;
            
            if (position.quantity === 0) {
                // Position closed
                this.positions.delete(trade.symbol);
                return;
            }
        }
        
        // Update position value
        const currentPrice = this.tickers.get(trade.symbol)?.price || trade.price;
        position.value = position.quantity * currentPrice;
        position.unrealizedPnL = this.calculatePositionProfit(
            position.avgPrice,
            currentPrice,
            position.quantity,
            position.side
        );
        
        this.positions.set(trade.symbol, position);
    }
    
    /**
     * Calculate position profit
     */
    calculatePositionProfit(entryPrice, exitPrice, quantity, side) {
        if (side === 'BUY') {
            return (exitPrice - entryPrice) * quantity;
        } else {
            return (entryPrice - exitPrice) * quantity;
        }
    }
    
    /**
     * Calculate trade profit
     */
    calculateTradeProfit(trade, position) {
        const profit = this.calculatePositionProfit(
            position.avgPrice,
            trade.price,
            trade.quantity,
            position.side
        );
        
        return profit - trade.fee;
    }
    
    /**
     * Update performance metrics
     */
    updatePerformance(trade) {
        this.performance.totalTrades++;
        
        if (trade.profit > 0) {
            this.performance.winningTrades++;
            this.performance.totalProfit += trade.profit;
        } else if (trade.profit < 0) {
            this.performance.losingTrades++;
            this.performance.totalLoss += Math.abs(trade.profit);
        }
        
        // Calculate win rate
        const winRate = this.performance.totalTrades > 0 
            ? (this.performance.winningTrades / this.performance.totalTrades) * 100 
            : 0;
        
        // Calculate profit factor
        const profitFactor = this.performance.totalLoss > 0 
            ? this.performance.totalProfit / this.performance.totalLoss 
            : this.performance.totalProfit > 0 ? Infinity : 0;
        
        // Update UI
        this.app.emit('performance:updated', {
            ...this.performance,
            winRate,
            profitFactor
        });
    }
    
    /**
     * Update position values with current price
     */
    updatePositionValues(symbol, currentPrice) {
        const position = this.positions.get(symbol);
        if (!position) return;
        
        position.value = position.quantity * currentPrice;
        position.unrealizedPnL = this.calculatePositionProfit(
            position.avgPrice,
            currentPrice,
            position.quantity,
            position.side
        );
        
        // Check stop loss / take profit
        if (this.shouldClosePosition(position)) {
            this.closePosition(symbol).catch(console.error);
        }
    }
    
    /**
     * Risk management methods
     */
    async checkOrderRisk(order) {
        const config = this.app.config.get('risk');
        
        // Check if risk management is enabled
        if (!config.enabled) return true;
        
        // Calculate position value
        const price = order.price || this.tickers.get(order.symbol)?.price || 0;
        const positionValue = order.quantity * price;
        
        // Check position size limit
        const maxPositionValue = this.balance.total * config.maxPositionRisk;
        if (positionValue > maxPositionValue) {
            console.warn(`Order exceeds position risk limit: ${positionValue} > ${maxPositionValue}`);
            return false;
        }
        
        // Check daily loss limit
        const dailyLoss = this.calculateDailyLoss();
        if (dailyLoss >= this.balance.total * config.maxDailyLoss) {
            console.warn('Daily loss limit reached');
            return false;
        }
        
        // Check portfolio risk
        const portfolioRisk = this.calculatePortfolioRisk();
        if (portfolioRisk > config.maxPortfolioRisk) {
            console.warn(`Portfolio risk too high: ${portfolioRisk}`);
            return false;
        }
        
        return true;
    }
    
    checkPositionRisk(position) {
        const config = this.app.config.get('risk');
        const currentPrice = this.tickers.get(position.symbol)?.price || position.avgPrice;
        
        // Calculate current loss percentage
        const lossPercent = Math.abs(position.unrealizedPnL) / (position.avgPrice * position.quantity);
        
        // Check if loss exceeds limit
        return lossPercent <= config.defaultStopLoss;
    }
    
    checkPortfolioRisk() {
        // Calculate total portfolio risk
        let totalRisk = 0;
        
        for (const position of this.positions.values()) {
            const positionRisk = Math.abs(position.unrealizedPnL) / this.balance.total;
            totalRisk += positionRisk;
        }
        
        const config = this.app.config.get('risk');
        return totalRisk <= config.maxPortfolioRisk;
    }
    
    calculateStopLoss(entryPrice, direction) {
        const config = this.app.config.get('risk');
        const stopLossPercent = config.defaultStopLoss;
        
        if (direction === 'BUY') {
            return entryPrice * (1 - stopLossPercent);
        } else {
            return entryPrice * (1 + stopLossPercent);
        }
    }
    
    calculateTakeProfit(entryPrice, direction) {
        const config = this.app.config.get('risk');
        const takeProfitPercent = config.defaultTakeProfit;
        
        if (direction === 'BUY') {
            return entryPrice * (1 + takeProfitPercent);
        } else {
            return entryPrice * (1 - takeProfitPercent);
        }
    }
    
    shouldClosePosition(position) {
        const config = this.app.config.get('risk');
        if (!config.enabled) return false;
        
        const currentPrice = this.tickers.get(position.symbol)?.price;
        if (!currentPrice) return false;
        
        // Check stop loss
        const lossPercent = position.unrealizedPnL / (position.avgPrice * position.quantity);
        if (lossPercent <= -config.defaultStopLoss) {
            console.log(`🛑 Stop loss triggered for ${position.symbol}`);
            return true;
        }
        
        // Check take profit
        const profitPercent = position.unrealizedPnL / (position.avgPrice * position.quantity);
        if (profitPercent >= config.defaultTakeProfit) {
            console.log(`💰 Take profit triggered for ${position.symbol}`);
            return true;
        }
        
        // Check trailing stop
        if (config.trailingStop && position.highestPrice) {
            const fromHigh = (position.highestPrice - currentPrice) / position.highestPrice;
            if (fromHigh >= config.trailingStopDistance) {
                console.log(`📉 Trailing stop triggered for ${position.symbol}`);
                return true;
            }
        }
        
        return false;
    }
    
    /**
     * Position sizing methods
     */
    calculatePositionSize(signal) {
        const config = this.app.config.get('trading');
        const riskConfig = this.app.config.get('risk');
        
        // Base position size
        let size = this.balance.available * config.defaultPositionSize;
        
        // Adjust for signal strength
        if (signal.confidence) {
            size *= signal.confidence;
        }
        
        // Apply Kelly Criterion if enabled
        if (signal.winProbability && signal.winLossRatio) {
            const kelly = this.kellyFormula(signal.winProbability, signal.winLossRatio);
            size *= Math.min(kelly, 0.25); // Cap at 25%
        }
        
        // Ensure within limits
        size = Math.max(size, this.balance.available * config.minPositionSize);
        size = Math.min(size, this.balance.available * config.maxPositionSize);
        
        return size;
    }
    
    adjustPositionForRisk(size, risk) {
        // Reduce size based on risk level
        const riskMultiplier = {
            low: 1.0,
            medium: 0.7,
            high: 0.4,
            extreme: 0.1
        };
        
        return size * (riskMultiplier[risk] || 0.5);
    }
    
    getMaxPositionSize(symbol) {
        const config = this.app.config.get('trading');
        const riskConfig = this.app.config.get('risk');
        
        // Check existing exposure
        const currentPosition = this.positions.get(symbol);
        const currentExposure = currentPosition ? currentPosition.value : 0;
        
        // Maximum allowed
        const maxAllowed = this.balance.total * config.maxPositionSize;
        
        return Math.max(0, maxAllowed - currentExposure);
    }
    
    getOptimalLeverage(symbol) {
        const volatility = this.calculateVolatility(symbol);
        const riskConfig = this.app.config.get('risk');
        
        // Lower leverage for higher volatility
        const baseLevel = riskConfig.maxLeverage;
        const volAdjustment = Math.min(volatility * 10, 0.8);
        
        return Math.max(1, Math.floor(baseLevel * (1 - volAdjustment)));
    }
    
    /**
     * Kelly Formula for position sizing
     */
    kellyFormula(winProbability, winLossRatio) {
        // f = (p * b - q) / b
        // where: f = fraction of capital to bet
        //        p = probability of winning
        //        q = probability of losing (1 - p)
        //        b = win/loss ratio
        
        const q = 1 - winProbability;
        const kelly = (winProbability * winLossRatio - q) / winLossRatio;
        
        return Math.max(0, kelly);
    }
    
    /**
     * Calculate volatility
     */
    calculateVolatility(symbol, period = 20) {
        const candles = this.candles.get(symbol);
        if (!candles || candles.length < period) return 0.02; // Default 2%
        
        const returns = [];
        for (let i = 1; i < period && i < candles.length; i++) {
            const ret = (candles[i].close - candles[i-1].close) / candles[i-1].close;
            returns.push(ret);
        }
        
        // Calculate standard deviation
        const mean = returns.reduce((a, b) => a + b) / returns.length;
        const variance = returns.reduce((sum, ret) => sum + Math.pow(ret - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance);
    }
    
    /**
     * Calculate daily loss
     */
    calculateDailyLoss() {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        const todayTrades = this.trades.filter(t => t.timestamp >= todayStart);
        
        return todayTrades.reduce((loss, trade) => {
            return loss + (trade.profit < 0 ? Math.abs(trade.profit) : 0);
        }, 0);
    }
    
    /**
     * Calculate portfolio risk
     */
    calculatePortfolioRisk() {
        let totalRisk = 0;
        
        for (const position of this.positions.values()) {
            const positionRisk = Math.abs(position.unrealizedPnL) / this.balance.total;
            totalRisk += positionRisk;
        }
        
        return totalRisk;
    }
    
    /**
     * Performance analysis
     */
    getPerformanceSummary() {
        const totalReturn = ((this.balance.total - this.performance.startBalance) / 
                            this.performance.startBalance) * 100;
        
        const winRate = this.performance.totalTrades > 0 
            ? (this.performance.winningTrades / this.performance.totalTrades) * 100 
            : 0;
        
        const avgWin = this.performance.winningTrades > 0
            ? this.performance.totalProfit / this.performance.winningTrades
            : 0;
        
        const avgLoss = this.performance.losingTrades > 0
            ? this.performance.totalLoss / this.performance.losingTrades
            : 0;
        
        const profitFactor = avgLoss > 0 ? avgWin / avgLoss : avgWin > 0 ? Infinity : 0;
        
        const expectancy = this.performance.totalTrades > 0
            ? (this.performance.totalProfit - this.performance.totalLoss) / this.performance.totalTrades
            : 0;
        
        return {
            totalReturn,
            winRate,
            totalTrades: this.performance.totalTrades,
            winningTrades: this.performance.winningTrades,
            losingTrades: this.performance.losingTrades,
            avgWin,
            avgLoss,
            profitFactor,
            expectancy,
            maxDrawdown: this.performance.maxDrawdown,
            sharpeRatio: this.calculateSharpeRatio()
        };
    }
    
    /**
     * Calculate Sharpe Ratio
     */
    calculateSharpeRatio(riskFreeRate = 0.02) {
        if (this.trades.length < 2) return 0;
        
        // Calculate returns
        const returns = [];
        let capital = this.performance.startBalance;
        
        for (const trade of this.trades) {
            const ret = trade.profit / capital;
            returns.push(ret);
            capital += trade.profit;
        }
        
        // Calculate average return
        const avgReturn = returns.reduce((a, b) => a + b) / returns.length;
        
        // Calculate standard deviation
        const variance = returns.reduce((sum, ret) => 
            sum + Math.pow(ret - avgReturn, 2), 0
        ) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        // Sharpe ratio = (return - risk free rate) / standard deviation
        const annualizedReturn = avgReturn * 252; // Assuming daily returns
        const annualizedStdDev = stdDev * Math.sqrt(252);
        
        return stdDev > 0 ? (annualizedReturn - riskFreeRate) / annualizedStdDev : 0;
    }
    
    /**
     * Helper methods
     */
    generateOrderId() {
        return `ORD_${Date.now()}_${++this.orderNonce}`;
    }
    
    generateTradeId() {
        return `TRD_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    findOrderByExchangeId(exchangeId) {
        for (const [orderId, order] of this.orders) {
            if (order.exchangeId === exchangeId) {
                return orderId;
            }
        }
        return null;
    }
    
    validateOrder(params) {
        const required = ['symbol', 'side', 'type', 'quantity'];
        for (const field of required) {
            if (!params[field]) {
                throw new Error(`Missing required field: ${field}`);
            }
        }
        
        // Validate side
        if (!['BUY', 'SELL'].includes(params.side)) {
            throw new Error('Invalid order side');
        }
        
        // Validate type
        const validTypes = ['MARKET', 'LIMIT', 'STOP_LOSS', 'STOP_LIMIT', 'TAKE_PROFIT'];
        if (!validTypes.includes(params.type)) {
            throw new Error('Invalid order type');
        }
        
        // Validate quantity
        if (params.quantity <= 0) {
            throw new Error('Invalid quantity');
        }
        
        // Validate price for limit orders
        if (['LIMIT', 'STOP_LIMIT'].includes(params.type) && !params.price) {
            throw new Error('Price required for limit orders');
        }
    }
    
    async checkPrerequisites() {
        // Check API connection
        if (!this.app.modules.has('api')) {
            throw new Error('API module not available');
        }
        
        // Check balance
        await this.loadAccountBalance();
        if (this.balance.available <= 0) {
            throw new Error('Insufficient balance');
        }
        
        // Check risk settings
        const riskConfig = this.app.config.get('risk');
        if (riskConfig.enabled && !this.validateRiskSettings()) {
            throw new Error('Invalid risk settings');
        }
    }
    
    validateRiskSettings() {
        const config = this.app.config.get('risk');
        
        // Validate risk parameters
        if (config.maxDailyLoss <= 0 || config.maxDailyLoss > 1) {
            return false;
        }
        
        if (config.maxPositionRisk <= 0 || config.maxPositionRisk > 1) {
            return false;
        }
        
        return true;
    }
    
    async loadAccountBalance() {
        const api = this.app.modules.get('api');
        const account = await api.getAccount();
        
        const asset = this.balance.currency;
        const balance = account.balances.find(b => b.asset === asset);
        
        if (balance) {
            this.balance.available = parseFloat(balance.free);
            this.balance.locked = parseFloat(balance.locked);
            this.balance.total = this.balance.available + this.balance.locked;
        }
    }
    
    async loadExistingPositions() {
        const api = this.app.modules.get('api');
        const positions = await api.getPositions();
        
        for (const pos of positions) {
            if (pos.positionAmt !== 0) {
                this.positions.set(pos.symbol, {
                    symbol: pos.symbol,
                    side: pos.positionAmt > 0 ? 'BUY' : 'SELL',
                    quantity: Math.abs(pos.positionAmt),
                    avgPrice: parseFloat(pos.entryPrice),
                    value: Math.abs(pos.positionAmt) * parseFloat(pos.markPrice),
                    unrealizedPnL: parseFloat(pos.unRealizedProfit),
                    realizedPnL: 0,
                    openTime: Date.now()
                });
            }
        }
    }
    
    async startDataFeeds() {
        const symbols = this.app.config.get('trading.watchlist');
        const interval = this.app.config.get('trading.candleInterval');
        
        // Start candle data collection
        for (const symbol of symbols) {
            await this.loadHistoricalCandles(symbol, interval);
            this.startCandleStream(symbol, interval);
        }
    }
    
    async loadHistoricalCandles(symbol, interval, limit = 500) {
        const api = this.app.modules.get('api');
        const candles = await api.getCandles(symbol, interval, limit);
        
        this.candles.set(symbol, candles.map(c => ({
            openTime: c[0],
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseFloat(c[5]),
            closeTime: c[6]
        })));
    }
    
    startCandleStream(symbol, interval) {
        // Subscribe to candle updates
        if (this.dataStream) {
            this.dataStream.subscribe(`${symbol.toLowerCase()}@kline_${interval}`);
        }
    }
    
    clearMarketData() {
        this.marketData.clear();
        this.orderBooks.clear();
        this.tickers.clear();
        this.candles.clear();
    }
    
    setupEventHandlers() {
        // Strategy events
        this.on('signal:buy', (signal) => this.handleBuySignal(signal));
        this.on('signal:sell', (signal) => this.handleSellSignal(signal));
        this.on('signal:close', (signal) => this.handleCloseSignal(signal));
    }
    
    async handleBuySignal(signal) {
        try {
            // Calculate position size
            const size = this.positionSizer.calculatePositionSize(signal);
            
            // Create order
            const order = await this.createOrder({
                symbol: signal.symbol,
                side: 'BUY',
                type: signal.orderType || 'MARKET',
                quantity: size,
                price: signal.price,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit
            });
            
            console.log(`📈 Buy signal executed: ${signal.symbol}`);
            
        } catch (error) {
            console.error('Failed to execute buy signal:', error);
        }
    }
    
    async handleSellSignal(signal) {
        try {
            // Calculate position size
            const size = this.positionSizer.calculatePositionSize(signal);
            
            // Create order
            const order = await this.createOrder({
                symbol: signal.symbol,
                side: 'SELL',
                type: signal.orderType || 'MARKET',
                quantity: size,
                price: signal.price,
                stopLoss: signal.stopLoss,
                takeProfit: signal.takeProfit
            });
            
            console.log(`📉 Sell signal executed: ${signal.symbol}`);
            
        } catch (error) {
            console.error('Failed to execute sell signal:', error);
        }
    }
    
    async handleCloseSignal(signal) {
        try {
            await this.closePosition(signal.symbol, signal.percentage || 100);
            console.log(`🔚 Close signal executed: ${signal.symbol}`);
        } catch (error) {
            console.error('Failed to execute close signal:', error);
        }
    }
    
    handleStreamError(type, error) {
        console.error(`Stream error (${type}):`, error);
        
        // Attempt reconnection
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            setTimeout(() => {
                console.log(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);
                this.reconnectStream(type);
            }, 5000 * this.reconnectAttempts);
        }
    }
    
    handleStreamClose(type) {
        console.warn(`Stream closed: ${type}`);
        this.handleStreamError(type, new Error('Stream closed'));
    }
    
    async reconnectStream(type) {
        try {
            if (type === 'data') {
                await this.connectToExchange();
            } else if (type === 'trading') {
                // Reconnect trading stream
                const api = this.app.modules.get('api');
                this.tradingStream = await api.connectUserStream();
                this.setupStreamHandlers();
            }
            
            this.reconnectAttempts = 0;
            console.log(`✅ Stream reconnected: ${type}`);
            
        } catch (error) {
            this.handleStreamError(type, error);
        }
    }
    
    startOrderProcessor() {
        this.orderProcessorInterval = setInterval(() => {
            if (this.orderQueue.length > 0 && !this.orderProcessing) {
                this.processOrderQueue();
            }
        }, 100);
    }
    
    stopOrderProcessor() {
        if (this.orderProcessorInterval) {
            clearInterval(this.orderProcessorInterval);
            this.orderProcessorInterval = null;
        }
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    on(event, handler) {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event).push(handler);
    }
    
    emit(event, data) {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => {
                try {
                    handler(data);
                } catch (error) {
                    console.error(`Event handler error (${event}):`, error);
                }
            });
        }
    }
    
    emitOrderEvent(type, order) {
        this.emit(`order:${type}`, order);
        this.app.emit(`order:${type}`, order);
    }
    
    /**
     * Get engine status
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            isPaused: this.isPaused,
            strategy: this.currentStrategy?.name || 'none',
            balance: this.balance,
            positions: this.positions.size,
            openOrders: this.getOpenOrders().length,
            performance: this.getPerformanceSummary()
        };
    }
    
    /**
     * Export trading data
     */
    exportTradingData() {
        return {
            trades: this.trades,
            orders: Array.from(this.orders.values()),
            positions: Array.from(this.positions.values()),
            performance: this.getPerformanceSummary(),
            exportDate: new Date().toISOString()
        };
    }
    
    /**
     * Destroy trading engine
     */
    async destroy() {
        await this.stop();
        
        // Clear all data
        this.orders.clear();
        this.positions.clear();
        this.trades = [];
        this.marketData.clear();
        this.strategies.clear();
        this.eventHandlers.clear();
        
        console.log('Trading engine destroyed');
    }
}

/**
 * Base Strategy Class
 */
class BaseStrategy {
    constructor(engine) {
        this.engine = engine;
        this.name = 'base';
        this.isActive = false;
        this.config = {};
    }
    
    async initialize() {
        this.config = this.engine.app.config.get(`strategies.${this.name}`);
        console.log(`🎯 Strategy initialized: ${this.name}`);
    }
    
    async start() {
        this.isActive = true;
        console.log(`▶️ Strategy started: ${this.name}`);
    }
    
    async stop() {
        this.isActive = false;
        console.log(`⏹️ Strategy stopped: ${this.name}`);
    }
    
    pause() {
        this.isActive = false;
    }
    
    resume() {
        this.isActive = true;
    }
    
    // Override these in specific strategies
    onTickerUpdate(ticker) {}
    onDepthUpdate(orderBook) {}
    onTradeUpdate(trade) {}
    onOrderFill(order, trade) {}
}

/**
 * Grid Trading Strategy
 */
class GridStrategy extends BaseStrategy {
    constructor(engine) {
        super(engine);
        this.name = 'grid';
        this.grids = new Map();
        this.gridOrders = new Map();
    }
    
    async start() {
        await super.start();
        
        // Setup grids for each symbol
        const symbols = this.engine.app.config.get('trading.watchlist');
        for (const symbol of symbols) {
            await this.setupGrid(symbol);
        }
    }
    
    async setupGrid(symbol) {
        const ticker = this.engine.tickers.get(symbol);
        if (!ticker) return;
        
        const currentPrice = ticker.price;
        const gridLevels = this.config.gridLevels;
        const gridSpacing = this.config.gridSpacing;
        const investment = this.config.totalInvestment / gridLevels;
        
        const grids = [];
        
        // Create grid levels
        for (let i = 0; i < gridLevels; i++) {
            const offset = (i - gridLevels / 2) * gridSpacing;
            const price = currentPrice * (1 + offset);
            
            grids.push({
                level: i,
                price: price,
                quantity: investment / price,
                side: offset < 0 ? 'BUY' : 'SELL',
                filled: false
            });
        }
        
        this.grids.set(symbol, grids);
        
        // Place initial orders
        await this.placeGridOrders(symbol);
    }
    
    async placeGridOrders(symbol) {
        const grids = this.grids.get(symbol);
        if (!grids) return;
        
        for (const grid of grids) {
            if (!grid.filled && !grid.orderId) {
                try {
                    const order = await this.engine.createOrder({
                        symbol: symbol,
                        side: grid.side,
                        type: 'LIMIT',
                        quantity: grid.quantity,
                        price: grid.price
                    });
                    
                    grid.orderId = order.id;
                    
                } catch (error) {
                    console.error(`Failed to place grid order: ${error.message}`);
                }
            }
        }
    }
    
    async onOrderFill(order, trade) {
        if (!this.isActive) return;
        
        // Find the grid level
        const grids = this.grids.get(order.symbol);
        if (!grids) return;
        
        const grid = grids.find(g => g.orderId === order.id);
        if (!grid) return;
        
        grid.filled = true;
        grid.orderId = null;
        
        // Place opposite order
        const oppositeGrid = {
            price: order.side === 'BUY' 
                ? order.avgPrice * (1 + this.config.profitPerGrid)
                : order.avgPrice * (1 - this.config.profitPerGrid),
            quantity: order.filledQuantity,
            side: order.side === 'BUY' ? 'SELL' : 'BUY'
        };
        
        try {
            const newOrder = await this.engine.createOrder({
                symbol: order.symbol,
                side: oppositeGrid.side,
                type: 'LIMIT',
                quantity: oppositeGrid.quantity,
                price: oppositeGrid.price
            });
            
            console.log(`🔲 Grid order placed: ${oppositeGrid.side} ${order.symbol} @ ${oppositeGrid.price}`);
            
        } catch (error) {
            console.error('Failed to place opposite grid order:', error);
        }
    }
}

/**
 * DCA (Dollar Cost Averaging) Strategy
 */
class DCAStrategy extends BaseStrategy {
    constructor(engine) {
        super(engine);
        this.name = 'dca';
        this.lastBuyTime = new Map();
        this.buyCount = new Map();
    }
    
    async start() {
        await super.start();
        
        // Start DCA timer
        this.dcaInterval = setInterval(() => {
            this.checkDCAConditions();
        }, 60000); // Check every minute
    }
    
    async stop() {
        await super.stop();
        
        if (this.dcaInterval) {
            clearInterval(this.dcaInterval);
        }
    }
    
    async checkDCAConditions() {
        if (!this.isActive) return;
        
        const symbols = this.engine.app.config.get('trading.watchlist');
        
        for (const symbol of symbols) {
            const lastBuy = this.lastBuyTime.get(symbol) || 0;
            const timeSinceLastBuy = Date.now() - lastBuy;
            
            // Check if enough time has passed
            if (timeSinceLastBuy >= this.config.interval) {
                await this.executeDCA(symbol);
            }
        }
    }
    
    async executeDCA(symbol) {
        const ticker = this.engine.tickers.get(symbol);
        if (!ticker) return;
        
        const buyCount = this.buyCount.get(symbol) || 0;
        if (buyCount >= this.config.maxOrders) return;
        
        // Calculate buy amount
        let amount = this.config.amount;
        
        // Apply martingale if enabled
        if (this.config.martingale && buyCount > 0) {
            amount *= Math.pow(this.config.martingaleMultiplier, buyCount);
        }
        
        const quantity = amount / ticker.price;
        
        try {
            const order = await this.engine.createOrder({
                symbol: symbol,
                side: 'BUY',
                type: 'MARKET',
                quantity: quantity
            });
            
            this.lastBuyTime.set(symbol, Date.now());
            this.buyCount.set(symbol, buyCount + 1);
            
            console.log(`💵 DCA buy executed: ${symbol} - Order ${buyCount + 1}/${this.config.maxOrders}`);
            
        } catch (error) {
            console.error('DCA order failed:', error);
        }
    }
    
    onTickerUpdate(ticker) {
        if (!this.isActive) return;
        
        // Check for profit target
        const position = this.engine.positions.get(ticker.symbol);
        if (!position) return;
        
        const profitPercent = ((ticker.price - position.avgPrice) / position.avgPrice) * 100;
        
        if (profitPercent >= this.config.takeProfit * 100) {
            // Take profit
            this.engine.closePosition(ticker.symbol).then(() => {
                console.log(`💰 DCA take profit: ${ticker.symbol} @ ${profitPercent.toFixed(2)}%`);
                
                // Reset counters
                this.buyCount.delete(ticker.symbol);
                this.lastBuyTime.delete(ticker.symbol);
            });
        }
    }
}

/**
 * Momentum Strategy
 */
class MomentumStrategy extends BaseStrategy {
    constructor(engine) {
        super(engine);
        this.name = 'momentum';
        this.indicators = new Map();
    }
    
    async start() {
        await super.start();
        
        // Initialize indicators
        const symbols = this.engine.app.config.get('trading.watchlist');
        for (const symbol of symbols) {
            this.initializeIndicators(symbol);
        }
    }
    
    initializeIndicators(symbol) {
        this.indicators.set(symbol, {
            rsi: [],
            macd: { line: [], signal: [], histogram: [] },
            volume: [],
            signals: []
        });
    }
    
    onTickerUpdate(ticker) {
        if (!this.isActive) return;
        
        // Update indicators
        this.updateIndicators(ticker.symbol);
        
        // Check for signals
        const signal = this.checkMomentumSignals(ticker.symbol);
        if (signal) {
            this.executeSignal(signal);
        }
    }
    
    updateIndicators(symbol) {
        const candles = this.engine.candles.get(symbol);
        if (!candles || candles.length < 50) return;
        
        const indicators = this.indicators.get(symbol);
        
        // Calculate RSI
        const closes = candles.map(c => c.close);
        indicators.rsi = this.calculateRSI(closes, this.config.rsiPeriod);
        
        // Calculate MACD
        indicators.macd = this.calculateMACD(
            closes,
            this.config.macdFast,
            this.config.macdSlow,
            this.config.macdSignal
        );
        
        // Volume analysis
        const volumes = candles.map(c => c.volume);
        const avgVolume = volumes.slice(-20).reduce((a, b) => a + b) / 20;
        indicators.currentVolume = candles[candles.length - 1].volume;
        indicators.volumeRatio = indicators.currentVolume / avgVolume;
    }
    
    checkMomentumSignals(symbol) {
        const indicators = this.indicators.get(symbol);
        if (!indicators) return null;
        
        const lastRSI = indicators.rsi[indicators.rsi.length - 1];
        const lastMACD = indicators.macd.histogram[indicators.macd.histogram.length - 1];
        const prevMACD = indicators.macd.histogram[indicators.macd.histogram.length - 2];
        
        // Buy signal
        if (lastRSI < this.config.rsiOversold &&
            lastMACD > prevMACD &&
            indicators.volumeRatio > this.config.volumeThreshold) {
            
            return {
                symbol: symbol,
                side: 'BUY',
                strength: 0.8,
                reason: 'Oversold with MACD reversal and high volume'
            };
        }
        
        // Sell signal
        if (lastRSI > this.config.rsiOverbought &&
            lastMACD < prevMACD &&
            indicators.volumeRatio > this.config.volumeThreshold) {
            
            return {
                symbol: symbol,
                side: 'SELL',
                strength: 0.8,
                reason: 'Overbought with MACD reversal and high volume'
            };
        }
        
        return null;
    }
    
    async executeSignal(signal) {
        // Check if we need confirmation
        if (this.config.confirmationCandles > 0) {
            // Store signal and wait for confirmation
            const indicators = this.indicators.get(signal.symbol);
            indicators.signals.push({
                ...signal,
                timestamp: Date.now()
            });
            
            // Check after next candle
            return;
        }
        
        // Execute immediately
        this.engine.emit(`signal:${signal.side.toLowerCase()}`, {
            ...signal,
            orderType: 'MARKET',
            confidence: signal.strength
        });
    }
    
    calculateRSI(closes, period) {
        // Implementation provided in plugin manager
        return this.engine.app.modules.get('pluginManager')
            .calculateRSI(closes, period);
    }
    
    calculateMACD(closes, fastPeriod, slowPeriod, signalPeriod) {
        const fastEMA = this.calculateEMA(closes, fastPeriod);
        const slowEMA = this.calculateEMA(closes, slowPeriod);
        
        const macdLine = [];
        for (let i = 0; i < Math.min(fastEMA.length, slowEMA.length); i++) {
            macdLine.push(fastEMA[i] - slowEMA[i]);
        }
        
        const signalLine = this.calculateEMA(macdLine, signalPeriod);
        
        const histogram = [];
        for (let i = 0; i < Math.min(macdLine.length, signalLine.length); i++) {
            histogram.push(macdLine[i] - signalLine[i]);
        }
        
        return { line: macdLine, signal: signalLine, histogram };
    }
    
    calculateEMA(data, period) {
        // Implementation provided in plugin manager
        return this.engine.app.modules.get('pluginManager')
            .calculateEMA(data, period);
    }
}

/**
 * Scalping Strategy
 */
class ScalpingStrategy extends BaseStrategy {
    constructor(engine) {
        super(engine);
        this.name = 'scalping';
        this.activeScalps = new Map();
    }
    
    onDepthUpdate(orderBook) {
        if (!this.isActive) return;
        
        // Analyze order book for scalping opportunities
        const opportunity = this.findScalpingOpportunity(orderBook);
        if (opportunity) {
            this.executeScalp(opportunity);
        }
    }
    
    findScalpingOpportunity(orderBook) {
        // Calculate spread
        const bestBid = orderBook.bids[0]?.price || 0;
        const bestAsk = orderBook.asks[0]?.price || 0;
        const spread = (bestAsk - bestBid) / bestBid;
        
        // Check if spread is wide enough
        if (spread < this.config.minProfit) return null;
        
        // Check order book imbalance
        const bidVolume = orderBook.bids.slice(0, 5)
            .reduce((sum, level) => sum + level.quantity, 0);
        const askVolume = orderBook.asks.slice(0, 5)
            .reduce((sum, level) => sum + level.quantity, 0);
        
        const imbalance = (bidVolume - askVolume) / (bidVolume + askVolume);
        
        // Strong buy pressure
        if (imbalance > 0.3 && spread > this.config.minProfit) {
            return {
                symbol: orderBook.symbol,
                side: 'BUY',
                entryPrice: bestBid + 0.01,
                exitPrice: bestAsk - 0.01,
                confidence: Math.min(imbalance, 0.8)
            };
        }
        
        // Strong sell pressure
        if (imbalance < -0.3 && spread > this.config.minProfit) {
            return {
                symbol: orderBook.symbol,
                side: 'SELL',
                entryPrice: bestAsk - 0.01,
                exitPrice: bestBid + 0.01,
                confidence: Math.min(Math.abs(imbalance), 0.8)
            };
        }
        
        return null;
    }
    
    async executeScalp(opportunity) {
        const activeScalp = this.activeScalps.get(opportunity.symbol);
        if (activeScalp) return; // Already in a scalp
        
        try {
            // Place entry order
            const entryOrder = await this.engine.createOrder({
                symbol: opportunity.symbol,
                side: opportunity.side,
                type: 'LIMIT',
                quantity: this.calculateScalpSize(opportunity),
                price: opportunity.entryPrice,
                timeInForce: 'IOC' // Immediate or cancel
            });
            
            if (entryOrder.status === 'FILLED') {
                // Place exit order
                const exitOrder = await this.engine.createOrder({
                    symbol: opportunity.symbol,
                    side: opportunity.side === 'BUY' ? 'SELL' : 'BUY',
                    type: 'LIMIT',
                    quantity: entryOrder.filledQuantity,
                    price: opportunity.exitPrice,
                    timeInForce: 'GTC'
                });
                
                this.activeScalps.set(opportunity.symbol, {
                    entryOrder,
                    exitOrder,
                    startTime: Date.now()
                });
                
                // Set timeout for quick exit
                setTimeout(() => {
                    this.checkScalpTimeout(opportunity.symbol);
                }, this.config.maxHoldTime);
            }
        } catch (error) {
            console.error('Scalp execution failed:', error);
        }
    }
    
    async checkScalpTimeout(symbol) {
        const scalp = this.activeScalps.get(symbol);
        if (!scalp) return;
        
        // Cancel exit order and market sell if still open
        if (scalp.exitOrder.status === 'OPEN') {
            await this.engine.cancelOrder(scalp.exitOrder.id);
            await this.engine.closePosition(symbol);
            
            console.log(`⏱️ Scalp timeout: ${symbol}`);
        }
        
        this.activeScalps.delete(symbol);
    }
    
    calculateScalpSize(opportunity) {
        // Use small position size for scalping
        const baseSize = this.engine.balance.available * 0.1;
        return baseSize * opportunity.confidence;
    }
}

/**
 * Arbitrage Strategy
 */
class ArbitrageStrategy extends BaseStrategy {
    constructor(engine) {
        super(engine);
        this.name = 'arbitrage';
        this.exchanges = new Map();
    }
    
    async start() {
        await super.start();
        
        // Connect to multiple exchanges
        // This is a simplified example
        console.log('🔄 Arbitrage strategy started');
    }
    
    findArbitrageOpportunity() {
        // Compare prices across exchanges
        // Execute if profitable spread found
        // This would require connections to multiple exchanges
    }
}

/**
 * ML (Machine Learning) Strategy
 */
class MLStrategy extends BaseStrategy {
    constructor(engine) {
        super(engine);
        this.name = 'ml';
        this.model = null;
        this.features = [];
    }
    
    async initialize() {
        await super.initialize();
        
        // Load ML model
        // This would integrate with TensorFlow.js or similar
        console.log('🧠 ML strategy initialized');
    }
    
    async predict(symbol) {
        // Prepare features
        // Run prediction
        // Return signal
    }
}

// Export
export default TradingEngine;