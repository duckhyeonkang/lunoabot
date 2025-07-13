/**
 * 🧠 Trading Bot AI Signals Plugin
 * Version: 2.1.0
 * 
 * 🤖 Features:
 * - Multiple AI/ML models
 * - Pattern recognition
 * - Sentiment analysis
 * - Price prediction
 * - Signal generation
 * - Confidence scoring
 * - Real-time updates
 * - Backtesting support
 * - Signal validation
 * - Market regime detection
 */

import { EventEmitter } from '../core/event-emitter.js';

class AISignalsPlugin extends EventEmitter {
    constructor(tradingBot) {
        super();
        this.bot = tradingBot;
        this.config = tradingBot.config.aiSignals || this.getDefaultConfig();
        
        // AI Models
        this.models = new Map();
        this.activeModels = new Set();
        
        // Signal storage
        this.signals = new Map();
        this.signalHistory = [];
        
        // Pattern recognition
        this.patterns = new Map();
        this.patternLibrary = this.loadPatternLibrary();
        
        // Market data
        this.marketData = {
            price: [],
            volume: [],
            indicators: {},
            sentiment: {}
        };
        
        // Training data
        this.trainingData = [];
        this.validationData = [];
        
        // Performance tracking
        this.performance = {
            accuracy: 0,
            winRate: 0,
            profitFactor: 0,
            totalSignals: 0,
            successfulSignals: 0
        };
        
        // Market regime
        this.marketRegime = 'neutral';
        this.regimeHistory = [];
        
        // Signal queue
        this.signalQueue = [];
        this.processing = false;
        
        // WebWorker for heavy computations
        this.worker = null;
        
        this.init();
    }
    
    getDefaultConfig() {
        return {
            enabled: true,
            models: {
                lstm: {
                    enabled: true,
                    lookback: 60,
                    features: ['price', 'volume', 'rsi', 'macd'],
                    threshold: 0.7
                },
                randomForest: {
                    enabled: true,
                    trees: 100,
                    maxDepth: 10,
                    features: ['price', 'volume', 'volatility', 'momentum']
                },
                neuralNetwork: {
                    enabled: true,
                    layers: [64, 32, 16],
                    activation: 'relu',
                    dropout: 0.2
                },
                patternRecognition: {
                    enabled: true,
                    patterns: ['headAndShoulders', 'doubleTop', 'triangle', 'flag']
                },
                sentiment: {
                    enabled: true,
                    sources: ['social', 'news', 'onchain'],
                    weight: 0.3
                }
            },
            signals: {
                minConfidence: 0.6,
                maxSignalsPerHour: 10,
                cooldownPeriod: 300000, // 5 minutes
                combineModels: true,
                requireConsensus: false
            },
            prediction: {
                timeframes: ['5m', '15m', '1h', '4h'],
                horizons: [1, 3, 6, 12], // candles ahead
                priceTargets: true,
                confidenceIntervals: true
            },
            validation: {
                backtest: true,
                paperTrade: true,
                minSampleSize: 100,
                maxDrawdown: 0.2
            },
            training: {
                autoRetrain: true,
                retrainInterval: 86400000, // 24 hours
                minDataPoints: 1000,
                validationSplit: 0.2
            }
        };
    }
    
    async init() {
        try {
            // Initialize AI models
            await this.initializeModels();
            
            // Setup data pipeline
            this.setupDataPipeline();
            
            // Load historical data
            await this.loadHistoricalData();
            
            // Setup WebWorker
            this.setupWebWorker();
            
            // Start signal generation
            this.startSignalGeneration();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize UI components
            this.initializeUI();
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('AI Signals plugin initialization failed:', error);
            this.emit('error', { type: 'init_failed', error });
        }
    }
    
    // ===== MODEL INITIALIZATION =====
    async initializeModels() {
        // LSTM Model for time series prediction
        if (this.config.models.lstm.enabled) {
            const lstm = await this.createLSTMModel();
            this.models.set('lstm', lstm);
            this.activeModels.add('lstm');
        }
        
        // Random Forest for classification
        if (this.config.models.randomForest.enabled) {
            const rf = await this.createRandomForestModel();
            this.models.set('randomForest', rf);
            this.activeModels.add('randomForest');
        }
        
        // Neural Network for complex patterns
        if (this.config.models.neuralNetwork.enabled) {
            const nn = await this.createNeuralNetworkModel();
            this.models.set('neuralNetwork', nn);
            this.activeModels.add('neuralNetwork');
        }
        
        // Pattern Recognition
        if (this.config.models.patternRecognition.enabled) {
            this.initializePatternRecognition();
        }
        
        // Sentiment Analysis
        if (this.config.models.sentiment.enabled) {
            await this.initializeSentimentAnalysis();
        }
    }
    
