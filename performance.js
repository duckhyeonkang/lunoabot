/**
 * 📈 Trading Bot Performance Module
 * Version: 2.1.0
 * 
 * 🚀 Features:
 * - Real-time FPS monitoring
 * - Memory usage tracking
 * - API latency measurement
 * - Rendering performance
 * - Bot metrics collection
 * - Resource monitoring
 * - Performance profiling
 * - Bottleneck detection
 * - Optimization suggestions
 * - Performance reports
 */

import { EventEmitter } from '../core/event-emitter.js';

class PerformanceModule extends EventEmitter {
    constructor(tradingBot) {
        super();
        this.bot = tradingBot;
        this.config = tradingBot.config.performance || this.getDefaultConfig();
        
        // Performance metrics
        this.metrics = {
            fps: {
                current: 60,
                average: 60,
                min: 60,
                max: 60,
                history: []
            },
            memory: {
                used: 0,
                total: 0,
                percent: 0,
                limit: 0,
                history: []
            },
            cpu: {
                usage: 0,
                cores: navigator.hardwareConcurrency || 4,
                history: []
            },
            network: {
                latency: 0,
                bandwidth: 0,
                requests: 0,
                errors: 0,
                history: []
            },
            rendering: {
                paintTime: 0,
                layoutTime: 0,
                scriptTime: 0,
                idleTime: 0,
                history: []
            },
            bot: {
                tradesPerSecond: 0,
                ordersPerSecond: 0,
                profit: 0,
                positions: 0,
                activeStrategies: 0,
                history: []
            }
        };
        
        // Performance observers
        this.observers = new Map();
        
        // Monitoring intervals
        this.monitors = new Map();
        
        // Performance marks
        this.marks = new Map();
        this.measures = new Map();
        
        // Frame timing
        this.frameCount = 0;
        this.lastFrameTime = performance.now();
        this.rafId = null;
        
        // Optimization suggestions
        this.suggestions = [];
        
        // Performance budget
        this.budget = this.config.budget;
        
        // Alert thresholds
        this.alerts = new Map();
        
        // Performance history
        this.history = {
            maxSize: 1000,
            data: []
        };
        
        this.init();
    }
    
    getDefaultConfig() {
        return {
            enabled: true,
            monitoring: {
                fps: true,
                memory: true,
                cpu: true,
                network: true,
                rendering: true,
                bot: true
            },
            intervals: {
                fps: 100,        // 10 FPS updates per second
                memory: 1000,    // Every second
                cpu: 2000,       // Every 2 seconds
                network: 1000,   // Every second
                rendering: 5000, // Every 5 seconds
                bot: 1000        // Every second
            },
            budget: {
                fps: { min: 30, target: 60, max: 144 },
                memory: { max: 500 * 1024 * 1024 }, // 500MB
                latency: { max: 100 }, // 100ms
                cpu: { max: 80 } // 80%
            },
            alerts: {
                fps: { enabled: true, threshold: 30 },
                memory: { enabled: true, threshold: 80 },
                latency: { enabled: true, threshold: 500 },
                errors: { enabled: true, threshold: 10 }
            },
            profiling: {
                enabled: false,
                sampleRate: 1000, // 1 second
                maxSamples: 100
            },
            reporting: {
                enabled: true,
                interval: 60000, // Every minute
                detailed: false
            }
        };
    }
    
    async init() {
        try {
            // Check performance API support
            this.checkPerformanceSupport();
            
            // Setup performance observers
            this.setupObservers();
            
            // Start monitoring
            this.startMonitoring();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize UI
            this.initializeUI();
            
            // Load historical data
            this.loadHistoricalData();
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('Performance module initialization failed:', error);
            this.emit('error', { type: 'init_failed', error });
        }
    }
    
    checkPerformanceSupport() {
        const required = [
            'performance',
            'PerformanceObserver',
            'requestAnimationFrame',
            'requestIdleCallback'
        ];
        
        const unsupported = required.filter(api => !(api in window));
        
        if (unsupported.length > 0) {
            console.warn('Missing performance APIs:', unsupported);
            this.config.enabled = false;
        }
        
        // Check memory API
        if (!performance.memory) {
            console.warn('Memory API not available');
            this.config.monitoring.memory = false;
        }
    }
    
