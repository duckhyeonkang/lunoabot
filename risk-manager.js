/**
 * ⚠️ Trading Bot Risk Manager Plugin
 * Version: 2.1.0
 * 
 * 🛡️ Features:
 * - Position sizing algorithms
 * - Loss limits & drawdown control
 * - Risk metrics calculation
 * - Portfolio risk management
 * - Automated protection systems
 * - Exposure management
 * - Alert & warning systems
 * - Stress testing
 * - Risk reporting
 * - Adaptive risk adjustment
 */

import { EventEmitter } from '../tradingcore/event-emitter.js';

class RiskManagerPlugin extends EventEmitter {
    constructor(tradingBot) {
        super();
        this.bot = tradingBot;
        this.config = tradingBot.config.riskManager || this.getDefaultConfig();
        
        // Risk state
        this.riskState = {
            currentLevel: 'low',
            score: 85,
            alerts: new Map(),
            violations: []
        };
        
        // Position tracking
        this.positions = new Map();
        this.exposure = {
            total: 0,
            byAsset: new Map(),
            bySector: new Map(),
            byStrategy: new Map()
        };
        
        // Loss tracking
        this.losses = {
            daily: 0,
            weekly: 0,
            monthly: 0,
            consecutive: 0,
            maxDrawdown: 0,
            currentDrawdown: 0
        };
        
        // Risk metrics
        this.metrics = {
            var: { daily: 0, weekly: 0 },
            cvar: { daily: 0, weekly: 0 },
            sharpe: 0,
            sortino: 0,
            beta: 0,
            correlation: new Map(),
            volatility: 0
        };
        
        // Protection systems
        this.protectionSystems = {
            stopLoss: new Map(),
            trailingStop: new Map(),
            circuitBreakers: new Map()
        };
        
        // Risk limits
        this.limits = this.config.limits;
        
        // Historical data
        this.history = {
            returns: [],
            drawdowns: [],
            violations: [],
            adjustments: []
        };
        
        // Stress test scenarios
        this.stressScenarios = this.loadStressScenarios();
        
        this.init();
    }
    
    getDefaultConfig() {
        return {
            enabled: true,
            limits: {
                daily: {
                    loss: 0.05,        // 5% daily loss limit
                    trades: 50,        // Max trades per day
                    exposure: 1.0      // 100% max exposure
                },
                position: {
                    size: 0.02,        // 2% max per position
                    loss: 0.01,        // 1% max loss per trade
                    concentration: 0.2  // 20% max in single asset
                },
                portfolio: {
                    leverage: 2,       // 2x max leverage
                    var95: 0.1,       // 10% VaR limit
                    drawdown: 0.2,    // 20% max drawdown
                    correlation: 0.7   // 70% max correlation
                }
            },
            protection: {
                stopLoss: {
                    enabled: true,
                    type: 'fixed',     // fixed, atr, volatility
                    value: 0.02        // 2% stop loss
                },
                trailingStop: {
                    enabled: true,
                    activation: 0.01,  // Activate at 1% profit
                    distance: 0.005    // 0.5% trailing distance
                },
                circuitBreaker: {
                    enabled: true,
                    threshold: 0.03,   // 3% portfolio loss
                    cooldown: 3600000  // 1 hour cooldown
                }
            },
            sizing: {
                method: 'kelly',       // kelly, fixed, volatility, equal
                kelly: {
                    fraction: 0.25,    // Kelly fraction
                    max: 0.02          // Max 2% even if Kelly suggests more
                },
                volatility: {
                    target: 0.01,      // 1% volatility target
                    lookback: 20       // 20 period lookback
                }
            },
            alerts: {
                riskLevel: {
                    medium: 0.7,       // 70% of limits
                    high: 0.85,        // 85% of limits
                    critical: 0.95     // 95% of limits
                },
                notifications: {
                    email: false,
                    push: true,
                    sound: true
                }
            },
            reporting: {
                enabled: true,
                interval: 3600000,     // Hourly reports
                detailed: true
            },
            adaptation: {
                enabled: true,
                factors: ['volatility', 'drawdown', 'regime', 'performance']
            }
        };
    }
    
    async init() {
        try {
            // Load historical data
            await this.loadHistoricalData();
            
            // Calculate initial metrics
            this.calculateRiskMetrics();
            
            // Setup monitoring
            this.setupMonitoring();
            
            // Initialize protection systems
            this.initializeProtectionSystems();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize UI
            this.initializeUI();
            
            // Start risk assessment
            this.startRiskAssessment();
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('Risk Manager initialization failed:', error);
            this.emit('error', { type: 'init_failed', error });
        }
    }
    
    // ===== POSITION SIZING =====
    calculatePositionSize(signal, balance) {
        const method = this.config.sizing.method;
        let size = 0;
        
        switch (method) {
            case 'kelly':
                size = this.kellyPositionSize(signal, balance);
                break;
            case 'fixed':
                size = this.fixedPositionSize(balance);
                break;
            case 'volatility':
                size = this.volatilityPositionSize(signal, balance);
                break;
            case 'equal':
                size = this.equalPositionSize(balance);
                break;
            default:
                size = this.fixedPositionSize(balance);
        }
        
        // Apply limits
        size = this.applyPositionLimits(size, signal, balance);
        
        // Check if position is allowed
        if (!this.canOpenPosition(size, signal)) {
            return 0;
        }
        
        return size;
    }
    