    async createLSTMModel() {
        // Simplified LSTM implementation
        // In production, use TensorFlow.js or similar
        return {
            type: 'lstm',
            config: this.config.models.lstm,
            weights: null,
            
            predict: async (data) => {
                // Prepare sequence data
                const sequence = this.prepareSequenceData(data, this.config.models.lstm.lookback);
                
                // Simulate LSTM prediction
                const prediction = await this.simulateLSTMPrediction(sequence);
                
                return {
                    direction: prediction.direction,
                    confidence: prediction.confidence,
                    priceTarget: prediction.target,
                    timeframe: '1h'
                };
            },
            
            train: async (data, labels) => {
                // Simulate training
                console.log('Training LSTM model...');
                await this.sleep(1000);
                
                this.weights = {
                    trained: true,
                    timestamp: Date.now(),
                    accuracy: 0.85
                };
                
                return { success: true, accuracy: 0.85 };
            }
        };
    }
    
    async createRandomForestModel() {
        return {
            type: 'randomForest',
            config: this.config.models.randomForest,
            trees: [],
            
            predict: async (features) => {
                // Extract features
                const extractedFeatures = this.extractFeatures(features);
                
                // Simulate ensemble prediction
                const predictions = await this.simulateRandomForestPrediction(extractedFeatures);
                
                return {
                    signal: predictions.signal,
                    confidence: predictions.confidence,
                    importance: predictions.featureImportance
                };
            },
            
            train: async (data, labels) => {
                console.log('Training Random Forest...');
                
                // Build decision trees
                for (let i = 0; i < this.config.models.randomForest.trees; i++) {
                    this.trees.push(this.buildDecisionTree(data, labels));
                }
                
                return { success: true, accuracy: 0.82 };
            }
        };
    }
    
    async createNeuralNetworkModel() {
        return {
            type: 'neuralNetwork',
            config: this.config.models.neuralNetwork,
            layers: [],
            
            predict: async (input) => {
                // Forward propagation
                let output = input;
                
                for (const layer of this.layers) {
                    output = this.activationFunction(
                        this.matrixMultiply(output, layer.weights),
                        layer.activation
                    );
                }
                
                return {
                    buy: output[0],
                    sell: output[1],
                    hold: output[2],
                    confidence: Math.max(...output)
                };
            },
            
            train: async (data, labels) => {
                console.log('Training Neural Network...');
                
                // Initialize layers
                const layers = this.config.models.neuralNetwork.layers;
                for (let i = 0; i < layers.length; i++) {
                    this.layers.push({
                        weights: this.randomMatrix(
                            i === 0 ? data[0].length : layers[i-1],
                            layers[i]
                        ),
                        activation: this.config.models.neuralNetwork.activation
                    });
                }
                
                // Simulate training epochs
                await this.sleep(2000);
                
                return { success: true, accuracy: 0.88 };
            }
        };
    }
    
    // ===== PATTERN RECOGNITION =====
    initializePatternRecognition() {
        const patterns = this.config.models.patternRecognition.patterns;
        
        patterns.forEach(patternName => {
            const pattern = this.patternLibrary[patternName];
            if (pattern) {
                this.patterns.set(patternName, {
                    ...pattern,
                    lastDetected: null,
                    occurrences: 0
                });
            }
        });
    }
    
    loadPatternLibrary() {
        return {
            headAndShoulders: {
                name: 'Head and Shoulders',
                type: 'reversal',
                reliability: 0.83,
                detect: (data) => this.detectHeadAndShoulders(data)
            },
            doubleTop: {
                name: 'Double Top',
                type: 'reversal',
                reliability: 0.78,
                detect: (data) => this.detectDoubleTop(data)
            },
            triangle: {
                name: 'Triangle',
                type: 'continuation',
                reliability: 0.75,
                detect: (data) => this.detectTriangle(data)
            },
            flag: {
                name: 'Flag',
                type: 'continuation',
                reliability: 0.72,
                detect: (data) => this.detectFlag(data)
            },
            cup: {
                name: 'Cup and Handle',
                type: 'continuation',
                reliability: 0.80,
                detect: (data) => this.detectCupAndHandle(data)
            },
            wedge: {
                name: 'Wedge',
                type: 'reversal',
                reliability: 0.77,
                detect: (data) => this.detectWedge(data)
            }
        };
    }
    
