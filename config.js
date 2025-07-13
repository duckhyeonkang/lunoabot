/**
 * ⚙️ Trading Bot Configuration Manager
 * Version: 2.1.0
 * 
 * 🔒 Security Features:
 * - Encrypted sensitive data
 * - Environment-based configs
 * - Validation & sanitization
 * - Secure defaults
 * 
 * 📊 Features:
 * - Real-time config updates
 * - Config versioning
 * - Backup & restore
 * - Performance optimized
 */

'use strict';

/**
 * Configuration Manager Class
 */
class ConfigManager {
    constructor() {
        this.config = null;
        this.defaults = this.getDefaultConfig();
        this.validators = this.setupValidators();
        this.encryptedFields = ['apiKey', 'apiSecret', 'password', 'webhookSecret'];
        this.listeners = new Map();
        this.configHistory = [];
        this.maxHistorySize = 10;
        
        // Environment detection
        this.env = this.detectEnvironment();
        
        // Load initial config
        this.loadConfig();
    }
    
    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            version: '2.1.0',
            lastUpdated: new Date().toISOString(),
            
            // Environment
            environment: 'production',
            debug: false,
            logLevel: 'info',
            
            // API Configuration
            api: {
                exchange: 'binance',
                endpoint: 'wss://stream.binance.com:9443',
                restEndpoint: 'https://api.binance.com',
                testnet: false,
                apiKey: '',
                apiSecret: '',
                timeout: 30000,
                retryAttempts: 3,
                retryDelay: 1000,
                rateLimit: {
                    orders: 10,
                    weight: 1200,
                    windowMs: 60000
                }
            },
            
            // Trading Configuration
            trading: {
                defaultStrategy: 'grid',
                autoStart: false,
                paperTrading: true,
                
                // Position sizing
                maxPositions: 3,
                defaultPositionSize: 0.1, // 10% of portfolio
                minPositionSize: 0.01,
                maxPositionSize: 0.25,
                
                // Order settings
                orderTypes: ['LIMIT', 'MARKET', 'STOP_LOSS', 'TAKE_PROFIT'],
                defaultOrderType: 'LIMIT',
                slippage: 0.001, // 0.1%
                
                // Fees
                makerFee: 0.001, // 0.1%
                takerFee: 0.001, // 0.1%
                
                // Timing
                candleInterval: '1m',
                updateInterval: 1000, // ms
                orderTimeout: 30000, // ms
                
                // Markets
                allowedMarkets: ['SPOT', 'FUTURES'],
                defaultMarket: 'SPOT',
                
                // Pairs
                watchlist: ['BTCUSDT', 'ETHUSDT', 'BNBUSDT'],
                blacklist: [],
                
                // Advanced
                enableArbitrage: false,
                enableMarketMaking: false,
                enableLiquidation: false
            },
            
            // Risk Management
            risk: {
                enabled: true,
                
                // Loss limits
                maxDailyLoss: 0.05, // 5%
                maxWeeklyLoss: 0.15, // 15%
                maxMonthlyLoss: 0.25, // 25%
                maxDrawdown: 0.20, // 20%
                
                // Position limits
                maxLeverage: 1,
                maxPositionRisk: 0.02, // 2% per position
                maxPortfolioRisk: 0.06, // 6% total
                
                // Stop loss
                defaultStopLoss: 0.02, // 2%
                trailingStop: true,
                trailingStopDistance: 0.01, // 1%
                
                // Take profit
                defaultTakeProfit: 0.04, // 4%
                partialTakeProfit: true,
                takeProfitLevels: [
                    { percent: 0.5, price: 0.02 },
                    { percent: 0.3, price: 0.03 },
                    { percent: 0.2, price: 0.04 }
                ],
                
                // Correlation
                maxCorrelation: 0.7,
                correlationPeriod: 30, // days
                
                // Emergency
                emergencyStop: {
                    enabled: true,
                    triggerLoss: 0.10, // 10%
                    closePositions: true,
                    cancelOrders: true,
                    lockTrading: true,
                    notifyEmail: true
                }
            },
            
