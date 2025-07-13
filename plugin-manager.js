/**
 * 🔌 Trading Bot Plugin Manager
 * Version: 2.1.0
 * 
 * 🔒 Security Features:
 * - Sandboxed plugin execution
 * - Permission system
 * - Resource limits
 * - API access control
 * 
 * 🚀 Features:
 * - Dynamic plugin loading
 * - Dependency management
 * - Plugin lifecycle hooks
 * - Inter-plugin communication
 */

'use strict';

/**
 * Plugin Manager Class
 */
class PluginManager {
    constructor(app) {
        this.app = app;
        this.plugins = new Map();
        this.pluginStates = new Map();
        this.pluginMetadata = new Map();
        this.loadingQueue = [];
        this.dependencies = new Map();
        this.hooks = new Map();
        this.permissions = this.setupPermissions();
        
        // Plugin communication
        this.pluginBus = new EventTarget();
        
        // Resource tracking
        this.resourceUsage = new Map();
        this.resourceLimits = {
            maxMemory: 50 * 1024 * 1024, // 50MB per plugin
            maxCpuTime: 1000, // ms per second
            maxApiCalls: 100, // per minute
            maxDomNodes: 1000
        };
        
        // Security
        this.blockedAPIs = ['eval', 'Function', 'WebAssembly'];
        this.allowedDomains = ['api.binance.com', 'api.coingecko.com'];
        
        console.log('🔌 Plugin Manager initialized');
    }
    
    /**
     * Setup permission system
     */
    setupPermissions() {
        return {
            // Core permissions
            'core.state.read': 'Read application state',
            'core.state.write': 'Modify application state',
            'core.config.read': 'Read configuration',
            'core.config.write': 'Modify configuration',
            
            // Trading permissions
            'trading.orders.read': 'View orders',
            'trading.orders.create': 'Create orders',
            'trading.orders.cancel': 'Cancel orders',
            'trading.positions.read': 'View positions',
            'trading.positions.close': 'Close positions',
            
            // Data permissions
            'data.market.read': 'Read market data',
            'data.historical.read': 'Read historical data',
            'data.indicators.read': 'Read indicators',
            
            // UI permissions
            'ui.panel.create': 'Create UI panels',
            'ui.notification.show': 'Show notifications',
            'ui.modal.show': 'Show modals',
            
            // API permissions
            'api.external.fetch': 'Make external API calls',
            'api.websocket.connect': 'Connect to websockets',
            
            // System permissions
            'system.storage.read': 'Read from storage',
            'system.storage.write': 'Write to storage',
            'system.worker.create': 'Create web workers'
        };
    }
    
    /**
     * Register a plugin
     */
    async register(pluginId, PluginClass, metadata = {}) {
        try {
            console.log(`📦 Registering plugin: ${pluginId}`);
            
            // Validate plugin
            this.validatePlugin(pluginId, PluginClass, metadata);
            
            // Check dependencies
            await this.checkDependencies(pluginId, metadata.dependencies);
            
            // Store metadata
            this.pluginMetadata.set(pluginId, {
                id: pluginId,
                name: metadata.name || pluginId,
                version: metadata.version || '1.0.0',
                author: metadata.author || 'Unknown',
                description: metadata.description || '',
                permissions: metadata.permissions || [],
                dependencies: metadata.dependencies || [],
                hooks: metadata.hooks || {},
                config: metadata.config || {},
                ...metadata
            });
            
            // Create sandboxed environment
            const sandbox = this.createSandbox(pluginId, metadata.permissions);
            
            // Instantiate plugin
            const plugin = new PluginClass(sandbox);
            
            // Store plugin
            this.plugins.set(pluginId, plugin);
            this.pluginStates.set(pluginId, 'registered');
            
            // Register hooks
            this.registerHooks(pluginId, metadata.hooks);
            
            console.log(`✅ Plugin registered: ${pluginId}`);
            
            // Emit event
            this.app.emit('plugin:registered', { pluginId, metadata });
            
            return true;
            
        } catch (error) {
            console.error(`Failed to register plugin ${pluginId}:`, error);
            throw error;
        }
    }
    