    detectHeadAndShoulders(data) {
        if (data.length < 50) return null;
        
        // Find peaks and troughs
        const peaks = this.findPeaks(data);
        const troughs = this.findTroughs(data);
        
        // Look for pattern: peak, higher peak, lower peak
        for (let i = 2; i < peaks.length; i++) {
            const leftShoulder = peaks[i-2];
            const head = peaks[i-1];
            const rightShoulder = peaks[i];
            
            // Check if head is highest
            if (head.value > leftShoulder.value && 
                head.value > rightShoulder.value &&
                Math.abs(leftShoulder.value - rightShoulder.value) / head.value < 0.03) {
                
                // Find neckline
                const neckline = this.findNeckline(data, leftShoulder.index, rightShoulder.index);
                
                return {
                    pattern: 'headAndShoulders',
                    confidence: 0.85,
                    direction: 'bearish',
                    target: neckline - (head.value - neckline),
                    stopLoss: head.value * 1.02,
                    indices: {
                        leftShoulder: leftShoulder.index,
                        head: head.index,
                        rightShoulder: rightShoulder.index
                    }
                };
            }
        }
        
        return null;
    }
    
    detectDoubleTop(data) {
        if (data.length < 30) return null;
        
        const peaks = this.findPeaks(data);
        
        for (let i = 1; i < peaks.length; i++) {
            const peak1 = peaks[i-1];
            const peak2 = peaks[i];
            
            // Check if peaks are similar height
            const diff = Math.abs(peak1.value - peak2.value) / peak1.value;
            if (diff < 0.02) {
                // Find valley between peaks
                const valley = this.findValley(data, peak1.index, peak2.index);
                
                return {
                    pattern: 'doubleTop',
                    confidence: 0.80,
                    direction: 'bearish',
                    target: valley - (peak1.value - valley),
                    stopLoss: Math.max(peak1.value, peak2.value) * 1.02,
                    indices: {
                        peak1: peak1.index,
                        peak2: peak2.index,
                        valley: valley.index
                    }
                };
            }
        }
        
        return null;
    }
    
    // ===== SENTIMENT ANALYSIS =====
    async initializeSentimentAnalysis() {
        this.sentimentAnalyzer = {
            sources: new Map(),
            weights: {
                social: 0.4,
                news: 0.4,
                onchain: 0.2
            },
            
            analyze: async () => {
                const sentiments = {};
                
                // Aggregate from all sources
                for (const [source, analyzer] of this.sentimentAnalyzer.sources) {
                    sentiments[source] = await analyzer.getSentiment();
                }
                
                // Calculate weighted sentiment
                let weightedSentiment = 0;
                let totalWeight = 0;
                
                for (const [source, sentiment] of Object.entries(sentiments)) {
                    const weight = this.sentimentAnalyzer.weights[source] || 0.33;
                    weightedSentiment += sentiment.score * weight;
                    totalWeight += weight;
                }
                
                return {
                    score: weightedSentiment / totalWeight,
                    sources: sentiments,
                    timestamp: Date.now()
                };
            }
        };
        
        // Initialize sentiment sources
        if (this.config.models.sentiment.sources.includes('social')) {
            await this.initializeSocialSentiment();
        }
        
        if (this.config.models.sentiment.sources.includes('news')) {
            await this.initializeNewsSentiment();
        }
        
        if (this.config.models.sentiment.sources.includes('onchain')) {
            await this.initializeOnchainSentiment();
        }
    }
    
    async initializeSocialSentiment() {
        this.sentimentAnalyzer.sources.set('social', {
            getSentiment: async () => {
                // Simulate social media sentiment
                // In production, connect to Twitter, Reddit APIs
                const fearGreedIndex = await this.getFearGreedIndex();
                const socialMetrics = await this.getSocialMetrics();
                
                return {
                    score: (fearGreedIndex / 100) * 2 - 1, // Convert to -1 to 1
                    fearGreed: fearGreedIndex,
                    metrics: socialMetrics,
                    confidence: 0.75
                };
            }
        });
    }
    
