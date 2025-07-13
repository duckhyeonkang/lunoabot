/**
 * 🤖 Professional Trading Bot - Main Entry Point
 * Version: 2.1.0
 * 
 * 🔒 Security Features:
 * - XSS Protection
 * - CSRF Protection
 * - Input Sanitization
 * - Secure API Communication
 * 
 * ⚡ Performance Optimizations:
 * - Lazy Loading
 * - Code Splitting
 * - Web Workers
 * - Request Animation Frame
 */

'use strict';

// Global namespace
window.TradingBot = window.TradingBot || {};

/**
 * Main Trading Bot Application
 */
class TradingBotApp {
    constructor() {
        this.version = '2.1.0';
        this.modules = new Map();
        this.plugins = new Map();
        this.config = null;
        this.state = {
            isRunning: false,
            isConnected: false,
            currentStrategy: null,
            portfolio: {},
            performance: {}
        };
        
        // Security
        this.securityToken = this.generateSecurityToken();
        
        // Performance monitoring
        this.performanceObserver = null;
        this.frameId = null;
        
        // Event emitter
        this.events = new EventTarget();
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize the application
     */
    async init() {
        try {
            console.log(`🤖 Trading Bot v${this.version} initializing...`);
            
            // Security checks
            this.performSecurityChecks();
            
            // Load configuration
            await this.loadConfig();
            
            // Initialize core modules
            await this.initializeCoreModules();
            
            // Load plugins
            await this.loadPlugins();
            
            // Setup UI
            this.setupUI();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            // Connect to services
            await this.connectToServices();
            
            console.log('✅ Trading Bot initialized successfully');
            this.emit('app:initialized');
            
        } catch (error) {
            console.error('❌ Initialization failed:', error);
            this.handleCriticalError(error);
        }
    }
    
    /**
     * Security checks
     */
    performSecurityChecks() {
        // Check for HTTPS
        if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
            throw new Error('🔒 HTTPS is required for security');
        }
        
        // Check for Content Security Policy
        const csp = document.querySelector('meta[http-equiv="Content-Security-Policy"]');
        if (!csp) {
            console.warn('⚠️ Content Security Policy not found');
        }
        
        // Freeze critical objects
        Object.freeze(Object.prototype);
        Object.freeze(Array.prototype);
        Object.freeze(Function.prototype);
        
        // Disable dangerous features in production
        if (this.isProduction()) {
            this.disableDangerousFeatures();
        }
    }
    
    /**
     * Disable dangerous features
     */
    disableDangerousFeatures() {
        // Disable eval
        window.eval = () => {
            throw new Error('eval is disabled for security');
        };
        
        // Override console in production
        if (!this.config?.debug) {
            ['log', 'info', 'warn', 'error'].forEach(method => {
                const original = console[method];
                console[method] = (...args) => {
                    // Log to server instead
                    this.logToServer(method, args);
                };
            });
        }
    }
    
    /**
     * Generate security token
     */
    generateSecurityToken() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Load configuration
     */
    async loadConfig() {
        try {
            // Load from secure storage or API
            const stored = this.secureStorage.get('config');
            if (stored) {
                this.config = JSON.parse(stored);
            } else {
                // Load default config
                this.config = await import('./config.js').then(m => m.default);
            }
            
            // Validate config
            this.validateConfig(this.config);
            
        } catch (error) {
            console.error('Failed to load config:', error);
            // Use fallback config
            this.config = this.getFallbackConfig();
        }
    }
    
    /**
     * Initialize core modules
     */
    async initializeCoreModules() {
        const moduleList = [
            { name: 'security', path: './modules/security.js' },
            { name: 'api', path: './modules/api.js' },
            { name: 'ui', path: './modules/ui-components.js' },
            { name: 'tradingEngine', path: './modules/trading-engine.js' },
            { name: 'chart', path: './modules/chart.js' },
            { name: 'performance', path: './modules/performance.js' }
        ];
        
        for (const module of moduleList) {
            try {
                const ModuleClass = await import(module.path).then(m => m.default);
                const instance = new ModuleClass(this);
                this.modules.set(module.name, instance);
                console.log(`✅ Module loaded: ${module.name}`);
            } catch (error) {
                console.error(`❌ Failed to load module ${module.name}:`, error);
                // Continue loading other modules
            }
        }
    }
    
    /**
     * Load plugins
     */
    async loadPlugins() {
        const enabledPlugins = this.config?.plugins?.enabled || [];
        
        for (const pluginName of enabledPlugins) {
            try {
                const plugin = await import(`./plugins/${pluginName}.js`).then(m => m.default);
                await this.registerPlugin(pluginName, plugin);
            } catch (error) {
                console.error(`Failed to load plugin ${pluginName}:`, error);
            }
        }
    }
    