    // ===== MONITORING SETUP =====
    startMonitoring() {
        if (!this.config.enabled) return;
        
        // FPS monitoring
        if (this.config.monitoring.fps) {
            this.startFPSMonitoring();
        }
        
        // Memory monitoring
        if (this.config.monitoring.memory) {
            this.startMemoryMonitoring();
        }
        
        // CPU monitoring
        if (this.config.monitoring.cpu) {
            this.startCPUMonitoring();
        }
        
        // Network monitoring
        if (this.config.monitoring.network) {
            this.startNetworkMonitoring();
        }
        
        // Rendering monitoring
        if (this.config.monitoring.rendering) {
            this.startRenderingMonitoring();
        }
        
        // Bot performance monitoring
        if (this.config.monitoring.bot) {
            this.startBotMonitoring();
        }
        
        // Performance reporting
        if (this.config.reporting.enabled) {
            this.startReporting();
        }
    }
    
    // ===== FPS MONITORING =====
    startFPSMonitoring() {
        let frameCount = 0;
        let lastTime = performance.now();
        
        const measureFPS = () => {
            const currentTime = performance.now();
            frameCount++;
            
            if (currentTime >= lastTime + 1000) {
                const fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
                
                // Update metrics
                this.updateFPSMetrics(fps);
                
                frameCount = 0;
                lastTime = currentTime;
            }
            
            this.rafId = requestAnimationFrame(measureFPS);
        };
        
        this.rafId = requestAnimationFrame(measureFPS);
    }
    
    updateFPSMetrics(fps) {
        const metrics = this.metrics.fps;
        
        metrics.current = fps;
        metrics.history.push({ timestamp: Date.now(), value: fps });
        
        // Keep history size limited
        if (metrics.history.length > 100) {
            metrics.history.shift();
        }
        
        // Calculate statistics
        const values = metrics.history.map(h => h.value);
        metrics.average = values.reduce((a, b) => a + b, 0) / values.length;
        metrics.min = Math.min(...values);
        metrics.max = Math.max(...values);
        
        // Check alerts
        if (fps < this.config.alerts.fps.threshold) {
            this.triggerAlert('fps', {
                current: fps,
                threshold: this.config.alerts.fps.threshold
            });
        }
        
        // Update UI
        this.updateUI('fps', fps);
        
        // Emit event
        this.emit('fps:update', { fps, metrics });
    }
    
    // ===== MEMORY MONITORING =====
    startMemoryMonitoring() {
        const monitor = setInterval(() => {
            if (performance.memory) {
                const memory = {
                    used: performance.memory.usedJSHeapSize,
                    total: performance.memory.totalJSHeapSize,
                    limit: performance.memory.jsHeapSizeLimit
                };
                
                memory.percent = (memory.used / memory.limit) * 100;
                
                this.updateMemoryMetrics(memory);
            }
        }, this.config.intervals.memory);
        
        this.monitors.set('memory', monitor);
    }
    
    updateMemoryMetrics(memory) {
        Object.assign(this.metrics.memory, memory);
        
        this.metrics.memory.history.push({
            timestamp: Date.now(),
            value: memory.used
        });
        
        // Keep history size limited
        if (this.metrics.memory.history.length > 100) {
            this.metrics.memory.history.shift();
        }
        
        // Check alerts
        if (memory.percent > this.config.alerts.memory.threshold) {
            this.triggerAlert('memory', {
                percent: memory.percent,
                threshold: this.config.alerts.memory.threshold
            });
        }
        
        // Check for memory leaks
        this.detectMemoryLeaks();
        
        // Update UI
        this.updateUI('memory', this.formatBytes(memory.used));
        
        // Emit event
        this.emit('memory:update', { memory, metrics: this.metrics.memory });
    }
    
    detectMemoryLeaks() {
        const history = this.metrics.memory.history;
        if (history.length < 10) return;
        
        // Check if memory is continuously increasing
        const recent = history.slice(-10);
        const increasing = recent.every((item, i) => 
            i === 0 || item.value > recent[i - 1].value
        );
        
        if (increasing) {
            const growth = recent[9].value - recent[0].value;
            const growthRate = (growth / recent[0].value) * 100;
            
            if (growthRate > 10) { // 10% growth in 10 samples
                this.addSuggestion({
                    type: 'memory_leak',
                    severity: 'warning',
                    message: `잠재적 메모리 누수 감지: ${growthRate.toFixed(1)}% 증가`,
                    solution: '오래된 데이터 정리 및 이벤트 리스너 제거 확인'
                });
            }
        }
    }
    