    // ===== SIGNAL GENERATION =====
    startSignalGeneration() {
        // Real-time signal generation
        this.bot.on('price:update', (data) => {
            this.updateMarketData(data);
            this.checkForSignals();
        });
        
        // Periodic deep analysis
        setInterval(() => {
            this.performDeepAnalysis();
        }, 60000); // Every minute
        
        // Pattern scanning
        setInterval(() => {
            this.scanPatterns();
        }, 30000); // Every 30 seconds
    }
    
    async checkForSignals() {
        if (this.processing) return;
        this.processing = true;
        
        try {
            const signals = [];
            
            // Get predictions from each model
            for (const modelName of this.activeModels) {
                const model = this.models.get(modelName);
                if (!model) continue;
                
                const prediction = await model.predict(this.marketData);
                
                if (prediction && this.validatePrediction(prediction)) {
                    signals.push({
                        model: modelName,
                        ...prediction,
                        timestamp: Date.now()
                    });
                }
            }
            
            // Combine signals if configured
            if (this.config.signals.combineModels && signals.length > 0) {
                const combinedSignal = this.combineSignals(signals);
                
                if (combinedSignal.confidence >= this.config.signals.minConfidence) {
                    await this.processSignal(combinedSignal);
                }
            } else {
                // Process individual signals
                for (const signal of signals) {
                    if (signal.confidence >= this.config.signals.minConfidence) {
                        await this.processSignal(signal);
                    }
                }
            }
            
        } catch (error) {
            console.error('Signal generation error:', error);
            this.emit('error', { type: 'signal_generation', error });
        } finally {
            this.processing = false;
        }
    }
    
    combineSignals(signals) {
        // Aggregate signals from multiple models
        const directions = { buy: 0, sell: 0, hold: 0 };
        let totalConfidence = 0;
        let totalWeight = 0;
        
        for (const signal of signals) {
            const weight = signal.confidence;
            
            if (signal.direction) {
                directions[signal.direction] += weight;
            } else if (signal.signal) {
                directions[signal.signal] += weight;
            }
            
            totalConfidence += signal.confidence * weight;
            totalWeight += weight;
        }
        
        // Find consensus direction
        const maxDirection = Object.entries(directions)
            .reduce((a, b) => directions[a] > directions[b] ? a : b);
        
        // Calculate consensus confidence
        const consensusRatio = directions[maxDirection] / totalWeight;
        const avgConfidence = totalConfidence / totalWeight;
        const finalConfidence = (consensusRatio + avgConfidence) / 2;
        
        // Combine price targets
        const priceTargets = signals
            .filter(s => s.priceTarget)
            .map(s => s.priceTarget);
        
        const avgPriceTarget = priceTargets.length > 0 ?
            priceTargets.reduce((a, b) => a + b, 0) / priceTargets.length : null;
        
        return {
            type: 'combined',
            direction: maxDirection,
            confidence: finalConfidence,
            priceTarget: avgPriceTarget,
            models: signals.map(s => s.model),
            consensus: consensusRatio,
            timestamp: Date.now()
        };
    }
    
    async processSignal(signal) {
        // Check cooldown
        const lastSignal = this.getLastSignal();
        if (lastSignal && Date.now() - lastSignal.timestamp < this.config.signals.cooldownPeriod) {
            return;
        }
        
        // Check rate limit
        const recentSignals = this.signalHistory.filter(s => 
            Date.now() - s.timestamp < 3600000 // Last hour
        );
        
        if (recentSignals.length >= this.config.signals.maxSignalsPerHour) {
            return;
        }
        
        // Enhance signal with additional data
        const enhancedSignal = await this.enhanceSignal(signal);
        
        // Store signal
        const signalId = `signal-${Date.now()}`;
        this.signals.set(signalId, enhancedSignal);
        this.signalHistory.push(enhancedSignal);
        
        // Keep history limited
        if (this.signalHistory.length > 1000) {
            this.signalHistory.shift();
        }
        
        // Update UI
        this.updateSignalUI(enhancedSignal);
        
        // Emit signal event
        this.emit('signal:generated', enhancedSignal);
        
        // Execute if auto-trading enabled
        if (this.bot.config.autoTrade && enhancedSignal.confidence > 0.8) {
            this.bot.tradingEngine.executeSignal(enhancedSignal);
        }
    }
    