    /**
     * Register a plugin
     */
    async registerPlugin(name, PluginClass) {
        try {
            // Validate plugin
            if (!this.validatePlugin(PluginClass)) {
                throw new Error('Invalid plugin structure');
            }
            
            // Create sandbox for plugin
            const sandbox = this.createPluginSandbox(name);
            const instance = new PluginClass(sandbox);
            
            // Initialize plugin
            await instance.init();
            
            this.plugins.set(name, instance);
            console.log(`🔌 Plugin registered: ${name}`);
            this.emit('plugin:registered', { name });
            
        } catch (error) {
            console.error(`Failed to register plugin ${name}:`, error);
            throw error;
        }
    }
    
    /**
     * Create plugin sandbox for security
     */
    createPluginSandbox(pluginName) {
        return {
            // Limited API access
            api: {
                getState: () => this.getPublicState(),
                subscribe: (event, handler) => this.events.addEventListener(event, handler),
                unsubscribe: (event, handler) => this.events.removeEventListener(event, handler),
                emit: (event, data) => this.emit(`plugin:${pluginName}:${event}`, data)
            },
            // Limited DOM access
            dom: {
                querySelector: (selector) => {
                    // Only allow access to plugin-specific containers
                    if (selector.startsWith(`#plugin-${pluginName}`)) {
                        return document.querySelector(selector);
                    }
                    return null;
                }
            },
            // Utilities
            utils: {
                formatCurrency: this.formatCurrency.bind(this),
                formatPercent: this.formatPercent.bind(this),
                debounce: this.debounce.bind(this),
                throttle: this.throttle.bind(this)
            }
        };
    }
    
    /**
     * Setup UI
     */
    setupUI() {
        // Remove loading screen
        const loadingScreen = document.getElementById('loadingScreen');
        if (loadingScreen) {
            loadingScreen.classList.add('fade-out');
            setTimeout(() => loadingScreen.remove(), 500);
        }
        
        // Show main interface
        const mainInterface = document.getElementById('tradingBotInterface');
        if (mainInterface) {
            mainInterface.classList.add('loaded');
        }
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Initialize tooltips
        this.initializeTooltips();
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Start/Stop button
        const startStopBtn = document.getElementById('start-stop-btn');
        if (startStopBtn) {
            startStopBtn.addEventListener('click', this.debounce(() => {
                this.toggleBot();
            }, 300));
        }
        
        // Emergency stop
        const emergencyStop = document.getElementById('emergency-stop');
        if (emergencyStop) {
            emergencyStop.addEventListener('click', () => {
                this.emergencyStop();
            });
        }
        
        // Strategy selector
        const strategySelector = document.getElementById('strategy-selector');
        if (strategySelector) {
            strategySelector.addEventListener('change', (e) => {
                this.changeStrategy(e.target.value);
            });
        }
        
        // Window events
        window.addEventListener('beforeunload', (e) => {
            if (this.state.isRunning) {
                e.preventDefault();
                e.returnValue = 'Trading bot is running. Are you sure you want to leave?';
            }
        });
        
        // Error handling
        window.addEventListener('unhandledrejection', (e) => {
            console.error('Unhandled promise rejection:', e.reason);
            this.handleError(e.reason);
        });
    }
    
    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        const shortcuts = {
            'ctrl+s': () => this.toggleBot(),
            'ctrl+e': () => this.exportData(),
            'ctrl+r': () => this.refreshData(),
            'ctrl+t': () => this.openBacktest(),
            'ctrl+n': () => this.createNewOrder(),
            'ctrl+1': () => this.changeTimeframe('1h'),
            'ctrl+2': () => this.changeTimeframe('1d'),
            'ctrl+3': () => this.changeTimeframe('1w'),
            'space': (e) => {
                e.preventDefault();
                this.emergencyStop();
            },
            'escape': () => this.closeAllModals(),
            'f1': () => this.showHelp()
        };
        