    kellyPositionSize(signal, balance) {
        // Kelly Criterion: f = (p*b - q) / b
        // f = fraction to bet
        // p = probability of win
        // q = probability of loss (1-p)
        // b = odds (win/loss ratio)
        
        const winRate = signal.confidence || 0.55;
        const winAmount = signal.expectedReturn || 0.02;
        const lossAmount = signal.expectedLoss || 0.01;
        const odds = winAmount / lossAmount;
        
        const kellyFraction = (winRate * odds - (1 - winRate)) / odds;
        
        // Apply Kelly fraction limit
        const adjustedFraction = Math.min(
            kellyFraction * this.config.sizing.kelly.fraction,
            this.config.sizing.kelly.max
        );
        
        // Ensure positive and reasonable size
        const size = Math.max(0, Math.min(adjustedFraction, 0.25));
        
        return size * balance;
    }
    
    fixedPositionSize(balance) {
        return balance * this.config.limits.position.size;
    }
    
    volatilityPositionSize(signal, balance) {
        const targetVolatility = this.config.sizing.volatility.target;
        const currentVolatility = this.calculateVolatility(
            signal.symbol,
            this.config.sizing.volatility.lookback
        );
        
        if (currentVolatility === 0) {
            return this.fixedPositionSize(balance);
        }
        
        // Size inversely proportional to volatility
        const size = (targetVolatility / currentVolatility) * this.config.limits.position.size;
        
        return Math.min(size, this.config.limits.position.size) * balance;
    }
    
    equalPositionSize(balance) {
        const activePositions = this.positions.size;
        const maxPositions = 10; // Maximum concurrent positions
        
        if (activePositions >= maxPositions) {
            return 0;
        }
        
        return balance / (maxPositions - activePositions);
    }
    
    applyPositionLimits(size, signal, balance) {
        // Maximum position size
        const maxSize = balance * this.config.limits.position.size;
        size = Math.min(size, maxSize);
        
        // Concentration limit
        const assetExposure = this.exposure.byAsset.get(signal.symbol) || 0;
        const maxConcentration = balance * this.config.limits.position.concentration;
        
        if (assetExposure + size > maxConcentration) {
            size = Math.max(0, maxConcentration - assetExposure);
        }
        
        // Total exposure limit
        const totalExposure = this.exposure.total;
        const maxExposure = balance * this.config.limits.daily.exposure;
        
        if (totalExposure + size > maxExposure) {
            size = Math.max(0, maxExposure - totalExposure);
        }
        
        // Leverage limit
        const currentLeverage = totalExposure / balance;
        if (currentLeverage >= this.config.limits.portfolio.leverage) {
            size = 0;
        }
        
        // Risk-based adjustment
        size = this.adjustSizeForRisk(size);
        
        return size;
    }
    
    adjustSizeForRisk(size) {
        // Reduce size based on risk level
        switch (this.riskState.currentLevel) {
            case 'low':
                return size;
            case 'medium':
                return size * 0.75;
            case 'high':
                return size * 0.5;
            case 'critical':
                return size * 0.25;
            default:
                return size;
        }
    }
    
    canOpenPosition(size, signal) {
        // Check daily trade limit
        const tradestoday = this.getTradesToday();
        if (tradestoday >= this.config.limits.daily.trades) {
            this.addViolation('daily_trade_limit', 'Daily trade limit reached');
            return false;
        }
        
        // Check daily loss limit
        if (this.losses.daily >= this.config.limits.daily.loss) {
            this.addViolation('daily_loss_limit', 'Daily loss limit reached');
            return false;
        }
        
        // Check circuit breaker
        if (this.isCircuitBreakerActive()) {
            this.addViolation('circuit_breaker', 'Circuit breaker active');
            return false;
        }
        
        // Check correlation limits
        if (!this.checkCorrelationLimits(signal)) {
            this.addViolation('correlation_limit', 'Correlation limit exceeded');
            return false;
        }
        
        return true;
    }
    
    // ===== LOSS MANAGEMENT =====
    updateLosses(trade) {
        const loss = trade.profit < 0 ? Math.abs(trade.profit) : 0;
        const profit = trade.profit > 0 ? trade.profit : 0;
        
        // Update daily loss
        this.losses.daily += loss;
        
        // Update weekly/monthly
        this.losses.weekly += loss;
        this.losses.monthly += loss;
        
        // Update consecutive losses
        if (loss > 0) {
            this.losses.consecutive++;
        } else if (profit > 0) {
            this.losses.consecutive = 0;
        }
        
        // Update drawdown
        this.updateDrawdown(trade);
        
        // Check loss limits
        this.checkLossLimits();
    }
    
    updateDrawdown(trade) {
        // Calculate current equity curve
        const equity = this.calculateEquity();
        const peak = this.getEquityPeak();
        
        // Current drawdown
        this.losses.currentDrawdown = peak > 0 ? (peak - equity) / peak : 0;
        
        // Maximum drawdown
        this.losses.maxDrawdown = Math.max(
            this.losses.maxDrawdown,
            this.losses.currentDrawdown
        );
        
        // Store in history
        this.history.drawdowns.push({
            timestamp: Date.now(),
            drawdown: this.losses.currentDrawdown,
            equity: equity
        });
        
        // Limit history size
        if (this.history.drawdowns.length > 1000) {
            this.history.drawdowns.shift();
        }
    }
    