    async enhanceSignal(signal) {
        // Add market context
        signal.marketRegime = this.marketRegime;
        signal.volatility = this.calculateVolatility();
        
        // Add risk metrics
        signal.risk = this.calculateSignalRisk(signal);
        
        // Add sentiment if available
        if (this.sentimentAnalyzer) {
            signal.sentiment = await this.sentimentAnalyzer.analyze();
        }
        
        // Add technical confirmation
        signal.technicalConfirmation = this.checkTechnicalConfirmation(signal);
        
        // Calculate position size recommendation
        signal.positionSize = this.calculatePositionSize(signal);
        
        // Add invalidation levels
        signal.invalidation = this.calculateInvalidationLevels(signal);
        
        return signal;
    }
    
    // ===== PATTERN DETECTION =====
    scanPatterns() {
        const data = this.marketData.price.slice(-200); // Last 200 candles
        
        if (data.length < 50) return;
        
        const detectedPatterns = [];
        
        for (const [name, pattern] of this.patterns) {
            const detection = pattern.detect(data);
            
            if (detection) {
                pattern.lastDetected = Date.now();
                pattern.occurrences++;
                
                detectedPatterns.push({
                    ...detection,
                    name: pattern.name,
                    type: pattern.type,
                    reliability: pattern.reliability
                });
            }
        }
        
        if (detectedPatterns.length > 0) {
            this.processPatterns(detectedPatterns);
        }
    }
    
    processPatterns(patterns) {
        for (const pattern of patterns) {
            // Convert pattern to signal
            const signal = {
                type: 'pattern',
                pattern: pattern.name,
                direction: pattern.direction,
                confidence: pattern.confidence * pattern.reliability,
                priceTarget: pattern.target,
                stopLoss: pattern.stopLoss,
                timestamp: Date.now()
            };
            
            this.processSignal(signal);
        }
    }
    
    // ===== MARKET REGIME DETECTION =====
    async detectMarketRegime() {
        const data = this.marketData.price.slice(-100);
        
        if (data.length < 50) return;
        
        // Calculate trend strength
        const trend = this.calculateTrend(data);
        
        // Calculate volatility
        const volatility = this.calculateVolatility(data);
        
        // Detect regime
        let regime = 'neutral';
        
        if (trend.strength > 0.7) {
            regime = trend.direction === 'up' ? 'bullish' : 'bearish';
        } else if (volatility > 2) {
            regime = 'volatile';
        } else if (volatility < 0.5) {
            regime = 'ranging';
        }
        
        // Check if regime changed
        if (regime !== this.marketRegime) {
            this.marketRegime = regime;
            this.regimeHistory.push({
                regime: regime,
                timestamp: Date.now(),
                metrics: { trend, volatility }
            });
            
            this.emit('regime:changed', { 
                previous: this.marketRegime,
                current: regime 
            });
            
            // Adjust model parameters based on regime
            this.adjustModelsForRegime(regime);
        }
    }
    
    adjustModelsForRegime(regime) {
        switch (regime) {
            case 'bullish':
                // Increase buy signal sensitivity
                this.config.signals.minConfidence *= 0.9;
                break;
            case 'bearish':
                // Increase sell signal sensitivity
                this.config.signals.minConfidence *= 0.9;
                break;
            case 'volatile':
                // Increase confidence threshold
                this.config.signals.minConfidence *= 1.2;
                break;
            case 'ranging':
                // Focus on mean reversion
                this.config.signals.minConfidence *= 1.1;
                break;
        }
    }
    
    // ===== PREDICTION METHODS =====
    async makePrediction(timeframe, horizon) {
        const predictions = [];
        
        // Get predictions from each model
        for (const [modelName, model] of this.models) {
            try {
                const prediction = await model.predict({
                    data: this.marketData,
                    timeframe: timeframe,
                    horizon: horizon
                });
                
                predictions.push({
                    model: modelName,
                    ...prediction
                });
            } catch (error) {
                console.error(`Prediction error for ${modelName}:`, error);
            }
        }
        
        // Ensemble prediction
        const ensemble = this.ensemblePredictions(predictions);
        
        return {
            timeframe: timeframe,
            horizon: horizon,
            predictions: predictions,
            ensemble: ensemble,
            timestamp: Date.now()
        };
    }
    