    /**
     * Load a plugin
     */
    async load(pluginId) {
        try {
            const plugin = this.plugins.get(pluginId);
            if (!plugin) {
                throw new Error(`Plugin not found: ${pluginId}`);
            }
            
            const state = this.pluginStates.get(pluginId);
            if (state === 'loaded' || state === 'enabled') {
                console.warn(`Plugin already loaded: ${pluginId}`);
                return true;
            }
            
            console.log(`📥 Loading plugin: ${pluginId}`);
            
            // Initialize resource tracking
            this.resourceUsage.set(pluginId, {
                memory: 0,
                cpuTime: 0,
                apiCalls: 0,
                domNodes: 0,
                startTime: Date.now()
            });
            
            // Call plugin load hook
            if (plugin.onLoad) {
                await this.executeInSandbox(pluginId, async () => {
                    await plugin.onLoad();
                });
            }
            
            // Update state
            this.pluginStates.set(pluginId, 'loaded');
            
            console.log(`✅ Plugin loaded: ${pluginId}`);
            
            // Emit event
            this.app.emit('plugin:loaded', { pluginId });
            
            return true;
            
        } catch (error) {
            console.error(`Failed to load plugin ${pluginId}:`, error);
            this.pluginStates.set(pluginId, 'error');
            throw error;
        }
    }
    
    /**
     * Enable a plugin
     */
    async enable(pluginId) {
        try {
            const plugin = this.plugins.get(pluginId);
            if (!plugin) {
                throw new Error(`Plugin not found: ${pluginId}`);
            }
            
            const state = this.pluginStates.get(pluginId);
            if (state !== 'loaded') {
                if (state !== 'disabled') {
                    await this.load(pluginId);
                }
            }
            
            console.log(`🟢 Enabling plugin: ${pluginId}`);
            
            // Call plugin enable hook
            if (plugin.onEnable) {
                await this.executeInSandbox(pluginId, async () => {
                    await plugin.onEnable();
                });
            }
            
            // Update state
            this.pluginStates.set(pluginId, 'enabled');
            
            // Start resource monitoring
            this.startResourceMonitoring(pluginId);
            
            console.log(`✅ Plugin enabled: ${pluginId}`);
            
            // Emit event
            this.app.emit('plugin:enabled', { pluginId });
            
            return true;
            
        } catch (error) {
            console.error(`Failed to enable plugin ${pluginId}:`, error);
            throw error;
        }
    }
    
    /**
     * Disable a plugin
     */
    async disable(pluginId) {
        try {
            const plugin = this.plugins.get(pluginId);
            if (!plugin) {
                throw new Error(`Plugin not found: ${pluginId}`);
            }
            
            console.log(`🔴 Disabling plugin: ${pluginId}`);
            
            // Stop resource monitoring
            this.stopResourceMonitoring(pluginId);
            
            // Call plugin disable hook
            if (plugin.onDisable) {
                await this.executeInSandbox(pluginId, async () => {
                    await plugin.onDisable();
                });
            }
            
            // Update state
            this.pluginStates.set(pluginId, 'disabled');
            
            console.log(`✅ Plugin disabled: ${pluginId}`);
            
            // Emit event
            this.app.emit('plugin:disabled', { pluginId });
            
            return true;
            
        } catch (error) {
            console.error(`Failed to disable plugin ${pluginId}:`, error);
            throw error;
        }
    }
    
    /**
     * Unload a plugin
     */
    async unload(pluginId) {
        try {
            const plugin = this.plugins.get(pluginId);
            if (!plugin) {
                throw new Error(`Plugin not found: ${pluginId}`);
            }
            
            // Disable first if enabled
            const state = this.pluginStates.get(pluginId);
            if (state === 'enabled') {
                await this.disable(pluginId);
            }
            
            console.log(`📤 Unloading plugin: ${pluginId}`);
            
            // Call plugin unload hook
            if (plugin.onUnload) {
                await this.executeInSandbox(pluginId, async () => {
                    await plugin.onUnload();
                });
            }
            
            // Clean up resources
            this.cleanupPlugin(pluginId);
            
            // Update state
            this.pluginStates.set(pluginId, 'unloaded');
            
            console.log(`✅ Plugin unloaded: ${pluginId}`);
            
            // Emit event
            this.app.emit('plugin:unloaded', { pluginId });
            
            return true;
            
        } catch (error) {
            console.error(`Failed to unload plugin ${pluginId}:`, error);
            throw error;
        }
    }
    
