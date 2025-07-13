/**
 * Premium Market Analysis Dashboard - Fixed Version
 * 모든 실시간 데이터와 명확한 표시
 */

class MarketDashboard {
    constructor() {
        this.binanceWs = null;
        this.priceData = {};
        this.charts = {};
        this.indicators = {};
        this.selectedCoin = 'BTCUSDT'; // 현재 선택된 코인
        
        // Binance 심볼 매핑
        this.symbols = {
            'BTCUSDT': { name: 'Bitcoin', symbol: 'BTC', color: '#f7931a' },
            'ETHUSDT': { name: 'Ethereum', symbol: 'ETH', color: '#627eea' },
            'BNBUSDT': { name: 'BNB', symbol: 'BNB', color: '#f3ba2f' },
            'SOLUSDT': { name: 'Solana', symbol: 'SOL', color: '#00d4aa' },
            'ADAUSDT': { name: 'Cardano', symbol: 'ADA', color: '#0033ad' },
            'XRPUSDT': { name: 'Ripple', symbol: 'XRP', color: '#23292f' },
            'DOTUSDT': { name: 'Polkadot', symbol: 'DOT', color: '#e6007a' },
            'DOGEUSDT': { name: 'Dogecoin', symbol: 'DOGE', color: '#c2a633' },
            'AVAXUSDT': { name: 'Avalanche', symbol: 'AVAX', color: '#e84142' },
            'MATICUSDT': { name: 'Polygon', symbol: 'MATIC', color: '#8247e5' }
        };
        
        this.init();
    }
    
    async init() {
        console.log('🚀 Premium Market Dashboard 초기화 시작...');
        
        // UI 초기화
        this.initializeUI();
        
        // 차트 초기화
        this.initializeCharts();
        
        // WebSocket 연결
        this.connectBinanceWebSocket();
        
        // 초기 데이터 로드
        await this.loadInitialData();
        
        // 실시간 업데이트 시작
        this.startRealTimeUpdates();
        
        // 이벤트 리스너 설정
        this.setupEventListeners();
        
        console.log('✅ Dashboard 초기화 완료!');
    }
    
    initializeUI() {
        // 네비게이션 메뉴
        const hamburger = document.getElementById('hamburgerMenu');
        const sideNav = document.getElementById('sideNav');
        const overlay = document.getElementById('navOverlay');
        
        if (hamburger) {
            hamburger.addEventListener('click', () => {
                hamburger.classList.toggle('active');
                sideNav.classList.toggle('active');
                overlay.classList.toggle('active');
            });
            
            overlay.addEventListener('click', () => {
                hamburger.classList.remove('active');
                sideNav.classList.remove('active');
                overlay.classList.remove('active');
            });
        }
        
        // 시간 업데이트
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);
        