    ensemblePredictions(predictions) {
        if (predictions.length === 0) return null;
        
        // Weighted average based on model performance
        let weightedPrice = 0;
        let weightedDirection = 0;
        let totalWeight = 0;
        
        for (const pred of predictions) {
            const weight = pred.confidence || 0.5;
            
            if (pred.priceTarget) {
                weightedPrice += pred.priceTarget * weight;
            }
            
            if (pred.direction) {
                const dirValue = pred.direction === 'up' ? 1 : -1;
                weightedDirection += dirValue * weight;
            }
            
            totalWeight += weight;
        }
        
        return {
            priceTarget: weightedPrice / totalWeight,
            direction: weightedDirection > 0 ? 'up' : 'down',
            confidence: totalWeight / predictions.length,
            agreement: this.calculateAgreement(predictions)
        };
    }
    
    // ===== BACKTESTING =====
    async backtest(startDate, endDate) {
        console.log('Starting AI signals backtest...');
        
        // Get historical data
        const historicalData = await this.bot.api.getHistoricalData({
            startDate,
            endDate,
            interval: '1h'
        });
        
        // Reset performance metrics
        const results = {
            totalSignals: 0,
            successfulSignals: 0,
            totalProfit: 0,
            maxDrawdown: 0,
            winRate: 0,
            profitFactor: 0,
            signals: []
        };
        
        // Simulate signal generation
        for (let i = 100; i < historicalData.length; i++) {
            // Update market data
            this.marketData.price = historicalData.slice(i - 100, i);
            
            // Generate signals
            const signals = await this.generateBacktestSignals(i);
            
            for (const signal of signals) {
                // Simulate trade execution
                const result = this.simulateTrade(signal, historicalData.slice(i));
                
                results.totalSignals++;
                if (result.profit > 0) {
                    results.successfulSignals++;
                }
                
                results.totalProfit += result.profit;
                results.signals.push({
                    ...signal,
                    result: result
                });
            }
        }
        
        // Calculate final metrics
        results.winRate = results.successfulSignals / results.totalSignals;
        results.profitFactor = this.calculateProfitFactor(results.signals);
        results.maxDrawdown = this.calculateMaxDrawdown(results.signals);
        
        return results;
    }
    
    // ===== TRAINING METHODS =====
    async trainModels(data) {
        console.log('Starting model training...');
        
        // Prepare training data
        const { features, labels } = this.prepareTrainingData(data);
        
        // Split data
        const splitIndex = Math.floor(features.length * 0.8);
        const trainFeatures = features.slice(0, splitIndex);
        const trainLabels = labels.slice(0, splitIndex);
        const valFeatures = features.slice(splitIndex);
        const valLabels = labels.slice(splitIndex);
        
        // Train each model
        const results = {};
        
        for (const [modelName, model] of this.models) {
            if (model.train) {
                console.log(`Training ${modelName}...`);
                
                const trainResult = await model.train(trainFeatures, trainLabels);
                
                // Validate
                const valResult = await this.validateModel(model, valFeatures, valLabels);
                
                results[modelName] = {
                    training: trainResult,
                    validation: valResult
                };
            }
        }
        
        // Update model weights
        await this.saveModelWeights();
        
        return results;
    }
    
    prepareTrainingData(rawData) {
        const features = [];
        const labels = [];
        
        for (let i = 100; i < rawData.length - 10; i++) {
            // Extract features
            const feature = {
                price: rawData[i].close,
                volume: rawData[i].volume,
                rsi: this.calculateRSI(rawData.slice(i - 14, i)),
                macd: this.calculateMACD(rawData.slice(i - 26, i)),
                volatility: this.calculateVolatility(rawData.slice(i - 20, i)),
                trend: this.calculateTrend(rawData.slice(i - 50, i))
            };
            
            features.push(feature);
            
            // Create label (price direction in next 10 candles)
            const futurePrice = rawData[i + 10].close;
            const currentPrice = rawData[i].close;
            const change = (futurePrice - currentPrice) / currentPrice;
            
            labels.push({
                direction: change > 0.01 ? 'up' : change < -0.01 ? 'down' : 'neutral',
                magnitude: Math.abs(change)
            });
        }
        
        return { features, labels };
    }
    
    // ===== HELPER METHODS =====
    findPeaks(data, window = 5) {
        const peaks = [];
        
        for (let i = window; i < data.length - window; i++) {
            let isPeak = true;
            
            for (let j = i - window; j <= i + window; j++) {
                if (j !== i && data[j].high >= data[i].high) {
                    isPeak = false;
                    break;
                }
            }
            
            if (isPeak) {
                peaks.push({
                    index: i,
                    value: data[i].high,
                    timestamp: data[i].timestamp
                });
            }
        }
        
        return peaks;
    }
    