    checkLossLimits() {
        // Daily loss limit
        if (this.losses.daily >= this.config.limits.daily.loss) {
            this.triggerAlert('daily_loss_limit', {
                current: this.losses.daily,
                limit: this.config.limits.daily.loss
            });
            
            // Activate circuit breaker
            this.activateCircuitBreaker('daily_loss');
        }
        
        // Drawdown limit
        if (this.losses.currentDrawdown >= this.config.limits.portfolio.drawdown) {
            this.triggerAlert('drawdown_limit', {
                current: this.losses.currentDrawdown,
                limit: this.config.limits.portfolio.drawdown
            });
            
            // Emergency stop
            this.emergencyStop();
        }
        
        // Consecutive loss limit
        if (this.losses.consecutive >= 5) {
            this.triggerAlert('consecutive_losses', {
                count: this.losses.consecutive
            });
            
            // Reduce position sizes
            this.reduceRiskExposure();
        }
    }
    
    // ===== STOP LOSS MANAGEMENT =====
    setStopLoss(position) {
        if (!this.config.protection.stopLoss.enabled) return;
        
        const stopLossConfig = this.config.protection.stopLoss;
        let stopPrice;
        
        switch (stopLossConfig.type) {
            case 'fixed':
                stopPrice = this.calculateFixedStop(position, stopLossConfig.value);
                break;
            case 'atr':
                stopPrice = this.calculateATRStop(position);
                break;
            case 'volatility':
                stopPrice = this.calculateVolatilityStop(position);
                break;
            default:
                stopPrice = this.calculateFixedStop(position, stopLossConfig.value);
        }
        
        // Store stop loss
        this.protectionSystems.stopLoss.set(position.id, {
            price: stopPrice,
            type: stopLossConfig.type,
            activated: false
        });
        
        // Create stop order
        this.createStopOrder(position, stopPrice);
        
        return stopPrice;
    }
    
    calculateFixedStop(position, percentage) {
        const direction = position.side === 'buy' ? -1 : 1;
        return position.entryPrice * (1 + direction * percentage);
    }
    
    calculateATRStop(position) {
        const atr = this.calculateATR(position.symbol, 14);
        const multiplier = 2; // 2x ATR
        const direction = position.side === 'buy' ? -1 : 1;
        
        return position.entryPrice + (direction * atr * multiplier);
    }
    
    calculateVolatilityStop(position) {
        const volatility = this.calculateVolatility(position.symbol, 20);
        const stdDevs = 2; // 2 standard deviations
        const direction = position.side === 'buy' ? -1 : 1;
        
        return position.entryPrice * (1 + direction * volatility * stdDevs);
    }
    
    // ===== TRAILING STOP =====
    updateTrailingStop(position, currentPrice) {
        if (!this.config.protection.trailingStop.enabled) return;
        
        const trailingConfig = this.config.protection.trailingStop;
        const profit = position.side === 'buy' ? 
            (currentPrice - position.entryPrice) / position.entryPrice :
            (position.entryPrice - currentPrice) / position.entryPrice;
        
        // Check if trailing stop should be activated
        if (profit >= trailingConfig.activation) {
            let trailingStop = this.protectionSystems.trailingStop.get(position.id);
            
            if (!trailingStop) {
                // Initialize trailing stop
                trailingStop = {
                    activated: true,
                    price: this.calculateTrailingPrice(position, currentPrice, trailingConfig.distance),
                    highWaterMark: currentPrice
                };
                
                this.protectionSystems.trailingStop.set(position.id, trailingStop);
            } else {
                // Update trailing stop
                if (position.side === 'buy' && currentPrice > trailingStop.highWaterMark) {
                    trailingStop.highWaterMark = currentPrice;
                    trailingStop.price = currentPrice * (1 - trailingConfig.distance);
                } else if (position.side === 'sell' && currentPrice < trailingStop.highWaterMark) {
                    trailingStop.highWaterMark = currentPrice;
                    trailingStop.price = currentPrice * (1 + trailingConfig.distance);
                }
            }
            
            // Update stop order
            this.updateStopOrder(position, trailingStop.price);
        }
    }
    
    calculateTrailingPrice(position, currentPrice, distance) {
        if (position.side === 'buy') {
            return currentPrice * (1 - distance);
        } else {
            return currentPrice * (1 + distance);
        }
    }
    
    // ===== RISK METRICS =====
    calculateRiskMetrics() {
        // Value at Risk (VaR)
        this.calculateVaR();
        
        // Conditional VaR (CVaR)
        this.calculateCVaR();
        
        // Sharpe Ratio
        this.calculateSharpeRatio();
        
        // Sortino Ratio
        this.calculateSortinoRatio();
        
        // Beta
        this.calculateBeta();
        
        // Correlation Matrix
        this.calculateCorrelations();
        
        // Portfolio Volatility
        this.calculatePortfolioVolatility();
    }
    
