/**
 * 📊 Trading Bot Backtest Plugin
 * Version: 2.1.0
 * 
 * 🔄 Features:
 * - Historical data management
 * - Strategy backtesting
 * - Performance analysis
 * - Monte Carlo simulation
 * - Walk-forward analysis
 * - Parameter optimization
 * - Risk metrics calculation
 * - Visual reporting
 * - Multi-strategy comparison
 * - Market replay
 */

import { EventEmitter } from '../core/event-emitter.js';

class BacktestPlugin extends EventEmitter {
    constructor(tradingBot) {
        super();
        this.bot = tradingBot;
        this.config = tradingBot.config.backtest || this.getDefaultConfig();
        
        // Backtest state
        this.state = {
            running: false,
            progress: 0,
            currentTime: null,
            speed: 1
        };
        
        // Data storage
        this.historicalData = new Map();
        this.marketData = {
            candles: [],
            trades: [],
            orderbook: []
        };
        
        // Test results
        this.results = {
            trades: [],
            equity: [],
            drawdown: [],
            metrics: {},
            report: null
        };
        
        // Virtual account
        this.account = {
            balance: 10000,
            initialBalance: 10000,
            positions: new Map(),
            orders: new Map(),
            history: []
        };
        
        // Strategy cache
        this.strategies = new Map();
        this.activeStrategy = null;
        
        // Optimization
        this.optimization = {
            running: false,
            parameters: [],
            results: [],
            bestParams: null
        };
        
        // Comparison results
        this.comparisons = new Map();
        
        // Market replay
        this.replay = {
            enabled: false,
            speed: 1,
            paused: false,
            currentIndex: 0
        };
        
        this.init();
    }
    
    getDefaultConfig() {
        return {
            enabled: true,
            data: {
                source: 'local',         // local, api, database
                cacheEnabled: true,
                maxCacheSize: 1000000,   // 1M candles
                resolution: '1m'         // Default timeframe
            },
            execution: {
                slippage: 0.0001,        // 0.01% slippage
                commission: 0.001,       // 0.1% commission
                latency: 100,            // 100ms latency
                fillProbability: 0.95,   // 95% fill rate
                partialFills: true
            },
            analysis: {
                metrics: [
                    'returns', 'sharpe', 'sortino', 'calmar',
                    'winRate', 'profitFactor', 'maxDrawdown',
                    'var', 'cvar', 'omega', 'ulcer'
                ],
                benchmarks: ['BTCUSDT'],
                riskFreeRate: 0.02       // 2% annual
            },
            optimization: {
                method: 'grid',          // grid, random, genetic, bayesian
                objective: 'sharpe',     // sharpe, returns, calmar
                maxIterations: 1000,
                parallelJobs: 4
            },
            reporting: {
                generateCharts: true,
                saveResults: true,
                format: 'html'           // html, pdf, json
            },
            monteCarlo: {
                enabled: false,
                simulations: 1000,
                confidenceLevel: 0.95
            }
        };
    }
    
    async init() {
        try {
            // Load saved results
            await this.loadSavedResults();
            
            // Initialize strategies
            this.initializeStrategies();
            
            // Setup UI
            this.initializeUI();
            
            // Setup event listeners
            this.setupEventListeners();
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('Backtest plugin initialization failed:', error);
            this.emit('error', { type: 'init_failed', error });
        }
    }
    
    // ===== DATA MANAGEMENT =====
    async loadHistoricalData(symbol, startDate, endDate, resolution = '1m') {
        try {
            this.emit('data:loading', { symbol, startDate, endDate });
            
            let data;
            
            // Check cache first
            const cacheKey = `${symbol}-${resolution}-${startDate}-${endDate}`;
            if (this.config.data.cacheEnabled && this.historicalData.has(cacheKey)) {
                data = this.historicalData.get(cacheKey);
            } else {
                // Load from source
                switch (this.config.data.source) {
                    case 'api':
                        data = await this.loadFromAPI(symbol, startDate, endDate, resolution);
                        break;
                    case 'database':
                        data = await this.loadFromDatabase(symbol, startDate, endDate, resolution);
                        break;
                    case 'local':
                    default:
                        data = await this.loadFromLocal(symbol, startDate, endDate, resolution);
                        break;
                }
                
                // Cache data
                if (this.config.data.cacheEnabled) {
                    this.cacheData(cacheKey, data);
                }
            }
            
            this.marketData.candles = data;
            
            this.emit('data:loaded', {
                symbol,
                candles: data.length,
                startDate: data[0]?.timestamp,
                endDate: data[data.length - 1]?.timestamp
            });
            
            return data;
            
        } catch (error) {
            console.error('Failed to load historical data:', error);
            this.emit('error', { type: 'data_load_failed', error });
            throw error;
        }
    }
    
    async loadFromAPI(symbol, startDate, endDate, resolution) {
        console.log('Loading data from API...');
        
        const candles = [];
        const chunkSize = 1000; // API limit
        let currentStart = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        
        while (currentStart < end) {
            const chunk = await this.bot.api.getActiveExchange().client.getKlines(
                symbol,
                resolution,
                chunkSize,
                currentStart
            );
            
            if (chunk.length === 0) break;
            
            candles.push(...chunk);
            currentStart = chunk[chunk.length - 1].timestamp + 1;
            
            // Update progress
            const progress = (currentStart - new Date(startDate).getTime()) / 
                            (end - new Date(startDate).getTime());
            this.emit('data:progress', { progress });
            
            // Rate limit
            await this.sleep(100);
        }
        
        return candles;
    }
    
    async loadFromLocal(symbol, startDate, endDate, resolution) {
        // Simulate loading from local file
        console.log('Generating sample data...');
        
        const candles = [];
        const start = new Date(startDate).getTime();
        const end = new Date(endDate).getTime();
        const interval = this.getIntervalMs(resolution);
        
        let currentTime = start;
        let price = 50000; // Starting price for BTC
        
        while (currentTime <= end) {
            // Generate realistic candle
            const volatility = 0.002; // 0.2% volatility
            const trend = Math.sin(currentTime / (86400000 * 30)) * 0.0001; // Monthly cycle
            
            const change = (Math.random() - 0.5) * volatility + trend;
            price *= (1 + change);
            
            const high = price * (1 + Math.random() * volatility);
            const low = price * (1 - Math.random() * volatility);
            const open = price * (1 + (Math.random() - 0.5) * volatility * 0.5);
            const close = price;
            
            candles.push({
                timestamp: currentTime,
                open: open,
                high: Math.max(open, close, high),
                low: Math.min(open, close, low),
                close: close,
                volume: Math.random() * 1000000
            });
            
            currentTime += interval;
        }
        
        return candles;
    }
    