    // ===== CPU MONITORING =====
    startCPUMonitoring() {
        // Estimate CPU usage using script execution time
        const monitor = setInterval(async () => {
            const usage = await this.measureCPUUsage();
            this.updateCPUMetrics(usage);
        }, this.config.intervals.cpu);
        
        this.monitors.set('cpu', monitor);
    }
    
    async measureCPUUsage() {
        const startTime = performance.now();
        const iterations = 1000000;
        
        // Perform CPU-intensive task
        let result = 0;
        for (let i = 0; i < iterations; i++) {
            result += Math.sqrt(i);
        }
        
        const endTime = performance.now();
        const executionTime = endTime - startTime;
        
        // Estimate CPU usage (rough approximation)
        const baselineTime = 10; // Baseline for 100% CPU
        const usage = Math.min(100, (executionTime / baselineTime) * 100);
        
        return usage;
    }
    
    updateCPUMetrics(usage) {
        this.metrics.cpu.usage = usage;
        
        this.metrics.cpu.history.push({
            timestamp: Date.now(),
            value: usage
        });
        
        // Keep history size limited
        if (this.metrics.cpu.history.length > 100) {
            this.metrics.cpu.history.shift();
        }
        
        // Check if CPU is overloaded
        if (usage > this.config.budget.cpu.max) {
            this.addSuggestion({
                type: 'high_cpu',
                severity: 'warning',
                message: `CPU 사용률이 높습니다: ${usage.toFixed(1)}%`,
                solution: '복잡한 계산을 Web Worker로 이동하거나 최적화 필요'
            });
        }
        
        // Emit event
        this.emit('cpu:update', { usage, metrics: this.metrics.cpu });
    }
    
    // ===== NETWORK MONITORING =====
    startNetworkMonitoring() {
        // Monitor API latency
        this.bot.api.on('api:request', (data) => {
            this.metrics.network.requests++;
        });
        
        this.bot.api.on('api:response', (data) => {
            if (data.latency) {
                this.updateNetworkMetrics({ latency: data.latency });
            }
        });
        
        this.bot.api.on('api:error', () => {
            this.metrics.network.errors++;
        });
        
        // Periodic network stats update
        const monitor = setInterval(() => {
            this.calculateNetworkStats();
        }, this.config.intervals.network);
        
        this.monitors.set('network', monitor);
    }
    
    updateNetworkMetrics(data) {
        if (data.latency) {
            this.metrics.network.latency = data.latency;
            
            this.metrics.network.history.push({
                timestamp: Date.now(),
                value: data.latency
            });
            
            // Keep history size limited
            if (this.metrics.network.history.length > 100) {
                this.metrics.network.history.shift();
            }
            
            // Check alerts
            if (data.latency > this.config.alerts.latency.threshold) {
                this.triggerAlert('latency', {
                    current: data.latency,
                    threshold: this.config.alerts.latency.threshold
                });
            }
        }
        
        // Update UI
        this.updateUI('latency', `${Math.round(this.metrics.network.latency)}ms`);
        
        // Emit event
        this.emit('network:update', { network: this.metrics.network });
    }
    
    calculateNetworkStats() {
        const history = this.metrics.network.history;
        if (history.length === 0) return;
        
        const latencies = history.map(h => h.value);
        const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
        
        // Check for network issues
        if (avgLatency > 200) {
            this.addSuggestion({
                type: 'high_latency',
                severity: 'info',
                message: `평균 네트워크 지연시간이 높습니다: ${avgLatency.toFixed(0)}ms`,
                solution: '네트워크 연결 확인 또는 더 가까운 서버 선택'
            });
        }
        
        // Error rate
        const errorRate = (this.metrics.network.errors / this.metrics.network.requests) * 100;
        if (errorRate > 5) {
            this.addSuggestion({
                type: 'high_error_rate',
                severity: 'error',
                message: `API 오류율이 높습니다: ${errorRate.toFixed(1)}%`,
                solution: 'API 상태 확인 및 재시도 로직 검토'
            });
        }
    }
    