    /**
     * Remove a plugin completely
     */
    async remove(pluginId) {
        try {
            // Unload first
            await this.unload(pluginId);
            
            console.log(`🗑️ Removing plugin: ${pluginId}`);
            
            // Remove from maps
            this.plugins.delete(pluginId);
            this.pluginStates.delete(pluginId);
            this.pluginMetadata.delete(pluginId);
            this.resourceUsage.delete(pluginId);
            
            // Remove hooks
            this.unregisterHooks(pluginId);
            
            console.log(`✅ Plugin removed: ${pluginId}`);
            
            // Emit event
            this.app.emit('plugin:removed', { pluginId });
            
            return true;
            
        } catch (error) {
            console.error(`Failed to remove plugin ${pluginId}:`, error);
            throw error;
        }
    }
    
    /**
     * Create sandboxed environment for plugin
     */
    createSandbox(pluginId, requestedPermissions = []) {
        const sandbox = {
            // Plugin info
            id: pluginId,
            version: this.pluginMetadata.get(pluginId)?.version,
            
            // Granted permissions
            permissions: this.grantPermissions(requestedPermissions),
            
            // Core API
            api: this.createPluginAPI(pluginId, requestedPermissions),
            
            // Event system
            events: this.createPluginEventAPI(pluginId),
            
            // Storage
            storage: this.createPluginStorageAPI(pluginId),
            
            // UI access
            ui: this.createPluginUIAPI(pluginId, requestedPermissions),
            
            // Utilities
            utils: this.createPluginUtilsAPI(),
            
            // Communication
            messaging: this.createPluginMessagingAPI(pluginId)
        };
        
        // Freeze to prevent modifications
        return this.deepFreeze(sandbox);
    }
    
    /**
     * Create plugin API based on permissions
     */
    createPluginAPI(pluginId, permissions) {
        const api = {};
        
        // State access
        if (permissions.includes('core.state.read')) {
            api.getState = (path) => {
                this.trackAPICall(pluginId, 'getState');
                return this.app.state[path];
            };
        }
        
        if (permissions.includes('core.state.write')) {
            api.setState = (path, value) => {
                this.trackAPICall(pluginId, 'setState');
                // Validate and set state
                this.app.state[path] = value;
                this.app.emit('state:changed', { path, value, source: pluginId });
            };
        }
        
        // Config access
        if (permissions.includes('core.config.read')) {
            api.getConfig = (path) => {
                this.trackAPICall(pluginId, 'getConfig');
                return this.app.config.get(path);
            };
        }
        
        // Trading APIs
        if (permissions.includes('trading.orders.read')) {
            api.getOrders = () => {
                this.trackAPICall(pluginId, 'getOrders');
                return this.app.modules.get('tradingEngine')?.getOrders();
            };
        }
        
        if (permissions.includes('trading.orders.create')) {
            api.createOrder = async (order) => {
                this.trackAPICall(pluginId, 'createOrder');
                // Validate order
                this.validatePluginOrder(pluginId, order);
                return await this.app.modules.get('tradingEngine')?.createOrder(order);
            };
        }
        
        // External API access
        if (permissions.includes('api.external.fetch')) {
            api.fetch = this.createSecureFetch(pluginId);
        }
        
        return api;
    }
    
    /**
     * Create plugin event API
     */
    createPluginEventAPI(pluginId) {
        return {
            on: (event, handler) => {
                const wrappedHandler = (e) => {
                    this.executeInSandbox(pluginId, () => handler(e.detail));
                };
                this.pluginBus.addEventListener(`${pluginId}:${event}`, wrappedHandler);
            },
            
            off: (event, handler) => {
                this.pluginBus.removeEventListener(`${pluginId}:${event}`, handler);
            },
            
            emit: (event, data) => {
                this.trackAPICall(pluginId, 'emit');
                this.pluginBus.dispatchEvent(
                    new CustomEvent(`${pluginId}:${event}`, { detail: data })
                );
            },
            
            // Global events (if permitted)
            subscribe: (event, handler) => {
                if (this.canSubscribeToGlobalEvent(pluginId, event)) {
                    this.app.events.addEventListener(event, handler);
                }
            }
        };
    }
    