    getIntervalMs(resolution) {
        const intervals = {
            '1m': 60000,
            '5m': 300000,
            '15m': 900000,
            '30m': 1800000,
            '1h': 3600000,
            '4h': 14400000,
            '1d': 86400000
        };
        
        return intervals[resolution] || 60000;
    }
    
    cacheData(key, data) {
        this.historicalData.set(key, data);
        
        // Limit cache size
        if (this.historicalData.size > 100) {
            const firstKey = this.historicalData.keys().next().value;
            this.historicalData.delete(firstKey);
        }
    }
    
    // ===== BACKTEST EXECUTION =====
    async runBacktest(strategy, startDate, endDate, options = {}) {
        if (this.state.running) {
            throw new Error('Backtest already running');
        }
        
        try {
            this.state.running = true;
            this.state.progress = 0;
            
            // Reset state
            this.resetBacktest();
            
            // Set strategy
            this.activeStrategy = strategy;
            
            // Load data
            const symbol = options.symbol || 'BTCUSDT';
            const resolution = options.resolution || this.config.data.resolution;
            
            await this.loadHistoricalData(symbol, startDate, endDate, resolution);
            
            // Initialize strategy
            if (typeof strategy.init === 'function') {
                await strategy.init(this);
            }
            
            // Run simulation
            await this.runSimulation();
            
            // Calculate metrics
            this.calculateMetrics();
            
            // Generate report
            const report = this.generateReport();
            
            this.results.report = report;
            
            // Save results
            if (this.config.reporting.saveResults) {
                await this.saveResults(report);
            }
            
            this.emit('backtest:complete', report);
            
            return report;
            
        } catch (error) {
            console.error('Backtest failed:', error);
            this.emit('error', { type: 'backtest_failed', error });
            throw error;
        } finally {
            this.state.running = false;
            this.state.progress = 100;
        }
    }
    
    async runSimulation() {
        const candles = this.marketData.candles;
        const totalCandles = candles.length;
        
        console.log(`Running backtest on ${totalCandles} candles...`);
        
        for (let i = 0; i < totalCandles; i++) {
            const candle = candles[i];
            this.state.currentTime = candle.timestamp;
            
            // Update market state
            this.updateMarketState(candle, i);
            
            // Check open orders
            await this.checkOrders(candle);
            
            // Update positions
            this.updatePositions(candle);
            
            // Run strategy
            if (this.activeStrategy) {
                const signals = await this.activeStrategy.analyze(
                    this.getMarketSnapshot(i),
                    this.account
                );
                
                // Process signals
                if (signals && signals.length > 0) {
                    for (const signal of signals) {
                        await this.processSignal(signal, candle);
                    }
                }
            }
            
            // Update equity
            this.updateEquity(candle);
            
            // Update progress
            this.state.progress = (i / totalCandles) * 100;
            
            // Emit progress event
            if (i % 100 === 0) {
                this.emit('backtest:progress', {
                    progress: this.state.progress,
                    candle: i,
                    totalCandles: totalCandles,
                    equity: this.account.balance
                });
            }
        }
    }
    
    updateMarketState(candle, index) {
        // Update indicators
        if (!this.marketData.indicators) {
            this.marketData.indicators = {};
        }
        
        // Calculate common indicators
        const closes = this.marketData.candles
            .slice(Math.max(0, index - 200), index + 1)
            .map(c => c.close);
        
        if (closes.length >= 20) {
            this.marketData.indicators.sma20 = this.calculateSMA(closes, 20);
            this.marketData.indicators.sma50 = this.calculateSMA(closes, 50);
            this.marketData.indicators.rsi = this.calculateRSI(closes, 14);
            this.marketData.indicators.atr = this.calculateATR(
                this.marketData.candles.slice(Math.max(0, index - 14), index + 1)
            );
        }
    }
    
    getMarketSnapshot(index) {
        const lookback = 100;
        const startIdx = Math.max(0, index - lookback + 1);
        
        return {
            candles: this.marketData.candles.slice(startIdx, index + 1),
            indicators: this.marketData.indicators,
            currentCandle: this.marketData.candles[index],
            timestamp: this.state.currentTime
        };
    }
    
    async processSignal(signal, candle) {
        switch (signal.type) {
            case 'buy':
            case 'sell':
                await this.createOrder({
                    symbol: signal.symbol || 'BTCUSDT',
                    side: signal.type,
                    type: signal.orderType || 'market',
                    quantity: signal.quantity || this.calculateOrderSize(signal),
                    price: signal.price || candle.close,
                    stopLoss: signal.stopLoss,
                    takeProfit: signal.takeProfit
                }, candle);
                break;
                
            case 'close':
                await this.closePosition(signal.positionId || 'all', candle);
                break;
                
            case 'cancel':
                this.cancelOrder(signal.orderId);
                break;
        }
    }
    
    // ===== ORDER MANAGEMENT =====
    async createOrder(order, candle) {
        // Apply execution simulation
        const executed = await this.simulateExecution(order, candle);
        
        if (!executed) {
            return null;
        }
        
        // Create order
        const orderId = `order-${Date.now()}-${Math.random()}`;
        const fullOrder = {
            id: orderId,
            ...order,
            status: order.type === 'market' ? 'filled' : 'open',
            createdAt: this.state.currentTime,
            filledAt: order.type === 'market' ? this.state.currentTime : null,
            fillPrice: executed.price,
            commission: executed.commission,
            slippage: executed.slippage
        };
        
        this.account.orders.set(orderId, fullOrder);
        
        // If market order, execute immediately
        if (order.type === 'market') {
            this.executeOrder(fullOrder, candle);
        }
        
        return fullOrder;
    }
    
