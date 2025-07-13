/**
 * UI Event Handlers - 완전한 버전 (설정 작동 수정)
 * Manages all user interface interactions and events
 */

class UIHandlers {
    constructor() {
        this.isInitialized = false;
        
        // References to other managers
        this.chartManager = null;
        this.websocketManager = null;
        this.settingsModal = null;
        this.dataLoader = null;
        
        // UI state
        this.currentSymbol = 'BTCUSDT';
        this.currentTimeframe = '1h';
        this.updateCount = 0;
        this.navigationOpen = false;
        
        // Event callbacks
        this.onSymbolChange = null;
        this.onTimeframeChange = null;
        this.onIndicatorToggle = null;
        this.onRealtimeModeChange = null;
    }
    
    /**
     * Initialize UI handlers
     * @param {Object} managers - Object containing manager instances
     * @param {Object} callbacks - Event callback functions
     */
    initialize(managers = {}, callbacks = {}) {
        if (this.isInitialized) {
            console.warn('UIHandlers already initialized');
            return;
        }
        
        // Store manager references
        this.chartManager = managers.chartManager || null;
        this.websocketManager = managers.websocketManager || null;
        this.settingsModal = managers.settingsModal || null;
        this.dataLoader = managers.dataLoader || null;
        
        // Store callbacks
        this.onSymbolChange = callbacks.onSymbolChange || null;
        this.onTimeframeChange = callbacks.onTimeframeChange || null;
        this.onIndicatorToggle = callbacks.onIndicatorToggle || null;
        this.onRealtimeModeChange = callbacks.onRealtimeModeChange || null;
        
        // Setup all event listeners
        this.setupTimeframeHandlers();
        this.setupSymbolHandlers();
        this.setupRealtimeModeHandlers();
        this.setupIndicatorHandlers();
        this.setupSettingsHandlers();
        this.setupToolHandlers();
        this.setupResizeHandler();
        this.setupKeyboardShortcuts();
        
        this.isInitialized = true;
        console.log('✅ UIHandlers initialized');
    }
    