    calculateVaR(confidence = 0.95, periods = 1) {
        const returns = this.history.returns.slice(-252); // Last year
        
        if (returns.length < 30) {
            return { daily: 0, weekly: 0 };
        }
        
        // Sort returns
        const sortedReturns = [...returns].sort((a, b) => a - b);
        
        // Find percentile
        const index = Math.floor((1 - confidence) * sortedReturns.length);
        const dailyVaR = Math.abs(sortedReturns[index]);
        
        // Scale to weekly
        const weeklyVaR = dailyVaR * Math.sqrt(5);
        
        this.metrics.var = {
            daily: dailyVaR,
            weekly: weeklyVaR,
            confidence: confidence
        };
        
        return this.metrics.var;
    }
    
    calculateCVaR(confidence = 0.95) {
        const returns = this.history.returns.slice(-252);
        
        if (returns.length < 30) {
            return { daily: 0, weekly: 0 };
        }
        
        // Sort returns
        const sortedReturns = [...returns].sort((a, b) => a - b);
        
        // Find VaR index
        const varIndex = Math.floor((1 - confidence) * sortedReturns.length);
        
        // Calculate average of returns worse than VaR
        const tailReturns = sortedReturns.slice(0, varIndex);
        const dailyCVaR = Math.abs(
            tailReturns.reduce((a, b) => a + b, 0) / tailReturns.length
        );
        
        const weeklyCVaR = dailyCVaR * Math.sqrt(5);
        
        this.metrics.cvar = {
            daily: dailyCVaR,
            weekly: weeklyCVaR,
            confidence: confidence
        };
        
        return this.metrics.cvar;
    }
    
    calculateSharpeRatio() {
        const returns = this.history.returns.slice(-252);
        
        if (returns.length < 30) {
            this.metrics.sharpe = 0;
            return 0;
        }
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const riskFreeRate = 0.02 / 252; // 2% annual risk-free rate
        
        const excessReturns = returns.map(r => r - riskFreeRate);
        const stdDev = this.calculateStandardDeviation(excessReturns);
        
        // Annualized Sharpe ratio
        this.metrics.sharpe = stdDev > 0 ? 
            (avgReturn - riskFreeRate) / stdDev * Math.sqrt(252) : 0;
        
        return this.metrics.sharpe;
    }
    
    calculateSortinoRatio() {
        const returns = this.history.returns.slice(-252);
        
        if (returns.length < 30) {
            this.metrics.sortino = 0;
            return 0;
        }
        
        const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const riskFreeRate = 0.02 / 252;
        
        // Downside returns only
        const downsideReturns = returns.filter(r => r < riskFreeRate);
        const downsideDeviation = this.calculateStandardDeviation(downsideReturns);
        
        // Annualized Sortino ratio
        this.metrics.sortino = downsideDeviation > 0 ?
            (avgReturn - riskFreeRate) / downsideDeviation * Math.sqrt(252) : 0;
        
        return this.metrics.sortino;
    }
    
    calculateBeta() {
        // Calculate beta relative to market (BTC as proxy)
        const portfolioReturns = this.history.returns.slice(-252);
        const marketReturns = this.getMarketReturns('BTCUSDT', 252);
        
        if (portfolioReturns.length < 30 || marketReturns.length < 30) {
            this.metrics.beta = 1;
            return 1;
        }
        
        // Calculate covariance and market variance
        const covariance = this.calculateCovariance(portfolioReturns, marketReturns);
        const marketVariance = this.calculateVariance(marketReturns);
        
        this.metrics.beta = marketVariance > 0 ? covariance / marketVariance : 1;
        
        return this.metrics.beta;
    }
    
    // ===== CIRCUIT BREAKERS =====
    activateCircuitBreaker(reason) {
        const breaker = {
            reason: reason,
            activatedAt: Date.now(),
            expiresAt: Date.now() + this.config.protection.circuitBreaker.cooldown,
            active: true
        };
        
        this.protectionSystems.circuitBreakers.set(reason, breaker);
        
        // Stop all trading
        this.bot.tradingEngine.pause();
        
        // Cancel all open orders
        this.cancelAllOrders();
        
        // Send alert
        this.triggerAlert('circuit_breaker_activated', {
            reason: reason,
            duration: this.config.protection.circuitBreaker.cooldown
        });
        
        // Schedule reactivation
        setTimeout(() => {
            this.deactivateCircuitBreaker(reason);
        }, this.config.protection.circuitBreaker.cooldown);
    }
    
    deactivateCircuitBreaker(reason) {
        const breaker = this.protectionSystems.circuitBreakers.get(reason);
        if (breaker) {
            breaker.active = false;
            this.emit('circuit_breaker:deactivated', { reason });
        }
    }
    
    isCircuitBreakerActive() {
        for (const [reason, breaker] of this.protectionSystems.circuitBreakers) {
            if (breaker.active && Date.now() < breaker.expiresAt) {
                return true;
            }
        }
        return false;
    }
    
    // ===== RISK ASSESSMENT =====
    startRiskAssessment() {
        // Real-time monitoring
        this.assessmentInterval = setInterval(() => {
            this.assessCurrentRisk();
        }, 5000); // Every 5 seconds
        
        // Deep analysis
        this.analysisInterval = setInterval(() => {
            this.performDeepRiskAnalysis();
        }, 300000); // Every 5 minutes
    }
    