            // Strategy Settings
            strategies: {
                grid: {
                    enabled: true,
                    gridLevels: 10,
                    gridSpacing: 0.01, // 1%
                    totalInvestment: 1000,
                    profitPerGrid: 0.003, // 0.3%
                    stopLoss: 0.10, // 10%
                    dynamicGrid: true,
                    rebalanceInterval: 3600000 // 1 hour
                },
                
                dca: {
                    enabled: true,
                    interval: 3600000, // 1 hour
                    amount: 100,
                    maxOrders: 20,
                    priceDeviation: 0.02, // 2%
                    takeProfit: 0.10, // 10%
                    martingale: false,
                    martingaleMultiplier: 1.5
                },
                
                momentum: {
                    enabled: true,
                    rsiPeriod: 14,
                    rsiOverbought: 70,
                    rsiOversold: 30,
                    macdFast: 12,
                    macdSlow: 26,
                    macdSignal: 9,
                    volumeThreshold: 2, // 2x average
                    confirmationCandles: 2
                },
                
                scalping: {
                    enabled: false,
                    minProfit: 0.002, // 0.2%
                    maxHoldTime: 300000, // 5 minutes
                    indicators: ['EMA', 'VWAP', 'OrderFlow'],
                    entryConfirmations: 3,
                    quickExit: true
                },
                
                arbitrage: {
                    enabled: false,
                    minSpread: 0.003, // 0.3%
                    exchanges: ['binance', 'ftx', 'kraken'],
                    maxLatency: 100, // ms
                    flashLoan: false
                },
                
                ml: {
                    enabled: false,
                    model: 'lstm',
                    features: 50,
                    lookback: 100,
                    retrain: 86400000, // 24 hours
                    minConfidence: 0.7,
                    ensemble: true
                }
            },
            
            // UI Configuration
            ui: {
                theme: 'dark',
                language: 'ko',
                timezone: 'Asia/Seoul',
                
                // Display
                compactMode: false,
                animations: true,
                soundAlerts: true,
                desktopNotifications: true,
                
                // Chart
                chartType: 'candlestick',
                indicators: ['EMA', 'MACD', 'RSI', 'Volume'],
                chartInterval: '1h',
                
                // Refresh rates
                portfolioRefresh: 1000, // ms
                ordersRefresh: 500, // ms
                chartsRefresh: 2000, // ms
                
                // Layout
                panels: {
                    portfolio: true,
                    chart: true,
                    orders: true,
                    trades: true,
                    alerts: true,
                    performance: true
                },
                
                // Colors
                colors: {
                    profit: '#00C851',
                    loss: '#FF4444',
                    primary: '#2962FF',
                    secondary: '#00BCD4'
                }
            },
            
            // Notifications
            notifications: {
                enabled: true,
                
                // Channels
                email: {
                    enabled: false,
                    address: '',
                    smtp: {
                        host: '',
                        port: 587,
                        secure: false,
                        user: '',
                        pass: ''
                    }
                },
                
                telegram: {
                    enabled: false,
                    botToken: '',
                    chatId: ''
                },
                
                discord: {
                    enabled: false,
                    webhookUrl: ''
                },
                
                webhook: {
                    enabled: false,
                    url: '',
                    secret: ''
                },
                
                // Event triggers
                events: {
                    orderFilled: true,
                    stopLossHit: true,
                    takeProfitHit: true,
                    dailyReport: true,
                    errorOccurred: true,
                    emergencyStop: true,
                    largeMovement: true,
                    lowBalance: true
                },
                
                // Filters
                minAmount: 10, // Minimum trade amount for notification
                priceAlerts: []
            },
            
            // Performance
            performance: {
                enableProfiling: false,
                enableMetrics: true,
                metricsInterval: 60000, // 1 minute
                
                // Optimization
                batchOrders: true,
                orderQueueSize: 100,
                wsReconnectDelay: 5000,
                
                // Caching
                cacheEnabled: true,
                cacheTTL: 300000, // 5 minutes
                maxCacheSize: 100 // MB
            },
            