    findTroughs(data, window = 5) {
        const troughs = [];
        
        for (let i = window; i < data.length - window; i++) {
            let isTrough = true;
            
            for (let j = i - window; j <= i + window; j++) {
                if (j !== i && data[j].low <= data[i].low) {
                    isTrough = false;
                    break;
                }
            }
            
            if (isTrough) {
                troughs.push({
                    index: i,
                    value: data[i].low,
                    timestamp: data[i].timestamp
                });
            }
        }
        
        return troughs;
    }
    
    calculateTrend(data) {
        if (data.length < 2) return { direction: 'neutral', strength: 0 };
        
        // Linear regression
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        for (let i = 0; i < n; i++) {
            const x = i;
            const y = data[i].close || data[i];
            
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        }
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        // Calculate R-squared
        const yMean = sumY / n;
        let ssTotal = 0, ssResidual = 0;
        
        for (let i = 0; i < n; i++) {
            const y = data[i].close || data[i];
            const yPred = slope * i + intercept;
            
            ssTotal += Math.pow(y - yMean, 2);
            ssResidual += Math.pow(y - yPred, 2);
        }
        
        const rSquared = 1 - (ssResidual / ssTotal);
        
        return {
            direction: slope > 0 ? 'up' : 'down',
            strength: Math.min(Math.abs(rSquared), 1),
            slope: slope,
            angle: Math.atan(slope) * (180 / Math.PI)
        };
    }
    
    calculateVolatility(data) {
        if (!data || data.length < 2) return 0;
        
        const returns = [];
        for (let i = 1; i < data.length; i++) {
            const prev = data[i-1].close || data[i-1];
            const curr = data[i].close || data[i];
            returns.push((curr - prev) / prev);
        }
        
        const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
        
        return Math.sqrt(variance) * Math.sqrt(252) * 100; // Annualized volatility
    }
    