    assessCurrentRisk() {
        const factors = {
            exposure: this.assessExposureRisk(),
            volatility: this.assessVolatilityRisk(),
            correlation: this.assessCorrelationRisk(),
            drawdown: this.assessDrawdownRisk(),
            liquidity: this.assessLiquidityRisk()
        };
        
        // Calculate weighted risk score
        const weights = {
            exposure: 0.25,
            volatility: 0.20,
            correlation: 0.20,
            drawdown: 0.25,
            liquidity: 0.10
        };
        
        let totalScore = 0;
        let totalWeight = 0;
        
        for (const [factor, score] of Object.entries(factors)) {
            totalScore += score * weights[factor];
            totalWeight += weights[factor];
        }
        
        this.riskState.score = Math.round((1 - totalScore / totalWeight) * 100);
        
        // Determine risk level
        if (this.riskState.score >= 80) {
            this.riskState.currentLevel = 'low';
        } else if (this.riskState.score >= 60) {
            this.riskState.currentLevel = 'medium';
        } else if (this.riskState.score >= 40) {
            this.riskState.currentLevel = 'high';
        } else {
            this.riskState.currentLevel = 'critical';
        }
        
        // Update UI
        this.updateRiskUI();
        
        // Emit risk update
        this.emit('risk:updated', {
            level: this.riskState.currentLevel,
            score: this.riskState.score,
            factors: factors
        });
    }
    
    assessExposureRisk() {
        const balance = this.bot.getBalance();
        const exposureRatio = this.exposure.total / balance;
        const limit = this.config.limits.daily.exposure;
        
        return Math.min(exposureRatio / limit, 1);
    }
    
    assessVolatilityRisk() {
        const currentVol = this.metrics.volatility;
        const historicalVol = this.getHistoricalVolatility();
        
        if (historicalVol === 0) return 0;
        
        const volRatio = currentVol / historicalVol;
        return Math.min(Math.max(volRatio - 1, 0), 1);
    }
    
    assessCorrelationRisk() {
        let maxCorrelation = 0;
        
        for (const [pair, correlation] of this.metrics.correlation) {
            maxCorrelation = Math.max(maxCorrelation, Math.abs(correlation));
        }
        
        return maxCorrelation;
    }
    
    assessDrawdownRisk() {
        const currentDD = this.losses.currentDrawdown;
        const maxDD = this.config.limits.portfolio.drawdown;
        
        return Math.min(currentDD / maxDD, 1);
    }
    
    assessLiquidityRisk() {
        // Check order book depth for open positions
        let liquidityScore = 0;
        let positionCount = 0;
        
        for (const [id, position] of this.positions) {
            const liquidity = this.checkPositionLiquidity(position);
            liquidityScore += liquidity;
            positionCount++;
        }
        
        return positionCount > 0 ? 1 - (liquidityScore / positionCount) : 0;
    }
    
    // ===== STRESS TESTING =====
    async runStressTest(scenario) {
        console.log(`Running stress test: ${scenario.name}`);
        
        const results = {
            scenario: scenario.name,
            timestamp: Date.now(),
            impacts: {},
            worstCase: 0,
            recommendations: []
        };
        
        // Apply scenario shocks
        for (const [asset, shock] of Object.entries(scenario.shocks)) {
            const impact = await this.calculateScenarioImpact(asset, shock);
            results.impacts[asset] = impact;
            results.worstCase += impact.portfolioImpact;
        }
        
        // Generate recommendations
        if (results.worstCase < -0.1) { // 10% loss
            results.recommendations.push('Reduce leverage');
            results.recommendations.push('Increase hedging');
            results.recommendations.push('Diversify portfolio');
        }
        
        // Store results
        this.stressTestResults = results;
        
        return results;
    }
    
    loadStressScenarios() {
        return {
            'market_crash': {
                name: 'Market Crash',
                description: '2008-style financial crisis',
                shocks: {
                    'BTC': -0.50,
                    'ETH': -0.60,
                    'stocks': -0.40
                }
            },
            'flash_crash': {
                name: 'Flash Crash',
                description: 'Sudden liquidity crisis',
                shocks: {
                    'all': -0.30
                },
                duration: 3600000 // 1 hour
            },
            'black_swan': {
                name: 'Black Swan',
                description: 'Unexpected major event',
                shocks: {
                    'all': -0.70,
                    'volatility': 3.0
                }
            },
            'correlation_breakdown': {
                name: 'Correlation Breakdown',
                description: 'Diversification failure',
                correlations: 0.95
            }
        };
    }
    
    // ===== REPORTING =====
    generateRiskReport() {
        const report = {
            timestamp: Date.now(),
            summary: {
                riskLevel: this.riskState.currentLevel,
                riskScore: this.riskState.score,
                totalExposure: this.exposure.total,
                openPositions: this.positions.size
            },
            metrics: {
                var: this.metrics.var,
                cvar: this.metrics.cvar,
                sharpe: this.metrics.sharpe,
                sortino: this.metrics.sortino,
                beta: this.metrics.beta,
                maxDrawdown: this.losses.maxDrawdown,
                currentDrawdown: this.losses.currentDrawdown
            },
            losses: {
                daily: this.losses.daily,
                weekly: this.losses.weekly,
                monthly: this.losses.monthly,
                consecutive: this.losses.consecutive
            },
            violations: this.history.violations.slice(-10),
            alerts: Array.from(this.riskState.alerts.values()),
            recommendations: this.generateRecommendations()
        };
        
        // Save report
        this.saveRiskReport(report);
        
        // Emit report event
        this.emit('report:generated', report);
        
        return report;
    }
    