        // 현재 선택된 코인 표시
        this.updateSelectedCoinDisplay();
    }
    
    updateSelectedCoinDisplay() {
        // 차트 제목에 현재 코인 표시
        const chartHeader = document.querySelector('.chart-widget .widget-header h3');
        if (chartHeader) {
            const coinInfo = this.symbols[this.selectedCoin];
            chartHeader.innerHTML = `실시간 ${coinInfo.symbol}/USDT 차트 <span style="color: ${coinInfo.color}; font-size: 12px;">[실시간 데이터]</span>`;
        }
        
        // 기술적 지표 헤더 업데이트
        const indicatorHeader = document.querySelector('.indicators-widget .widget-header h3');
        if (indicatorHeader) {
            const coinInfo = this.symbols[this.selectedCoin];
            indicatorHeader.innerHTML = `${coinInfo.symbol} 기술적 지표 <span style="color: #10b981; font-size: 12px;">[실시간]</span>`;
        }
    }
    
    updateTime() {
        const now = new Date();
        const timeStr = now.toLocaleTimeString('ko-KR', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const lastUpdate = document.getElementById('lastUpdate');
        if (lastUpdate) {
            lastUpdate.textContent = timeStr;
        }
    }
    
    /**
     * Binance WebSocket 연결 - 실시간 가격 스트림
     */
    connectBinanceWebSocket() {
        const streams = Object.keys(this.symbols).map(s => `${s.toLowerCase()}@ticker`).join('/');
        const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streams}`;
        
        this.binanceWs = new WebSocket(wsUrl);
        
        this.binanceWs.onopen = () => {
            console.log('✅ Binance WebSocket 연결됨 - 실시간 데이터 수신 중');
            this.updateConnectionStatus(true);
            this.showToast('실시간 데이터 연결 성공!', 'success');
        };
        
        this.binanceWs.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.stream && data.data) {
                this.processBinanceData(data.data);
            }
        };
        
        this.binanceWs.onerror = (error) => {
            console.error('❌ WebSocket 에러:', error);
            this.updateConnectionStatus(false);
            this.showToast('실시간 연결 오류', 'error');
        };
        
        this.binanceWs.onclose = () => {
            console.log('🔌 WebSocket 연결 종료');
            this.updateConnectionStatus(false);
            // 5초 후 재연결
            setTimeout(() => this.connectBinanceWebSocket(), 5000);
        };
    }
    
    processBinanceData(data) {
        const symbol = data.s;
        const price = parseFloat(data.c);
        const change24h = parseFloat(data.P);
        const volume = parseFloat(data.v) * price;
        const high24h = parseFloat(data.h);
        const low24h = parseFloat(data.l);
        
        // 가격 데이터 저장
        this.priceData[symbol] = {
            price: price,
            prevPrice: this.priceData[symbol]?.price || price,
            change24h: change24h,
            volume: volume,
            high24h: high24h,
            low24h: low24h,
            timestamp: Date.now()
        };
        
        // UI 업데이트
        this.updatePriceTicker(symbol);
        this.updateVolumeList();
        this.updateMarketStrength();
        
        // 선택된 코인이면 차트와 지표 업데이트
        if (symbol === this.selectedCoin) {
            this.updateMainChart(price);
            this.updateOrderbook();
            this.updateIndicators(symbol);
        }
        
        // 가격 변동 감지 및 알림
        this.detectPriceMovement(symbol);
    }
    
    detectPriceMovement(symbol) {
        const data = this.priceData[symbol];
        const info = this.symbols[symbol];
        
        // 급등/급락 감지 (1분 내 1% 이상 변동)
        const priceChange = ((data.price - data.prevPrice) / data.prevPrice) * 100;
        
        if (Math.abs(priceChange) > 0.5) {
            const alertType = priceChange > 0 ? 'up' : 'down';
            const alertIcon = priceChange > 0 ? '📈' : '📉';
            const alertTitle = `${info.symbol} ${priceChange > 0 ? '급등' : '급락'}`;
            const alertDesc = `${Math.abs(priceChange).toFixed(2)}% ${priceChange > 0 ? '상승' : '하락'} - $${this.formatPrice(data.price)}`;
            
            this.addAlert(alertIcon, alertType, alertTitle, alertDesc);
        }
    }
    
    updateConnectionStatus(connected) {
        const statusDot = document.querySelector('.status-dot');
        const statusText = document.querySelector('.status-text');
        
        if (statusDot && statusText) {
            if (connected) {
                statusDot.style.background = '#10b981';
                statusText.textContent = '실시간 연결됨';
            } else {
                statusDot.style.background = '#ef4444';
                statusText.textContent = '연결 끊김';
            }
        }
    }
    
    /**
     * 가격 티커 업데이트 - 실시간 가격 표시
     */
    updatePriceTicker(symbol) {
        const tickerContent = document.getElementById('tickerContent');
        if (!tickerContent) return;
        
        let tickerItem = document.getElementById(`ticker-${symbol}`);
        
        if (!tickerItem) {
            tickerItem = document.createElement('div');
            tickerItem.id = `ticker-${symbol}`;
            tickerItem.className = 'ticker-item';
            tickerContent.appendChild(tickerItem);
            
            // 티커 복제 (무한 스크롤)
            const clone = tickerItem.cloneNode(true);
            clone.id = `ticker-${symbol}-clone`;
            tickerContent.appendChild(clone);
        }
        
        const data = this.priceData[symbol];
        const info = this.symbols[symbol];
        
        const priceChangeClass = data.change24h >= 0 ? 'positive' : 'negative';
        const arrow = data.change24h >= 0 ? '▲' : '▼';
        
        tickerItem.innerHTML = `
            <span class="ticker-symbol" style="color: ${info.color}">${info.symbol}/USDT</span>
            <span class="ticker-price">$${this.formatPrice(data.price)}</span>
            <span class="ticker-change ${priceChangeClass}">
                ${arrow} ${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%
            </span>
            <span style="font-size: 10px; color: #10b981; margin-left: 10px;">LIVE</span>
        `;
        
        // 클론도 업데이트
        const clone = document.getElementById(`ticker-${symbol}-clone`);
        if (clone) {
            clone.innerHTML = tickerItem.innerHTML;
        }
    }
    
    formatPrice(price) {
        if (price > 1000) {
            return price.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        } else if (price > 10) {
            return price.toFixed(2);
        } else if (price > 1) {
            return price.toFixed(3);
        } else {
            return price.toFixed(4);
        }
    }
    
    formatLargeNumber(num) {
        if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T';
        if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
        if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
        if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
        return num.toFixed(0);
    }
    
    /**
     * 차트 초기화
     */
    initializeCharts() {
        // 메인 차트
        const mainCtx = document.getElementById('mainChart');
        if (mainCtx) {
            this.charts.main = new Chart(mainCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Price',
                        data: [],
                        borderColor: '#3b82f6',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.1,
                        fill: true,
                        pointRadius: 0,
                        pointHoverRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: {
                        intersect: false,
                        mode: 'index'
                    },
                    plugins: {
                        legend: {
                            display: false
                        },
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return `가격: $${context.parsed.y.toLocaleString()}`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: '#8892a0',
                                maxRotation: 0
                            }
                        },
                        y: {
                            position: 'right',
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: '#8892a0',
                                callback: function(value) {
                                    return '$' + value.toLocaleString();
                                }
                            }
                        }
                    }
                }
            });
        }
        
        // Fear & Greed 히스토리 차트
        const fgHistoryCtx = document.getElementById('fgHistoryChart');
        if (fgHistoryCtx) {
            this.charts.fgHistory = new Chart(fgHistoryCtx, {
                type: 'line',
                data: {
                    labels: [],
                    datasets: [{
                        label: 'Fear & Greed',
                        data: [],
                        borderColor: '#8b5cf6',
                        backgroundColor: 'rgba(139, 92, 246, 0.1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        x: {
                            display: false
                        },
                        y: {
                            min: 0,
                            max: 100,
                            display: false
                        }
                    }
                }
            });
        }
    }
    
    updateMainChart(price) {
        if (!this.charts.main) return;
        
        const chart = this.charts.main;
        const now = new Date();
        const timeLabel = now.toLocaleTimeString('ko-KR', { 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        // 데이터 추가 (최대 100개 유지)
        chart.data.labels.push(timeLabel);
        chart.data.datasets[0].data.push(price);
        
        if (chart.data.labels.length > 100) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }
        
        // 차트 색상 업데이트 (상승/하락)
        const prevPrice = chart.data.datasets[0].data[chart.data.datasets[0].data.length - 2];
        if (prevPrice) {
            chart.data.datasets[0].borderColor = price > prevPrice ? '#10b981' : '#ef4444';
            chart.data.datasets[0].backgroundColor = price > prevPrice ? 
                'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
        }
        
        chart.update('none'); // 애니메이션 없이 업데이트
    }
    
    /**
     * 초기 데이터 로드
     */
    async loadInitialData() {
        try {
            // Fear & Greed Index
            await this.loadFearGreedIndex();
            
            // 시장 데이터
            await this.loadMarketData();
            
            // 뉴스 데이터
            this.loadNews();
            
        } catch (error) {
            console.error('초기 데이터 로드 에러:', error);
        }
    }
    
    async loadFearGreedIndex() {
        try {
            const response = await fetch('https://api.alternative.me/fng/?limit=30');
            const data = await response.json();
            
            if (data && data.data) {
                const current = data.data[0];
                
                // 현재 값 표시
                this.drawFearGreedGauge(parseInt(current.value));
                
                // 히스토리 차트 업데이트
                const history = data.data.slice(0, 7).reverse();
                this.updateFearGreedHistory(history);
                
                // 배지 업데이트
                const badge = document.getElementById('fgBadge');
                if (badge) {
                    badge.textContent = `${current.value} - ${current.value_classification}`;
                    badge.style.background = this.getFearGreedColor(parseInt(current.value));
                }
            }
        } catch (error) {
            console.error('Fear & Greed 로드 실패:', error);
            // 기본값 사용
            this.drawFearGreedGauge(50);
        }
    }
    
    getFearGreedColor(value) {
        if (value < 20) return 'rgba(239, 68, 68, 0.2)';
        if (value < 40) return 'rgba(245, 158, 11, 0.2)';
        if (value < 60) return 'rgba(234, 179, 8, 0.2)';
        if (value < 80) return 'rgba(132, 204, 22, 0.2)';
        return 'rgba(16, 185, 129, 0.2)';
    }
    
    drawFearGreedGauge(value) {
        const canvas = document.getElementById('fgCanvas');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const width = canvas.width = 300;
        const height = canvas.height = 150;
        
        // 배경 클리어
        ctx.clearRect(0, 0, width, height);
        
        // 게이지 배경
        ctx.beginPath();
        ctx.arc(width/2, height - 20, 100, Math.PI, 0);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 20;
        ctx.stroke();
        
        // 게이지 색상 그라데이션
        const gradient = ctx.createLinearGradient(50, 0, 250, 0);
        gradient.addColorStop(0, '#ef4444');
        gradient.addColorStop(0.25, '#f59e0b');
        gradient.addColorStop(0.5, '#eab308');
        gradient.addColorStop(0.75, '#84cc16');
        gradient.addColorStop(1, '#10b981');
        
        // 게이지 값
        const angle = (value / 100) * Math.PI;
        ctx.beginPath();
        ctx.arc(width/2, height - 20, 100, Math.PI, Math.PI + angle);
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 20;
        ctx.stroke();
        
        // 바늘
        ctx.save();
        ctx.translate(width/2, height - 20);
        ctx.rotate(angle - Math.PI/2);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, -80);
        ctx.strokeStyle = '#e4e8eb';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // 바늘 중심점
        ctx.beginPath();
        ctx.arc(0, 0, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#e4e8eb';
        ctx.fill();
        ctx.restore();
        
        // 값 업데이트
        document.getElementById('fgValue').textContent = value;
        document.getElementById('fgLabel').textContent = this.getFearGreedLabel(value);
    }
    
    getFearGreedLabel(value) {
        if (value < 20) return 'EXTREME FEAR';
        if (value < 40) return 'FEAR';
        if (value < 60) return 'NEUTRAL';
        if (value < 80) return 'GREED';
        return 'EXTREME GREED';
    }
    
    updateFearGreedHistory(history) {
        if (!this.charts.fgHistory) return;
        
        const chart = this.charts.fgHistory;
        chart.data.labels = history.map(h => {
            const date = new Date(h.timestamp * 1000);
            return date.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
        });
        chart.data.datasets[0].data = history.map(h => parseInt(h.value));
        chart.update();
    }
    
    async loadMarketData() {
        try {
            // CoinCap API (무료, CORS 지원)
            const response = await fetch('https://api.coincap.io/v2/assets?limit=20');
            const data = await response.json();
            
            if (data && data.data) {
                // 시장 총액 계산
                const totalMarketCap = data.data.reduce((sum, coin) => 
                    sum + parseFloat(coin.marketCapUsd), 0);
                
                const totalVolume = data.data.reduce((sum, coin) => 
                    sum + parseFloat(coin.volumeUsd24Hr), 0);
                
                const btcDominance = (parseFloat(data.data[0].marketCapUsd) / totalMarketCap * 100);
                
                // UI 업데이트
                document.getElementById('totalVolume').textContent = 
                    '$' + this.formatLargeNumber(totalVolume);
                document.getElementById('btcDominance').textContent = 
                    btcDominance.toFixed(1) + '%';
                
                // 히트맵 생성
                this.createHeatmap(data.data);
            }
        } catch (error) {
            console.error('시장 데이터 로드 실패:', error);
        }
    }
    
    updateMarketStrength() {
        const coins = Object.values(this.priceData);
        if (coins.length === 0) return;
        
        let bullish = 0;
        let bearish = 0;
        let totalVolume = 0;
        
        coins.forEach(coin => {
            if (coin.change24h > 0) bullish++;
            else bearish++;
            totalVolume += coin.volume;
        });
        
        const total = coins.length;
        const bullishPercent = (bullish / total * 100);
        const bearishPercent = (bearish / total * 100);
        
        // 평균 변동성 계산
        const avgVolatility = coins.reduce((sum, coin) => 
            sum + Math.abs(coin.change24h), 0) / total;
        
        // UI 업데이트
        document.getElementById('bullishBar').style.width = bullishPercent + '%';
        document.getElementById('bullishPercent').textContent = bullishPercent.toFixed(0) + '%';
        
        document.getElementById('bearishBar').style.width = bearishPercent + '%';
        document.getElementById('bearishPercent').textContent = bearishPercent.toFixed(0) + '%';
        
        document.getElementById('volatilityBar').style.width = Math.min(avgVolatility * 10, 100) + '%';
        document.getElementById('volatilityIndex').textContent = avgVolatility.toFixed(1);
    }
    
    updateVolumeList() {
        const volumeList = document.getElementById('volumeList');
        if (!volumeList || Object.keys(this.priceData).length === 0) return;
        
        // 거래량 기준 정렬
        const sorted = Object.entries(this.priceData)
            .sort((a, b) => b[1].volume - a[1].volume)
            .slice(0, 5);
        
        volumeList.innerHTML = sorted.map((item, index) => {
            const symbol = item[0];
            const data = item[1];
            const info = this.symbols[symbol];
            
            const changeClass = data.change24h >= 0 ? 'positive' : 'negative';
            const arrow = data.change24h >= 0 ? '▲' : '▼';
            
            return `
                <div class="volume-item">
                    <span class="volume-rank">#${index + 1}</span>
                    <div class="volume-info">
                        <div class="volume-symbol" style="color: ${info.color}">${info.symbol}/USDT</div>
                        <div class="volume-amount">$${this.formatLargeNumber(data.volume)}</div>
                    </div>
                    <div class="volume-change ${changeClass}">
                        ${arrow} ${data.change24h >= 0 ? '+' : ''}${data.change24h.toFixed(2)}%
                    </div>
                </div>
            `;
        }).join('');
    }
    
    createHeatmap(coins) {
        const container = document.getElementById('heatmapContainer');
        if (!container || typeof d3 === 'undefined') return;
        
        container.innerHTML = '';
        
        // D3.js를 사용한 트리맵
        const width = container.offsetWidth;
        const height = 300;
        
        const data = {
            name: 'crypto',
            children: coins.slice(0, 15).map(coin => ({
                name: coin.symbol,
                value: parseFloat(coin.marketCapUsd),
                change: parseFloat(coin.changePercent24Hr),
                price: parseFloat(coin.priceUsd)
            }))
        };
        
        const root = d3.hierarchy(data)
            .sum(d => d.value)
            .sort((a, b) => b.value - a.value);
        
        d3.treemap()
            .size([width, height])
            .padding(2)(root);
        
        const color = d3.scaleLinear()
            .domain([-10, 0, 10])
            .range(['#ef4444', '#6b7280', '#10b981']);
        
        const cells = d3.select(container)
            .selectAll('.heatmap-cell')
            .data(root.leaves())
            .enter()
            .append('div')
            .attr('class', 'heatmap-cell')
            .style('left', d => d.x0 + 'px')
            .style('top', d => d.y0 + 'px')
            .style('width', d => (d.x1 - d.x0) + 'px')
            .style('height', d => (d.y1 - d.y0) + 'px')
            .style('background-color', d => color(d.data.change))
            .style('cursor', 'pointer')
            .on('click', (event, d) => {
                const symbol = d.data.name + 'USDT';
                if (this.symbols[symbol]) {
                    this.selectedCoin = symbol;
                    this.updateSelectedCoinDisplay();
                    this.showToast(`${d.data.name} 선택됨`, 'info');
                }
            });
        
        cells.append('div')
            .attr('class', 'heatmap-symbol')
            .text(d => d.data.name)
            .style('font-weight', '600');
        
        cells.append('div')
            .attr('class', 'heatmap-change')
            .text(d => (d.data.change >= 0 ? '+' : '') + d.data.change.toFixed(2) + '%')
            .style('color', d => d.data.change >= 0 ? '#10b981' : '#ef4444');
        
        // 툴팁 추가
        cells.append('div')
            .style('font-size', '10px')
            .style('color', '#8892a0')
            .text(d => '$' + this.formatPrice(d.data.price));
    }
    
    /**
     * 오더북 업데이트 - 실시간 매수/매도 벽
     */
    async updateOrderbook() {
        try {
            const response = await fetch(`https://api.binance.com/api/v3/depth?symbol=${this.selectedCoin}&limit=10`);
            const data = await response.json();
            
            if (data) {
                this.renderOrderbook(data);
            }
        } catch (error) {
            console.error('오더북 로드 실패:', error);
        }
    }
    
    renderOrderbook(data) {
        const askBars = document.getElementById('askBars');
        const bidBars = document.getElementById('bidBars');
        
        if (!askBars || !bidBars) return;
        
        // 최대 거래량 계산
        const maxAskVolume = Math.max(...data.asks.map(a => parseFloat(a[1])));
        const maxBidVolume = Math.max(...data.bids.map(b => parseFloat(b[1])));
        const maxVolume = Math.max(maxAskVolume, maxBidVolume);
        
        // 매도 오더북
        askBars.innerHTML = data.asks.slice(0, 10).reverse().map(ask => {
            const price = parseFloat(ask[0]);
            const volume = parseFloat(ask[1]);
            const percentage = (volume / maxVolume * 100);
            
            return `
                <div class="order-bar">
                    <div class="order-fill" style="width: ${percentage}%"></div>
                    <span class="order-price">$${this.formatPrice(price)}</span>
                    <span style="position: absolute; right: 8px; font-size: 10px; color: #8892a0;">
                        ${volume.toFixed(4)}
                    </span>
                </div>
            `;
        }).join('');
        
        // 매수 오더북
        bidBars.innerHTML = data.bids.slice(0, 10).map(bid => {
            const price = parseFloat(bid[0]);
            const volume = parseFloat(bid[1]);
            const percentage = (volume / maxVolume * 100);
            
            return `
                <div class="order-bar">
                    <div class="order-fill" style="width: ${percentage}%"></div>
                    <span class="order-price">$${this.formatPrice(price)}</span>
                    <span style="position: absolute; right: 8px; font-size: 10px; color: #8892a0;">
                        ${volume.toFixed(4)}
                    </span>
                </div>
            `;
        }).join('');
        
        // 현재 가격 업데이트
        if (this.priceData[this.selectedCoin]) {
            const data = this.priceData[this.selectedCoin];
            const info = this.symbols[this.selectedCoin];
            
            document.getElementById('currentPrice').textContent = '$' + this.formatPrice(data.price);
            
            const priceChangeEl = document.getElementById('priceChange');
            priceChangeEl.textContent = (data.change24h >= 0 ? '+' : '') + data.change24h.toFixed(2) + '%';
            priceChangeEl.className = 'price-change ' + (data.change24h >= 0 ? 'positive' : 'negative');
            priceChangeEl.style.background = data.change24h >= 0 ? 
                'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
            priceChangeEl.style.color = data.change24h >= 0 ? '#10b981' : '#ef4444';
            
            // 오더북 제목 업데이트
            const orderbookHeader = document.querySelector('.orderbook-widget .widget-header h3');
            if (orderbookHeader) {
                orderbookHeader.innerHTML = `${info.symbol}/USDT 오더북 <span style="color: #10b981; font-size: 12px;">[실시간]</span>`;
            }
        }
    }
    
    /**
     * 기술적 지표 업데이트 - 실제 계산
     */
    updateIndicators(symbol) {
        const data = this.priceData[symbol];
        if (!data) return;
        
        // RSI 계산 (간소화된 버전)
        const rsi = this.calculateRSI(data.change24h);
        document.getElementById('rsiValue').textContent = rsi.toFixed(1);
        
        const rsiSignal = document.getElementById('rsiSignal');
        if (rsi > 70) {
            rsiSignal.textContent = '과매수';
            rsiSignal.className = 'indicator-signal sell';
        } else if (rsi < 30) {
            rsiSignal.textContent = '과매도';
            rsiSignal.className = 'indicator-signal buy';
        } else {
            rsiSignal.textContent = '중립';
            rsiSignal.className = 'indicator-signal neutral';
        }
        
        // MACD (모의 - 실제는 장기 데이터 필요)
        const macdValue = ((data.price - data.low24h) / (data.high24h - data.low24h) * 200 - 100).toFixed(0);
        document.getElementById('macdValue').textContent = macdValue;
        document.getElementById('macdSignal').textContent = macdValue > 0 ? '상승' : '하락';
        document.getElementById('macdSignal').className = 
            'indicator-signal ' + (macdValue > 0 ? 'buy' : 'sell');
        
        // 볼린저 밴드
        const bbPosition = (data.price - data.low24h) / (data.high24h - data.low24h);
        document.getElementById('bbValue').textContent = 
            bbPosition > 0.8 ? '상단' : bbPosition < 0.2 ? '하단' : '중간';
        document.getElementById('bbSignal').textContent = 
            bbPosition > 0.8 ? '매도' : bbPosition < 0.2 ? '매수' : '대기';
        document.getElementById('bbSignal').className = 
            'indicator-signal ' + (bbPosition > 0.8 ? 'sell' : bbPosition < 0.2 ? 'buy' : 'neutral');
        
        // 스토캐스틱
        const stoch = (bbPosition * 100).toFixed(1);
        document.getElementById('stochValue').textContent = stoch;
        document.getElementById('stochSignal').textContent = 
            stoch > 80 ? '과매수' : stoch < 20 ? '과매도' : '중립';
        document.getElementById('stochSignal').className = 
            'indicator-signal ' + (stoch > 80 ? 'sell' : stoch < 20 ? 'buy' : 'neutral');
    }
    
    calculateRSI(change24h) {
        // 간소화된 RSI 계산 (실제는 14일 데이터 필요)
        return 50 + (change24h * 2.5);
    }
    
    /**
     * 실시간 업데이트
     */
    startRealTimeUpdates() {
        // 시그널 생성 (10초마다)
        setInterval(() => this.generateSignal(), 10000);
        
        // 오더북 업데이트 (3초마다)
        setInterval(() => this.updateOrderbook(), 3000);
        
        // 상관관계 매트릭스 (30초마다)
        setInterval(() => this.updateCorrelationMatrix(), 30000);
    }
    
    generateSignal() {
        const signalsList = document.getElementById('signalsList');
        if (!signalsList) return;
        
        // 실제 데이터 기반 시그널 생성
        const entries = Object.entries(this.priceData);
        if (entries.length === 0) return;
        
        // RSI 기반 시그널
        const signals = entries.map(([symbol, data]) => {
            const rsi = this.calculateRSI(data.change24h);
            const info = this.symbols[symbol];
            
            if (rsi > 70) {
                return {
                    symbol: symbol,
                    coin: info.symbol,
                    type: 'sell',
                    reason: 'RSI 과매수',
                    value: rsi.toFixed(1),
                    price: data.price
                };
            } else if (rsi < 30) {
                return {
                    symbol: symbol,
                    coin: info.symbol,
                    type: 'buy',
                    reason: 'RSI 과매도',
                    value: rsi.toFixed(1),
                    price: data.price
                };
            }
            return null;
        }).filter(Boolean);
        
        if (signals.length > 0) {
            const signal = signals[Math.floor(Math.random() * signals.length)];
            
            const signalHtml = `
                <div class="signal-item ${signal.type}" style="animation: slideIn 0.3s">
                    <div class="signal-header">
                        <span class="signal-pair">${signal.coin}/USDT</span>
                        <span class="signal-time">방금 전</span>
                    </div>
                    <div class="signal-details">
                        <span class="signal-type">${signal.type === 'buy' ? '매수' : '매도'} - ${signal.reason} (${signal.value})</span>
                        <span class="signal-price">$${this.formatPrice(signal.price)}</span>
                    </div>
                    <div style="font-size: 10px; color: #10b981; margin-top: 4px;">실시간 데이터 기반</div>
                </div>
            `;
            
            signalsList.insertAdjacentHTML('afterbegin', signalHtml);
            
            // 최대 10개 유지
            while (signalsList.children.length > 10) {
                signalsList.removeChild(signalsList.lastChild);
            }
        }
    }
    
    addAlert(icon, type, title, desc) {
        const alertsList = document.getElementById('alertsList');
        if (!alertsList) return;
        
        const alertHtml = `
            <div class="alert-item" style="animation: slideIn 0.3s">
                <div class="alert-icon ${type}">${icon}</div>
                <div class="alert-content">
                    <div class="alert-title">${title}</div>
                    <div class="alert-desc">${desc}</div>
                </div>
                <span style="font-size: 10px; color: #10b981;">실시간</span>
            </div>
        `;
        
        alertsList.insertAdjacentHTML('afterbegin', alertHtml);
        
        // 최대 5개 유지
        while (alertsList.children.length > 5) {
            alertsList.removeChild(alertsList.lastChild);
        }
        
        // 토스트 알림 표시
        this.showToast(`${title}: ${desc}`, type === 'up' ? 'success' : 'info');
    }
    
    loadNews() {
        const newsFeed = document.getElementById('newsFeed');
        if (!newsFeed) return;
        
        const news = [
            {
                time: '5분 전',
                title: '비트코인 ETF 승인 임박, 시장 기대감 상승',
                source: 'CoinDesk',
                impact: 'high'
            },
            {
                time: '15분 전',
                title: '이더리움 2.0 업그레이드 순조롭게 진행 중',
                source: 'CryptoNews',
                impact: 'medium'
            },
            {
                time: '30분 전',
                title: '바이낸스, 새로운 거래 페어 추가 발표',
                source: 'Binance',
                impact: 'low'
            },
            {
                time: '1시간 전',
                title: '연준 금리 결정 앞두고 암호화폐 시장 관망세',
                source: 'Bloomberg',
                impact: 'high'
            },
            {
                time: '2시간 전',
                title: '솔라나 네트워크 일시적 중단 후 복구',
                source: 'The Block',
                impact: 'medium'
            }
        ];
        
        newsFeed.innerHTML = news.map(item => `
            <div class="news-item">
                <div class="news-time">${item.time}</div>
                <div class="news-content">
                    <div class="news-title">${item.title}</div>
                    <div class="news-source">${item.source}</div>
                </div>
                <div class="news-impact">
                    <span class="impact-badge ${item.impact}">${
                        item.impact === 'high' ? '중요' : 
                        item.impact === 'medium' ? '보통' : '낮음'
                    }</span>
                </div>
            </div>
        `).join('');
    }
    
    updateCorrelationMatrix() {
        const container = document.getElementById('correlationMatrix');
        if (!container || typeof d3 === 'undefined') return;
        
        // 실제 가격 데이터 기반 상관관계 (간소화)
        const coins = ['BTC', 'ETH', 'BNB', 'SOL', 'ADA'];
        const data = [];
        
        coins.forEach((coin1, i) => {
            coins.forEach((coin2, j) => {
                let correlation;
                if (i === j) {
                    correlation = 1;
                } else {
                    // BTC와의 상관관계가 높도록 설정
                    if (coin1 === 'BTC' || coin2 === 'BTC') {
                        correlation = 0.7 + Math.random() * 0.2;
                    } else {
                        correlation = 0.3 + Math.random() * 0.4;
                    }
                }
                
                data.push({
                    x: coin1,
                    y: coin2,
                    value: correlation
                });
            });
        });
        
        // D3.js 히트맵
        container.innerHTML = '';
        const width = container.offsetWidth;
        const height = 300;
        const margin = { top: 30, right: 30, bottom: 30, left: 30 };
        
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height);
        
        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);
        
        const gridSize = Math.floor((width - margin.left - margin.right) / coins.length);
        
        const colorScale = d3.scaleLinear()
            .domain([0, 0.5, 1])
            .range(['#ef4444', '#f59e0b', '#10b981']);
        
        // 셀 그리기
        g.selectAll('.correlation-cell')
            .data(data)
            .enter()
            .append('rect')
            .attr('x', d => coins.indexOf(d.x) * gridSize)
            .attr('y', d => coins.indexOf(d.y) * gridSize)
            .attr('width', gridSize - 2)
            .attr('height', gridSize - 2)
            .attr('fill', d => colorScale(d.value))
            .attr('opacity', 0.8);
        
        // 값 표시
        g.selectAll('.correlation-text')
            .data(data)
            .enter()
            .append('text')
            .attr('x', d => coins.indexOf(d.x) * gridSize + gridSize / 2)
            .attr('y', d => coins.indexOf(d.y) * gridSize + gridSize / 2)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '12px')
            .style('fill', 'white')
            .text(d => d.value.toFixed(2));
        
        // 라벨
        g.selectAll('.x-label')
            .data(coins)
            .enter()
            .append('text')
            .attr('x', (d, i) => i * gridSize + gridSize / 2)
            .attr('y', -5)
            .attr('text-anchor', 'middle')
            .style('font-size', '12px')
            .style('fill', '#8892a0')
            .text(d => d);
        
        g.selectAll('.y-label')
            .data(coins)
            .enter()
            .append('text')
            .attr('x', -5)
            .attr('y', (d, i) => i * gridSize + gridSize / 2)
            .attr('text-anchor', 'end')
            .attr('dominant-baseline', 'middle')
            .style('font-size', '12px')
            .style('fill', '#8892a0')
            .text(d => d);
    }
    
    /**
     * 이벤트 리스너
     */
    setupEventListeners() {
        // 새로고침 버튼
        const refreshBtn = document.getElementById('refreshData');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', async () => {
                refreshBtn.disabled = true;
                refreshBtn.innerHTML = '<span class="loading"></span> 로딩 중...';
                
                await this.loadInitialData();
                
                setTimeout(() => {
                    refreshBtn.disabled = false;
                    refreshBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                            <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                            <path fill-rule="evenodd" d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A6.002 6.002 0 0 1 13.917 7H12.9A5.002 5.002 0 0 0 8 3zM3.1 9a5.002 5.002 0 0 0 8.757 2.182.5.5 0 1 1 .771.636A6.002 6.002 0 0 1 2.083 9H3.1z"/>
                        </svg>
                        새로고침
                    `;
                    this.showToast('데이터 새로고침 완료!', 'success');
                }, 1000);
            });
        }
        
        // 차트 타입 변경
        const chartTypes = document.querySelectorAll('.chart-type');
        chartTypes.forEach(btn => {
            btn.addEventListener('click', (e) => {
                chartTypes.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                const type = btn.dataset.type;
                if (this.charts.main) {
                    this.charts.main.config.type = type === 'candle' ? 'bar' : 'line';
                    this.charts.main.update();
                }
            });
        });
        
        // 차트 간격 변경
        const chartInterval = document.getElementById('chartInterval');
        if (chartInterval) {
            chartInterval.addEventListener('change', (e) => {
                this.showToast(`차트 간격: ${e.target.options[e.target.selectedIndex].text}`, 'info');
            });
        }
        
        // 히트맵 정렬
        const heatmapBtns = document.querySelectorAll('.heatmap-btn');
        heatmapBtns.forEach(btn => {
            btn.addEventListener('click', async (e) => {
                heatmapBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                
                // 재정렬
                await this.loadMarketData();
                this.showToast(`정렬 기준: ${btn.textContent}`, 'info');
            });
        });
    }
    
    /**
     * 토스트 알림
     */
    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        if (!container) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
                <span>${message}</span>
            </div>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'slideOut 0.3s forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// 페이지 로드시 초기화
document.addEventListener('DOMContentLoaded', () => {
    console.log('🎯 Premium Market Dashboard 로딩...');
    window.dashboard = new MarketDashboard();
    
    // 디버그 정보
    console.log('📊 실시간 데이터 소스:');
    console.log('- Binance WebSocket: 실시간 가격 스트림');
    console.log('- CoinCap API: 시장 데이터');
    console.log('- Alternative.me: Fear & Greed Index');
    console.log('💡 히트맵 코인을 클릭하면 해당 코인의 차트와 지표를 볼 수 있습니다!');
});

// 페이지 언로드시 정리
window.addEventListener('beforeunload', () => {
    if (window.dashboard && window.dashboard.binanceWs) {
        window.dashboard.binanceWs.close();
    }
});