    // ===== RENDERING MONITORING =====
    startRenderingMonitoring() {
        // Setup Performance Observer for paint timing
        if ('PerformanceObserver' in window) {
            const paintObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.handlePaintTiming(entry);
                }
            });
            
            try {
                paintObserver.observe({ entryTypes: ['paint'] });
                this.observers.set('paint', paintObserver);
            } catch (e) {
                console.warn('Paint observer not supported');
            }
            
            // Long task observer
            const taskObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    this.handleLongTask(entry);
                }
            });
            
            try {
                taskObserver.observe({ entryTypes: ['longtask'] });
                this.observers.set('longtask', taskObserver);
            } catch (e) {
                console.warn('Long task observer not supported');
            }
        }
        
        // Monitor layout thrashing
        this.monitorLayoutThrashing();
    }
    
    handlePaintTiming(entry) {
        if (entry.name === 'first-contentful-paint') {
            this.metrics.rendering.paintTime = entry.startTime;
            
            if (entry.startTime > 2000) {
                this.addSuggestion({
                    type: 'slow_paint',
                    severity: 'warning',
                    message: `First Contentful Paint가 느립니다: ${entry.startTime.toFixed(0)}ms`,
                    solution: 'Critical CSS 인라인화 및 리소스 로딩 최적화'
                });
            }
        }
    }
    
    handleLongTask(entry) {
        if (entry.duration > 50) {
            this.addSuggestion({
                type: 'long_task',
                severity: 'info',
                message: `긴 작업 감지: ${entry.duration.toFixed(0)}ms`,
                solution: '작업을 작은 청크로 분할하거나 requestIdleCallback 사용'
            });
        }
    }
    
    monitorLayoutThrashing() {
        let reads = 0;
        let writes = 0;
        
        // Override layout-triggering properties
        const properties = ['offsetWidth', 'offsetHeight', 'scrollTop', 'scrollLeft'];
        
        properties.forEach(prop => {
            const originalDescriptor = Object.getOwnPropertyDescriptor(
                Element.prototype, 
                prop
            );
            
            if (originalDescriptor) {
                Object.defineProperty(Element.prototype, `_${prop}`, originalDescriptor);
                
                Object.defineProperty(Element.prototype, prop, {
                    get() {
                        reads++;
                        return this[`_${prop}`];
                    },
                    set(value) {
                        writes++;
                        this[`_${prop}`] = value;
                    }
                });
            }
        });
        
        // Check for thrashing periodically
        setInterval(() => {
            if (reads > 100 || writes > 100) {
                this.addSuggestion({
                    type: 'layout_thrashing',
                    severity: 'warning',
                    message: `레이아웃 스래싱 감지: ${reads} 읽기, ${writes} 쓰기`,
                    solution: 'DOM 읽기/쓰기를 배치로 처리하고 가상 DOM 사용 고려'
                });
            }
            reads = 0;
            writes = 0;
        }, 5000);
    }
    
    // ===== BOT PERFORMANCE MONITORING =====
    startBotMonitoring() {
        // Monitor trading performance
        this.bot.on('trade:executed', () => {
            this.metrics.bot.tradesPerSecond++;
        });
        
        this.bot.on('order:created', () => {
            this.metrics.bot.ordersPerSecond++;
        });
        
        // Reset counters every second
        const monitor = setInterval(() => {
            this.updateBotMetrics();
            
            // Reset counters
            this.metrics.bot.tradesPerSecond = 0;
            this.metrics.bot.ordersPerSecond = 0;
        }, this.config.intervals.bot);
        
        this.monitors.set('bot', monitor);
    }
    
    updateBotMetrics() {
        // Get current bot stats
        const stats = this.bot.getStats();
        
        this.metrics.bot.profit = stats.totalProfit || 0;
        this.metrics.bot.positions = stats.openPositions || 0;
        this.metrics.bot.activeStrategies = stats.activeStrategies || 0;
        
        this.metrics.bot.history.push({
            timestamp: Date.now(),
            trades: this.metrics.bot.tradesPerSecond,
            orders: this.metrics.bot.ordersPerSecond,
            profit: this.metrics.bot.profit
        });
        
        // Keep history size limited
        if (this.metrics.bot.history.length > 100) {
            this.metrics.bot.history.shift();
        }
        
        // Check bot performance
        if (this.metrics.bot.tradesPerSecond > 10) {
            this.addSuggestion({
                type: 'high_trade_frequency',
                severity: 'info',
                message: `높은 거래 빈도: ${this.metrics.bot.tradesPerSecond}/초`,
                solution: '거래 빈도 제한 또는 배치 처리 고려'
            });
        }
        
        // Emit event
        this.emit('bot:update', { bot: this.metrics.bot });
    }
    
    // ===== PERFORMANCE PROFILING =====
    startProfiling() {
        if (!this.config.profiling.enabled) return;
        
        const samples = [];
        let sampleCount = 0;
        
        const profile = () => {
            const sample = {
                timestamp: Date.now(),
                fps: this.metrics.fps.current,
                memory: this.metrics.memory.used,
                cpu: this.metrics.cpu.usage,
                latency: this.metrics.network.latency
            };
            
            samples.push(sample);
            sampleCount++;
            
            if (sampleCount >= this.config.profiling.maxSamples) {
                this.analyzeProfile(samples);
                return;
            }
            
            setTimeout(profile, this.config.profiling.sampleRate);
        };
        
        profile();
    }
    
    analyzeProfile(samples) {
        const analysis = {
            duration: samples[samples.length - 1].timestamp - samples[0].timestamp,
            avgFPS: samples.reduce((a, s) => a + s.fps, 0) / samples.length,
            avgMemory: samples.reduce((a, s) => a + s.memory, 0) / samples.length,
            avgCPU: samples.reduce((a, s) => a + s.cpu, 0) / samples.length,
            avgLatency: samples.reduce((a, s) => a + s.latency, 0) / samples.length,
            bottlenecks: []
        };
        
        // Identify bottlenecks
        if (analysis.avgFPS < 30) {
            analysis.bottlenecks.push({
                type: 'rendering',
                severity: 'high',
                impact: 'User experience degradation'
            });
        }
        
        if (analysis.avgCPU > 80) {
            analysis.bottlenecks.push({
                type: 'cpu',
                severity: 'high',
                impact: 'System responsiveness issues'
            });
        }
        
        if (analysis.avgMemory > this.config.budget.memory.max * 0.8) {
            analysis.bottlenecks.push({
                type: 'memory',
                severity: 'medium',
                impact: 'Potential crashes or slowdowns'
            });
        }
        
        this.emit('profile:complete', analysis);
        
        return analysis;
    }
    
    // ===== PERFORMANCE OPTIMIZATION =====
    optimize() {
        const optimizations = [];
        
        // Check current metrics
        if (this.metrics.fps.average < 30) {
            optimizations.push(this.optimizeRendering());
        }
        
        if (this.metrics.memory.percent > 80) {
            optimizations.push(this.optimizeMemory());
        }
        
        if (this.metrics.cpu.usage > 80) {
            optimizations.push(this.optimizeCPU());
        }
        
        if (this.metrics.network.latency > 200) {
            optimizations.push(this.optimizeNetwork());
        }
        
        return Promise.all(optimizations);
    }
    
    optimizeRendering() {
        const optimizations = [];
        
        // Reduce animation complexity
        document.documentElement.style.setProperty('--duration-normal', '150ms');
        optimizations.push('Reduced animation duration');
        
        // Disable non-critical animations
        if (this.metrics.fps.average < 20) {
            document.body.classList.add('reduce-motion');
            optimizations.push('Disabled non-critical animations');
        }
        
        // Enable GPU acceleration on more elements
        document.querySelectorAll('.panel').forEach(panel => {
            panel.style.willChange = 'transform';
        });
        optimizations.push('Enhanced GPU acceleration');
        
        // Reduce chart update frequency
        if (this.bot.charts) {
            this.bot.charts.setUpdateInterval(1000); // 1 second
            optimizations.push('Reduced chart update frequency');
        }
        
        return {
            type: 'rendering',
            optimizations: optimizations
        };
    }
    
    optimizeMemory() {
        const optimizations = [];
        
        // Clear caches
        if (this.bot.api) {
            this.bot.api.clearCache();
            optimizations.push('Cleared API cache');
        }
        
        // Reduce history sizes
        Object.values(this.metrics).forEach(metric => {
            if (metric.history && metric.history.length > 50) {
                metric.history = metric.history.slice(-50);
            }
        });
        optimizations.push('Reduced metrics history');
        
        // Clear old trading logs
        if (this.bot.tradingEngine) {
            this.bot.tradingEngine.clearOldLogs(100); // Keep last 100
            optimizations.push('Cleared old trading logs');
        }
        
        // Force garbage collection (if available)
        if (window.gc) {
            window.gc();
            optimizations.push('Forced garbage collection');
        }
        
        return {
            type: 'memory',
            optimizations: optimizations
        };
    }
    
    optimizeCPU() {
        const optimizations = [];
        
        // Throttle non-critical updates
        this.config.intervals.rendering = 10000; // 10 seconds
        optimizations.push('Throttled rendering monitoring');
        
        // Disable complex indicators
        if (this.bot.charts) {
            this.bot.charts.disableIndicator('bollinger');
            this.bot.charts.disableIndicator('macd');
            optimizations.push('Disabled complex indicators');
        }
        
        // Reduce strategy complexity
        if (this.bot.tradingEngine) {
            this.bot.tradingEngine.setMode('simple');
            optimizations.push('Switched to simple trading mode');
        }
        
        return {
            type: 'cpu',
            optimizations: optimizations
        };
    }
    
    optimizeNetwork() {
        const optimizations = [];
        
        // Enable aggressive caching
        if (this.bot.api) {
            this.bot.api.setCacheTTL(300000); // 5 minutes
            optimizations.push('Increased cache TTL');
        }
        
        // Reduce WebSocket subscriptions
        if (this.bot.api) {
            this.bot.api.unsubscribeNonEssential();
            optimizations.push('Reduced WebSocket subscriptions');
        }
        
        // Batch API requests
        if (this.bot.api) {
            this.bot.api.enableBatching(true);
            optimizations.push('Enabled request batching');
        }
        
        return {
            type: 'network',
            optimizations: optimizations
        };
    }
    
    // ===== SUGGESTIONS SYSTEM =====
    addSuggestion(suggestion) {
        // Check if similar suggestion exists
        const exists = this.suggestions.some(s => 
            s.type === suggestion.type && 
            Date.now() - s.timestamp < 60000 // Within last minute
        );
        
        if (!exists) {
            suggestion.timestamp = Date.now();
            suggestion.id = `suggestion-${Date.now()}`;
            
            this.suggestions.push(suggestion);
            
            // Keep suggestions limited
            if (this.suggestions.length > 10) {
                this.suggestions.shift();
            }
            
            // Show notification for high severity
            if (suggestion.severity === 'error' || suggestion.severity === 'warning') {
                this.bot.ui.showNotification({
                    type: suggestion.severity,
                    title: '성능 문제 감지',
                    message: suggestion.message,
                    duration: 10000
                });
            }
            
            this.emit('suggestion:added', suggestion);
        }
    }
    
    getSuggestions() {
        return this.suggestions.sort((a, b) => {
            const severityOrder = { error: 0, warning: 1, info: 2 };
            return severityOrder[a.severity] - severityOrder[b.severity];
        });
    }
    
    // ===== ALERTS =====
    triggerAlert(type, data) {
        if (!this.config.alerts[type]?.enabled) return;
        
        const alert = {
            type: type,
            data: data,
            timestamp: Date.now()
        };
        
        this.alerts.set(type, alert);
        
        // Emit alert event
        this.emit('alert', alert);
        
        // Log to console
        console.warn(`Performance Alert [${type}]:`, data);
    }
    
    // ===== REPORTING =====
    startReporting() {
        const report = setInterval(() => {
            const report = this.generateReport();
            this.emit('report', report);
            
            // Save report
            this.saveReport(report);
        }, this.config.reporting.interval);
        
        this.monitors.set('reporting', report);
    }
    
    generateReport() {
        const report = {
            timestamp: Date.now(),
            duration: this.config.reporting.interval,
            summary: {
                fps: {
                    average: this.metrics.fps.average,
                    min: this.metrics.fps.min,
                    max: this.metrics.fps.max
                },
                memory: {
                    average: this.calculateAverage(this.metrics.memory.history),
                    peak: Math.max(...this.metrics.memory.history.map(h => h.value))
                },
                cpu: {
                    average: this.calculateAverage(this.metrics.cpu.history)
                },
                network: {
                    avgLatency: this.calculateAverage(this.metrics.network.history),
                    totalRequests: this.metrics.network.requests,
                    errorRate: (this.metrics.network.errors / this.metrics.network.requests) * 100
                },
                bot: {
                    totalTrades: this.sumValues(this.metrics.bot.history, 'trades'),
                    totalOrders: this.sumValues(this.metrics.bot.history, 'orders'),
                    profit: this.metrics.bot.profit
                }
            },
            alerts: Array.from(this.alerts.values()),
            suggestions: this.getSuggestions(),
            score: this.calculatePerformanceScore()
        };
        
        if (this.config.reporting.detailed) {
            report.detailed = {
                fps: this.metrics.fps.history,
                memory: this.metrics.memory.history,
                cpu: this.metrics.cpu.history,
                network: this.metrics.network.history,
                bot: this.metrics.bot.history
            };
        }
        
        return report;
    }
    
    calculatePerformanceScore() {
        let score = 100;
        
        // FPS impact (max -30 points)
        if (this.metrics.fps.average < 60) {
            score -= Math.min(30, (60 - this.metrics.fps.average) * 0.5);
        }
        
        // Memory impact (max -20 points)
        if (this.metrics.memory.percent > 50) {
            score -= Math.min(20, (this.metrics.memory.percent - 50) * 0.4);
        }
        
        // CPU impact (max -20 points)
        if (this.metrics.cpu.usage > 50) {
            score -= Math.min(20, (this.metrics.cpu.usage - 50) * 0.4);
        }
        
        // Network impact (max -20 points)
        if (this.metrics.network.latency > 100) {
            score -= Math.min(20, (this.metrics.network.latency - 100) * 0.1);
        }
        
        // Error impact (max -10 points)
        const errorRate = (this.metrics.network.errors / Math.max(1, this.metrics.network.requests)) * 100;
        if (errorRate > 1) {
            score -= Math.min(10, errorRate);
        }
        
        return Math.max(0, Math.round(score));
    }
    
    saveReport(report) {
        // Save to localStorage
        try {
            const reports = JSON.parse(localStorage.getItem('performance-reports') || '[]');
            reports.push(report);
            
            // Keep last 100 reports
            if (reports.length > 100) {
                reports.shift();
            }
            
            localStorage.setItem('performance-reports', JSON.stringify(reports));
        } catch (error) {
            console.error('Failed to save performance report:', error);
        }
    }
    
    // ===== UI INTEGRATION =====
    initializeUI() {
        // Update performance metrics display
        this.metricsDisplay = document.getElementById('performance-metrics');
        
        // Create performance panel if needed
        if (!document.getElementById('performance-panel')) {
            this.createPerformancePanel();
        }
    }
    
    createPerformancePanel() {
        const panel = document.createElement('div');
        panel.id = 'performance-panel';
        panel.className = 'performance-panel hidden';
        panel.innerHTML = `
            <div class="performance-header">
                <h4>Performance Monitor</h4>
                <button class="close-btn" onclick="performance.hidePanel()">×</button>
            </div>
            <div class="performance-content">
                <div class="metric-grid">
                    <div class="metric-item">
                        <span class="metric-label">FPS</span>
                        <span class="metric-value" id="perf-fps">60</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Memory</span>
                        <span class="metric-value" id="perf-memory">0MB</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">CPU</span>
                        <span class="metric-value" id="perf-cpu">0%</span>
                    </div>
                    <div class="metric-item">
                        <span class="metric-label">Latency</span>
                        <span class="metric-value" id="perf-latency">0ms</span>
                    </div>
                </div>
                <div class="performance-score">
                    <h5>Performance Score</h5>
                    <div class="score-value" id="perf-score">100</div>
                </div>
                <div class="suggestions-list" id="perf-suggestions"></div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }
    
    updateUI(metric, value) {
        // Update metrics display
        if (this.metricsDisplay) {
            const element = this.metricsDisplay.querySelector(`#${metric}`);
            if (element) {
                element.textContent = value;
            }
        }
        
        // Update performance panel
        const perfElement = document.getElementById(`perf-${metric}`);
        if (perfElement) {
            perfElement.textContent = value;
        }
        
        // Update performance score
        const scoreElement = document.getElementById('perf-score');
        if (scoreElement) {
            const score = this.calculatePerformanceScore();
            scoreElement.textContent = score;
            scoreElement.className = `score-value ${
                score > 80 ? 'good' : score > 50 ? 'warning' : 'bad'
            }`;
        }
        
        // Update suggestions
        this.updateSuggestionsUI();
    }
    
    updateSuggestionsUI() {
        const container = document.getElementById('perf-suggestions');
        if (!container) return;
        
        const suggestions = this.getSuggestions();
        
        container.innerHTML = suggestions.map(s => `
            <div class="suggestion-item ${s.severity}">
                <div class="suggestion-message">${s.message}</div>
                <div class="suggestion-solution">${s.solution}</div>
            </div>
        `).join('');
    }
    
    // ===== UTILITIES =====
    setupEventListeners() {
        // Listen for visibility changes
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.pause();
            } else {
                this.resume();
            }
        });
        
        // Listen for memory pressure events
        if ('memory' in navigator && 'addEventListener' in navigator.memory) {
            navigator.memory.addEventListener('pressure', (event) => {
                console.warn('Memory pressure event:', event.level);
                if (event.level === 'critical') {
                    this.optimizeMemory();
                }
            });
        }
    }
    
    pause() {
        // Pause non-critical monitoring
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        // Reduce monitoring intervals
        this.monitors.forEach((interval, key) => {
            if (key !== 'bot') { // Keep bot monitoring
                clearInterval(interval);
            }
        });
        
        this.emit('paused');
    }
    
    resume() {
        // Resume monitoring
        this.startMonitoring();
        this.emit('resumed');
    }
    
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB'];
        let size = bytes;
        let unitIndex = 0;
        
        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }
        
        return `${size.toFixed(1)}${units[unitIndex]}`;
    }
    
    calculateAverage(history) {
        if (!history || history.length === 0) return 0;
        const values = history.map(h => h.value || 0);
        return values.reduce((a, b) => a + b, 0) / values.length;
    }
    
    sumValues(history, key) {
        if (!history || history.length === 0) return 0;
        return history.reduce((sum, item) => sum + (item[key] || 0), 0);
    }
    
    loadHistoricalData() {
        try {
            const reports = JSON.parse(localStorage.getItem('performance-reports') || '[]');
            if (reports.length > 0) {
                this.history.data = reports;
                this.emit('history:loaded', { count: reports.length });
            }
        } catch (error) {
            console.error('Failed to load performance history:', error);
        }
    }
    
    // ===== PUBLIC API =====
    getMetrics() {
        return {
            fps: this.metrics.fps.current,
            memory: this.metrics.memory,
            cpu: this.metrics.cpu.usage,
            network: {
                latency: this.metrics.network.latency,
                requests: this.metrics.network.requests,
                errors: this.metrics.network.errors
            },
            bot: this.metrics.bot,
            score: this.calculatePerformanceScore()
        };
    }
    
    getReport(detailed = false) {
        this.config.reporting.detailed = detailed;
        return this.generateReport();
    }
    
    mark(name) {
        performance.mark(name);
        this.marks.set(name, performance.now());
    }
    
    measure(name, startMark, endMark) {
        performance.measure(name, startMark, endMark);
        const measure = performance.getEntriesByName(name, 'measure')[0];
        this.measures.set(name, measure.duration);
        return measure.duration;
    }
    
    clearMarks() {
        performance.clearMarks();
        this.marks.clear();
    }
    
    clearMeasures() {
        performance.clearMeasures();
        this.measures.clear();
    }
    
    // ===== CLEANUP =====
    destroy() {
        // Stop monitoring
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        // Clear intervals
        this.monitors.forEach(interval => clearInterval(interval));
        this.monitors.clear();
        
        // Disconnect observers
        this.observers.forEach(observer => observer.disconnect());
        this.observers.clear();
        
        // Clear timers
        this.cacheTimers.forEach(timer => clearTimeout(timer));
        
        // Clear data
        this.metrics = null;
        this.suggestions = [];
        this.alerts.clear();
        this.marks.clear();
        this.measures.clear();
        
        // Remove event listeners
        this.removeAllListeners();
        
        // Remove UI elements
        const panel = document.getElementById('performance-panel');
        if (panel) panel.remove();
    }
}

export default PerformanceModule;