    generateRecommendations() {
        const recommendations = [];
        
        // Based on risk level
        if (this.riskState.currentLevel === 'high' || this.riskState.currentLevel === 'critical') {
            recommendations.push({
                priority: 'high',
                action: 'Reduce position sizes by 50%',
                reason: 'High risk level detected'
            });
        }
        
        // Based on drawdown
        if (this.losses.currentDrawdown > 0.1) {
            recommendations.push({
                priority: 'medium',
                action: 'Implement tighter stop losses',
                reason: `Current drawdown: ${(this.losses.currentDrawdown * 100).toFixed(1)}%`
            });
        }
        
        // Based on correlation
        let highCorrelations = 0;
        for (const [pair, correlation] of this.metrics.correlation) {
            if (Math.abs(correlation) > 0.7) highCorrelations++;
        }
        
        if (highCorrelations > 2) {
            recommendations.push({
                priority: 'medium',
                action: 'Diversify portfolio',
                reason: 'High correlations detected between positions'
            });
        }
        
        // Based on Sharpe ratio
        if (this.metrics.sharpe < 0.5) {
            recommendations.push({
                priority: 'low',
                action: 'Review trading strategy',
                reason: `Low risk-adjusted returns (Sharpe: ${this.metrics.sharpe.toFixed(2)})`
            });
        }
        
        return recommendations;
    }
    
    // ===== UI INTEGRATION =====
    initializeUI() {
        // Update risk panel elements
        this.riskLevelElement = document.getElementById('risk-level');
        this.riskScoreElement = document.getElementById('risk-score');
        
        // Update metrics displays
        this.varElement = document.getElementById('var-1d');
        this.betaElement = document.getElementById('portfolio-beta');
        this.correlationElement = document.getElementById('correlation');
        
        // Initialize risk dashboard
        this.createRiskDashboard();
    }
    
    updateRiskUI() {
        // Update risk level
        if (this.riskLevelElement) {
            this.riskLevelElement.textContent = this.getRiskLevelText();
            this.riskLevelElement.className = `risk-level ${this.riskState.currentLevel}`;
        }
        
        // Update risk score
        if (this.riskScoreElement) {
            this.riskScoreElement.textContent = `${this.riskState.score}/100`;
        }
        
        // Update VaR
        if (this.varElement) {
            const balance = this.bot.getBalance();
            const varAmount = balance * this.metrics.var.daily;
            this.varElement.textContent = `$${varAmount.toFixed(0)}`;
        }
        
        // Update Beta
        if (this.betaElement) {
            this.betaElement.textContent = this.metrics.beta.toFixed(2);
        }
        
        // Update correlations
        if (this.correlationElement) {
            const maxCorr = Math.max(...Array.from(this.metrics.correlation.values()));
            this.correlationElement.textContent = maxCorr.toFixed(2);
        }
        
        // Update protection settings UI
        this.updateProtectionUI();
    }
    
    getRiskLevelText() {
        const levels = {
            low: '안전',
            medium: '주의',
            high: '위험',
            critical: '긴급'
        };
        
        return levels[this.riskState.currentLevel] || '알 수 없음';
    }
    
    createRiskDashboard() {
        // Create detailed risk dashboard
        const dashboard = document.createElement('div');
        dashboard.className = 'risk-dashboard';
        dashboard.innerHTML = `
            <div class="risk-header">
                <h3>리스크 대시보드</h3>
                <div class="risk-summary">
                    <div class="risk-score-visual">
                        <svg viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r="45" fill="none" stroke="#333" stroke-width="5"/>
                            <circle cx="50" cy="50" r="45" fill="none" 
                                stroke="${this.getRiskColor()}" 
                                stroke-width="5"
                                stroke-dasharray="${this.riskState.score * 2.83} 283"
                                transform="rotate(-90 50 50)"/>
                        </svg>
                        <div class="score-text">${this.riskState.score}</div>
                    </div>
                </div>
            </div>
            <div class="risk-metrics">
                <div class="metric-card">
                    <span class="metric-label">일일 VaR (95%)</span>
                    <span class="metric-value">${(this.metrics.var.daily * 100).toFixed(2)}%</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">현재 낙폭</span>
                    <span class="metric-value">${(this.losses.currentDrawdown * 100).toFixed(2)}%</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">샤프 비율</span>
                    <span class="metric-value">${this.metrics.sharpe.toFixed(2)}</span>
                </div>
                <div class="metric-card">
                    <span class="metric-label">베타</span>
                    <span class="metric-value">${this.metrics.beta.toFixed(2)}</span>
                </div>
            </div>
        `;
        
        // Add to UI if container exists
        const container = document.querySelector('.risk-panel .panel-content');
        if (container) {
            container.appendChild(dashboard);
        }
    }
    