    /**
     * Setup timeframe selection handlers
     */
    setupTimeframeHandlers() {
        const timeframeBtns = document.querySelectorAll('.timeframe-btn');
        
        timeframeBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const newTimeframe = e.target.dataset.tf;
                
                if (newTimeframe === this.currentTimeframe) return;
                
                // Update UI state
                document.querySelector('.timeframe-btn.active')?.classList.remove('active');
                e.target.classList.add('active');
                
                this.currentTimeframe = newTimeframe;
                
                // Show loading state
                this.showLoading();
                
                // Notify callback
                if (this.onTimeframeChange) {
                    await this.onTimeframeChange(newTimeframe);
                }
                
                this.hideLoading();
                
                console.log(`⏱️ Timeframe changed to: ${newTimeframe}`);
            });
        });
        
        console.log('✅ Timeframe handlers setup');
    }
    
    /**
     * Setup symbol selection handlers
     */
    setupSymbolHandlers() {
        const symbolItems = document.querySelectorAll('.symbol-item');
        
        symbolItems.forEach(item => {
            item.addEventListener('click', async (e) => {
                const newSymbol = item.dataset.symbol;
                
                if (newSymbol === this.currentSymbol) return;
                
                // Update UI state
                document.querySelector('.symbol-item.active')?.classList.remove('active');
                item.classList.add('active');
                
                this.currentSymbol = newSymbol;
                
                // Show loading state
                this.showLoading();
                
                // Update chart title
                this.updateChartTitle();
                
                // Notify callback
                if (this.onSymbolChange) {
                    await this.onSymbolChange(newSymbol);
                }
                
                this.hideLoading();
                
                console.log(`💰 Symbol changed to: ${newSymbol}`);
            });
        });
        
        console.log('✅ Symbol handlers setup');
    }
    
    /**
     * Setup real-time mode handlers
     */
    setupRealtimeModeHandlers() {
        const modeButtons = document.querySelectorAll('[data-mode]');
        
        modeButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const mode = e.target.dataset.mode;
                
                // Update UI state
                document.querySelector('[data-mode].active')?.classList.remove('active');
                e.target.classList.add('active');
                
                // Determine throttle based on mode
                let throttle;
                switch(mode) {
                    case 'ultra': throttle = 100; break;
                    case 'fast': throttle = 500; break;
                    case 'normal': throttle = 1000; break;
                    default: throttle = 500;
                }
                
                // Update speed indicator
                this.updateSpeedIndicator(mode);
                
                // Notify callback
                if (this.onRealtimeModeChange) {
                    this.onRealtimeModeChange(mode, throttle);
                }
                
                console.log(`⚡ Real-time mode changed to: ${mode} (${throttle}ms)`);
            });
        });
        
        console.log('✅ Real-time mode handlers setup');
    }
    
    /**
     * 🔧 Setup indicator toggle handlers - 완전 수정된 버전
     */
    setupIndicatorHandlers() {
        // Main indicator toggles
        const indicatorBtns = document.querySelectorAll('[data-indicator]');
        
        indicatorBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const indicator = e.currentTarget.dataset.indicator;
                const statusElement = document.getElementById(`${indicator}-status`);
                
                if (!statusElement) {
                    console.error(`Status element not found for indicator: ${indicator}`);
                    return;
                }
                
                // BB와 MA는 특별 처리
                if (indicator === 'bb' || indicator === 'ma') {
                    let isCurrentlyActive = statusElement.classList.contains('active');
                    let newState;
                    
                    try {
                        if (indicator === 'bb' && this.chartManager) {
                            // 볼린저밴드 토글
                            newState = this.chartManager.toggleBollingerBands();
                            console.log(`Bollinger Bands toggled: ${newState}`);
                        } else if (indicator === 'ma' && this.chartManager) {
                            // 이동평균선 토글
                            newState = this.chartManager.toggleMovingAverage();
                            console.log(`Moving Average toggled: ${newState}`);
                        } else {
                            // chartManager가 없으면 UI만 토글
                            newState = !isCurrentlyActive;
                            console.warn(`ChartManager not available, toggling UI only`);
                        }
                        
                        // UI 상태 업데이트
                        if (newState) {
                            statusElement.classList.add('active');
                            statusElement.textContent = 'ON';
                        } else {
                            statusElement.classList.remove('active');
                            statusElement.textContent = 'OFF';
                        }
                        
                        // 콜백 호출
                        if (this.onIndicatorToggle) {
                            this.onIndicatorToggle(indicator, newState);
                        }
                    } catch (error) {
                        console.error(`Error toggling ${indicator}:`, error);
                        // 에러 발생시 UI 상태 복원
                        if (isCurrentlyActive) {
                            statusElement.classList.add('active');
                            statusElement.textContent = 'ON';
                        } else {
                            statusElement.classList.remove('active');
                            statusElement.textContent = 'OFF';
                        }
                    }
                } else {
                    // 다른 지표들은 기존 로직 사용
                    const isActive = statusElement.classList.contains('active');
                    
                    if (isActive) {
                        statusElement.classList.remove('active');
                        statusElement.textContent = 'OFF';
                    } else {
                        statusElement.classList.add('active');
                        statusElement.textContent = 'ON';
                    }
                    
                    // Notify callback
                    if (this.onIndicatorToggle) {
                        this.onIndicatorToggle(indicator, !isActive);
                    }
                }
                
                console.log(`📊 Indicator ${indicator} toggled`);
            });
        });
        
        console.log('✅ Indicator handlers setup complete');
    }
    
    /**
     * Setup chart settings handlers - 수정된 버전
     */
    setupSettingsHandlers() {
        // 차트 패널의 설정 버튼들
        const settingsButtons = document.querySelectorAll('.chart-settings-btn');
        
        console.log(`Found ${settingsButtons.length} chart settings buttons`);
        
        settingsButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                
                const chartType = btn.dataset.chart;
                console.log(`차트 설정 버튼 클릭: ${chartType}`);
                
                if (this.settingsModal && this.chartManager) {
                    const currentSettings = this.getCurrentChartSettings(chartType);
                    this.settingsModal.openModal(chartType, currentSettings);
                } else {
                    console.error('Settings modal or chart manager not available', {
                        settingsModal: !!this.settingsModal,
                        chartManager: !!this.chartManager,
                        chartType: chartType
                    });
                }
            });
        });
        
        // BB 설정 버튼
        const bbSettingsBtn = document.querySelector('[data-bb-settings]');
        if (bbSettingsBtn) {
            bbSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('BB 설정 버튼 클릭됨');
                if (this.settingsModal && this.chartManager) {
                    this.settingsModal.openModal('bb', this.chartManager.indicatorSettings.bb);
                } else {
                    console.error('Settings modal or chart manager not available');
                }
            });
        }
        
        // MA 설정 버튼
        const maSettingsBtn = document.querySelector('[data-ma-settings]');
        if (maSettingsBtn) {
            maSettingsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('MA 설정 버튼 클릭됨');
                if (this.settingsModal && this.chartManager) {
                    this.settingsModal.openModal('ma', this.chartManager.indicatorSettings.ma);
                } else {
                    console.error('Settings modal or chart manager not available');
                }
            });
        }
        
        // Global settings button
        const globalSettingsBtn = document.getElementById('global-settings-btn');
        if (globalSettingsBtn) {
            globalSettingsBtn.addEventListener('click', () => {
                console.log('전체 설정 버튼 클릭됨');
                if (this.settingsModal && this.chartManager) {
                    this.settingsModal.openModal('main', this.chartManager.indicatorSettings);
                }
            });
        }
        
        // Preset buttons
        const savePresetBtn = document.getElementById('save-preset-btn');
        if (savePresetBtn) {
            savePresetBtn.addEventListener('click', () => {
                this.saveCurrentPreset();
            });
        }
        
        const resetSettingsBtn = document.getElementById('reset-settings-btn');
        if (resetSettingsBtn) {
            resetSettingsBtn.addEventListener('click', () => {
                this.resetAllSettings();
            });
        }
        
        console.log('✅ Settings handlers setup complete');
    }
    
    /**
     * Setup tool section handlers
     */
    setupToolHandlers() {
        // Section toggles
        const sectionToggles = document.querySelectorAll('.section-toggle');
        
        sectionToggles.forEach(toggle => {
            toggle.addEventListener('click', (e) => {
                const section = e.target.closest('.tool-section');
                if (section) {
                    section.classList.toggle('collapsed');
                    e.target.textContent = section.classList.contains('collapsed') ? '▶' : '▼';
                }
            });
        });
        
        // Alert buttons
        const alertButtons = document.querySelectorAll('[data-alert]');
        
        alertButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const alertType = e.target.dataset.alert;
                this.setupAlert(alertType);
                console.log(`🔔 Alert setup: ${alertType}`);
            });
        });
        
        console.log('✅ Tool handlers setup');
    }
    
    /**
     * Setup window resize handler
     */
    setupResizeHandler() {
        let resizeTimeout;
        
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                if (this.chartManager) {
                    this.chartManager.handleResize();
                }
                console.log('📐 Window resized, charts updated');
            }, 250);
        });
        
        console.log('✅ Resize handler setup');
    }
    
    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only activate shortcuts when not typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch(e.key) {
                case 'Escape':
                    // Close any open modals
                    if (this.settingsModal) {
                        this.settingsModal.closeModal();
                    }
                    break;
                    
                case 'r':
                case 'R':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.refreshData();
                    }
                    break;
                    
                case 's':
                case 'S':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.saveCurrentPreset();
                    }
                    break;
                    
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                    if (!e.ctrlKey && !e.metaKey) {
                        const timeframes = ['1m', '5m', '15m', '1h', '4h'];
                        const index = parseInt(e.key) - 1;
                        if (timeframes[index]) {
                            this.selectTimeframe(timeframes[index]);
                        }
                    }
                    break;
            }
        });
        
        console.log('✅ Keyboard shortcuts setup');
    }
    
    /**
     * Update price display
     * @param {Object} candleData - Current candle data
     */
    updatePriceDisplay(candleData) {
        try {
            const currentPrice = candleData.close;
            const openPrice = candleData.open;
            const change = currentPrice - openPrice;
            const changePercent = (change / openPrice) * 100;
            
            // Update current price
            const currentPriceElement = document.getElementById('current-price');
            if (currentPriceElement) {
                const newPriceText = this.formatPrice(currentPrice);
                
                if (currentPriceElement.textContent !== newPriceText) {
                    currentPriceElement.textContent = newPriceText;
                    currentPriceElement.style.color = change >= 0 ? '#26a69a' : '#ef5350';
                    
                    // Add flash animation
                    currentPriceElement.style.transform = 'scale(1.02)';
                    setTimeout(() => {
                        currentPriceElement.style.transform = 'scale(1)';
                    }, 150);
                }
            }
            
            // Update OHLC data
            this.updateElement('open-price', this.formatPrice(candleData.open));
            this.updateElement('high-price', this.formatPrice(candleData.high));
            this.updateElement('low-price', this.formatPrice(candleData.low));
            this.updateElement('volume', this.formatVolume(candleData.volume));
            
            // Update price change
            const priceChangeElement = document.getElementById('price-change');
            if (priceChangeElement) {
                const changeText = `${change >= 0 ? '+' : ''}${Math.abs(change).toFixed(2)} (${change >= 0 ? '+' : ''}${changePercent.toFixed(2)}%)`;
                priceChangeElement.textContent = changeText;
                priceChangeElement.className = `price-change ${change >= 0 ? 'positive' : 'negative'}`;
            }
            
        } catch (error) {
            console.error('❌ Price display update error:', error);
        }
    }
    
    /**
     * Update ticker prices in watchlist
     * @param {Object} tickerData - Ticker data
     */
    updateTickerPrice(tickerData) {
        const symbolElement = document.querySelector(`[data-symbol="${tickerData.symbol}"]`);
        if (!symbolElement) return;
        
        const priceElement = symbolElement.querySelector('.symbol-price');
        const changeElement = symbolElement.querySelector('.symbol-change');
        
        if (priceElement) {
            const formattedPrice = this.formatPrice(tickerData.price);
            priceElement.textContent = formattedPrice;
            priceElement.classList.add('price-flash');
            setTimeout(() => priceElement.classList.remove('price-flash'), 300);
        }
        
        if (changeElement) {
            const change = tickerData.changePercent;
            const isPositive = change >= 0;
            
            changeElement.textContent = `${isPositive ? '+' : ''}${change.toFixed(2)}%`;
            changeElement.className = `symbol-change ${isPositive ? 'positive' : 'negative'}`;
        }
    }
    
    /**
     * Update connection status
     * @param {boolean} connected - Connection status
     */
    updateConnectionStatus(connected) {
        const statusDot = document.getElementById('status-dot');
        const connectionText = document.getElementById('connection-text');
        
        if (statusDot) {
            if (connected) {
                statusDot.classList.add('connected');
            } else {
                statusDot.classList.remove('connected');
            }
        }
        
        if (connectionText) {
            if (connected) {
                connectionText.textContent = '실시간 연결됨';
                connectionText.style.color = '#26a69a';
            } else {
                connectionText.textContent = '연결 중...';
                connectionText.style.color = '#ef5350';
            }
        }
    }
    
    /**
     * Update statistics display
     * @param {number} ping - Ping time in milliseconds
     */
    updateStats(ping = null) {
        this.updateCount++;
        
        // Update counter
        this.updateElement('update-count', this.updateCount.toLocaleString());
        
        // Update timestamp
        const now = new Date();
        this.updateElement('last-update', now.toLocaleTimeString());
        
        // Update ping if provided
        if (ping !== null) {
            this.updateElement('ping-time', ping);
        }
    }
    
    /**
     * Show loading state
     */
    showLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.display = 'flex';
            loadingElement.style.opacity = '1';
        }
    }
    
    /**
     * Hide loading state
     */
    hideLoading() {
        const loadingElement = document.getElementById('loading');
        if (loadingElement) {
            loadingElement.style.opacity = '0';
            setTimeout(() => {
                loadingElement.style.display = 'none';
            }, 300);
        }
    }
    
    /**
     * Update speed indicator
     * @param {string} mode - Speed mode ('ultra', 'fast', 'normal')
     */
    updateSpeedIndicator(mode) {
        const speedIndicator = document.querySelector('.speed-indicator span');
        if (speedIndicator) {
            const modeText = {
                ultra: '0.1초 실시간',
                fast: '0.5초 실시간',
                normal: '1초 실시간'
            };
            speedIndicator.textContent = modeText[mode] || '실시간';
        }
    }
    
    /**
     * Update chart title
     */
    updateChartTitle() {
        const mainTitle = document.querySelector('.main-chart .chart-title');
        if (mainTitle) {
            mainTitle.textContent = `📊 ${this.currentSymbol} - ${this.currentTimeframe.toUpperCase()}`;
        }
    }
    
    /**
     * Get current indicator settings
     * @param {string} indicator - Indicator name
     * @returns {Object} Current settings
     */
    getCurrentIndicatorSettings(indicator) {
        if (this.chartManager && this.chartManager.indicatorSettings) {
            return this.chartManager.indicatorSettings[indicator] || {};
        }
        return {};
    }
    
    /**
     * Get current chart settings
     * @param {string} chartType - Chart type
     * @returns {Object} Current settings
     */
    getCurrentChartSettings(chartType) {
        if (this.chartManager && this.chartManager.indicatorSettings) {
            return this.chartManager.indicatorSettings[chartType] || {};
        }
        return {};
    }
    
    /**
     * Setup alert for specific type
     * @param {string} alertType - Type of alert ('price', 'volume', 'breakout')
     */
    setupAlert(alertType) {
        const alertConfig = prompt(`${alertType} 알림을 설정하시겠습니까? (값을 입력하세요)`);
        if (alertConfig) {
            console.log(`🔔 Alert set: ${alertType} = ${alertConfig}`);
        }
    }
    
    /**
     * Save current settings as preset
     */
    saveCurrentPreset() {
        const presetName = prompt('프리셋 이름을 입력하세요:');
        if (presetName && this.settingsModal) {
            console.log(`💾 Preset saved: ${presetName}`);
            // TODO: Implement preset saving logic
        }
    }
    
    /**
     * Reset all settings to default
     */
    resetAllSettings() {
        if (confirm('모든 설정을 초기화하시겠습니까?')) {
            console.log('🔄 All settings reset to default');
            
            if (this.chartManager) {
                // Reset indicator settings to default
                this.chartManager.indicatorSettings = this.chartManager.getDefaultIndicatorSettings();
                
                // Update all indicators
                this.chartManager.updateAllIndicators();
                
                // Update UI
                this.updateChartTitles();
            }
        }
    }
    
    /**
     * Refresh chart data
     */
    async refreshData() {
        console.log('🔄 Refreshing data...');
        
        this.showLoading();
        
        if (this.onSymbolChange) {
            await this.onSymbolChange(this.currentSymbol);
        }
        
        this.hideLoading();
    }
    
    /**
     * Select timeframe programmatically
     * @param {string} timeframe - Timeframe to select
     */
    selectTimeframe(timeframe) {
        const btn = document.querySelector(`[data-tf="${timeframe}"]`);
        if (btn) {
            btn.click();
        }
    }
    
    /**
     * Utility function to update element text content
     * @param {string} id - Element ID
     * @param {string} content - Content to set
     */
    updateElement(id, content) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = content;
        }
    }
    
    /**
     * Format price for display
     * @param {number} price - Price value
     * @returns {string} Formatted price
     */
    formatPrice(price) {
        if (price < 1) {
            return price.toFixed(4);
        } else if (price < 100) {
            return price.toFixed(2);
        } else {
            return price.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2
            });
        }
    }
    
    /**
     * Format volume for display
     * @param {number} volume - Volume value
     * @returns {string} Formatted volume
     */
    formatVolume(volume) {
        if (volume >= 1000000) {
            return `${(volume / 1000000).toFixed(1)}M`;
        } else if (volume >= 1000) {
            return `${(volume / 1000).toFixed(1)}K`;
        } else {
            return volume.toFixed(0);
        }
    }
    
    /**
     * Get current UI state
     * @returns {Object} Current state
     */
    getState() {
        return {
            isInitialized: this.isInitialized,
            currentSymbol: this.currentSymbol,
            currentTimeframe: this.currentTimeframe,
            updateCount: this.updateCount,
            navigationOpen: this.navigationOpen
        };
    }
    
    /**
     * Cleanup UI handlers
     */
    cleanup() {
        this.isInitialized = false;
        this.chartManager = null;
        this.websocketManager = null;
        this.settingsModal = null;
        this.dataLoader = null;
        
        console.log('🧹 UIHandlers cleaned up');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UIHandlers;
} else {
    window.UIHandlers = UIHandlers;
}