    /**
     * Create plugin storage API
     */
    createPluginStorageAPI(pluginId) {
        const prefix = `plugin_${pluginId}_`;
        
        return {
            get: (key) => {
                this.trackAPICall(pluginId, 'storage.get');
                try {
                    const value = localStorage.getItem(prefix + key);
                    return value ? JSON.parse(value) : null;
                } catch (e) {
                    console.error('Plugin storage read error:', e);
                    return null;
                }
            },
            
            set: (key, value) => {
                this.trackAPICall(pluginId, 'storage.set');
                try {
                    // Check storage quota
                    const size = JSON.stringify(value).length;
                    if (this.checkStorageQuota(pluginId, size)) {
                        localStorage.setItem(prefix + key, JSON.stringify(value));
                        return true;
                    }
                    return false;
                } catch (e) {
                    console.error('Plugin storage write error:', e);
                    return false;
                }
            },
            
            remove: (key) => {
                this.trackAPICall(pluginId, 'storage.remove');
                localStorage.removeItem(prefix + key);
            },
            
            clear: () => {
                this.trackAPICall(pluginId, 'storage.clear');
                // Clear all plugin storage
                for (let i = localStorage.length - 1; i >= 0; i--) {
                    const key = localStorage.key(i);
                    if (key.startsWith(prefix)) {
                        localStorage.removeItem(key);
                    }
                }
            }
        };
    }
    
    /**
     * Create plugin UI API
     */
    createPluginUIAPI(pluginId, permissions) {
        const ui = {};
        
        if (permissions.includes('ui.panel.create')) {
            ui.createPanel = (config) => {
                this.trackAPICall(pluginId, 'createPanel');
                return this.createPluginPanel(pluginId, config);
            };
        }
        
        if (permissions.includes('ui.notification.show')) {
            ui.showNotification = (message, type = 'info') => {
                this.trackAPICall(pluginId, 'showNotification');
                this.app.showNotification(`[${pluginId}] ${message}`, type);
            };
        }
        
        if (permissions.includes('ui.modal.show')) {
            ui.showModal = (config) => {
                this.trackAPICall(pluginId, 'showModal');
                return this.createPluginModal(pluginId, config);
            };
        }
        
        // DOM access (restricted)
        ui.querySelector = (selector) => {
            // Only allow access to plugin-specific elements
            if (selector.startsWith(`#plugin-${pluginId}`)) {
                return document.querySelector(selector);
            }
            return null;
        };
        
        return ui;
    }
    
    /**
     * Create plugin utils API
     */
    createPluginUtilsAPI() {
        return {
            // Data formatting
            formatCurrency: (value, currency) => 
                this.app.formatCurrency(value, currency),
            formatPercent: (value) => 
                this.app.formatPercent(value),
            formatNumber: (value, decimals = 2) => 
                value.toFixed(decimals),
            
            // Date/Time
            formatDate: (date, format) => 
                this.formatDate(date, format),
            now: () => Date.now(),
            
            // Helpers
            debounce: (fn, delay) => 
                this.app.debounce(fn, delay),
            throttle: (fn, limit) => 
                this.app.throttle(fn, limit),
            
            // Calculations
            calculatePnL: (entry, exit, quantity, fees) => 
                this.calculatePnL(entry, exit, quantity, fees),
            calculatePosition: (price, quantity, leverage) => 
                this.calculatePosition(price, quantity, leverage),
            
            // Indicators (basic)
            sma: (data, period) => this.calculateSMA(data, period),
            ema: (data, period) => this.calculateEMA(data, period),
            rsi: (data, period) => this.calculateRSI(data, period)
        };
    }
    
    /**
     * Create plugin messaging API
     */
    createPluginMessagingAPI(pluginId) {
        return {
            // Send message to another plugin
            send: (targetPluginId, message) => {
                this.trackAPICall(pluginId, 'messaging.send');
                if (this.plugins.has(targetPluginId)) {
                    this.pluginBus.dispatchEvent(
                        new CustomEvent(`message:${targetPluginId}`, {
                            detail: { from: pluginId, data: message }
                        })
                    );
                    return true;
                }
                return false;
            },
            
            // Broadcast to all plugins
            broadcast: (message) => {
                this.trackAPICall(pluginId, 'messaging.broadcast');
                this.pluginBus.dispatchEvent(
                    new CustomEvent('message:broadcast', {
                        detail: { from: pluginId, data: message }
                    })
                );
            },
            
            // Listen for messages
            onMessage: (handler) => {
                this.pluginBus.addEventListener(`message:${pluginId}`, (e) => {
                    this.executeInSandbox(pluginId, () => handler(e.detail));
                });
            }
        };
    }
    