    getRiskColor() {
        if (this.riskState.score >= 80) return '#00C851';
        if (this.riskState.score >= 60) return '#FFC107';
        if (this.riskState.score >= 40) return '#FF8800';
        return '#FF4444';
    }
    
    // ===== ALERT SYSTEM =====
    triggerAlert(type, data) {
        const alert = {
            id: `alert-${Date.now()}`,
            type: type,
            data: data,
            timestamp: Date.now(),
            severity: this.getAlertSeverity(type)
        };
        
        this.riskState.alerts.set(alert.id, alert);
        
        // Show notification
        if (this.config.alerts.notifications.push) {
            this.bot.ui.showNotification({
                type: alert.severity,
                title: '리스크 경고',
                message: this.getAlertMessage(type, data),
                duration: 10000
            });
        }
        
        // Play sound
        if (this.config.alerts.notifications.sound) {
            this.playAlertSound(alert.severity);
        }
        
        // Emit alert event
        this.emit('alert:triggered', alert);
        
        // Auto-dismiss after 1 hour
        setTimeout(() => {
            this.riskState.alerts.delete(alert.id);
        }, 3600000);
    }
    
    getAlertSeverity(type) {
        const severities = {
            'daily_loss_limit': 'critical',
            'drawdown_limit': 'critical',
            'circuit_breaker_activated': 'critical',
            'consecutive_losses': 'high',
            'high_correlation': 'medium',
            'volatility_spike': 'medium',
            'position_limit': 'low'
        };
        
        return severities[type] || 'info';
    }
    
    getAlertMessage(type, data) {
        const messages = {
            'daily_loss_limit': `일일 손실 한도 도달: ${(data.current * 100).toFixed(1)}%`,
            'drawdown_limit': `최대 낙폭 한도 도달: ${(data.current * 100).toFixed(1)}%`,
            'circuit_breaker_activated': `회로 차단기 작동: ${data.reason}`,
            'consecutive_losses': `연속 손실: ${data.count}회`,
            'high_correlation': `높은 상관관계 감지: ${data.correlation.toFixed(2)}`,
            'volatility_spike': `변동성 급증: ${(data.volatility * 100).toFixed(1)}%`,
            'position_limit': `포지션 한도 도달`
        };
        
        return messages[type] || '리스크 경고';
    }
    
    playAlertSound(severity) {
        // Create audio context for alert sounds
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // Different frequencies for different severities
        const frequencies = {
            'critical': 880,  // A5
            'high': 660,      // E5
            'medium': 440,    // A4
            'low': 330        // E4
        };
        
        oscillator.frequency.value = frequencies[severity] || 440;
        gainNode.gain.value = 0.1;
        
        oscillator.start();
        oscillator.stop(audioContext.currentTime + 0.2);
    }
    
    // ===== HELPER METHODS =====
    calculateVolatility(symbol, period) {
        // Get price data
        const prices = this.getPriceHistory(symbol, period);
        if (prices.length < 2) return 0;
        
        // Calculate returns
        const returns = [];
        for (let i = 1; i < prices.length; i++) {
            returns.push((prices[i] - prices[i-1]) / prices[i-1]);
        }
        
        // Calculate standard deviation
        const stdDev = this.calculateStandardDeviation(returns);
        
        // Annualized volatility
        return stdDev * Math.sqrt(252);
    }
    
    calculateATR(symbol, period) {
        const candles = this.getCandleHistory(symbol, period + 1);
        if (candles.length < period) return 0;
        
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
        
        // Calculate average
        return trueRanges.slice(-period).reduce((a, b) => a + b, 0) / period;
    }
    
    calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
        
