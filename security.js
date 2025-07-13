/**
 * 🔒 Trading Bot Security Module
 * Version: 2.1.0
 * 
 * 🛡️ Security Features:
 * - XSS/CSRF Protection
 * - Input validation & sanitization
 * - API authentication & encryption
 * - Rate limiting & DDoS protection
 * - Secure session management
 * - Security audit logging
 * - Threat detection & prevention
 * 
 * ⚡ Performance:
 * - Minimal overhead
 * - Async operations
 * - Caching for performance
 */

'use strict';

/**
 * Security Module Class
 */
class SecurityModule {
    constructor(app) {
        this.app = app;
        
        // Security configuration
        this.config = {
            // Session
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
            sessionRenewThreshold: 5 * 60 * 1000, // 5 minutes
            maxSessions: 3,
            
            // Rate limiting
            rateLimit: {
                windowMs: 60 * 1000, // 1 minute
                maxRequests: 100,
                maxFailedLogins: 5,
                blockDuration: 15 * 60 * 1000 // 15 minutes
            },
            
            // Encryption
            algorithm: 'AES-GCM',
            keyLength: 256,
            saltLength: 32,
            iterations: 100000,
            
            // API Security
            apiTokenExpiry: 24 * 60 * 60 * 1000, // 24 hours
            requireHttps: true,
            
            // Input validation
            maxInputLength: 10000,
            allowedFileTypes: ['json', 'csv', 'txt'],
            maxFileSize: 10 * 1024 * 1024, // 10MB
            
            // Security headers
            headers: {
                'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
                'X-Content-Type-Options': 'nosniff',
                'X-Frame-Options': 'DENY',
                'X-XSS-Protection': '1; mode=block',
                'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;"
            }
        };
        
        // Security state
        this.sessions = new Map();
        this.rateLimiters = new Map();
        this.blacklist = new Set();
        this.failedAttempts = new Map();
        this.securityEvents = [];
        this.threatPatterns = this.loadThreatPatterns();
        
        // Crypto keys
        this.masterKey = null;
        this.sessionKeys = new Map();
        
        // Initialize
        this.init();
    }
    
    /**
     * Initialize security module
     */
    async init() {
        try {
            // Generate master key
            await this.generateMasterKey();
            
            // Setup CSRF protection
            this.setupCSRFProtection();
            
            // Setup security headers
            this.setupSecurityHeaders();
            
            // Setup input sanitization
            this.setupInputSanitization();
            
            // Start security monitoring
            this.startSecurityMonitoring();
            
            // Setup secure communication
            this.setupSecureCommunication();
            
            console.log('🔒 Security module initialized');
            
        } catch (error) {
            console.error('Security initialization failed:', error);
            throw error;
        }
    }
    
    /**
     * Generate master encryption key
     */
    async generateMasterKey() {
        try {
            // Check if key exists in secure storage
            const stored = await this.getSecureItem('masterKey');
            if (stored) {
                this.masterKey = await this.importKey(stored);
            } else {
                // Generate new key
                this.masterKey = await crypto.subtle.generateKey(
                    {
                        name: this.config.algorithm,
                        length: this.config.keyLength
                    },
                    true,
                    ['encrypt', 'decrypt']
                );
                
                // Store securely
                const exported = await this.exportKey(this.masterKey);
                await this.setSecureItem('masterKey', exported);
            }
        } catch (error) {
            console.error('Failed to generate master key:', error);
            // Fallback to password-based key
            this.masterKey = await this.deriveKeyFromPassword(
                this.app.securityToken || 'default-security-token'
            );
        }
    }
    
    /**
     * Setup CSRF protection
     */
    setupCSRFProtection() {
        // Generate CSRF token
        this.csrfToken = this.generateToken();
        
        // Add to all forms
        document.addEventListener('DOMContentLoaded', () => {
            const forms = document.querySelectorAll('form');
            forms.forEach(form => {
                const input = document.createElement('input');
                input.type = 'hidden';
                input.name = '_csrf';
                input.value = this.csrfToken;
                form.appendChild(input);
            });
        });
        
        // Validate on submission
        document.addEventListener('submit', (e) => {
            const form = e.target;
            const token = form.querySelector('input[name="_csrf"]')?.value;
            
            if (!this.validateCSRFToken(token)) {
                e.preventDefault();
                this.logSecurityEvent('CSRF_VALIDATION_FAILED', {
                    form: form.id || 'unknown'
                });
                throw new Error('CSRF validation failed');
            }
        });
    }
    