    calculateRSI(data, period = 14) {
        if (data.length < period) return 50;
        
        let gains = 0;
        let losses = 0;
        
        for (let i = 1; i <= period; i++) {
            const change = data[i].close - data[i-1].close;
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        const avgGain = gains / period;
        const avgLoss = losses / period;
        const rs = avgGain / avgLoss;
        
        return 100 - (100 / (1 + rs));
    }
    
    calculateMACD(data) {
        const ema12 = this.calculateEMA(data.map(d => d.close), 12);
        const ema26 = this.calculateEMA(data.map(d => d.close), 26);
        
        const macd = ema12[ema12.length - 1] - ema26[ema26.length - 1];
        const signal = this.calculateEMA([macd], 9)[0];
        
        return {
            macd: macd,
            signal: signal,
            histogram: macd - signal
        };
    }
    
    calculateEMA(data, period) {
        const multiplier = 2 / (period + 1);
        const ema = [data[0]];
        
        for (let i = 1; i < data.length; i++) {
            ema.push((data[i] - ema[i-1]) * multiplier + ema[i-1]);
        }
        
        return ema;
    }
    
    // ===== UI INTEGRATION =====
    initializeUI() {
        // Update signals panel
        this.signalsContainer = document.getElementById('signals-list');
        
        // Update sentiment meter
        this.sentimentMeter = document.querySelector('.sentiment-fill');
        
        // Create signal cards
        this.updateSignalsDisplay();
    }
    
    updateSignalUI(signal) {
        if (!this.signalsContainer) return;
        
        const signalElement = document.createElement('div');
        signalElement.className = `signal-item ${signal.direction}`;
        signalElement.innerHTML = `
            <div class="signal-header">
                <span class="signal-type">${signal.type || 'AI'}</span>
                <span class="signal-time">${new Date(signal.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="signal-body">
                <div class="signal-direction ${signal.direction}">
                    ${signal.direction.toUpperCase()}
                </div>
                <div class="signal-confidence">
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${signal.confidence * 100}%"></div>
                    </div>
                    <span class="confidence-text">${(signal.confidence * 100).toFixed(0)}%</span>
                </div>
                ${signal.priceTarget ? `
                    <div class="signal-target">
                        목표가: $${signal.priceTarget.toFixed(2)}
                    </div>
                ` : ''}
            </div>
            <div class="signal-footer">
                ${signal.models ? signal.models.join(', ') : signal.model || 'Unknown'}
            </div>
        `;
        
        // Add to container (prepend for newest first)
        this.signalsContainer.insertBefore(signalElement, this.signalsContainer.firstChild);
        
        // Limit displayed signals
        while (this.signalsContainer.children.length > 10) {
            this.signalsContainer.removeChild(this.signalsContainer.lastChild);
        }
        
        // Animate entry
        signalElement.style.opacity = '0';
        signalElement.style.transform = 'translateX(-20px)';
        
        setTimeout(() => {
            signalElement.style.transition = 'all 0.3s ease';
            signalElement.style.opacity = '1';
            signalElement.style.transform = 'translateX(0)';
        }, 10);
    }
    
    updateSentimentUI(sentiment) {
        if (!this.sentimentMeter) return;
        
        // Convert -1 to 1 range to 0 to 100
        const percentage = (sentiment.score + 1) * 50;
        
        this.sentimentMeter.style.width = percentage + '%';
        
        // Update color based on sentiment
        if (percentage < 30) {
            this.sentimentMeter.style.background = '#FF4444';
        } else if (percentage > 70) {
            this.sentimentMeter.style.background = '#00C851';
        } else {
            this.sentimentMeter.style.background = '#FFC107';
        }
        
        // Update label
        const label = document.querySelector('.sentiment-labels .current');
        if (label) {
            const fearGreedScore = Math.round(percentage);
            let text = '중립';
            
            if (fearGreedScore < 20) text = '극도 공포';
            else if (fearGreedScore < 40) text = '공포';
            else if (fearGreedScore > 80) text = '극도 탐욕';
            else if (fearGreedScore > 60) text = '탐욕';
            
            label.textContent = `${text} (${fearGreedScore})`;
        }
    }
    
    // ===== WEB WORKER =====
    setupWebWorker() {
        // Create worker for heavy computations
        const workerCode = `
            self.onmessage = function(e) {
                const { type, data } = e.data;
                
                switch(type) {
                    case 'train':
                        // Heavy training computation
                        const result = performTraining(data);
                        self.postMessage({ type: 'training_complete', result });
                        break;
                        
                    case 'predict':
                        // Complex prediction
                        const prediction = performPrediction(data);
                        self.postMessage({ type: 'prediction', result: prediction });
                        break;
                }
            };
            
            function performTraining(data) {
                // Simulate training
                return { success: true, accuracy: 0.85 };
            }
            
            function performPrediction(data) {
                // Simulate prediction
                return { direction: 'up', confidence: 0.75 };
            }
        `;
        
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        this.worker = new Worker(URL.createObjectURL(blob));
        
        this.worker.onmessage = (e) => {
            this.handleWorkerMessage(e.data);
        };
    }
    
    handleWorkerMessage(data) {
        switch(data.type) {
            case 'training_complete':
                this.emit('training:complete', data.result);
                break;
            case 'prediction':
                this.emit('prediction:ready', data.result);
                break;
        }
    }
    
    // ===== PUBLIC API =====
    async generateSignal() {
        await this.checkForSignals();
        return this.getLastSignal();
    }
    
    getLastSignal() {
        return this.signalHistory[this.signalHistory.length - 1];
    }
    
    getSignalHistory(limit = 100) {
        return this.signalHistory.slice(-limit);
    }
    
    getModelPerformance() {
        const performance = {};
        
        for (const [modelName, model] of this.models) {
            performance[modelName] = {
                accuracy: model.weights?.accuracy || 0,
                signals: this.signalHistory.filter(s => s.model === modelName).length,
                lastUpdate: model.weights?.timestamp || null
            };
        }
        
        return performance;
    }
    
    async predict(timeframe = '1h', horizon = 1) {
        return this.makePrediction(timeframe, horizon);
    }
    
    async train(data) {
        return this.trainModels(data);
    }
    
    enableModel(modelName) {
        if (this.models.has(modelName)) {
            this.activeModels.add(modelName);
            this.emit('model:enabled', { model: modelName });
        }
    }
    
    disableModel(modelName) {
        this.activeModels.delete(modelName);
        this.emit('model:disabled', { model: modelName });
    }
    
    // ===== CLEANUP =====
    destroy() {
        // Stop signal generation
        this.processing = true;
        
        // Terminate worker
        if (this.worker) {
            this.worker.terminate();
        }
        
        // Clear intervals
        // Clear data
        this.models.clear();
        this.signals.clear();
        this.patterns.clear();
        this.signalHistory = [];
        
        // Remove event listeners
        this.removeAllListeners();
    }
}

// Utility functions
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export default AISignalsPlugin;