        return Math.sqrt(variance);
    }
    
    calculateCovariance(series1, series2) {
        if (series1.length !== series2.length || series1.length === 0) return 0;
        
        const mean1 = series1.reduce((a, b) => a + b, 0) / series1.length;
        const mean2 = series2.reduce((a, b) => a + b, 0) / series2.length;
        
        let covariance = 0;
        for (let i = 0; i < series1.length; i++) {
            covariance += (series1[i] - mean1) * (series2[i] - mean2);
        }
        
        return covariance / series1.length;
    }
    
    calculateVariance(values) {
        if (values.length === 0) return 0;
        
        const mean = values.reduce((a, b) => a + b, 0) / values.length;
        const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
        
        return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    }
    
    // ===== EVENT LISTENERS =====
    setupEventListeners() {
        // Position updates
        this.bot.on('position:opened', (position) => {
            this.addPosition(position);
            this.setStopLoss(position);
            this.updateExposure();
        });
        
        this.bot.on('position:closed', (position) => {
            this.removePosition(position.id);
            this.updateLosses(position);
            this.updateExposure();
        });
        
        // Price updates for trailing stops
        this.bot.on('price:update', (data) => {
            this.updateTrailingStops(data);
        });
        
        // Trade execution
        this.bot.on('trade:executed', (trade) => {
            this.recordTrade(trade);
            this.calculateRiskMetrics();
        });
        
        // Daily reset
        this.scheduleDailyReset();
    }
    
    addPosition(position) {
        this.positions.set(position.id, {
            ...position,
            addedAt: Date.now(),
            currentPrice: position.entryPrice,
            unrealizedPnL: 0
        });
        
        this.updateExposure();
    }
    
    removePosition(positionId) {
        const position = this.positions.get(positionId);
        if (!position) return;
        
        this.positions.delete(positionId);
        
        // Clean up protection systems
        this.protectionSystems.stopLoss.delete(positionId);
        this.protectionSystems.trailingStop.delete(positionId);
        
        this.updateExposure();
    }
    
    updateExposure() {
        // Reset exposure
        this.exposure.total = 0;
        this.exposure.byAsset.clear();
        this.exposure.bySector.clear();
        this.exposure.byStrategy.clear();
        
        // Calculate current exposure
        for (const [id, position] of this.positions) {
            const positionValue = position.quantity * position.currentPrice;
            
            this.exposure.total += positionValue;
            
            // By asset
            const assetExposure = this.exposure.byAsset.get(position.symbol) || 0;
            this.exposure.byAsset.set(position.symbol, assetExposure + positionValue);
            
            // By sector (crypto, stocks, forex, etc.)
            const sector = this.getAssetSector(position.symbol);
            const sectorExposure = this.exposure.bySector.get(sector) || 0;
            this.exposure.bySector.set(sector, sectorExposure + positionValue);
            
            // By strategy
            if (position.strategy) {
                const strategyExposure = this.exposure.byStrategy.get(position.strategy) || 0;
                this.exposure.byStrategy.set(position.strategy, strategyExposure + positionValue);
            }
        }
        
        // Check exposure limits
        this.checkExposureLimits();
    }
    
    updateTrailingStops(priceData) {
        for (const [id, position] of this.positions) {
            if (position.symbol === priceData.symbol) {
                position.currentPrice = priceData.price;
                this.updateTrailingStop(position, priceData.price);
                
                // Update unrealized P&L
                const pnl = position.side === 'buy' ?
                    (priceData.price - position.entryPrice) * position.quantity :
                    (position.entryPrice - priceData.price) * position.quantity;
                
                position.unrealizedPnL = pnl;
            }
        }
    }
    
    scheduleDailyReset() {
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        
        const msUntilMidnight = tomorrow - now;
        
        setTimeout(() => {
            this.resetDailyMetrics();
            this.scheduleDailyReset(); // Schedule next reset
        }, msUntilMidnight);
    }
    
    resetDailyMetrics() {
        this.losses.daily = 0;
        
        // Weekly reset (if Sunday)
        if (new Date().getDay() === 0) {
            this.losses.weekly = 0;
        }
        
        // Monthly reset (if 1st)
        if (new Date().getDate() === 1) {
            this.losses.monthly = 0;
        }
        
        this.emit('metrics:reset', { type: 'daily' });
    }
    
    // ===== PUBLIC API =====
    getPositionSize(signal, balance) {
        return this.calculatePositionSize(signal, balance || this.bot.getBalance());
    }
    
    getRiskMetrics() {
        return {
            level: this.riskState.currentLevel,
            score: this.riskState.score,
            metrics: this.metrics,
            exposure: this.exposure.total,
            positions: this.positions.size
        };
    }
    
    getProtectionSettings() {
        return {
            stopLoss: this.config.protection.stopLoss,
            trailingStop: this.config.protection.trailingStop,
            circuitBreaker: this.config.protection.circuitBreaker
        };
    }
    
    setProtectionSettings(settings) {
        Object.assign(this.config.protection, settings);
        this.emit('settings:updated', { protection: settings });
    }
    
    getLimits() {
        return this.config.limits;
    }
    
    setLimits(limits) {
        Object.assign(this.config.limits, limits);
        this.emit('limits:updated', limits);
    }
    
    emergencyStop() {
        console.warn('EMERGENCY STOP ACTIVATED');
        
        // Activate all circuit breakers
        this.activateCircuitBreaker('emergency_stop');
        
        // Close all positions
        this.closeAllPositions();
        
        // Cancel all orders
        this.cancelAllOrders();
        
        // Disable trading
        this.bot.tradingEngine.disable();
        
        // Send critical alert
        this.triggerAlert('emergency_stop', {
            reason: 'Manual emergency stop activated',
            positions: this.positions.size,
            exposure: this.exposure.total
        });
        
        this.emit('emergency:stop');
    }
    
    async closeAllPositions() {
        const positions = Array.from(this.positions.values());
        
        for (const position of positions) {
            try {
                await this.bot.tradingEngine.closePosition(position.id);
            } catch (error) {
                console.error(`Failed to close position ${position.id}:`, error);
            }
        }
    }
    
    async cancelAllOrders() {
        try {
            await this.bot.tradingEngine.cancelAllOrders();
        } catch (error) {
            console.error('Failed to cancel orders:', error);
        }
    }
    
    // ===== CLEANUP =====
    destroy() {
        // Clear intervals
        if (this.assessmentInterval) clearInterval(this.assessmentInterval);
        if (this.analysisInterval) clearInterval(this.analysisInterval);
        
        // Clear positions
        this.positions.clear();
        
        // Clear protection systems
        this.protectionSystems.stopLoss.clear();
        this.protectionSystems.trailingStop.clear();
        this.protectionSystems.circuitBreakers.clear();
        
        // Clear alerts
        this.riskState.alerts.clear();
        
        // Remove event listeners
        this.removeAllListeners();
    }
}

export default RiskManagerPlugin;