    /**
     * Setup security headers
     */
    setupSecurityHeaders() {
        // For service worker or server-side implementation
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then(registration => {
                registration.active?.postMessage({
                    type: 'SET_SECURITY_HEADERS',
                    headers: this.config.headers
                });
            });
        }
        
        // Meta tag equivalents
        Object.entries(this.config.headers).forEach(([name, value]) => {
            if (name.startsWith('X-') || name === 'Content-Security-Policy') {
                const meta = document.createElement('meta');
                meta.httpEquiv = name;
                meta.content = value;
                document.head.appendChild(meta);
            }
        });
    }
    
    /**
     * Setup input sanitization
     */
    setupInputSanitization() {
        // Override native methods
        const originalSetAttribute = Element.prototype.setAttribute;
        Element.prototype.setAttribute = function(name, value) {
            if (typeof value === 'string' && name !== 'data-secure') {
                value = SecurityModule.sanitizeHTML(value);
            }
            return originalSetAttribute.call(this, name, value);
        };
        
        // Sanitize all inputs
        document.addEventListener('input', (e) => {
            if (e.target instanceof HTMLInputElement || 
                e.target instanceof HTMLTextAreaElement) {
                this.sanitizeInput(e.target);
            }
        });
    }
    
    /**
     * Authenticate user
     */
    async authenticate(credentials) {
        try {
            // Rate limiting
            if (!this.checkRateLimit('auth')) {
                throw new Error('Too many authentication attempts');
            }
            
            // Validate credentials
            this.validateCredentials(credentials);
            
            // Hash password
            const hashedPassword = await this.hashPassword(
                credentials.password,
                credentials.username
            );
            
            // Verify with backend (simulated)
            const verified = await this.verifyCredentials({
                username: credentials.username,
                password: hashedPassword
            });
            
            if (!verified) {
                this.handleFailedLogin(credentials.username);
                throw new Error('Invalid credentials');
            }
            
            // Create session
            const session = await this.createSession(credentials.username);
            
            // Log success
            this.logSecurityEvent('LOGIN_SUCCESS', {
                username: credentials.username,
                sessionId: session.id
            });
            
            return session;
            
        } catch (error) {
            this.logSecurityEvent('LOGIN_FAILED', {
                username: credentials.username,
                error: error.message
            });
            throw error;
        }
    }
    
    /**
     * Create secure session
     */
    async createSession(username) {
        // Generate session ID
        const sessionId = this.generateSessionId();
        
        // Generate session key
        const sessionKey = await crypto.subtle.generateKey(
            {
                name: this.config.algorithm,
                length: 256
            },
            true,
            ['encrypt', 'decrypt']
        );
        
        // Create session object
        const session = {
            id: sessionId,
            username: username,
            createdAt: Date.now(),
            lastActivity: Date.now(),
            expiresAt: Date.now() + this.config.sessionTimeout,
            ipAddress: this.getClientIP(),
            userAgent: navigator.userAgent,
            fingerprint: await this.generateFingerprint()
        };
        
        // Store session
        this.sessions.set(sessionId, session);
        this.sessionKeys.set(sessionId, sessionKey);
        
        // Set secure cookie
        this.setSecureCookie('sessionId', sessionId, {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: this.config.sessionTimeout
        });
        
        return session;
    }
    
    /**
     * Validate session
     */
    async validateSession(sessionId) {
        const session = this.sessions.get(sessionId);
        
        if (!session) {
            return { valid: false, reason: 'Session not found' };
        }
        
        // Check expiry
        if (Date.now() > session.expiresAt) {
            this.destroySession(sessionId);
            return { valid: false, reason: 'Session expired' };
        }
        
        // Validate fingerprint
        const currentFingerprint = await this.generateFingerprint();
        if (currentFingerprint !== session.fingerprint) {
            this.logSecurityEvent('SESSION_FINGERPRINT_MISMATCH', {
                sessionId,
                expected: session.fingerprint,
                actual: currentFingerprint
            });
            this.destroySession(sessionId);
            return { valid: false, reason: 'Fingerprint mismatch' };
        }
        
        // Update activity
        session.lastActivity = Date.now();
        
        // Renew if needed
        if (session.expiresAt - Date.now() < this.config.sessionRenewThreshold) {
            session.expiresAt = Date.now() + this.config.sessionTimeout;
        }
        
        return { valid: true, session };
    }
    
    /**
     * Encrypt sensitive data
     */
    async encrypt(data, key = this.masterKey) {
        try {
            // Convert data to buffer
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(JSON.stringify(data));
            
            // Generate IV
            const iv = crypto.getRandomValues(new Uint8Array(12));
            
            // Encrypt
            const encrypted = await crypto.subtle.encrypt(
                {
                    name: this.config.algorithm,
                    iv: iv
                },
                key,
                dataBuffer
            );
            
            // Combine IV and encrypted data
            const combined = new Uint8Array(iv.length + encrypted.byteLength);
            combined.set(iv);
            combined.set(new Uint8Array(encrypted), iv.length);
            
            // Return base64
            return btoa(String.fromCharCode(...combined));
            
        } catch (error) {
            console.error('Encryption failed:', error);
            throw error;
        }
    }
    
    /**
     * Decrypt sensitive data
     */
    async decrypt(encryptedData, key = this.masterKey) {
        try {
            // Decode from base64
            const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
            
            // Extract IV and data
            const iv = combined.slice(0, 12);
            const data = combined.slice(12);
            
            // Decrypt
            const decrypted = await crypto.subtle.decrypt(
                {
                    name: this.config.algorithm,
                    iv: iv
                },
                key,
                data
            );
            
            // Convert back to object
            const decoder = new TextDecoder();
            return JSON.parse(decoder.decode(decrypted));
            
        } catch (error) {
            console.error('Decryption failed:', error);
            throw error;
        }
    }
    
    /**
     * Hash password with salt
     */
    async hashPassword(password, salt) {
        const encoder = new TextEncoder();
        const passwordBuffer = encoder.encode(password);
        const saltBuffer = encoder.encode(salt);
        
        // Derive key using PBKDF2
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            passwordBuffer,
            { name: 'PBKDF2' },
            false,
            ['deriveBits']
        );
        
        const derivedBits = await crypto.subtle.deriveBits(
            {
                name: 'PBKDF2',
                salt: saltBuffer,
                iterations: this.config.iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            256
        );
        
        // Convert to hex
        return Array.from(new Uint8Array(derivedBits))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    /**
     * Generate secure token
     */
    generateToken(length = 32) {
        const array = new Uint8Array(length);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    /**
     * Generate session ID
     */
    generateSessionId() {
        return `sess_${this.generateToken(16)}_${Date.now()}`;
    }
    
    /**
     * Generate client fingerprint
     */
    async generateFingerprint() {
        const components = [
            navigator.userAgent,
            navigator.language,
            navigator.platform,
            navigator.hardwareConcurrency,
            screen.width,
            screen.height,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            navigator.plugins.length,
            this.getCanvasFingerprint()
        ];
        
        const combined = components.join('|');
        const buffer = new TextEncoder().encode(combined);
        const hash = await crypto.subtle.digest('SHA-256', buffer);
        
        return Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
    
    /**
     * Get canvas fingerprint
     */
    getCanvasFingerprint() {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            ctx.textBaseline = 'top';
            ctx.font = '14px Arial';
            ctx.fillText('TradingBot🤖', 2, 2);
            
            return canvas.toDataURL().slice(-50);
        } catch (e) {
            return 'canvas-not-available';
        }
    }
    
    /**
     * Validate API request
     */
    async validateAPIRequest(request) {
        // Check HTTPS
        if (this.config.requireHttps && !request.url.startsWith('https://')) {
            throw new Error('HTTPS required');
        }
        
        // Validate API token
        const token = request.headers['Authorization']?.replace('Bearer ', '');
        if (!token || !await this.validateAPIToken(token)) {
            throw new Error('Invalid API token');
        }
        
        // Check rate limit
        if (!this.checkRateLimit(`api:${token}`)) {
            throw new Error('Rate limit exceeded');
        }
        
        // Validate signature
        const signature = request.headers['X-Signature'];
        if (!this.validateRequestSignature(request, signature)) {
            throw new Error('Invalid request signature');
        }
        
        return true;
    }
    
    /**
     * Sign API request
     */
    async signAPIRequest(request) {
        const timestamp = Date.now();
        const nonce = this.generateToken(16);
        
        // Create signature payload
        const payload = [
            request.method,
            request.url,
            timestamp,
            nonce,
            request.body || ''
        ].join('|');
        
        // Generate signature
        const signature = await this.generateHMAC(payload, this.app.config.api.apiSecret);
        
        // Add headers
        request.headers = {
            ...request.headers,
            'X-Timestamp': timestamp,
            'X-Nonce': nonce,
            'X-Signature': signature,
            'Authorization': `Bearer ${this.app.config.api.apiKey}`
        };
        
        return request;
    }
    
    /**
     * Generate HMAC signature
     */
    async generateHMAC(message, secret) {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const messageData = encoder.encode(message);
        
        const key = await crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );
        
        const signature = await crypto.subtle.sign(
            'HMAC',
            key,
            messageData
        );
        
        return btoa(String.fromCharCode(...new Uint8Array(signature)));
    }
    
    /**
     * Check rate limit
     */
    checkRateLimit(identifier) {
        const now = Date.now();
        let limiter = this.rateLimiters.get(identifier);
        
        if (!limiter) {
            limiter = {
                requests: [],
                blocked: false,
                blockedUntil: 0
            };
            this.rateLimiters.set(identifier, limiter);
        }
        
        // Check if blocked
        if (limiter.blocked && now < limiter.blockedUntil) {
            return false;
        } else if (limiter.blocked) {
            limiter.blocked = false;
        }
        
        // Clean old requests
        limiter.requests = limiter.requests.filter(
            time => now - time < this.config.rateLimit.windowMs
        );
        
        // Check limit
        if (limiter.requests.length >= this.config.rateLimit.maxRequests) {
            limiter.blocked = true;
            limiter.blockedUntil = now + this.config.rateLimit.blockDuration;
            
            this.logSecurityEvent('RATE_LIMIT_EXCEEDED', {
                identifier,
                requests: limiter.requests.length
            });
            
            return false;
        }
        
        // Add request
        limiter.requests.push(now);
        return true;
    }
    
    /**
     * Sanitize user input
     */
    sanitizeInput(input) {
        if (!input) return '';
        
        let value = input.value || input;
        
        // Remove null bytes
        value = value.replace(/\0/g, '');
        
        // Limit length
        if (value.length > this.config.maxInputLength) {
            value = value.substring(0, this.config.maxInputLength);
        }
        
        // Check for XSS patterns
        if (this.detectXSS(value)) {
            this.logSecurityEvent('XSS_ATTEMPT_DETECTED', {
                input: value.substring(0, 100)
            });
            value = this.escapeHTML(value);
        }
        
        // Check for SQL injection patterns
        if (this.detectSQLInjection(value)) {
            this.logSecurityEvent('SQL_INJECTION_ATTEMPT', {
                input: value.substring(0, 100)
            });
            value = this.escapeSQLChars(value);
        }
        
        if (input.value !== undefined) {
            input.value = value;
        }
        
        return value;
    }
    
    /**
     * Static HTML sanitization
     */
    static sanitizeHTML(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
    
    /**
     * Detect XSS patterns
     */
    detectXSS(input) {
        const xssPatterns = [
            /<script[^>]*>.*?<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /<iframe/gi,
            /<object/gi,
            /<embed/gi,
            /eval\(/gi,
            /expression\(/gi,
            /vbscript:/gi,
            /data:text\/html/gi
        ];
        
        return xssPatterns.some(pattern => pattern.test(input));
    }
    
    /**
     * Detect SQL injection patterns
     */
    detectSQLInjection(input) {
        const sqlPatterns = [
            /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER)\b)/gi,
            /('|(--|\/\*|\*\/|;))/g,
            /(EXEC|EXECUTE)\s*\(/gi,
            /(<|>|=|!|LIKE|OR|AND)\s*'[^']*'/gi
        ];
        
        return sqlPatterns.some(pattern => pattern.test(input));
    }
    
    /**
     * Escape HTML characters
     */
    escapeHTML(str) {
        const escapeMap = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
            '/': '&#x2F;'
        };
        
        return str.replace(/[&<>"'\/]/g, char => escapeMap[char]);
    }
    
    /**
     * Escape SQL characters
     */
    escapeSQLChars(str) {
        return str.replace(/['";\\]/g, char => '\\' + char);
    }
    
    /**
     * Validate file upload
     */
    validateFileUpload(file) {
        // Check file size
        if (file.size > this.config.maxFileSize) {
            throw new Error(`File too large: ${file.size} bytes`);
        }
        
        // Check file type
        const extension = file.name.split('.').pop().toLowerCase();
        if (!this.config.allowedFileTypes.includes(extension)) {
            throw new Error(`File type not allowed: ${extension}`);
        }
        
        // Check MIME type
        const validMimeTypes = {
            'json': 'application/json',
            'csv': 'text/csv',
            'txt': 'text/plain'
        };
        
        if (file.type !== validMimeTypes[extension]) {
            throw new Error(`Invalid MIME type: ${file.type}`);
        }
        
        // Check file content (first 1KB)
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                
                // Check for malicious patterns
                if (this.detectMaliciousContent(content)) {
                    reject(new Error('Malicious content detected'));
                } else {
                    resolve(true);
                }
            };
            reader.readAsText(file.slice(0, 1024));
        });
    }
    
    /**
     * Detect malicious content in files
     */
    detectMaliciousContent(content) {
        const maliciousPatterns = [
            /<script/i,
            /javascript:/i,
            /eval\(/i,
            /require\(/i,
            /import\s/i,
            /process\./i,
            /child_process/i,
            /__proto__/i
        ];
        
        return maliciousPatterns.some(pattern => pattern.test(content));
    }
    
    /**
     * Handle failed login
     */
    handleFailedLogin(username) {
        const attempts = this.failedAttempts.get(username) || 0;
        this.failedAttempts.set(username, attempts + 1);
        
        if (attempts + 1 >= this.config.rateLimit.maxFailedLogins) {
            this.blacklist.add(username);
            
            this.logSecurityEvent('ACCOUNT_LOCKED', {
                username,
                attempts: attempts + 1
            });
            
            // Schedule unlock
            setTimeout(() => {
                this.blacklist.delete(username);
                this.failedAttempts.delete(username);
            }, this.config.rateLimit.blockDuration);
        }
    }
    
    /**
     * Start security monitoring
     */
    startSecurityMonitoring() {
        // Monitor for suspicious activity
        setInterval(() => {
            this.detectAnomalies();
            this.cleanupExpiredSessions();
            this.updateThreatIntelligence();
        }, 60000); // Every minute
        
        // Monitor DOM changes
        const observer = new MutationObserver((mutations) => {
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // Element node
                            this.scanForThreats(node);
                        }
                    });
                }
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    /**
     * Detect anomalies
     */
    detectAnomalies() {
        // Check for unusual session patterns
        for (const [sessionId, session] of this.sessions) {
            // Rapid requests
            const recentActivity = Date.now() - session.lastActivity;
            if (recentActivity < 100) { // Less than 100ms
                this.logSecurityEvent('RAPID_REQUESTS', { sessionId });
            }
            
            // Geographic anomaly (would need GeoIP in real implementation)
            // Behavioral anomaly detection
        }
        
        // Check for brute force patterns
        for (const [identifier, limiter] of this.rateLimiters) {
            if (limiter.requests.length > this.config.rateLimit.maxRequests * 0.8) {
                this.logSecurityEvent('POTENTIAL_DDOS', {
                    identifier,
                    requests: limiter.requests.length
                });
            }
        }
    }
    
    /**
     * Scan DOM element for threats
     */
    scanForThreats(element) {
        // Check for inline scripts
        if (element.hasAttribute('onclick') || 
            element.hasAttribute('onload') ||
            element.hasAttribute('onerror')) {
            this.logSecurityEvent('INLINE_SCRIPT_DETECTED', {
                element: element.tagName,
                attributes: element.attributes
            });
            
            // Remove dangerous attributes
            ['onclick', 'onload', 'onerror', 'onmouseover'].forEach(attr => {
                element.removeAttribute(attr);
            });
        }
        
        // Check for dangerous elements
        if (['SCRIPT', 'IFRAME', 'OBJECT', 'EMBED'].includes(element.tagName)) {
            if (!element.hasAttribute('data-secure')) {
                this.logSecurityEvent('DANGEROUS_ELEMENT_DETECTED', {
                    element: element.tagName,
                    source: element.src || element.data
                });
                element.remove();
            }
        }
    }
    
    /**
     * Log security event
     */
    logSecurityEvent(type, details) {
        const event = {
            type,
            timestamp: Date.now(),
            details,
            userAgent: navigator.userAgent,
            url: window.location.href,
            sessionId: this.getCurrentSessionId()
        };
        
        this.securityEvents.push(event);
        
        // Keep only recent events
        if (this.securityEvents.length > 1000) {
            this.securityEvents = this.securityEvents.slice(-500);
        }
        
        // Send critical events to server
        if (this.isCriticalEvent(type)) {
            this.sendSecurityAlert(event);
        }
        
        console.warn(`[SECURITY] ${type}:`, details);
    }
    
    /**
     * Check if event is critical
     */
    isCriticalEvent(type) {
        const criticalTypes = [
            'XSS_ATTEMPT_DETECTED',
            'SQL_INJECTION_ATTEMPT',
            'ACCOUNT_LOCKED',
            'SESSION_HIJACKING',
            'POTENTIAL_DDOS',
            'DANGEROUS_ELEMENT_DETECTED'
        ];
        
        return criticalTypes.includes(type);
    }
    
    /**
     * Send security alert
     */
    async sendSecurityAlert(event) {
        try {
            if (this.app.modules.has('api')) {
                await this.app.modules.get('api').post('/security/alert', {
                    event,
                    severity: this.getEventSeverity(event.type)
                });
            }
        } catch (error) {
            console.error('Failed to send security alert:', error);
        }
    }
    
    /**
     * Get event severity
     */
    getEventSeverity(type) {
        const severityMap = {
            'XSS_ATTEMPT_DETECTED': 'high',
            'SQL_INJECTION_ATTEMPT': 'high',
            'ACCOUNT_LOCKED': 'medium',
            'SESSION_HIJACKING': 'critical',
            'POTENTIAL_DDOS': 'high',
            'RATE_LIMIT_EXCEEDED': 'low'
        };
        
        return severityMap[type] || 'medium';
    }
    
    /**
     * Setup secure communication
     */
    setupSecureCommunication() {
        // Override fetch
        const originalFetch = window.fetch;
        window.fetch = async (url, options = {}) => {
            // Add security headers
            options.headers = {
                ...options.headers,
                'X-CSRF-Token': this.csrfToken,
                'X-Request-ID': this.generateToken(16)
            };
            
            // Sign request if API call
            if (url.includes('/api/')) {
                options = await this.signAPIRequest({ ...options, url, method: options.method || 'GET' });
            }
            
            return originalFetch(url, options);
        };
        
        // Override WebSocket
        const OriginalWebSocket = window.WebSocket;
        window.WebSocket = function(url, protocols) {
            // Validate URL
            if (!url.startsWith('wss://')) {
                throw new Error('WebSocket must use secure connection (wss://)');
            }
            
            return new OriginalWebSocket(url, protocols);
        };
    }
    
    /**
     * Load threat patterns
     */
    loadThreatPatterns() {
        return {
            xss: [
                /<script[^>]*>.*?<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi
            ],
            sqli: [
                /(\b(SELECT|INSERT|UPDATE|DELETE|DROP)\b)/gi,
                /('|(--|\/\*|\*\/))/g
            ],
            pathTraversal: [
                /\.\.\//g,
                /\.\.\\/, 
                /%2e%2e/gi
            ],
            commandInjection: [
                /[;&|`$]/g,
                /\$\(/,
                /`.*`/
            ]
        };
    }
    
    /**
     * Update threat intelligence
     */
    async updateThreatIntelligence() {
        // In production, this would fetch from threat intelligence feeds
        // For now, just update patterns
        this.threatPatterns = this.loadThreatPatterns();
    }
    
    /**
     * Validate credentials format
     */
    validateCredentials(credentials) {
        if (!credentials.username || !credentials.password) {
            throw new Error('Username and password required');
        }
        
        // Username validation
        if (!/^[a-zA-Z0-9_-]{3,20}$/.test(credentials.username)) {
            throw new Error('Invalid username format');
        }
        
        // Password strength
        if (credentials.password.length < 8) {
            throw new Error('Password too short');
        }
        
        if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(credentials.password)) {
            throw new Error('Password must contain uppercase, lowercase, and numbers');
        }
        
        // Check against blacklist
        if (this.blacklist.has(credentials.username)) {
            throw new Error('Account temporarily locked');
        }
    }
    
    /**
     * Verify credentials (simulated)
     */
    async verifyCredentials(credentials) {
        // In production, this would verify against backend
        // For demo, accept specific test credentials
        const testHash = await this.hashPassword('Test123!', 'testuser');
        return credentials.username === 'testuser' && 
               credentials.password === testHash;
    }
    
    /**
     * Helper methods
     */
    getClientIP() {
        // In production, get from server headers
        return '127.0.0.1';
    }
    
    getCurrentSessionId() {
        return this.getCookie('sessionId');
    }
    
    getCookie(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop().split(';').shift();
        return null;
    }
    
    setSecureCookie(name, value, options = {}) {
        let cookie = `${name}=${value}`;
        
        if (options.maxAge) {
            cookie += `; max-age=${options.maxAge}`;
        }
        if (options.httpOnly) {
            cookie += '; HttpOnly';
        }
        if (options.secure) {
            cookie += '; Secure';
        }
        if (options.sameSite) {
            cookie += `; SameSite=${options.sameSite}`;
        }
        
        document.cookie = cookie;
    }
    
    destroySession(sessionId) {
        this.sessions.delete(sessionId);
        this.sessionKeys.delete(sessionId);
        this.setSecureCookie('sessionId', '', { maxAge: 0 });
    }
    
    cleanupExpiredSessions() {
        const now = Date.now();
        for (const [sessionId, session] of this.sessions) {
            if (now > session.expiresAt) {
                this.destroySession(sessionId);
            }
        }
    }
    
    async exportKey(key) {
        const exported = await crypto.subtle.exportKey('raw', key);
        return btoa(String.fromCharCode(...new Uint8Array(exported)));
    }
    
    async importKey(keyData) {
        const raw = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
        return await crypto.subtle.importKey(
            'raw',
            raw,
            { name: this.config.algorithm, length: this.config.keyLength },
            true,
            ['encrypt', 'decrypt']
        );
    }
    
    async deriveKeyFromPassword(password) {
        const encoder = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            encoder.encode(password),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );
        
        return await crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: encoder.encode('TradingBot-Salt-2024'),
                iterations: this.config.iterations,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: this.config.algorithm, length: this.config.keyLength },
            true,
            ['encrypt', 'decrypt']
        );
    }
    
    validateCSRFToken(token) {
        return token === this.csrfToken;
    }
    
    validateAPIToken(token) {
        // In production, validate against backend
        return token && token.length === 64;
    }
    
    validateRequestSignature(request, signature) {
        // In production, validate HMAC signature
        return true;
    }
    
    async getSecureItem(key) {
        try {
            const encrypted = localStorage.getItem(`secure_${key}`);
            if (!encrypted) return null;
            return await this.decrypt(encrypted);
        } catch (error) {
            console.error('Failed to get secure item:', error);
            return null;
        }
    }
    
    async setSecureItem(key, value) {
        try {
            const encrypted = await this.encrypt(value);
            localStorage.setItem(`secure_${key}`, encrypted);
            return true;
        } catch (error) {
            console.error('Failed to set secure item:', error);
            return false;
        }
    }
    
    /**
     * Get security status
     */
    getSecurityStatus() {
        return {
            sessions: this.sessions.size,
            activeSessions: Array.from(this.sessions.values()).filter(s => 
                Date.now() - s.lastActivity < 5 * 60 * 1000
            ).length,
            blacklistedUsers: this.blacklist.size,
            recentEvents: this.securityEvents.slice(-10),
            rateLimiters: this.rateLimiters.size,
            csrfToken: this.csrfToken ? 'Active' : 'Inactive',
            encryptionKey: this.masterKey ? 'Active' : 'Inactive'
        };
    }
    
    /**
     * Export security audit log
     */
    exportAuditLog() {
        const log = {
            exportDate: new Date().toISOString(),
            events: this.securityEvents,
            summary: {
                totalEvents: this.securityEvents.length,
                criticalEvents: this.securityEvents.filter(e => 
                    this.isCriticalEvent(e.type)
                ).length,
                uniqueUsers: new Set(this.securityEvents.map(e => 
                    e.sessionId
                )).size
            }
        };
        
        return JSON.stringify(log, null, 2);
    }
    
    /**
     * Destroy security module
     */
    destroy() {
        // Clear all sessions
        for (const sessionId of this.sessions.keys()) {
            this.destroySession(sessionId);
        }
        
        // Clear sensitive data
        this.masterKey = null;
        this.sessionKeys.clear();
        this.csrfToken = null;
        
        // Clear collections
        this.sessions.clear();
        this.rateLimiters.clear();
        this.blacklist.clear();
        this.failedAttempts.clear();
        
        console.log('Security module destroyed');
    }
}

// Export
export default SecurityModule;