        document.addEventListener('keydown', (e) => {
            const key = this.getShortcutKey(e);
            if (shortcuts[key]) {
                e.preventDefault();
                shortcuts[key](e);
            }
        });
    }
    
    /**
     * Get shortcut key string
     */
    getShortcutKey(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.altKey) parts.push('alt');
        if (e.shiftKey) parts.push('shift');
        if (e.metaKey) parts.push('meta');
        
        if (e.code === 'Space') {
            parts.push('space');
        } else if (e.code === 'Escape') {
            parts.push('escape');
        } else if (e.code.startsWith('F')) {
            parts.push(e.code.toLowerCase());
        } else if (e.key) {
            parts.push(e.key.toLowerCase());
        }
        
        return parts.join('+');
    }
    
    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        if (!this.modules.has('performance')) return;
        
        const perfModule = this.modules.get('performance');
        perfModule.startMonitoring();
        
        // Update UI with performance metrics
        this.frameId = requestAnimationFrame(this.updatePerformanceMetrics.bind(this));
    }
    
    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        if (!this.modules.has('performance')) return;
        
        const metrics = this.modules.get('performance').getMetrics();
        
        // Update UI
        const fpsElement = document.getElementById('fps');
        if (fpsElement) {
            fpsElement.textContent = Math.round(metrics.fps);
        }
        
        const memoryElement = document.getElementById('memory');
        if (memoryElement && metrics.memory) {
            const mb = Math.round(metrics.memory.usedJSHeapSize / 1048576);
            memoryElement.textContent = `${mb}MB`;
        }
        
        const latencyElement = document.getElementById('latency-metric');
        if (latencyElement) {
            latencyElement.textContent = `${metrics.latency}ms`;
        }
        
        // Continue monitoring
        this.frameId = requestAnimationFrame(this.updatePerformanceMetrics.bind(this));
    }
    
    /**
     * Connect to services
     */
    async connectToServices() {
        try {
            // Connect to exchange API
            if (this.modules.has('api')) {
                await this.modules.get('api').connect();
                this.state.isConnected = true;
            }
            
            // Start real-time data feeds
            if (this.modules.has('tradingEngine')) {
                await this.modules.get('tradingEngine').startDataFeeds();
            }
            
            this.emit('services:connected');
            
        } catch (error) {
            console.error('Failed to connect to services:', error);
            this.handleConnectionError(error);
        }
    }
    
    /**
     * Toggle bot running state
     */
    async toggleBot() {
        try {
            if (this.state.isRunning) {
                await this.stopBot();
            } else {
                await this.startBot();
            }
        } catch (error) {
            console.error('Failed to toggle bot:', error);
            this.showNotification('Failed to toggle bot', 'error');
        }
    }
    
    /**
     * Start the bot
     */
    async startBot() {
        if (!this.state.isConnected) {
            throw new Error('Not connected to exchange');
        }
        
        if (!this.state.currentStrategy) {
            throw new Error('No strategy selected');
        }
        
        // Pre-start checks
        const checks = await this.performPreStartChecks();
        if (!checks.passed) {
            throw new Error(checks.message);
        }
        
        // Start trading engine
        await this.modules.get('tradingEngine').start(this.state.currentStrategy);
        
        this.state.isRunning = true;
        this.updateBotStatus('running');
        this.emit('bot:started');
        
        console.log('🚀 Bot started');
        this.showNotification('Bot started successfully', 'success');
    }
    
    /**
     * Stop the bot
     */
    async stopBot() {
        // Stop trading engine
        if (this.modules.has('tradingEngine')) {
            await this.modules.get('tradingEngine').stop();
        }
        
        this.state.isRunning = false;
        this.updateBotStatus('stopped');
        this.emit('bot:stopped');
        
        console.log('🛑 Bot stopped');
        this.showNotification('Bot stopped', 'info');
    }
    
    /**
     * Emergency stop
     */
    async emergencyStop() {
        console.warn('🚨 EMERGENCY STOP ACTIVATED');
        
        try {
            // Cancel all orders immediately
            if (this.modules.has('tradingEngine')) {
                await this.modules.get('tradingEngine').cancelAllOrders();
            }
            
            // Close all positions
            if (this.config?.emergencyStop?.closePositions) {
                await this.modules.get('tradingEngine').closeAllPositions();
            }
            
            // Stop the bot
            await this.stopBot();
            
            // Log the event
            this.logEmergencyStop();
            
            this.showNotification('Emergency stop completed', 'warning');
            
        } catch (error) {
            console.error('Emergency stop failed:', error);
            this.showNotification('Emergency stop failed!', 'error');
        }
    }
    
    /**
     * Update bot status in UI
     */
    updateBotStatus(status) {
        const statusIndicator = document.getElementById('bot-status-indicator');
        const statusText = document.getElementById('bot-status-text');
        
        if (statusIndicator) {
            statusIndicator.className = 'status-indicator';
            if (status === 'running') {
                statusIndicator.classList.add('running');
            }
        }
        
        if (statusText) {
            const statusTexts = {
                running: '봇 실행 중',
                stopped: '봇 정지',
                error: '오류 발생'
            };
            statusText.textContent = statusTexts[status] || status;
        }
    }
    
    /**
     * Utility functions
     */
    formatCurrency(value, currency = 'USD') {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value);
    }
    
    formatPercent(value) {
        return new Intl.NumberFormat('en-US', {
            style: 'percent',
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        }).format(value / 100);
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Event emitter
     */
    emit(event, data) {
        this.events.dispatchEvent(new CustomEvent(event, { detail: data }));
    }
    
    /**
     * Error handling
     */
    handleError(error) {
        console.error('Application error:', error);
        
        // Log to server
        this.logToServer('error', error);
        
        // Show user-friendly message
        this.showNotification('An error occurred', 'error');
    }
    
    handleCriticalError(error) {
        console.error('CRITICAL ERROR:', error);
        
        // Show error screen
        const errorScreen = document.getElementById('errorScreen');
        if (errorScreen) {
            const errorMessage = document.getElementById('errorMessage');
            if (errorMessage) {
                errorMessage.textContent = error.message || 'A critical error occurred';
            }
            errorScreen.classList.add('show');
        }
    }
    
    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (this.modules.has('ui')) {
            this.modules.get('ui').showNotification(message, type);
        }
    }
    
    /**
     * Helper methods
     */
    isProduction() {
        return location.hostname !== 'localhost' && 
               location.hostname !== '127.0.0.1' && 
               !location.hostname.startsWith('192.168.');
    }
    
    get secureStorage() {
        // Wrapper for localStorage with encryption
        return {
            get: (key) => {
                try {
                    const encrypted = localStorage.getItem(key);
                    if (!encrypted) return null;
                    // Decrypt here (simplified for example)
                    return encrypted;
                } catch (e) {
                    console.error('Storage read error:', e);
                    return null;
                }
            },
            set: (key, value) => {
                try {
                    // Encrypt here (simplified for example)
                    localStorage.setItem(key, value);
                } catch (e) {
                    console.error('Storage write error:', e);
                }
            }
        };
    }
    
    validateConfig(config) {
        // Validate configuration structure
        const required = ['api', 'trading', 'risk', 'ui'];
        for (const key of required) {
            if (!config[key]) {
                throw new Error(`Missing required config: ${key}`);
            }
        }
        return true;
    }
    
    validatePlugin(PluginClass) {
        // Check if plugin has required methods
        const required = ['init', 'destroy'];
        const proto = PluginClass.prototype;
        
        for (const method of required) {
            if (typeof proto[method] !== 'function') {
                return false;
            }
        }
        return true;
    }
    
    getFallbackConfig() {
        // Minimal fallback configuration
        return {
            version: '2.1.0',
            api: {
                endpoint: 'wss://api.exchange.com',
                timeout: 30000
            },
            trading: {
                defaultStrategy: 'grid',
                maxPositions: 3
            },
            risk: {
                maxDailyLoss: 0.05,
                maxPositionSize: 0.1
            },
            ui: {
                theme: 'dark',
                refreshInterval: 1000
            },
            plugins: {
                enabled: []
            }
        };
    }
    
    getPublicState() {
        // Return safe copy of state for plugins
        return {
            isRunning: this.state.isRunning,
            isConnected: this.state.isConnected,
            currentStrategy: this.state.currentStrategy
        };
    }
    
    performPreStartChecks() {
        // Perform checks before starting bot
        const checks = {
            passed: true,
            message: ''
        };
        
        // Check balance
        if (this.state.portfolio.balance < 100) {
            checks.passed = false;
            checks.message = 'Insufficient balance';
        }
        
        // Check risk settings
        if (!this.modules.get('tradingEngine').validateRiskSettings()) {
            checks.passed = false;
            checks.message = 'Invalid risk settings';
        }
        
        return checks;
    }
    
    logToServer(level, data) {
        // Send logs to server (implement based on your backend)
        if (this.modules.has('api')) {
            this.modules.get('api').log(level, data).catch(() => {
                // Silent fail for logging
            });
        }
    }
    
    logEmergencyStop() {
        const event = {
            timestamp: new Date().toISOString(),
            type: 'EMERGENCY_STOP',
            state: this.state,
            reason: 'User initiated'
        };
        
        this.logToServer('critical', event);
    }
    
    /**
     * Cleanup
     */
    destroy() {
        // Cancel animation frame
        if (this.frameId) {
            cancelAnimationFrame(this.frameId);
        }
        
        // Destroy modules
        for (const [name, module] of this.modules) {
            if (module.destroy) {
                module.destroy();
            }
        }
        
        // Destroy plugins
        for (const [name, plugin] of this.plugins) {
            if (plugin.destroy) {
                plugin.destroy();
            }
        }
        
        // Clear event listeners
        this.events = new EventTarget();
        
        console.log('Trading Bot destroyed');
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.TradingBot.app = new TradingBotApp();
    });
} else {
    window.TradingBot.app = new TradingBotApp();
}

// Export for modules
export default TradingBotApp;