    async simulateExecution(order, candle) {
        // Simulate fill probability
        if (Math.random() > this.config.execution.fillProbability) {
            return null;
        }
        
        // Calculate execution price with slippage
        let executionPrice = order.price || candle.close;
        const slippage = this.config.execution.slippage * executionPrice;
        
        if (order.side === 'buy') {
            executionPrice += slippage;
        } else {
            executionPrice -= slippage;
        }
        
        // Calculate commission
        const commission = order.quantity * executionPrice * this.config.execution.commission;
        
        // Simulate latency
        if (this.config.execution.latency > 0) {
            await this.sleep(0); // Simulate async delay
        }
        
        return {
            price: executionPrice,
            commission: commission,
            slippage: slippage
        };
    }
    
    executeOrder(order, candle) {
        // Update balance
        const totalCost = order.quantity * order.fillPrice + order.commission;
        
        if (order.side === 'buy') {
            this.account.balance -= totalCost;
            
            // Create position
            const position = {
                id: `pos-${Date.now()}`,
                symbol: order.symbol,
                side: 'long',
                quantity: order.quantity,
                entryPrice: order.fillPrice,
                currentPrice: order.fillPrice,
                unrealizedPnL: 0,
                realizedPnL: 0,
                entryTime: this.state.currentTime,
                stopLoss: order.stopLoss,
                takeProfit: order.takeProfit
            };
            
            this.account.positions.set(position.id, position);
        } else {
            // Check if closing position
            const position = this.findPositionToClose(order.symbol, order.quantity);
            
            if (position) {
                // Close position
                const pnl = (order.fillPrice - position.entryPrice) * order.quantity - order.commission;
                position.realizedPnL = pnl;
                position.exitPrice = order.fillPrice;
                position.exitTime = this.state.currentTime;
                
                this.account.balance += order.quantity * order.fillPrice - order.commission;
                this.account.positions.delete(position.id);
                
                // Record trade
                this.recordTrade(position);
            }
        }
        
        // Update order status
        order.status = 'filled';
        
        // Record in history
        this.account.history.push({
            type: 'order',
            order: order,
            timestamp: this.state.currentTime,
            balance: this.account.balance
        });
    }
    
    async checkOrders(candle) {
        for (const [orderId, order] of this.account.orders) {
            if (order.status !== 'open') continue;
            
            let shouldFill = false;
            
            // Check limit orders
            if (order.type === 'limit') {
                if (order.side === 'buy' && candle.low <= order.price) {
                    shouldFill = true;
                } else if (order.side === 'sell' && candle.high >= order.price) {
                    shouldFill = true;
                }
            }
            
            // Check stop orders
            if (order.type === 'stop') {
                if (order.side === 'buy' && candle.high >= order.price) {
                    shouldFill = true;
                } else if (order.side === 'sell' && candle.low <= order.price) {
                    shouldFill = true;
                }
            }
            
            if (shouldFill) {
                order.filledAt = this.state.currentTime;
                order.fillPrice = order.price;
                this.executeOrder(order, candle);
            }
        }
    }
    
    updatePositions(candle) {
        for (const [posId, position] of this.account.positions) {
            // Update current price
            position.currentPrice = candle.close;
            
            // Calculate unrealized PnL
            if (position.side === 'long') {
                position.unrealizedPnL = (candle.close - position.entryPrice) * position.quantity;
            } else {
                position.unrealizedPnL = (position.entryPrice - candle.close) * position.quantity;
            }
            
            // Check stop loss
            if (position.stopLoss) {
                if (position.side === 'long' && candle.low <= position.stopLoss) {
                    this.closePositionAtPrice(position, position.stopLoss, 'stop_loss');
                } else if (position.side === 'short' && candle.high >= position.stopLoss) {
                    this.closePositionAtPrice(position, position.stopLoss, 'stop_loss');
                }
            }
            
            // Check take profit
            if (position.takeProfit) {
                if (position.side === 'long' && candle.high >= position.takeProfit) {
                    this.closePositionAtPrice(position, position.takeProfit, 'take_profit');
                } else if (position.side === 'short' && candle.low <= position.takeProfit) {
                    this.closePositionAtPrice(position, position.takeProfit, 'take_profit');
                }
            }
        }
    }
    
    closePositionAtPrice(position, price, reason) {
        const commission = position.quantity * price * this.config.execution.commission;
        
        if (position.side === 'long') {
            position.realizedPnL = (price - position.entryPrice) * position.quantity - commission;
        } else {
            position.realizedPnL = (position.entryPrice - price) * position.quantity - commission;
        }
        
        position.exitPrice = price;
        position.exitTime = this.state.currentTime;
        position.exitReason = reason;
        
        this.account.balance += position.quantity * price - commission;
        this.account.positions.delete(position.id);
        
        // Record trade
        this.recordTrade(position);
    }
    