            // Plugins
            plugins: {
                enabled: ['ai-signals', 'risk-manager'],
                autoUpdate: false,
                sandboxed: true,
                
                settings: {
                    'ai-signals': {
                        provider: 'internal',
                        sensitivity: 0.7
                    },
                    'risk-manager': {
                        strictMode: true
                    }
                }
            },
            
            // Backup
            backup: {
                enabled: true,
                interval: 3600000, // 1 hour
                maxBackups: 24,
                location: 'local',
                encrypt: true
            },
            
            // Advanced
            advanced: {
                multiAccount: false,
                customScripts: false,
                apiForwarding: false,
                debugMode: false,
                experimentalFeatures: false
            }
        };
    }
    
    /**
     * Setup validators for config fields
     */
    setupValidators() {
        return {
            // API validators
            'api.apiKey': (value) => {
                if (this.config.trading.paperTrading) return true;
                return value && value.length >= 32;
            },
            'api.timeout': (value) => value >= 1000 && value <= 60000,
            'api.retryAttempts': (value) => value >= 0 && value <= 10,
            
            // Trading validators
            'trading.maxPositions': (value) => value >= 1 && value <= 100,
            'trading.defaultPositionSize': (value) => value > 0 && value <= 1,
            'trading.slippage': (value) => value >= 0 && value <= 0.1,
            
            // Risk validators
            'risk.maxDailyLoss': (value) => value > 0 && value <= 1,
            'risk.maxLeverage': (value) => value >= 1 && value <= 125,
            'risk.defaultStopLoss': (value) => value > 0 && value <= 0.5,
            
            // Strategy validators
            'strategies.grid.gridLevels': (value) => value >= 2 && value <= 100,
            'strategies.dca.interval': (value) => value >= 60000, // Min 1 minute
            
            // UI validators
            'ui.theme': (value) => ['dark', 'light'].includes(value),
            'ui.language': (value) => ['en', 'ko', 'ja', 'zh'].includes(value),
            
            // Performance validators
            'performance.orderQueueSize': (value) => value >= 10 && value <= 1000,
            'performance.maxCacheSize': (value) => value >= 10 && value <= 1000
        };
    }
    
    /**
     * Detect environment
     */
    detectEnvironment() {
        if (typeof process !== 'undefined' && process.env) {
            return process.env.NODE_ENV || 'production';
        }
        
        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return 'development';
        }
        
        if (hostname.includes('staging') || hostname.includes('test')) {
            return 'staging';
        }
        
        return 'production';
    }
    
    /**
     * Load configuration
     */
    loadConfig() {
        try {
            // Try to load from localStorage first
            const stored = localStorage.getItem('tradingBotConfig');
            if (stored) {
                const decrypted = this.decrypt(stored);
                const parsed = JSON.parse(decrypted);
                
                // Validate version
                if (this.isVersionCompatible(parsed.version)) {
                    this.config = this.mergeConfig(this.defaults, parsed);
                } else {
                    console.warn('Config version mismatch, using defaults');
                    this.config = { ...this.defaults };
                }
            } else {
                // Use defaults
                this.config = { ...this.defaults };
            }
            
            // Apply environment overrides
            this.applyEnvironmentConfig();
            
            // Validate entire config
            this.validateConfig();
            
            // Save to history
            this.addToHistory();
            
            console.log('✅ Config loaded successfully');
            
        } catch (error) {
            console.error('Failed to load config:', error);
            this.config = { ...this.defaults };
        }
    }
    
    /**
     * Save configuration
     */
    saveConfig() {
        try {
            // Validate before saving
            this.validateConfig();
            
            // Update timestamp
            this.config.lastUpdated = new Date().toISOString();
            
            // Encrypt sensitive data
            const encrypted = this.encrypt(JSON.stringify(this.config));
            
            // Save to localStorage
            localStorage.setItem('tradingBotConfig', encrypted);
            
            // Add to history
            this.addToHistory();
            
            // Notify listeners
            this.notifyListeners('save', this.config);
            
            console.log('✅ Config saved successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to save config:', error);
            return false;
        }
    }
    
    /**
     * Get config value
     */
    get(path, defaultValue = undefined) {
        try {
            const keys = path.split('.');
            let value = this.config;
            
            for (const key of keys) {
                if (value && typeof value === 'object' && key in value) {
                    value = value[key];
                } else {
                    return defaultValue;
                }
            }
            
            return value;
            
        } catch (error) {
            console.error('Error getting config value:', error);
            return defaultValue;
        }
    }
    
    /**
     * Set config value
     */
    set(path, value) {
        try {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let target = this.config;
            
            // Navigate to parent object
            for (const key of keys) {
                if (!(key in target)) {
                    target[key] = {};
                }
                target = target[key];
            }
            
            // Validate if validator exists
            const validator = this.validators[path];
            if (validator && !validator(value)) {
                throw new Error(`Invalid value for ${path}`);
            }
            
            // Set value
            const oldValue = target[lastKey];
            target[lastKey] = value;
            
            // Save config
            this.saveConfig();
            
            // Notify listeners
            this.notifyListeners('change', {
                path,
                oldValue,
                newValue: value
            });
            
            return true;
            
        } catch (error) {
            console.error('Error setting config value:', error);
            return false;
        }
    }
    
    /**
     * Reset to defaults
     */
    reset(path = null) {
        try {
            if (path) {
                // Reset specific path
                const defaultValue = this.getDefaultValue(path);
                this.set(path, defaultValue);
            } else {
                // Reset entire config
                this.config = { ...this.defaults };
                this.saveConfig();
                this.notifyListeners('reset', this.config);
            }
            
            console.log('✅ Config reset successfully');
            return true;
            
        } catch (error) {
            console.error('Error resetting config:', error);
            return false;
        }
    }
    
    /**
     * Validate entire configuration
     */
    validateConfig() {
        const errors = [];
        
        // Check required fields
        const required = [
            'api.exchange',
            'trading.defaultStrategy',
            'risk.maxDailyLoss'
        ];
        
        for (const path of required) {
            const value = this.get(path);
            if (value === undefined || value === null || value === '') {
                errors.push(`Missing required field: ${path}`);
            }
        }
        
        // Run validators
        for (const [path, validator] of Object.entries(this.validators)) {
            const value = this.get(path);
            if (value !== undefined && !validator(value)) {
                errors.push(`Invalid value for ${path}: ${value}`);
            }
        }
        
        // Check strategy consistency
        const activeStrategy = this.get('trading.defaultStrategy');
        if (!this.get(`strategies.${activeStrategy}.enabled`)) {
            errors.push(`Default strategy '${activeStrategy}' is not enabled`);
        }
        
        if (errors.length > 0) {
            throw new Error(`Config validation failed:\n${errors.join('\n')}`);
        }
        
        return true;
    }
    
    /**
     * Apply environment-specific config
     */
    applyEnvironmentConfig() {
        if (this.env === 'development') {
            this.config.debug = true;
            this.config.logLevel = 'debug';
            this.config.api.testnet = true;
            this.config.trading.paperTrading = true;
            this.config.performance.enableProfiling = true;
        } else if (this.env === 'staging') {
            this.config.api.testnet = true;
            this.config.trading.paperTrading = true;
        }
        
        // Apply from environment variables if available
        if (typeof process !== 'undefined' && process.env) {
            if (process.env.API_KEY) {
                this.config.api.apiKey = process.env.API_KEY;
            }
            if (process.env.API_SECRET) {
                this.config.api.apiSecret = process.env.API_SECRET;
            }
        }
    }
    
    /**
     * Export configuration
     */
    export(options = {}) {
        const config = { ...this.config };
        
        // Remove sensitive data if requested
        if (options.removeSensitive) {
            for (const field of this.encryptedFields) {
                this.removeField(config, field);
            }
        }
        
        // Convert to specific format
        if (options.format === 'json') {
            return JSON.stringify(config, null, 2);
        } else if (options.format === 'env') {
            return this.toEnvFormat(config);
        }
        
        return config;
    }
    
    /**
     * Import configuration
     */
    import(data, options = {}) {
        try {
            let config;
            
            // Parse input
            if (typeof data === 'string') {
                config = JSON.parse(data);
            } else {
                config = data;
            }
            
            // Validate version
            if (!this.isVersionCompatible(config.version)) {
                if (!options.force) {
                    throw new Error('Incompatible config version');
                }
            }
            
            // Merge with defaults
            this.config = this.mergeConfig(this.defaults, config);
            
            // Validate
            this.validateConfig();
            
            // Save
            this.saveConfig();
            
            console.log('✅ Config imported successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to import config:', error);
            return false;
        }
    }
    
    /**
     * Add listener for config changes
     */
    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event).add(callback);
    }
    
    /**
     * Remove listener
     */
    off(event, callback) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).delete(callback);
        }
    }
    
    /**
     * Notify listeners
     */
    notifyListeners(event, data) {
        if (this.listeners.has(event)) {
            for (const callback of this.listeners.get(event)) {
                try {
                    callback(data);
                } catch (error) {
                    console.error('Listener error:', error);
                }
            }
        }
    }
    
    /**
     * Get configuration history
     */
    getHistory() {
        return [...this.configHistory];
    }
    
    /**
     * Restore from history
     */
    restoreFromHistory(index) {
        if (index >= 0 && index < this.configHistory.length) {
            this.config = { ...this.configHistory[index] };
            this.saveConfig();
            return true;
        }
        return false;
    }
    
    /**
     * Add to history
     */
    addToHistory() {
        this.configHistory.unshift({ ...this.config });
        if (this.configHistory.length > this.maxHistorySize) {
            this.configHistory.pop();
        }
    }
    
    /**
     * Encryption (simplified - use proper encryption in production)
     */
    encrypt(data) {
        // In production, use proper encryption like AES
        return btoa(encodeURIComponent(data));
    }
    
    decrypt(data) {
        // In production, use proper decryption
        return decodeURIComponent(atob(data));
    }
    
    /**
     * Helper methods
     */
    isVersionCompatible(version) {
        const [major] = version.split('.');
        const [currentMajor] = this.defaults.version.split('.');
        return major === currentMajor;
    }
    
    mergeConfig(defaults, custom) {
        const merged = { ...defaults };
        
        for (const [key, value] of Object.entries(custom)) {
            if (value && typeof value === 'object' && !Array.isArray(value)) {
                merged[key] = this.mergeConfig(defaults[key] || {}, value);
            } else {
                merged[key] = value;
            }
        }
        
        return merged;
    }
    
    getDefaultValue(path) {
        const keys = path.split('.');
        let value = this.defaults;
        
        for (const key of keys) {
            if (value && typeof value === 'object' && key in value) {
                value = value[key];
            } else {
                return undefined;
            }
        }
        
        return value;
    }
    
    removeField(obj, field) {
        const keys = field.split('.');
        const lastKey = keys.pop();
        let target = obj;
        
        for (const key of keys) {
            if (target[key]) {
                target = target[key];
            } else {
                return;
            }
        }
        
        delete target[lastKey];
    }
    
    toEnvFormat(config, prefix = 'TRADING_BOT') {
        const lines = [];
        
        const flatten = (obj, currentPrefix) => {
            for (const [key, value] of Object.entries(obj)) {
                const newPrefix = `${currentPrefix}_${key.toUpperCase()}`;
                
                if (value && typeof value === 'object' && !Array.isArray(value)) {
                    flatten(value, newPrefix);
                } else {
                    lines.push(`${newPrefix}=${value}`);
                }
            }
        };
        
        flatten(config, prefix);
        return lines.join('\n');
    }
}

// Export as singleton
const configManager = new ConfigManager();
export default configManager;