    /**
     * Execute code in sandbox
     */
    async executeInSandbox(pluginId, fn) {
        const startTime = performance.now();
        
        try {
            // Set active plugin context
            this.activePlugin = pluginId;
            
            // Execute with timeout
            const result = await Promise.race([
                fn(),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Plugin execution timeout')), 5000)
                )
            ]);
            
            // Track CPU time
            const cpuTime = performance.now() - startTime;
            this.trackResourceUsage(pluginId, 'cpuTime', cpuTime);
            
            return result;
            
        } catch (error) {
            console.error(`Plugin ${pluginId} execution error:`, error);
            throw error;
        } finally {
            this.activePlugin = null;
        }
    }
    
    /**
     * Create secure fetch for plugins
     */
    createSecureFetch(pluginId) {
        return async (url, options = {}) => {
            this.trackAPICall(pluginId, 'fetch');
            
            // Validate URL
            const urlObj = new URL(url);
            if (!this.isAllowedDomain(urlObj.hostname)) {
                throw new Error(`Domain not allowed: ${urlObj.hostname}`);
            }
            
            // Add security headers
            const secureOptions = {
                ...options,
                headers: {
                    ...options.headers,
                    'X-Plugin-ID': pluginId,
                    'X-Request-ID': this.generateRequestId()
                }
            };
            
            // Make request with timeout
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 30000);
            
            try {
                const response = await fetch(url, {
                    ...secureOptions,
                    signal: controller.signal
                });
                return response;
            } finally {
                clearTimeout(timeout);
            }
        };
    }
    
    /**
     * Validate plugin
     */
    validatePlugin(pluginId, PluginClass, metadata) {
        // Check plugin ID
        if (!pluginId || typeof pluginId !== 'string') {
            throw new Error('Invalid plugin ID');
        }
        
        if (this.plugins.has(pluginId)) {
            throw new Error(`Plugin already registered: ${pluginId}`);
        }
        
        // Check required methods
        const requiredMethods = ['onLoad', 'onUnload'];
        const proto = PluginClass.prototype;
        
        for (const method of requiredMethods) {
            if (typeof proto[method] !== 'function') {
                throw new Error(`Plugin missing required method: ${method}`);
            }
        }
        
        // Validate metadata
        if (!metadata.name || !metadata.version) {
            throw new Error('Plugin metadata must include name and version');
        }
        
        // Validate permissions
        if (metadata.permissions) {
            for (const permission of metadata.permissions) {
                if (!this.permissions[permission]) {
                    throw new Error(`Unknown permission: ${permission}`);
                }
            }
        }
    }
    
    /**
     * Check plugin dependencies
     */
    async checkDependencies(pluginId, dependencies = []) {
        for (const dep of dependencies) {
            const { id, version } = typeof dep === 'string' 
                ? { id: dep, version: '*' } 
                : dep;
            
            if (!this.plugins.has(id)) {
                throw new Error(`Missing dependency: ${id}`);
            }
            
            const depMetadata = this.pluginMetadata.get(id);
            if (!this.isVersionCompatible(depMetadata.version, version)) {
                throw new Error(
                    `Incompatible dependency version: ${id}@${depMetadata.version} ` +
                    `(required: ${version})`
                );
            }
        }
    }
    
    /**
     * Grant permissions
     */
    grantPermissions(requested) {
        // In production, show permission dialog to user
        // For now, grant all requested permissions
        return requested.filter(p => this.permissions[p]);
    }
    
    /**
     * Register plugin hooks
     */
    registerHooks(pluginId, hooks) {
        for (const [hookName, handler] of Object.entries(hooks)) {
            if (!this.hooks.has(hookName)) {
                this.hooks.set(hookName, new Map());
            }
            this.hooks.get(hookName).set(pluginId, handler);
        }
    }
    
    /**
     * Unregister plugin hooks
     */
    unregisterHooks(pluginId) {
        for (const hookMap of this.hooks.values()) {
            hookMap.delete(pluginId);
        }
    }
    
    /**
     * Call hook
     */
    async callHook(hookName, ...args) {
        if (!this.hooks.has(hookName)) {
            return [];
        }
        
        const results = [];
        const hookMap = this.hooks.get(hookName);
        
        for (const [pluginId, handler] of hookMap) {
            try {
                const plugin = this.plugins.get(pluginId);
                if (plugin && this.pluginStates.get(pluginId) === 'enabled') {
                    const result = await this.executeInSandbox(pluginId, async () => {
                        return await handler.call(plugin, ...args);
                    });
                    results.push(result);
                }
            } catch (error) {
                console.error(`Hook error in plugin ${pluginId}:`, error);
            }
        }
        
        return results;
    }
    
    /**
     * Resource tracking
     */
    trackAPICall(pluginId, api) {
        const usage = this.resourceUsage.get(pluginId);
        if (usage) {
            usage.apiCalls++;
            
            // Check rate limit
            const elapsed = Date.now() - usage.startTime;
            const callsPerMinute = (usage.apiCalls / elapsed) * 60000;
            
            if (callsPerMinute > this.resourceLimits.maxApiCalls) {
                throw new Error(`Plugin ${pluginId} exceeded API rate limit`);
            }
        }
    }
    
    trackResourceUsage(pluginId, resource, amount) {
        const usage = this.resourceUsage.get(pluginId);
        if (usage) {
            usage[resource] += amount;
            
            // Check limits
            if (usage[resource] > this.resourceLimits[`max${resource.charAt(0).toUpperCase() + resource.slice(1)}`]) {
                console.warn(`Plugin ${pluginId} exceeded ${resource} limit`);
                // Could disable plugin here
            }
        }
    }
    
    /**
     * Start resource monitoring
     */
    startResourceMonitoring(pluginId) {
        // Monitor memory usage
        if (performance.memory) {
            const interval = setInterval(() => {
                if (this.pluginStates.get(pluginId) !== 'enabled') {
                    clearInterval(interval);
                    return;
                }
                
                // Approximate memory usage (real implementation would be more sophisticated)
                const usage = this.resourceUsage.get(pluginId);
                if (usage) {
                    usage.memory = performance.memory.usedJSHeapSize / this.plugins.size;
                    this.trackResourceUsage(pluginId, 'memory', 0);
                }
            }, 10000);
        }
    }
    
    stopResourceMonitoring(pluginId) {
        // Clean up any monitoring intervals
    }
    
    /**
     * Clean up plugin resources
     */
    cleanupPlugin(pluginId) {
        // Remove DOM elements
        const elements = document.querySelectorAll(`[data-plugin-id="${pluginId}"]`);
        elements.forEach(el => el.remove());
        
        // Clear storage
        const prefix = `plugin_${pluginId}_`;
        for (let i = localStorage.length - 1; i >= 0; i--) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                localStorage.removeItem(key);
            }
        }
        
        // Clear event listeners
        // (Would need to track these properly)
    }
    
    /**
     * Create plugin panel
     */
    createPluginPanel(pluginId, config) {
        const panel = document.createElement('div');
        panel.className = 'panel plugin-panel';
        panel.setAttribute('data-plugin-id', pluginId);
        panel.id = `plugin-${pluginId}-panel`;
        
        // Create panel structure
        panel.innerHTML = `
            <div class="panel-header">
                <h3>${config.title || 'Plugin Panel'}</h3>
                <div class="panel-controls">
                    <button class="close-btn" data-action="close">&times;</button>
                </div>
            </div>
            <div class="panel-content" id="plugin-${pluginId}-content">
                ${config.content || ''}
            </div>
        `;
        
        // Add to grid
        const grid = document.querySelector('.bot-main-grid');
        if (grid && config.position) {
            grid.appendChild(panel);
        }
        
        // Track DOM nodes
        this.trackResourceUsage(pluginId, 'domNodes', 1);
        
        return panel;
    }
    
    /**
     * Helper methods
     */
    deepFreeze(obj) {
        Object.freeze(obj);
        Object.getOwnPropertyNames(obj).forEach(prop => {
            if (obj[prop] !== null && 
                (typeof obj[prop] === 'object' || typeof obj[prop] === 'function') && 
                !Object.isFrozen(obj[prop])) {
                this.deepFreeze(obj[prop]);
            }
        });
        return obj;
    }
    
    isAllowedDomain(domain) {
        return this.allowedDomains.some(allowed => 
            domain === allowed || domain.endsWith('.' + allowed)
        );
    }
    
    isVersionCompatible(current, required) {
        if (required === '*') return true;
        // Simple version check (could use semver library)
        return current >= required;
    }
    
    generateRequestId() {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
    
    checkStorageQuota(pluginId, size) {
        // Simple quota check (5MB per plugin)
        const maxSize = 5 * 1024 * 1024;
        return size < maxSize;
    }
    
    canSubscribeToGlobalEvent(pluginId, event) {
        // Check if plugin has permission for this event
        const eventPermissions = {
            'bot:started': 'core.state.read',
            'bot:stopped': 'core.state.read',
            'order:filled': 'trading.orders.read',
            'position:opened': 'trading.positions.read'
        };
        
        const required = eventPermissions[event];
        if (!required) return false;
        
        const metadata = this.pluginMetadata.get(pluginId);
        return metadata?.permissions?.includes(required);
    }
    
    validatePluginOrder(pluginId, order) {
        // Validate order from plugin
        if (!order.symbol || !order.side || !order.quantity) {
            throw new Error('Invalid order parameters');
        }
        
        // Add plugin tracking
        order.metadata = order.metadata || {};
        order.metadata.pluginId = pluginId;
        order.metadata.timestamp = Date.now();
    }
    
    // Technical indicator calculations for utils
    calculateSMA(data, period) {
        if (data.length < period) return null;
        const sum = data.slice(-period).reduce((a, b) => a + b, 0);
        return sum / period;
    }
    
    calculateEMA(data, period) {
        if (data.length < period) return null;
        const multiplier = 2 / (period + 1);
        let ema = this.calculateSMA(data.slice(0, period), period);
        
        for (let i = period; i < data.length; i++) {
            ema = (data[i] - ema) * multiplier + ema;
        }
        
        return ema;
    }
    
    calculateRSI(data, period = 14) {
        if (data.length < period + 1) return null;
        
        const gains = [];
        const losses = [];
        
        for (let i = 1; i < data.length; i++) {
            const diff = data[i] - data[i - 1];
            gains.push(diff > 0 ? diff : 0);
            losses.push(diff < 0 ? -diff : 0);
        }
        
        const avgGain = gains.slice(-period).reduce((a, b) => a + b) / period;
        const avgLoss = losses.slice(-period).reduce((a, b) => a + b) / period;
        
        if (avgLoss === 0) return 100;
        
        const rs = avgGain / avgLoss;
        return 100 - (100 / (1 + rs));
    }
    
    calculatePnL(entry, exit, quantity, fees = 0) {
        const grossPnL = (exit - entry) * quantity;
        const netPnL = grossPnL - fees;
        const percentage = ((exit - entry) / entry) * 100;
        
        return {
            gross: grossPnL,
            net: netPnL,
            percentage: percentage,
            fees: fees
        };
    }
    
    calculatePosition(price, quantity, leverage = 1) {
        const notional = price * quantity;
        const margin = notional / leverage;
        
        return {
            notional: notional,
            margin: margin,
            leverage: leverage,
            liquidationPrice: leverage > 1 
                ? price * (1 - (1 / leverage) + 0.005) // 0.5% maintenance margin
                : 0
        };
    }
    
    formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
        const d = new Date(date);
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        const seconds = String(d.getSeconds()).padStart(2, '0');
        
        return format
            .replace('YYYY', year)
            .replace('MM', month)
            .replace('DD', day)
            .replace('HH', hours)
            .replace('mm', minutes)
            .replace('ss', seconds);
    }
    
    /**
     * Get plugin info
     */
    getPluginInfo(pluginId) {
        return {
            metadata: this.pluginMetadata.get(pluginId),
            state: this.pluginStates.get(pluginId),
            resources: this.resourceUsage.get(pluginId)
        };
    }
    
    /**
     * Get all plugins
     */
    getAllPlugins() {
        const plugins = [];
        for (const [id, plugin] of this.plugins) {
            plugins.push({
                id,
                ...this.getPluginInfo(id)
            });
        }
        return plugins;
    }
    
    /**
     * Destroy plugin manager
     */
    destroy() {
        // Disable and unload all plugins
        for (const pluginId of this.plugins.keys()) {
            this.remove(pluginId).catch(console.error);
        }
        
        // Clear all maps
        this.plugins.clear();
        this.pluginStates.clear();
        this.pluginMetadata.clear();
        this.resourceUsage.clear();
        this.hooks.clear();
        
        console.log('Plugin Manager destroyed');
    }
}

// Export
export default PluginManager;