    // ===== METRICS CALCULATION =====
    calculateMetrics() {
        const trades = this.results.trades;
        const equity = this.results.equity;
        
        if (trades.length === 0) {
            this.results.metrics = {
                totalTrades: 0,
                winRate: 0,
                profitFactor: 0,
                sharpeRatio: 0,
                maxDrawdown: 0,
                calmarRatio: 0,
                sortinoRatio: 0,
                avgWin: 0,
                avgLoss: 0,
                largestWin: 0,
                largestLoss: 0,
                avgHoldTime: 0,
                totalReturn: 0,
                annualizedReturn: 0
            };
            return;
        }
        
        // Basic metrics
        const winningTrades = trades.filter(t => t.realizedPnL > 0);
        const losingTrades = trades.filter(t => t.realizedPnL < 0);
        
        const totalProfit = winningTrades.reduce((sum, t) => sum + t.realizedPnL, 0);
        const totalLoss = Math.abs(losingTrades.reduce((sum, t) => sum + t.realizedPnL, 0));
        
        // Calculate returns
        const returns = this.calculateReturns(equity);
        const annualizedReturn = this.annualizeReturn(returns);
        
        // Risk metrics
        const maxDrawdown = this.calculateMaxDrawdown(equity);
        const sharpeRatio = this.calculateSharpeRatio(returns);
        const sortinoRatio = this.calculateSortinoRatio(returns);
        const calmarRatio = maxDrawdown > 0 ? annualizedReturn / maxDrawdown : 0;
        
        // Advanced metrics
        const var95 = this.calculateVaR(returns, 0.95);
        const cvar95 = this.calculateCVaR(returns, 0.95);
        const omega = this.calculateOmegaRatio(returns);
        const ulcer = this.calculateUlcerIndex(equity);
        
        this.results.metrics = {
            // Basic metrics
            totalTrades: trades.length,
            winningTrades: winningTrades.length,
            losingTrades: losingTrades.length,
            winRate: winningTrades.length / trades.length,
            
            // Profit metrics
            totalProfit: totalProfit,
            totalLoss: totalLoss,
            netProfit: totalProfit - totalLoss,
            profitFactor: totalLoss > 0 ? totalProfit / totalLoss : 0,
            
            // Average metrics
            avgWin: winningTrades.length > 0 ? totalProfit / winningTrades.length : 0,
            avgLoss: losingTrades.length > 0 ? totalLoss / losingTrades.length : 0,
            avgTrade: trades.reduce((sum, t) => sum + t.realizedPnL, 0) / trades.length,
            
            // Extremes
            largestWin: Math.max(...trades.map(t => t.realizedPnL)),
            largestLoss: Math.min(...trades.map(t => t.realizedPnL)),
            
            // Hold time
            avgHoldTime: this.calculateAvgHoldTime(trades),
            
            // Returns
            totalReturn: (equity[equity.length - 1] - equity[0]) / equity[0],
            annualizedReturn: annualizedReturn,
            
            // Risk metrics
            maxDrawdown: maxDrawdown,
            sharpeRatio: sharpeRatio,
            sortinoRatio: sortinoRatio,
            calmarRatio: calmarRatio,
            
            // Advanced metrics
            var95: var95,
            cvar95: cvar95,
            omegaRatio: omega,
            ulcerIndex: ulcer,
            
            // Additional info
            startDate: this.marketData.candles[0].timestamp,
            endDate: this.marketData.candles[this.marketData.candles.length - 1].timestamp,
            tradingDays: this.marketData.candles.length
        };
    }
    
    calculateReturns(equity) {
        const returns = [];
        
        for (let i = 1; i < equity.length; i++) {
            const dailyReturn = (equity[i].value - equity[i-1].value) / equity[i-1].value;
            returns.push(dailyReturn);
        }
        
        return returns;
    }
    
    calculateMaxDrawdown(equity) {
        let maxDrawdown = 0;
        let peak = equity[0].value;
        
        for (const point of equity) {
            if (point.value > peak) {
                peak = point.value;
            }
            
            const drawdown = (peak - point.value) / peak;
            maxDrawdown = Math.max(maxDrawdown, drawdown);
        }
        
        return maxDrawdown;
    }
    
    calculateSharpeRatio(returns) {
        if (returns.length === 0) return 0;
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const riskFreeRate = this.config.analysis.riskFreeRate / 252; // Daily
        
        const excessReturns = returns.map(r => r - riskFreeRate);
        const stdDev = this.calculateStdDev(excessReturns);
        
        return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev * Math.sqrt(252) : 0;
    }
    
    calculateSortinoRatio(returns) {
        if (returns.length === 0) return 0;
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const riskFreeRate = this.config.analysis.riskFreeRate / 252;
        
        const downsideReturns = returns.filter(r => r < riskFreeRate);
        const downsideDeviation = this.calculateStdDev(downsideReturns);
        
        return downsideDeviation > 0 ? 
            (avgReturn - riskFreeRate) / downsideDeviation * Math.sqrt(252) : 0;
    }
    
    calculateVaR(returns, confidence) {
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const index = Math.floor((1 - confidence) * sortedReturns.length);
        
        return Math.abs(sortedReturns[index] || 0);
    }
    
    calculateCVaR(returns, confidence) {
        const sortedReturns = [...returns].sort((a, b) => a - b);
        const varIndex = Math.floor((1 - confidence) * sortedReturns.length);
        
        const tailReturns = sortedReturns.slice(0, varIndex);
        
        return tailReturns.length > 0 ?
            Math.abs(tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length) : 0;
    }
    
    calculateOmegaRatio(returns, threshold = 0) {
        const gains = returns.filter(r => r > threshold).reduce((sum, r) => sum + (r - threshold), 0);
        const losses = returns.filter(r => r <= threshold).reduce((sum, r) => sum + (threshold - r), 0);
        
        return losses > 0 ? gains / losses : gains > 0 ? Infinity : 0;
    }
    
    calculateUlcerIndex(equity) {
        let sumSquaredDrawdowns = 0;
        let peak = equity[0].value;
        
        for (const point of equity) {
            if (point.value > peak) {
                peak = point.value;
            }
            
            const drawdown = (peak - point.value) / peak;
            sumSquaredDrawdowns += drawdown * drawdown;
        }
        
        return Math.sqrt(sumSquaredDrawdowns / equity.length) * 100;
    }
    
    // ===== OPTIMIZATION =====
    async optimizeStrategy(strategy, parameters, options = {}) {
        console.log('Starting strategy optimization...');
        
        this.optimization.running = true;
        this.optimization.parameters = parameters;
        this.optimization.results = [];
        
        try {
            const method = options.method || this.config.optimization.method;
            
            switch (method) {
                case 'grid':
                    await this.gridSearchOptimization(strategy, parameters);
                    break;
                case 'random':
                    await this.randomSearchOptimization(strategy, parameters);
                    break;
                case 'genetic':
                    await this.geneticOptimization(strategy, parameters);
                    break;
                case 'bayesian':
                    await this.bayesianOptimization(strategy, parameters);
                    break;
                default:
                    throw new Error(`Unknown optimization method: ${method}`);
            }
            
            // Find best parameters
            const objective = options.objective || this.config.optimization.objective;
            this.optimization.bestParams = this.findBestParameters(objective);
            
            // Generate optimization report
            const report = this.generateOptimizationReport();
            
            this.emit('optimization:complete', report);
            
            return report;
            
        } catch (error) {
            console.error('Optimization failed:', error);
            this.emit('error', { type: 'optimization_failed', error });
            throw error;
        } finally {
            this.optimization.running = false;
        }
    }
    
