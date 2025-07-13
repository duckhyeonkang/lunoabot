/**
 * 📊 Trading Bot Chart Module
 * Version: 2.1.0
 * 
 * 🎨 Features:
 * - Candlestick charts with Lightweight Charts
 * - Technical indicators (MA, RSI, MACD, Bollinger Bands)
 * - Trading signals visualization
 * - Multi-timeframe support
 * - Real-time updates
 * - Zoom/Pan functionality
 * - Drawing tools
 * - Performance optimized
 */

import { EventEmitter } from '../core/event-emitter.js';

class ChartModule extends EventEmitter {
    constructor(tradingBot) {
        super();
        this.bot = tradingBot;
        this.config = tradingBot.config.charts || this.getDefaultConfig();
        this.charts = new Map();
        this.indicators = new Map();
        this.drawings = new Map();
        this.isInitialized = false;
        
        // Lightweight Charts instance
        this.LightweightCharts = window.LightweightCharts;
        
        // Chart containers from HTML
        this.containers = {
            profit: 'profit-chart-container',
            performance: 'performance-chart-container',
            backtest: 'backtest-chart-container'
        };
        
        // Active timeframe
        this.activeTimeframe = '1h';
        
        // WebSocket connections for real-time data
        this.dataStreams = new Map();
        
        // Drawing tools state
        this.drawingMode = null;
        this.currentDrawing = null;
        
        // Performance optimization
        this.updateQueue = [];
        this.rafId = null;
        
        this.init();
    }
    
    getDefaultConfig() {
        return {
            theme: 'dark',
            defaultTimeframe: '1h',
            indicators: {
                ma: { enabled: true, periods: [7, 25, 99] },
                rsi: { enabled: true, period: 14 },
                macd: { enabled: true, fast: 12, slow: 26, signal: 9 },
                bollinger: { enabled: true, period: 20, stdDev: 2 },
                volume: { enabled: true }
            },
            colors: {
                upColor: '#00C851',
                downColor: '#FF4444',
                borderUpColor: '#00E676',
                borderDownColor: '#FF5252',
                wickUpColor: '#00C851',
                wickDownColor: '#FF4444',
                volumeUpColor: 'rgba(0, 200, 81, 0.5)',
                volumeDownColor: 'rgba(255, 68, 68, 0.5)'
            },
            grid: {
                vertLines: { color: 'rgba(42, 46, 57, 0.5)' },
                horzLines: { color: 'rgba(42, 46, 57, 0.5)' }
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
                vertLine: {
                    color: '#758696',
                    width: 1,
                    style: 3,
                    visible: true
                },
                horzLine: {
                    color: '#758696',
                    width: 1,
                    style: 3,
                    visible: true
                }
            },
            localization: {
                locale: 'ko-KR',
                dateFormat: 'yyyy-MM-dd',
                timeFormat: 'HH:mm:ss'
            }
        };
    }
    
    async init() {
        try {
            // Initialize chart containers
            this.setupChartContainers();
            
            // Setup event listeners
            this.setupEventListeners();
            
            // Initialize main charts
            await this.initializeCharts();
            
            // Setup keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Start real-time updates
            this.startRealtimeUpdates();
            
            this.isInitialized = true;
            this.emit('initialized');
            
        } catch (error) {
            console.error('Chart module initialization failed:', error);
            this.emit('error', { type: 'init_failed', error });
        }
    }
    
    setupChartContainers() {
        // Ensure containers exist
        Object.entries(this.containers).forEach(([type, id]) => {
            const container = document.getElementById(id);
            if (!container) {
                console.warn(`Chart container not found: ${id}`);
                return;
            }
            
            // Set container dimensions
            container.style.width = '100%';
            container.style.height = '100%';
            container.style.position = 'relative';
        });
    }
    
    async initializeCharts() {
        // Initialize profit chart
        const profitContainer = document.getElementById(this.containers.profit);
        if (profitContainer) {
            this.charts.set('profit', await this.createChart(profitContainer, 'profit'));
        }
        
        // Initialize performance chart
        const perfContainer = document.getElementById(this.containers.performance);
        if (perfContainer) {
            this.charts.set('performance', await this.createChart(perfContainer, 'performance'));
        }
    }
    