    async gridSearchOptimization(strategy, parameters) {
        // Generate all parameter combinations
        const combinations = this.generateParameterGrid(parameters);
        const total = combinations.length;
        
        console.log(`Testing ${total} parameter combinations...`);
        
        for (let i = 0; i < combinations.length; i++) {
            const params = combinations[i];
            
            // Run backtest with these parameters
            const strategyWithParams = {
                ...strategy,
                parameters: params
            };
            
            const result = await this.runBacktest(
                strategyWithParams,
                this.marketData.candles[0].timestamp,
                this.marketData.candles[this.marketData.candles.length - 1].timestamp
            );
            
            this.optimization.results.push({
                parameters: params,
                metrics: result.metrics
            });
            
            // Update progress
            this.emit('optimization:progress', {
                current: i + 1,
                total: total,
                bestSoFar: this.findBestParameters()
            });
        }
    }
    
    generateParameterGrid(parameters) {
        const combinations = [];
        
        const generateCombinations = (params, current = {}) => {
            const paramNames = Object.keys(params);
            
            if (paramNames.length === 0) {
                combinations.push({ ...current });
                return;
            }
            
            const paramName = paramNames[0];
            const paramConfig = params[paramName];
            const remainingParams = { ...params };
            delete remainingParams[paramName];
            
            // Generate values for this parameter
            const values = [];
            
            if (paramConfig.type === 'range') {
                const step = paramConfig.step || (paramConfig.max - paramConfig.min) / 10;
                for (let v = paramConfig.min; v <= paramConfig.max; v += step) {
                    values.push(v);
                }
            } else if (paramConfig.type === 'choice') {
                values.push(...paramConfig.values);
            }
            
            // Recursively generate combinations
            for (const value of values) {
                generateCombinations(remainingParams, {
                    ...current,
                    [paramName]: value
                });
            }
        };
        
        generateCombinations(parameters);
        
        return combinations;
    }
    
    findBestParameters(objective = 'sharpe') {
        if (this.optimization.results.length === 0) return null;
        
        let best = this.optimization.results[0];
        
        for (const result of this.optimization.results) {
            if (result.metrics[objective] > best.metrics[objective]) {
                best = result;
            }
        }
        
        return best;
    }
    
    // ===== MONTE CARLO SIMULATION =====
    async runMonteCarloSimulation(strategy, numSimulations = 1000) {
        console.log(`Running ${numSimulations} Monte Carlo simulations...`);
        
        const baseResults = this.results.trades;
        const simResults = [];
        
        for (let i = 0; i < numSimulations; i++) {
            // Randomly reorder trades
            const shuffledTrades = this.shuffleArray([...baseResults]);
            
            // Calculate equity curve for this simulation
            const equityCurve = this.calculateEquityCurveFromTrades(
                shuffledTrades,
                this.account.initialBalance
            );
            
            // Calculate metrics
            const metrics = {
                finalEquity: equityCurve[equityCurve.length - 1],
                maxDrawdown: this.calculateMaxDrawdown(equityCurve.map((e, i) => ({ value: e }))),
                totalReturn: (equityCurve[equityCurve.length - 1] - equityCurve[0]) / equityCurve[0]
            };
            
            simResults.push(metrics);
            
            // Update progress
            if (i % 100 === 0) {
                this.emit('montecarlo:progress', {
                    current: i,
                    total: numSimulations
                });
            }
        }
        
        // Calculate statistics
        const stats = this.calculateMonteCarloStats(simResults);
        
        return {
            simulations: numSimulations,
            statistics: stats,
            confidenceIntervals: this.calculateConfidenceIntervals(simResults),
            probabilityOfRuin: this.calculateProbabilityOfRuin(simResults),
            expectedDrawdown: this.calculateExpectedDrawdown(simResults)
        };
    }
    
    calculateMonteCarloStats(results) {
        const returns = results.map(r => r.totalReturn);
        const drawdowns = results.map(r => r.maxDrawdown);
        
        return {
            returns: {
                mean: this.mean(returns),
                median: this.median(returns),
                stdDev: this.calculateStdDev(returns),
                min: Math.min(...returns),
                max: Math.max(...returns)
            },
            drawdowns: {
                mean: this.mean(drawdowns),
                median: this.median(drawdowns),
                stdDev: this.calculateStdDev(drawdowns),
                min: Math.min(...drawdowns),
                max: Math.max(...drawdowns)
            }
        };
    }
    
    // ===== WALK-FORWARD ANALYSIS =====
    async runWalkForwardAnalysis(strategy, options = {}) {
        const {
            inSampleRatio = 0.7,
            windowSize = 252,  // 1 year
            stepSize = 63      // 3 months
        } = options;
        
        const results = [];
        const candles = this.marketData.candles;
        let currentIndex = 0;
        
        while (currentIndex + windowSize < candles.length) {
            // Define in-sample and out-of-sample periods
            const inSampleEnd = currentIndex + Math.floor(windowSize * inSampleRatio);
            const outSampleEnd = currentIndex + windowSize;
            
            // Optimize on in-sample data
            const inSampleData = candles.slice(currentIndex, inSampleEnd);
            const optimizedParams = await this.optimizeOnData(strategy, inSampleData);
            
            // Test on out-of-sample data
            const outSampleData = candles.slice(inSampleEnd, outSampleEnd);
            const testResults = await this.testOnData(strategy, optimizedParams, outSampleData);
            
            results.push({
                period: {
                    inSample: {
                        start: inSampleData[0].timestamp,
                        end: inSampleData[inSampleData.length - 1].timestamp
                    },
                    outSample: {
                        start: outSampleData[0].timestamp,
                        end: outSampleData[outSampleData.length - 1].timestamp
                    }
                },
                optimizedParams: optimizedParams,
                performance: testResults
            });
            
            currentIndex += stepSize;
        }
        
        return {
            windows: results.length,
            results: results,
            summary: this.summarizeWalkForward(results)
        };
    }
    
    // ===== REPORTING =====
    generateReport() {
        const report = {
            summary: {
                strategy: this.activeStrategy?.name || 'Unknown',
                period: {
                    start: new Date(this.results.metrics.startDate),
                    end: new Date(this.results.metrics.endDate),
                    days: this.results.metrics.tradingDays
                },
                initialBalance: this.account.initialBalance,
                finalBalance: this.account.balance,
                totalReturn: this.results.metrics.totalReturn,
                annualizedReturn: this.results.metrics.annualizedReturn
            },
            performance: {
                trades: this.results.metrics.totalTrades,
                winRate: this.results.metrics.winRate,
                profitFactor: this.results.metrics.profitFactor,
                avgWin: this.results.metrics.avgWin,
                avgLoss: this.results.metrics.avgLoss,
                largestWin: this.results.metrics.largestWin,
                largestLoss: this.results.metrics.largestLoss
            },
            risk: {
                maxDrawdown: this.results.metrics.maxDrawdown,
                sharpeRatio: this.results.metrics.sharpeRatio,
                sortinoRatio: this.results.metrics.sortinoRatio,
                calmarRatio: this.results.metrics.calmarRatio,
                var95: this.results.metrics.var95,
                cvar95: this.results.metrics.cvar95
            },
            trades: this.results.trades.slice(-100), // Last 100 trades
            equity: this.results.equity,
            drawdown: this.results.drawdown,
            monthly: this.calculateMonthlyReturns(),
            charts: this.config.reporting.generateCharts ? this.generateCharts() : null
        };
        
        return report;
    }
    
    calculateMonthlyReturns() {
        const monthlyReturns = new Map();
        const equity = this.results.equity;
        
        for (let i = 1; i < equity.length; i++) {
            const date = new Date(equity[i].timestamp);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            
            if (!monthlyReturns.has(monthKey)) {
                monthlyReturns.set(monthKey, {
                    startEquity: equity[i-1].value,
                    endEquity: equity[i].value
                });
            } else {
                monthlyReturns.get(monthKey).endEquity = equity[i].value;
            }
        }
        
        const returns = [];
        for (const [month, data] of monthlyReturns) {
            returns.push({
                month: month,
                return: (data.endEquity - data.startEquity) / data.startEquity
            });
        }
        
        return returns;
    }
    
    generateCharts() {
        return {
            equityCurve: this.generateEquityChart(),
            drawdown: this.generateDrawdownChart(),
            returns: this.generateReturnsDistribution(),
            monthlyHeatmap: this.generateMonthlyHeatmap()
        };
    }
    
    generateEquityChart() {
        return {
            type: 'line',
            data: {
                labels: this.results.equity.map(e => new Date(e.timestamp).toLocaleDateString()),
                datasets: [{
                    label: 'Equity',
                    data: this.results.equity.map(e => e.value),
                    borderColor: '#2ECC71',
                    fill: false
                }]
            },
            options: {
                responsive: true,
                title: {
                    display: true,
                    text: 'Equity Curve'
                }
            }
        };
    }
    
    // ===== UI INTEGRATION =====
    initializeUI() {
        // Create backtest panel if needed
        if (!document.getElementById('backtest-panel')) {
            this.createBacktestPanel();
        }
        
        // Setup event handlers
        this.setupUIEventHandlers();
    }
    