    async createChart(container, type) {
        const chart = this.LightweightCharts.createChart(container, {
            width: container.clientWidth,
            height: container.clientHeight,
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: this.config.theme === 'dark' ? '#D1D4DC' : '#191919',
                fontSize: 12
            },
            grid: this.config.grid,
            crosshair: this.config.crosshair,
            rightPriceScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
                scaleMargins: {
                    top: 0.1,
                    bottom: 0.2
                }
            },
            timeScale: {
                borderColor: 'rgba(197, 203, 206, 0.8)',
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 5,
                barSpacing: 10,
                minBarSpacing: 5,
                fixLeftEdge: false,
                fixRightEdge: false,
                lockVisibleTimeRangeOnResize: true,
                rightBarStaysOnScroll: true,
                borderVisible: false,
                visible: true
            },
            watermark: {
                visible: true,
                fontSize: 24,
                horzAlign: 'center',
                vertAlign: 'center',
                color: 'rgba(171, 71, 188, 0.1)',
                text: 'Trading Bot Pro'
            },
            handleScroll: {
                mouseWheel: true,
                pressedMouseMove: true,
                horzTouchDrag: true,
                vertTouchDrag: false
            },
            handleScale: {
                axisPressedMouseMove: {
                    time: true,
                    price: true
                },
                axisDoubleClickReset: true,
                mouseWheel: true,
                pinch: true
            }
        });
        
        // Create series based on type
        let series;
        if (type === 'profit') {
            series = this.createProfitSeries(chart);
        } else if (type === 'performance') {
            series = this.createPerformanceSeries(chart);
        } else {
            series = this.createCandlestickSeries(chart);
        }
        
        // Add volume if enabled
        if (this.config.indicators.volume.enabled) {
            this.addVolumeIndicator(chart, series);
        }
        
        // Handle resize
        this.handleChartResize(chart, container);
        
        // Store chart data
        const chartData = {
            chart,
            series,
            container,
            type,
            indicators: new Map(),
            drawings: new Map()
        };
        
        // Add default indicators
        this.addDefaultIndicators(chartData);
        
        return chartData;
    }
    
    createCandlestickSeries(chart) {
        const series = chart.addCandlestickSeries({
            upColor: this.config.colors.upColor,
            downColor: this.config.colors.downColor,
            borderUpColor: this.config.colors.borderUpColor,
            borderDownColor: this.config.colors.borderDownColor,
            wickUpColor: this.config.colors.wickUpColor,
            wickDownColor: this.config.colors.wickDownColor,
            borderVisible: true,
            wickVisible: true
        });
        
        // Add price line
        series.createPriceLine({
            price: 0,
            color: '#2962FF',
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            axisLabelVisible: true,
            title: 'Current Price'
        });
        
        return series;
    }
    
    createProfitSeries(chart) {
        const series = chart.addAreaSeries({
            topColor: 'rgba(41, 98, 255, 0.56)',
            bottomColor: 'rgba(41, 98, 255, 0.04)',
            lineColor: 'rgba(41, 98, 255, 1)',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 6,
            lineType: 2,
            lastValueVisible: true,
            priceLineVisible: true,
            priceLineWidth: 2,
            priceLineColor: '#2962FF',
            priceLineStyle: 2
        });
        
        // Add baseline at 0%
        series.createPriceLine({
            price: 0,
            color: '#758696',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Solid,
            axisLabelVisible: true,
            title: 'Break Even'
        });
        
        return series;
    }
    
    createPerformanceSeries(chart) {
        // Multi-series for performance comparison
        const mainSeries = chart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 6,
            lastValueVisible: true,
            priceLineVisible: true,
            title: 'Bot Performance'
        });
        
        // Benchmark series
        const benchmarkSeries = chart.addLineSeries({
            color: '#FF9800',
            lineWidth: 2,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            crosshairMarkerVisible: true,
            crosshairMarkerRadius: 6,
            lastValueVisible: true,
            priceLineVisible: true,
            title: 'Benchmark'
        });
        
        return { main: mainSeries, benchmark: benchmarkSeries };
    }
    
    addVolumeIndicator(chart, priceSeries) {
        const volumeSeries = chart.addHistogramSeries({
            color: '#26a69a',
            priceFormat: {
                type: 'volume'
            },
            priceScaleId: 'volume',
            scaleMargins: {
                top: 0.8,
                bottom: 0
            }
        });
        
        // Configure volume scale
        volumeSeries.priceScale().applyOptions({
            scaleMargins: {
                top: 0.8,
                bottom: 0
            }
        });
        
        return volumeSeries;
    }
    
    addDefaultIndicators(chartData) {
        const { chart, series } = chartData;
        
        // Moving Averages
        if (this.config.indicators.ma.enabled) {
            this.config.indicators.ma.periods.forEach((period, index) => {
                const color = ['#2962FF', '#00BCD4', '#9C27B0'][index];
                const maSeries = chart.addLineSeries({
                    color,
                    lineWidth: 2,
                    crosshairMarkerVisible: false,
                    lastValueVisible: false,
                    priceLineVisible: false,
                    title: `MA ${period}`
                });
                
                chartData.indicators.set(`ma${period}`, {
                    series: maSeries,
                    type: 'ma',
                    period,
                    visible: true
                });
            });
        }
        
        // RSI
        if (this.config.indicators.rsi.enabled) {
            this.addRSIIndicator(chartData);
        }
        
        // MACD
        if (this.config.indicators.macd.enabled) {
            this.addMACDIndicator(chartData);
        }
        
        // Bollinger Bands
        if (this.config.indicators.bollinger.enabled) {
            this.addBollingerBands(chartData);
        }
    }
    
    addRSIIndicator(chartData) {
        const rsiContainer = document.createElement('div');
        rsiContainer.style.height = '100px';
        rsiContainer.style.marginTop = '10px';
        chartData.container.appendChild(rsiContainer);
        
        const rsiChart = this.LightweightCharts.createChart(rsiContainer, {
            width: chartData.container.clientWidth,
            height: 100,
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#D1D4DC'
            },
            rightPriceScale: {
                scaleMargins: { top: 0.1, bottom: 0.1 }
            },
            timeScale: {
                visible: false
            }
        });
        
        const rsiSeries = rsiChart.addLineSeries({
            color: '#9C27B0',
            lineWidth: 2,
            title: 'RSI'
        });
        
        // Add overbought/oversold lines
        rsiSeries.createPriceLine({
            price: 70,
            color: '#FF4444',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            title: 'Overbought'
        });
        
        rsiSeries.createPriceLine({
            price: 30,
            color: '#00C851',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            title: 'Oversold'
        });
        
        chartData.indicators.set('rsi', {
            chart: rsiChart,
            series: rsiSeries,
            type: 'rsi',
            period: this.config.indicators.rsi.period,
            visible: true
        });
        
        // Sync with main chart
        chartData.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            rsiChart.timeScale().setVisibleLogicalRange(range);
        });
    }
    
    addMACDIndicator(chartData) {
        const macdContainer = document.createElement('div');
        macdContainer.style.height = '100px';
        macdContainer.style.marginTop = '10px';
        chartData.container.appendChild(macdContainer);
        
        const macdChart = this.LightweightCharts.createChart(macdContainer, {
            width: chartData.container.clientWidth,
            height: 100,
            layout: {
                background: { type: 'solid', color: 'transparent' },
                textColor: '#D1D4DC'
            },
            rightPriceScale: {
                scaleMargins: { top: 0.1, bottom: 0.1 }
            },
            timeScale: {
                visible: false
            }
        });
        
        const macdLine = macdChart.addLineSeries({
            color: '#2962FF',
            lineWidth: 2,
            title: 'MACD'
        });
        
        const signalLine = macdChart.addLineSeries({
            color: '#FF9800',
            lineWidth: 2,
            title: 'Signal'
        });
        
        const histogram = macdChart.addHistogramSeries({
            color: '#26a69a',
            title: 'Histogram'
        });
        
        chartData.indicators.set('macd', {
            chart: macdChart,
            series: { macd: macdLine, signal: signalLine, histogram },
            type: 'macd',
            config: this.config.indicators.macd,
            visible: true
        });
        
        // Sync with main chart
        chartData.chart.timeScale().subscribeVisibleLogicalRangeChange(range => {
            macdChart.timeScale().setVisibleLogicalRange(range);
        });
    }
    
    addBollingerBands(chartData) {
        const { chart } = chartData;
        
        const upperBand = chart.addLineSeries({
            color: 'rgba(255, 152, 0, 0.7)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
            title: 'BB Upper'
        });
        
        const middleBand = chart.addLineSeries({
            color: 'rgba(33, 150, 243, 0.7)',
            lineWidth: 1,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
            title: 'BB Middle'
        });
        
        const lowerBand = chart.addLineSeries({
            color: 'rgba(255, 152, 0, 0.7)',
            lineWidth: 1,
            lineStyle: LightweightCharts.LineStyle.Dashed,
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
            title: 'BB Lower'
        });
        
        chartData.indicators.set('bollinger', {
            series: { upper: upperBand, middle: middleBand, lower: lowerBand },
            type: 'bollinger',
            config: this.config.indicators.bollinger,
            visible: true
        });
    }
    
    handleChartResize(chart, container) {
        const resizeObserver = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                chart.applyOptions({ width, height });
            }
        });
        
        resizeObserver.observe(container);
        
        // Store observer for cleanup
        chart._resizeObserver = resizeObserver;
    }
    
    setupEventListeners() {
        // Timeframe buttons
        document.querySelectorAll('.chart-tf-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const timeframe = e.target.dataset.tf;
                this.changeTimeframe(timeframe);
            });
        });
        
        // Chart type selector
        const chartTypeSelector = document.getElementById('chart-type');
        if (chartTypeSelector) {
            chartTypeSelector.addEventListener('change', (e) => {
                this.changeChartType(e.target.value);
            });
        }
        
        // Drawing tools (future implementation)
        this.setupDrawingTools();
    }
    
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case '1':
                        e.preventDefault();
                        this.changeTimeframe('1h');
                        break;
                    case '2':
                        e.preventDefault();
                        this.changeTimeframe('1d');
                        break;
                    case '3':
                        e.preventDefault();
                        this.changeTimeframe('1w');
                        break;
                    case '+':
                    case '=':
                        e.preventDefault();
                        this.zoomIn();
                        break;
                    case '-':
                        e.preventDefault();
                        this.zoomOut();
                        break;
                    case '0':
                        e.preventDefault();
                        this.resetZoom();
                        break;
                }
            }
        });
    }
    
    changeTimeframe(timeframe) {
        this.activeTimeframe = timeframe;
        
        // Update UI
        document.querySelectorAll('.chart-tf-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tf === timeframe);
        });
        
        // Update charts
        this.charts.forEach(chartData => {
            this.updateChartData(chartData, timeframe);
        });
        
        this.emit('timeframe:changed', { timeframe });
    }
    
    changeChartType(type) {
        const chartData = this.charts.get('profit');
        if (!chartData) return;
        
        switch(type) {
            case 'profit':
                this.showProfitChart(chartData);
                break;
            case 'portfolio':
                this.showPortfolioChart(chartData);
                break;
            case 'drawdown':
                this.showDrawdownChart(chartData);
                break;
            case 'sharpe':
                this.showSharpeChart(chartData);
                break;
        }
        
        this.emit('chartType:changed', { type });
    }
    
    async updateChartData(chartData, timeframe) {
        try {
            // Get data from trading engine
            const data = await this.bot.tradingEngine.getHistoricalData({
                symbol: this.bot.config.get('trading.defaultSymbol', 'BTCUSDT'),
                timeframe,
                limit: 500
            });
            
            // Update main series
            if (chartData.series) {
                if (chartData.type === 'profit') {
                    chartData.series.setData(this.calculateProfitData(data));
                } else if (chartData.type === 'performance') {
                    this.updatePerformanceChart(chartData, data);
                } else {
                    chartData.series.setData(this.formatCandleData(data));
                }
            }
            
            // Update indicators
            this.updateIndicators(chartData, data);
            
        } catch (error) {
            console.error('Failed to update chart data:', error);
            this.emit('error', { type: 'update_failed', error });
        }
    }
    
    formatCandleData(rawData) {
        return rawData.map(candle => ({
            time: candle.timestamp / 1000,
            open: parseFloat(candle.open),
            high: parseFloat(candle.high),
            low: parseFloat(candle.low),
            close: parseFloat(candle.close)
        }));
    }
    
    calculateProfitData(trades) {
        let cumulativeProfit = 0;
        const startingBalance = this.bot.config.get('trading.startingBalance', 10000);
        
        return trades.map(trade => {
            cumulativeProfit += trade.profit || 0;
            const profitPercentage = (cumulativeProfit / startingBalance) * 100;
            
            return {
                time: trade.timestamp / 1000,
                value: profitPercentage
            };
        });
    }
    
    updateIndicators(chartData, data) {
        const closes = data.map(d => d.close);
        
        // Update Moving Averages
        chartData.indicators.forEach((indicator, key) => {
            if (indicator.type === 'ma') {
                const maData = this.calculateMA(closes, indicator.period);
                indicator.series.setData(maData.map((value, index) => ({
                    time: data[index].timestamp / 1000,
                    value
                })));
            }
        });
        
        // Update RSI
        const rsiIndicator = chartData.indicators.get('rsi');
        if (rsiIndicator) {
            const rsiData = this.calculateRSI(closes, rsiIndicator.period);
            rsiIndicator.series.setData(rsiData.map((value, index) => ({
                time: data[index].timestamp / 1000,
                value
            })));
        }
        
        // Update MACD
        const macdIndicator = chartData.indicators.get('macd');
        if (macdIndicator) {
            const macdData = this.calculateMACD(closes, macdIndicator.config);
            macdIndicator.series.macd.setData(macdData.macd);
            macdIndicator.series.signal.setData(macdData.signal);
            macdIndicator.series.histogram.setData(macdData.histogram);
        }
        
        // Update Bollinger Bands
        const bollingerIndicator = chartData.indicators.get('bollinger');
        if (bollingerIndicator) {
            const bbData = this.calculateBollingerBands(closes, bollingerIndicator.config);
            bollingerIndicator.series.upper.setData(bbData.upper);
            bollingerIndicator.series.middle.setData(bbData.middle);
            bollingerIndicator.series.lower.setData(bbData.lower);
        }
    }
    
    // Technical indicator calculations
    calculateMA(data, period) {
        const ma = [];
        for (let i = 0; i < data.length; i++) {
            if (i < period - 1) {
                ma.push(null);
            } else {
                const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
                ma.push(sum / period);
            }
        }
        return ma;
    }
    
    calculateRSI(data, period = 14) {
        const rsi = [];
        let gains = 0;
        let losses = 0;
        
        // Calculate initial average gain/loss
        for (let i = 1; i <= period; i++) {
            const change = data[i] - data[i - 1];
            if (change > 0) gains += change;
            else losses -= change;
        }
        
        let avgGain = gains / period;
        let avgLoss = losses / period;
        
        // Calculate RSI
        for (let i = period; i < data.length; i++) {
            const change = data[i] - data[i - 1];
            
            if (change > 0) {
                avgGain = (avgGain * (period - 1) + change) / period;
                avgLoss = (avgLoss * (period - 1)) / period;
            } else {
                avgGain = (avgGain * (period - 1)) / period;
                avgLoss = (avgLoss * (period - 1) - change) / period;
            }
            
            const rs = avgGain / avgLoss;
            rsi.push(100 - (100 / (1 + rs)));
        }
        
        // Fill initial values
        for (let i = 0; i < period; i++) {
            rsi.unshift(null);
        }
        
        return rsi;
    }
    
    calculateMACD(data, config) {
        const { fast, slow, signal } = config;
        const emaFast = this.calculateEMA(data, fast);
        const emaSlow = this.calculateEMA(data, slow);
        
        const macdLine = [];
        const signalLine = [];
        const histogram = [];
        
        // Calculate MACD line
        for (let i = 0; i < data.length; i++) {
            if (emaFast[i] !== null && emaSlow[i] !== null) {
                macdLine.push({
                    time: data[i].timestamp / 1000,
                    value: emaFast[i] - emaSlow[i]
                });
            }
        }
        
        // Calculate signal line
        const macdValues = macdLine.map(d => d.value);
        const signalEMA = this.calculateEMA(macdValues, signal);
        
        for (let i = 0; i < macdLine.length; i++) {
            if (signalEMA[i] !== null) {
                signalLine.push({
                    time: macdLine[i].time,
                    value: signalEMA[i]
                });
                
                histogram.push({
                    time: macdLine[i].time,
                    value: macdLine[i].value - signalEMA[i],
                    color: macdLine[i].value - signalEMA[i] > 0 ? '#00C851' : '#FF4444'
                });
            }
        }
        
        return { macd: macdLine, signal: signalLine, histogram };
    }
    
    calculateEMA(data, period) {
        const ema = [];
        const multiplier = 2 / (period + 1);
        
        // Calculate SMA for first EMA value
        let sum = 0;
        for (let i = 0; i < period; i++) {
            sum += data[i];
        }
        ema[period - 1] = sum / period;
        
        // Calculate EMA
        for (let i = period; i < data.length; i++) {
            ema[i] = (data[i] - ema[i - 1]) * multiplier + ema[i - 1];
        }
        
        // Fill initial values
        for (let i = 0; i < period - 1; i++) {
            ema[i] = null;
        }
        
        return ema;
    }
    
    calculateBollingerBands(data, config) {
        const { period, stdDev } = config;
        const middle = this.calculateMA(data, period);
        const upper = [];
        const lower = [];
        
        for (let i = 0; i < data.length; i++) {
            if (middle[i] !== null) {
                // Calculate standard deviation
                const slice = data.slice(Math.max(0, i - period + 1), i + 1);
                const mean = slice.reduce((a, b) => a + b, 0) / slice.length;
                const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / slice.length;
                const std = Math.sqrt(variance);
                
                upper.push({
                    time: data[i].timestamp / 1000,
                    value: middle[i] + (std * stdDev)
                });
                
                lower.push({
                    time: data[i].timestamp / 1000,
                    value: middle[i] - (std * stdDev)
                });
            }
        }
        
        return {
            upper,
            middle: middle.map((value, index) => ({
                time: data[index].timestamp / 1000,
                value
            })),
            lower
        };
    }
    
    // Drawing tools
    setupDrawingTools() {
        // Future implementation for drawing tools
        // - Trend lines
        // - Horizontal lines
        // - Fibonacci retracement
        // - Annotations
    }
    
    // Zoom functions
    zoomIn() {
        this.charts.forEach(({ chart }) => {
            const timeScale = chart.timeScale();
            const currentRange = timeScale.getVisibleLogicalRange();
            if (currentRange) {
                const center = (currentRange.from + currentRange.to) / 2;
                const newRange = (currentRange.to - currentRange.from) * 0.8;
                timeScale.setVisibleLogicalRange({
                    from: center - newRange / 2,
                    to: center + newRange / 2
                });
            }
        });
    }
    
    zoomOut() {
        this.charts.forEach(({ chart }) => {
            const timeScale = chart.timeScale();
            const currentRange = timeScale.getVisibleLogicalRange();
            if (currentRange) {
                const center = (currentRange.from + currentRange.to) / 2;
                const newRange = (currentRange.to - currentRange.from) * 1.25;
                timeScale.setVisibleLogicalRange({
                    from: center - newRange / 2,
                    to: center + newRange / 2
                });
            }
        });
    }
    
    resetZoom() {
        this.charts.forEach(({ chart }) => {
            chart.timeScale().resetTimeScale();
        });
    }
    
    // Real-time updates
    startRealtimeUpdates() {
        // Subscribe to price updates
        this.bot.on('price:update', (data) => {
            this.updateRealtimePrice(data);
        });
        
        // Subscribe to trade updates
        this.bot.on('trade:executed', (trade) => {
            this.addTradeMarker(trade);
        });
        
        // Animation frame for smooth updates
        const animate = () => {
            if (this.updateQueue.length > 0) {
                this.processUpdateQueue();
            }
            this.rafId = requestAnimationFrame(animate);
        };
        
        this.rafId = requestAnimationFrame(animate);
    }
    
    updateRealtimePrice(priceData) {
        // Queue update for smooth rendering
        this.updateQueue.push({
            type: 'price',
            data: priceData,
            timestamp: Date.now()
        });
    }
    
    processUpdateQueue() {
        const now = Date.now();
        const updates = this.updateQueue.splice(0, 10); // Process max 10 updates per frame
        
        updates.forEach(update => {
            if (update.type === 'price') {
                this.charts.forEach(chartData => {
                    if (chartData.series && chartData.type !== 'profit') {
                        // Update last candle
                        const currentData = chartData.series.data();
                        if (currentData.length > 0) {
                            const lastCandle = currentData[currentData.length - 1];
                            chartData.series.update({
                                ...lastCandle,
                                close: update.data.price,
                                high: Math.max(lastCandle.high, update.data.price),
                                low: Math.min(lastCandle.low, update.data.price)
                            });
                        }
                    }
                });
            }
        });
    }
    
    addTradeMarker(trade) {
        this.charts.forEach(chartData => {
            if (chartData.series && chartData.type !== 'profit') {
                const marker = {
                    time: trade.timestamp / 1000,
                    position: trade.side === 'buy' ? 'belowBar' : 'aboveBar',
                    color: trade.side === 'buy' ? '#00C851' : '#FF4444',
                    shape: trade.side === 'buy' ? 'arrowUp' : 'arrowDown',
                    text: `${trade.side.toUpperCase()} ${trade.quantity} @ ${trade.price}`
                };
                
                chartData.series.setMarkers([
                    ...(chartData.series.markers() || []),
                    marker
                ]);
            }
        });
    }
    
    // Export functionality
    exportChart(type = 'png') {
        const chartData = this.charts.get('profit');
        if (!chartData) return;
        
        const canvas = chartData.container.querySelector('canvas');
        if (!canvas) return;
        
        switch(type) {
            case 'png':
                this.exportAsPNG(canvas);
                break;
            case 'csv':
                this.exportAsCSV(chartData);
                break;
            case 'json':
                this.exportAsJSON(chartData);
                break;
        }
    }
    
    exportAsPNG(canvas) {
        canvas.toBlob(blob => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `trading-chart-${Date.now()}.png`;
            a.click();
            URL.revokeObjectURL(url);
        });
    }
    
    exportAsCSV(chartData) {
        const data = chartData.series.data();
        const csv = ['Time,Open,High,Low,Close'];
        
        data.forEach(candle => {
            csv.push(`${candle.time},${candle.open},${candle.high},${candle.low},${candle.close}`);
        });
        
        const blob = new Blob([csv.join('\n')], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-data-${Date.now()}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    exportAsJSON(chartData) {
        const data = {
            timeframe: this.activeTimeframe,
            data: chartData.series.data(),
            indicators: {}
        };
        
        chartData.indicators.forEach((indicator, key) => {
            if (indicator.series && indicator.series.data) {
                data.indicators[key] = indicator.series.data();
            }
        });
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `trading-data-${Date.now()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }
    
    // Cleanup
    destroy() {
        // Cancel animation frame
        if (this.rafId) {
            cancelAnimationFrame(this.rafId);
        }
        
        // Destroy charts
        this.charts.forEach(({ chart, indicators }) => {
            // Destroy indicator charts
            indicators.forEach(indicator => {
                if (indicator.chart) {
                    indicator.chart.remove();
                }
            });
            
            // Destroy resize observer
            if (chart._resizeObserver) {
                chart._resizeObserver.disconnect();
            }
            
            // Destroy main chart
            chart.remove();
        });
        
        // Clear maps
        this.charts.clear();
        this.indicators.clear();
        this.drawings.clear();
        this.dataStreams.clear();
        
        // Remove event listeners
        this.removeAllListeners();
        
        this.isInitialized = false;
    }
}

export default ChartModule;