    createBacktestPanel() {
        const panel = document.createElement('div');
        panel.id = 'backtest-panel';
        panel.className = 'backtest-panel';
        panel.innerHTML = `
            <div class="backtest-header">
                <h3>백테스트</h3>
                <button class="close-btn" onclick="backtest.hidePanel()">×</button>
            </div>
            <div class="backtest-content">
                <div class="backtest-controls">
                    <div class="date-range">
                        <input type="date" id="backtest-start-date" />
                        <span>~</span>
                        <input type="date" id="backtest-end-date" />
                    </div>
                    <select id="backtest-strategy">
                        <option value="">전략 선택</option>
                    </select>
                    <button id="run-backtest-btn" class="primary-btn">
                        백테스트 실행
                    </button>
                </div>
                
                <div class="backtest-progress" style="display: none;">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: 0%"></div>
                    </div>
                    <span class="progress-text">0%</span>
                </div>
                
                <div class="backtest-results" style="display: none;">
                    <div class="metrics-grid">
                        <div class="metric-card">
                            <span class="label">총 수익률</span>
                            <span class="value" id="total-return">0%</span>
                        </div>
                        <div class="metric-card">
                            <span class="label">승률</span>
                            <span class="value" id="win-rate">0%</span>
                        </div>
                        <div class="metric-card">
                            <span class="label">샤프 비율</span>
                            <span class="value" id="sharpe-ratio">0</span>
                        </div>
                        <div class="metric-card">
                            <span class="label">최대 낙폭</span>
                            <span class="value" id="max-drawdown">0%</span>
                        </div>
                    </div>
                    
                    <div class="chart-container">
                        <canvas id="equity-chart"></canvas>
                    </div>
                    
                    <div class="trades-table">
                        <h4>최근 거래</h4>
                        <table>
                            <thead>
                                <tr>
                                    <th>시간</th>
                                    <th>종류</th>
                                    <th>가격</th>
                                    <th>수량</th>
                                    <th>손익</th>
                                </tr>
                            </thead>
                            <tbody id="trades-list"></tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }
    
    setupUIEventHandlers() {
        const runBtn = document.getElementById('run-backtest-btn');
        if (runBtn) {
            runBtn.addEventListener('click', () => this.runBacktestFromUI());
        }
        
        // Listen for events
        this.on('backtest:progress', (data) => {
            this.updateProgressUI(data.progress);
        });
        
        this.on('backtest:complete', (report) => {
            this.displayResults(report);
        });
    }
    
    async runBacktestFromUI() {
        const startDate = document.getElementById('backtest-start-date').value;
        const endDate = document.getElementById('backtest-end-date').value;
        const strategyName = document.getElementById('backtest-strategy').value;
        
        if (!startDate || !endDate || !strategyName) {
            alert('모든 필드를 입력해주세요.');
            return;
        }
        
        const strategy = this.strategies.get(strategyName);
        if (!strategy) {
            alert('전략을 찾을 수 없습니다.');
            return;
        }
        
        // Show progress
        document.querySelector('.backtest-progress').style.display = 'block';
        document.querySelector('.backtest-results').style.display = 'none';
        
        try {
            await this.runBacktest(strategy, startDate, endDate);
        } catch (error) {
            alert('백테스트 실행 중 오류가 발생했습니다.');
            console.error(error);
        }
    }
    
    updateProgressUI(progress) {
        const progressFill = document.querySelector('.progress-fill');
        const progressText = document.querySelector('.progress-text');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        if (progressText) {
            progressText.textContent = `${Math.round(progress)}%`;
        }
    }
    
    displayResults(report) {
        // Hide progress, show results
        document.querySelector('.backtest-progress').style.display = 'none';
        document.querySelector('.backtest-results').style.display = 'block';
        
        // Update metrics
        document.getElementById('total-return').textContent = 
            `${(report.summary.totalReturn * 100).toFixed(2)}%`;
        document.getElementById('win-rate').textContent = 
            `${(report.performance.winRate * 100).toFixed(1)}%`;
        document.getElementById('sharpe-ratio').textContent = 
            report.risk.sharpeRatio.toFixed(2);
        document.getElementById('max-drawdown').textContent = 
            `${(report.risk.maxDrawdown * 100).toFixed(1)}%`;
        
        // Draw equity chart
        if (report.charts && report.charts.equityCurve) {
            this.drawChart('equity-chart', report.charts.equityCurve);
        }
        
        // Display trades
        this.displayTrades(report.trades);
    }
    
    drawChart(canvasId, chartConfig) {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Simple chart drawing (in production, use Chart.js)
        const ctx = canvas.getContext('2d');
        const data = chartConfig.data.datasets[0].data;
        
        const width = canvas.width;
        const height = canvas.height;
        const padding = 40;
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw axes
        ctx.strokeStyle = '#666';
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, height - padding);
        ctx.lineTo(width - padding, height - padding);
        ctx.stroke();
        
        // Draw line
        if (data.length > 0) {
            const xStep = (width - 2 * padding) / (data.length - 1);
            const yMin = Math.min(...data);
            const yMax = Math.max(...data);
            const yScale = (height - 2 * padding) / (yMax - yMin);
            
            ctx.strokeStyle = '#2ECC71';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            data.forEach((value, i) => {
                const x = padding + i * xStep;
                const y = height - padding - (value - yMin) * yScale;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        }
    }
    
    displayTrades(trades) {
        const tbody = document.getElementById('trades-list');
        if (!tbody) return;
        
        tbody.innerHTML = trades.slice(-10).reverse().map(trade => `
            <tr class="${trade.realizedPnL > 0 ? 'profit' : 'loss'}">
                <td>${new Date(trade.exitTime).toLocaleString()}</td>
                <td>${trade.side}</td>
                <td>$${trade.exitPrice.toFixed(2)}</td>
                <td>${trade.quantity.toFixed(4)}</td>
                <td>${trade.realizedPnL > 0 ? '+' : ''}$${trade.realizedPnL.toFixed(2)}</td>
            </tr>
        `).join('');
    }
    
    // ===== HELPER METHODS =====
    resetBacktest() {
        this.account = {
            balance: this.account.initialBalance,
            initialBalance: this.account.initialBalance,
            positions: new Map(),
            orders: new Map(),
            history: []
        };
        
        this.results = {
            trades: [],
            equity: [{
                timestamp: Date.now(),
                value: this.account.initialBalance
            }],
            drawdown: [],
            metrics: {}
        };
    }
    
    updateEquity(candle) {
        // Calculate total equity including open positions
        let totalEquity = this.account.balance;
        
        for (const [id, position] of this.account.positions) {
            totalEquity += position.unrealizedPnL;
        }
        
        this.results.equity.push({
            timestamp: candle.timestamp,
            value: totalEquity
        });
        
        // Update account history
        this.account.history.push({
            type: 'equity',
            timestamp: candle.timestamp,
            balance: this.account.balance,
            equity: totalEquity,
            positions: this.account.positions.size
        });
    }
    
    recordTrade(position) {
        const trade = {
            id: position.id,
            symbol: position.symbol,
            side: position.side,
            entryTime: position.entryTime,
            entryPrice: position.entryPrice,
            exitTime: position.exitTime,
            exitPrice: position.exitPrice,
            quantity: position.quantity,
            realizedPnL: position.realizedPnL,
            holdTime: position.exitTime - position.entryTime,
            exitReason: position.exitReason || 'manual'
        };
        
        this.results.trades.push(trade);
        
        this.emit('trade:completed', trade);
    }
    
    calculateOrderSize(signal) {
        // Use risk manager if available
        if (this.bot.riskManager) {
            return this.bot.riskManager.calculatePositionSize(signal, this.account.balance);
        }
        
        // Default to 10% of balance
        return (this.account.balance * 0.1) / (signal.price || this.marketData.candles[this.marketData.candles.length - 1].close);
    }
    
    findPositionToClose(symbol, quantity) {
        for (const [id, position] of this.account.positions) {
            if (position.symbol === symbol) {
                return position;
            }
        }
        return null;
    }
    
    calculateSMA(values, period) {
        if (values.length < period) return 0;
        
        const sum = values.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }
    
    calculateRSI(closes, period = 14) {
        if (closes.length < period + 1) return 50;
        
        const changes = [];
        for (let i = 1; i < closes.length; i++) {
            changes.push(closes[i] - closes[i-1]);
        }
        
        const gains = changes.map(c => c > 0 ? c : 0);
        const losses = changes.map(c => c < 0 ? -c : 0);
        
        const avgGain = gains.slice(-period).reduce((a, b) => a + b, 0) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b, 0) / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    calculateATR(candles, period = 14) {
        if (candles.length < 2) return 0;
        
        const trueRanges = [];
        
        for (let i = 1; i < candles.length; i++) {
            const high = candles[i].high;
            const low = candles[i].low;
            const prevClose = candles[i-1].close;
            
            const tr = Math.max(
                high - low,
                Math.abs(high - prevClose),
                Math.abs(low - prevClose)
            );
            
            trueRanges.push(tr);
        }
        
        return this.calculateSMA(trueRanges, period);
    }
    
    calculateStdDev(values) {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        
        return Math.sqrt(variance);
    }
    
    calculateAvgHoldTime(trades) {
        if (trades.length === 0) return 0;
        
        const totalHoldTime = trades.reduce((sum, t) => sum + t.holdTime, 0);
        return totalHoldTime / trades.length / 3600000; // Convert to hours
    }
    
    annualizeReturn(returns) {
        if (returns.length === 0) return 0;
        
        const totalReturn = returns.reduce((acc, r) => acc * (1 + r), 1) - 1;
        const days = returns.length;
        
        return Math.pow(1 + totalReturn, 252 / days) - 1;
    }
    
    shuffleArray(array) {
        const shuffled = [...array];
        
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        
        return shuffled;
    }
    
    calculateEquityCurveFromTrades(trades, initialBalance) {
        const equity = [initialBalance];
        let balance = initialBalance;
        
        for (const trade of trades) {
            balance += trade.realizedPnL;
            equity.push(balance);
        }
        
        return equity;
    }
    
    mean(values) {
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
    
    median(values) {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        
        return sorted.length % 2 === 0 ?
            (sorted[mid - 1] + sorted[mid]) / 2 :
            sorted[mid];
    }
    
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    // ===== STRATEGY MANAGEMENT =====
    initializeStrategies() {
        // Register built-in strategies
        this.registerStrategy('sma_cross', {
            name: 'SMA Crossover',
            parameters: {
                fastPeriod: 20,
                slowPeriod: 50
            },
            analyze: async (market, account) => {
                const candles = market.candles;
                if (candles.length < 50) return [];
                
                const closes = candles.map(c => c.close);
                const fastSMA = this.calculateSMA(closes, 20);
                const slowSMA = this.calculateSMA(closes, 50);
                
                const prevFastSMA = this.calculateSMA(closes.slice(0, -1), 20);
                const prevSlowSMA = this.calculateSMA(closes.slice(0, -1), 50);
                
                const signals = [];
                
                // Golden cross
                if (prevFastSMA <= prevSlowSMA && fastSMA > slowSMA) {
                    signals.push({
                        type: 'buy',
                        confidence: 0.7,
                        reason: 'SMA Golden Cross'
                    });
                }
                
                // Death cross
                if (prevFastSMA >= prevSlowSMA && fastSMA < slowSMA) {
                    signals.push({
                        type: 'sell',
                        confidence: 0.7,
                        reason: 'SMA Death Cross'
                    });
                }
                
                return signals;
            }
        });
        
        this.registerStrategy('rsi_oversold', {
            name: 'RSI Oversold/Overbought',
            parameters: {
                period: 14,
                oversold: 30,
                overbought: 70
            },
            analyze: async (market, account) => {
                const candles = market.candles;
                if (candles.length < 15) return [];
                
                const closes = candles.map(c => c.close);
                const rsi = this.calculateRSI(closes, 14);
                const prevRSI = this.calculateRSI(closes.slice(0, -1), 14);
                
                const signals = [];
                
                // Oversold bounce
                if (prevRSI <= 30 && rsi > 30) {
                    signals.push({
                        type: 'buy',
                        confidence: 0.6,
                        reason: 'RSI Oversold Bounce'
                    });
                }
                
                // Overbought reversal
                if (prevRSI >= 70 && rsi < 70) {
                    signals.push({
                        type: 'sell',
                        confidence: 0.6,
                        reason: 'RSI Overbought Reversal'
                    });
                }
                
                return signals;
            }
        });
    }
    
    registerStrategy(name, strategy) {
        this.strategies.set(name, strategy);
        
        // Update UI
        const select = document.getElementById('backtest-strategy');
        if (select) {
            const option = document.createElement('option');
            option.value = name;
            option.textContent = strategy.name;
            select.appendChild(option);
        }
    }
    
    // ===== PUBLIC API =====
    async backtest(strategy, startDate, endDate, options) {
        return this.runBacktest(strategy, startDate, endDate, options);
    }
    
    async optimize(strategy, parameters, options) {
        return this.optimizeStrategy(strategy, parameters, options);
    }
    
    async monteCarlo(numSimulations) {
        return this.runMonteCarloSimulation(this.activeStrategy, numSimulations);
    }
    
    async walkForward(strategy, options) {
        return this.runWalkForwardAnalysis(strategy, options);
    }
    
    getResults() {
        return this.results.report;
    }
    
    getMetrics() {
        return this.results.metrics;
    }
    
    getTrades() {
        return this.results.trades;
    }
    
    getEquityCurve() {
        return this.results.equity;
    }
    
    async compareStrategies(strategies, startDate, endDate) {
        const results = [];
        
        for (const strategy of strategies) {
            const result = await this.runBacktest(strategy, startDate, endDate);
            results.push({
                strategy: strategy.name,
                metrics: result.metrics
            });
        }
        
        return {
            strategies: results,
            best: this.findBestStrategy(results)
        };
    }
    
    findBestStrategy(results, metric = 'sharpeRatio') {
        let best = results[0];
        
        for (const result of results) {
            if (result.metrics[metric] > best.metrics[metric]) {
                best = result;
            }
        }
        
        return best;
    }
    
    // ===== CLEANUP =====
    destroy() {
        // Stop any running backtests
        this.state.running = false;
        
        // Clear data
        this.historicalData.clear();
        this.strategies.clear();
        this.comparisons.clear();
        
        // Reset state
        this.resetBacktest();
        
        // Remove event listeners
        this.removeAllListeners();
        
        // Remove UI
        const panel = document.getElementById('backtest-panel');
        if (panel) panel.remove();
    }
    
    // ===== DATA PERSISTENCE =====
    async saveResults(report) {
        try {
            const results = JSON.parse(localStorage.getItem('backtest-results') || '[]');
            
            results.push({
                id: `backtest-${Date.now()}`,
                timestamp: Date.now(),
                strategy: report.summary.strategy,
                period: report.summary.period,
                metrics: report.performance,
                risk: report.risk
            });
            
            // Keep last 50 results
            if (results.length > 50) {
                results.shift();
            }
            
            localStorage.setItem('backtest-results', JSON.stringify(results));
            
        } catch (error) {
            console.error('Failed to save backtest results:', error);
        }
    }
    
    async loadSavedResults() {
        try {
            const results = JSON.parse(localStorage.getItem('backtest-results') || '[]');
            console.log(`Loaded ${results.length} saved backtest results`);
            return results;
        } catch (error) {
            console.error('Failed to load saved results:', error);
            return [];
        }
    }
}

export default BacktestPlugin;