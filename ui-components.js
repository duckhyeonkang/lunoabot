/**
 * 🎨 Trading Bot UI Components Module
 * Version: 2.1.0
 * 
 * 🧩 Components:
 * - Modal System (백테스트, 주문, 설정)
 * - Notification System (토스트, 알림)
 * - Panel Management
 * - Context Menu
 * - Tooltips
 * - Progress Indicators
 * - Tab System
 * - Search & Filter
 * - Status Indicators
 * - Metric Cards
 * - Virtual Scrolling
 * - Drag & Drop
 */

import { EventEmitter } from '../tradingcore/event-emitter.js';

class UIComponents extends EventEmitter {
    constructor(tradingBot) {
        super();
        this.bot = tradingBot;
        this.config = tradingBot.config.ui || this.getDefaultConfig();
        
        // Component registries
        this.modals = new Map();
        this.notifications = new Map();
        this.panels = new Map();
        this.tooltips = new Map();
        this.contextMenus = new Map();
        this.tabs = new Map();
        
        // Active states
        this.activeModal = null;
        this.activeTooltip = null;
        this.activeContextMenu = null;
        
        // Notification queue
        this.notificationQueue = [];
        this.maxNotifications = 5;
        
        // Animation states
        this.animations = new Map();
        
        // Theme
        this.theme = this.config.theme || 'dark';
        
        // Initialize
        this.init();
    }
    
    getDefaultConfig() {
        return {
            theme: 'dark',
            animations: {
                enabled: true,
                duration: 300,
                easing: 'cubic-bezier(0.4, 0, 0.2, 1)'
            },
            notifications: {
                position: 'top-right',
                duration: 5000,
                stack: true,
                maxStack: 5
            },
            modals: {
                backdrop: true,
                closeOnEscape: true,
                closeOnBackdrop: true
            },
            tooltips: {
                delay: 500,
                offset: 10,
                arrow: true
            },
            panels: {
                resizable: true,
                collapsible: true,
                draggable: false,
                rememberState: true
            }
        };
    }
    
    init() {
        // Initialize modal system
        this.initModalSystem();
        
        // Initialize notification system
        this.initNotificationSystem();
        
        // Initialize panel system
        this.initPanelSystem();
        
        // Initialize tooltips
        this.initTooltipSystem();
        
        // Initialize context menus
        this.initContextMenuSystem();
        
        // Initialize tab system
        this.initTabSystem();
        
        // Setup global event listeners
        this.setupGlobalListeners();
        
        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();
        
        // Load saved UI states
        this.loadUIStates();
        
        this.emit('initialized');
    }
    
    // ===== MODAL SYSTEM =====
    initModalSystem() {
        // Register existing modals
        const modalConfigs = [
            {
                id: 'backtest-modal',
                title: '백테스트 결과',
                type: 'backtest',
                size: 'large'
            },
            {
                id: 'order-modal',
                title: '고급 주문',
                type: 'order',
                size: 'medium'
            },
            {
                id: 'keyboard-help',
                title: '키보드 단축키',
                type: 'help',
                size: 'medium'
            }
        ];
        
        modalConfigs.forEach(config => {
            this.registerModal(config);
        });
    }
    
    registerModal(config) {
        const modal = {
            id: config.id,
            element: document.getElementById(config.id),
            config: config,
            isOpen: false,
            onOpen: [],
            onClose: []
        };
        
        if (!modal.element) {
            console.warn(`Modal element not found: ${config.id}`);
            return;
        }
        
        // Setup close button
        const closeBtn = modal.element.querySelector('.close-btn');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.closeModal(config.id));
        }
        
        // Setup backdrop click
        if (this.config.modals.closeOnBackdrop) {
            modal.element.addEventListener('click', (e) => {
                if (e.target === modal.element) {
                    this.closeModal(config.id);
                }
            });
        }
        
        this.modals.set(config.id, modal);
    }
    
    openModal(modalId, data = {}) {
        const modal = this.modals.get(modalId);
        if (!modal || modal.isOpen) return;
        
        // Close any active modal
        if (this.activeModal) {
            this.closeModal(this.activeModal);
        }
        
        // Open modal
        modal.element.classList.add('show');
        modal.element.setAttribute('aria-hidden', 'false');
        modal.isOpen = true;
        this.activeModal = modalId;
        
        // Focus management
        this.trapFocus(modal.element);
        
        // Execute open callbacks
        modal.onOpen.forEach(cb => cb(data));
        
        // Emit event
        this.emit('modal:opened', { id: modalId, data });
        
        // Animation
        if (this.config.animations.enabled) {
            this.animateIn(modal.element, 'fadeIn');
        }
        
        return modal;
    }
    
    closeModal(modalId) {
        const modal = this.modals.get(modalId);
        if (!modal || !modal.isOpen) return;
        
        // Animation
        if (this.config.animations.enabled) {
            this.animateOut(modal.element, 'fadeOut', () => {
                this.finalizeCloseModal(modal);
            });
        } else {
            this.finalizeCloseModal(modal);
        }
    }
    
    finalizeCloseModal(modal) {
        modal.element.classList.remove('show');
        modal.element.setAttribute('aria-hidden', 'true');
        modal.isOpen = false;
        
        if (this.activeModal === modal.id) {
            this.activeModal = null;
        }
        
        // Restore focus
        this.restoreFocus();
        
        // Execute close callbacks
        modal.onClose.forEach(cb => cb());
        
        // Emit event
        this.emit('modal:closed', { id: modal.id });
    }
    
    // ===== NOTIFICATION SYSTEM =====
    initNotificationSystem() {
        // Create notification container
        this.notificationContainer = document.createElement('div');
        this.notificationContainer.className = 'notification-container';
        this.notificationContainer.setAttribute('role', 'alert');
        this.notificationContainer.setAttribute('aria-live', 'polite');
        document.body.appendChild(this.notificationContainer);
        
        // Position container
        this.updateNotificationPosition();
    }
    
    showNotification(options) {
        const notification = {
            id: `notification-${Date.now()}`,
            type: options.type || 'info',
            title: options.title || '',
            message: options.message || '',
            duration: options.duration || this.config.notifications.duration,
            actions: options.actions || [],
            closable: options.closable !== false,
            timestamp: Date.now()
        };
        
        // Create notification element
        const element = this.createNotificationElement(notification);
        notification.element = element;
        
        // Add to queue
        this.notificationQueue.push(notification);
        this.notifications.set(notification.id, notification);
        
        // Check queue limit
        if (this.notificationQueue.length > this.maxNotifications) {
            const oldest = this.notificationQueue.shift();
            this.removeNotification(oldest.id);
        }
        
        // Add to container
        this.notificationContainer.appendChild(element);
        
        // Animation
        if (this.config.animations.enabled) {
            this.animateIn(element, 'slideInRight');
        }
        
        // Auto close
        if (notification.duration > 0) {
            notification.timer = setTimeout(() => {
                this.removeNotification(notification.id);
            }, notification.duration);
        }
        
        // Emit event
        this.emit('notification:shown', notification);
        
        return notification.id;
    }
    
    createNotificationElement(notification) {
        const element = document.createElement('div');
        element.className = `notification notification-${notification.type}`;
        element.id = notification.id;
        
        // Icon
        const icons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        element.innerHTML = `
            <div class="notification-icon">${icons[notification.type] || ''}</div>
            <div class="notification-content">
                ${notification.title ? `<div class="notification-title">${notification.title}</div>` : ''}
                <div class="notification-message">${notification.message}</div>
                ${notification.actions.length ? `
                    <div class="notification-actions">
                        ${notification.actions.map(action => `
                            <button class="notification-action" data-action="${action.id}">
                                ${action.label}
                            </button>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
            ${notification.closable ? `
                <button class="notification-close" aria-label="Close">×</button>
            ` : ''}
        `;
        
        // Event listeners
        if (notification.closable) {
            element.querySelector('.notification-close').addEventListener('click', () => {
                this.removeNotification(notification.id);
            });
        }
        
        // Action buttons
        notification.actions.forEach(action => {
            const btn = element.querySelector(`[data-action="${action.id}"]`);
            if (btn) {
                btn.addEventListener('click', () => {
                    action.handler();
                    if (action.closeOnClick !== false) {
                        this.removeNotification(notification.id);
                    }
                });
            }
        });
        
        return element;
    }
    
    removeNotification(id) {
        const notification = this.notifications.get(id);
        if (!notification) return;
        
        // Clear timer
        if (notification.timer) {
            clearTimeout(notification.timer);
        }
        
        // Animation
        if (this.config.animations.enabled && notification.element) {
            this.animateOut(notification.element, 'slideOutRight', () => {
                this.finalizeRemoveNotification(notification);
            });
        } else {
            this.finalizeRemoveNotification(notification);
        }
    }
    
    finalizeRemoveNotification(notification) {
        // Remove from DOM
        if (notification.element && notification.element.parentNode) {
            notification.element.parentNode.removeChild(notification.element);
        }
        
        // Remove from queue
        const index = this.notificationQueue.findIndex(n => n.id === notification.id);
        if (index > -1) {
            this.notificationQueue.splice(index, 1);
        }
        
        // Remove from map
        this.notifications.delete(notification.id);
        
        // Emit event
        this.emit('notification:removed', notification);
    }
    
    updateNotificationPosition() {
        const positions = {
            'top-right': { top: '20px', right: '20px' },
            'top-left': { top: '20px', left: '20px' },
            'bottom-right': { bottom: '20px', right: '20px' },
            'bottom-left': { bottom: '20px', left: '20px' }
        };
        
        const pos = positions[this.config.notifications.position] || positions['top-right'];
        Object.assign(this.notificationContainer.style, {
            position: 'fixed',
            zIndex: '1080',
            ...pos
        });
    }
    
    // ===== PANEL SYSTEM =====
    initPanelSystem() {
        // Register all panels
        document.querySelectorAll('.panel').forEach(panel => {
            this.registerPanel(panel);
        });
    }
    
    registerPanel(element) {
        const panel = {
            id: element.id || `panel-${Date.now()}`,
            element: element,
            header: element.querySelector('.panel-header'),
            content: element.querySelector('.panel-content'),
            isCollapsed: false,
            isMaximized: false,
            originalStyles: {},
            resizeObserver: null
        };
        
        // Setup controls
        this.setupPanelControls(panel);
        
        // Setup resize observer
        if (this.config.panels.resizable) {
            this.setupPanelResize(panel);
        }
        
        // Setup draggable (if enabled)
        if (this.config.panels.draggable) {
            this.setupPanelDrag(panel);
        }
        
        this.panels.set(panel.id, panel);
    }
    
    setupPanelControls(panel) {
        // Refresh button
        const refreshBtn = panel.element.querySelector('.refresh-btn');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.refreshPanel(panel.id);
            });
        }
        
        // Expand button
        const expandBtn = panel.element.querySelector('.expand-btn');
        if (expandBtn) {
            expandBtn.addEventListener('click', () => {
                this.togglePanelMaximize(panel.id);
            });
        }
        
        // Collapse functionality
        if (this.config.panels.collapsible && panel.header) {
            panel.header.style.cursor = 'pointer';
            panel.header.addEventListener('dblclick', () => {
                this.togglePanelCollapse(panel.id);
            });
        }
    }
    
    togglePanelCollapse(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;
        
        panel.isCollapsed = !panel.isCollapsed;
        
        if (panel.isCollapsed) {
            // Store original height
            panel.originalHeight = panel.content.offsetHeight;
            
            // Collapse
            panel.content.style.height = '0';
            panel.content.style.overflow = 'hidden';
            panel.element.classList.add('collapsed');
        } else {
            // Restore
            panel.content.style.height = panel.originalHeight + 'px';
            setTimeout(() => {
                panel.content.style.height = '';
                panel.content.style.overflow = '';
            }, this.config.animations.duration);
            panel.element.classList.remove('collapsed');
        }
        
        this.emit('panel:toggled', { id: panelId, collapsed: panel.isCollapsed });
    }
    
    togglePanelMaximize(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;
        
        panel.isMaximized = !panel.isMaximized;
        
        if (panel.isMaximized) {
            // Store original styles
            panel.originalStyles = {
                position: panel.element.style.position,
                top: panel.element.style.top,
                left: panel.element.style.left,
                width: panel.element.style.width,
                height: panel.element.style.height,
                zIndex: panel.element.style.zIndex,
                gridArea: panel.element.style.gridArea
            };
            
            // Maximize
            Object.assign(panel.element.style, {
                position: 'fixed',
                top: '80px',
                left: '0',
                width: '100%',
                height: 'calc(100% - 80px)',
                zIndex: '1000',
                gridArea: 'unset'
            });
            
            panel.element.classList.add('maximized');
        } else {
            // Restore
            Object.assign(panel.element.style, panel.originalStyles);
            panel.element.classList.remove('maximized');
        }
        
        this.emit('panel:maximized', { id: panelId, maximized: panel.isMaximized });
    }
    
    refreshPanel(panelId) {
        const panel = this.panels.get(panelId);
        if (!panel) return;
        
        // Add loading state
        panel.element.classList.add('loading');
        
        // Emit refresh event
        this.emit('panel:refresh', { id: panelId });
        
        // Remove loading state after delay
        setTimeout(() => {
            panel.element.classList.remove('loading');
        }, 1000);
    }
    
    // ===== TOOLTIP SYSTEM =====
    initTooltipSystem() {
        // Create tooltip container
        this.tooltipContainer = document.createElement('div');
        this.tooltipContainer.className = 'tooltip-container';
        this.tooltipContainer.style.cssText = `
            position: absolute;
            z-index: 1070;
            pointer-events: none;
            opacity: 0;
            transition: opacity ${this.config.animations.duration}ms;
        `;
        document.body.appendChild(this.tooltipContainer);
        
        // Setup tooltip triggers
        this.setupTooltipTriggers();
    }
    
    setupTooltipTriggers() {
        // Find all elements with title or data-tooltip
        document.querySelectorAll('[title], [data-tooltip]').forEach(element => {
            const content = element.getAttribute('title') || element.getAttribute('data-tooltip');
            
            if (content) {
                // Remove title to prevent default tooltip
                if (element.hasAttribute('title')) {
                    element.setAttribute('data-tooltip', content);
                    element.removeAttribute('title');
                }
                
                // Register tooltip
                this.registerTooltip(element, content);
            }
        });
    }
    
    registerTooltip(element, content, options = {}) {
        const tooltip = {
            element: element,
            content: content,
            options: { ...this.config.tooltips, ...options },
            timeout: null
        };
        
        // Mouse events
        element.addEventListener('mouseenter', () => this.showTooltip(tooltip));
        element.addEventListener('mouseleave', () => this.hideTooltip());
        element.addEventListener('focus', () => this.showTooltip(tooltip));
        element.addEventListener('blur', () => this.hideTooltip());
        
        this.tooltips.set(element, tooltip);
    }
    
    showTooltip(tooltip) {
        // Clear any existing timeout
        if (this.activeTooltip && this.activeTooltip.timeout) {
            clearTimeout(this.activeTooltip.timeout);
        }
        
        this.activeTooltip = tooltip;
        
        // Delay show
        tooltip.timeout = setTimeout(() => {
            this.tooltipContainer.innerHTML = `
                <div class="tooltip-content">${tooltip.content}</div>
                ${tooltip.options.arrow ? '<div class="tooltip-arrow"></div>' : ''}
            `;
            
            // Position tooltip
            this.positionTooltip(tooltip);
            
            // Show
            this.tooltipContainer.style.opacity = '1';
        }, tooltip.options.delay);
    }
    
    hideTooltip() {
        if (this.activeTooltip && this.activeTooltip.timeout) {
            clearTimeout(this.activeTooltip.timeout);
        }
        
        this.tooltipContainer.style.opacity = '0';
        this.activeTooltip = null;
    }
    
    positionTooltip(tooltip) {
        const rect = tooltip.element.getBoundingClientRect();
        const tooltipRect = this.tooltipContainer.getBoundingClientRect();
        
        // Default position: above center
        let top = rect.top - tooltipRect.height - tooltip.options.offset;
        let left = rect.left + (rect.width - tooltipRect.width) / 2;
        
        // Adjust if out of bounds
        if (top < 0) {
            // Position below
            top = rect.bottom + tooltip.options.offset;
            this.tooltipContainer.classList.add('tooltip-bottom');
        } else {
            this.tooltipContainer.classList.remove('tooltip-bottom');
        }
        
        if (left < 0) {
            left = tooltip.options.offset;
        } else if (left + tooltipRect.width > window.innerWidth) {
            left = window.innerWidth - tooltipRect.width - tooltip.options.offset;
        }
        
        this.tooltipContainer.style.top = top + 'px';
        this.tooltipContainer.style.left = left + 'px';
    }
    
    // ===== CONTEXT MENU SYSTEM =====
    initContextMenuSystem() {
        // Create context menu container
        this.contextMenuContainer = document.createElement('div');
        this.contextMenuContainer.className = 'context-menu';
        this.contextMenuContainer.style.display = 'none';
        document.body.appendChild(this.contextMenuContainer);
        
        // Global click to close
        document.addEventListener('click', () => this.hideContextMenu());
        
        // Prevent default context menu on registered elements
        document.addEventListener('contextmenu', (e) => {
            const target = e.target.closest('[data-context-menu]');
            if (target) {
                e.preventDefault();
                this.showContextMenu(e, target.getAttribute('data-context-menu'));
            }
        });
    }
    
    registerContextMenu(id, items) {
        this.contextMenus.set(id, items);
    }
    
    showContextMenu(event, menuId) {
        const items = this.contextMenus.get(menuId);
        if (!items) return;
        
        // Build menu
        this.contextMenuContainer.innerHTML = items.map(item => {
            if (item.separator) {
                return '<div class="context-menu-separator"></div>';
            }
            
            return `
                <div class="context-menu-item ${item.disabled ? 'disabled' : ''}" 
                     data-action="${item.action}">
                    ${item.icon ? `<span class="context-menu-icon">${item.icon}</span>` : ''}
                    <span class="context-menu-label">${item.label}</span>
                    ${item.shortcut ? `<span class="context-menu-shortcut">${item.shortcut}</span>` : ''}
                </div>
            `;
        }).join('');
        
        // Add click handlers
        this.contextMenuContainer.querySelectorAll('.context-menu-item:not(.disabled)').forEach(el => {
            el.addEventListener('click', () => {
                const action = el.getAttribute('data-action');
                const item = items.find(i => i.action === action);
                if (item && item.handler) {
                    item.handler();
                }
                this.hideContextMenu();
            });
        });
        
        // Position and show
        const x = event.clientX;
        const y = event.clientY;
        
        this.contextMenuContainer.style.display = 'block';
        const rect = this.contextMenuContainer.getBoundingClientRect();
        
        // Adjust position if out of bounds
        const finalX = x + rect.width > window.innerWidth ? x - rect.width : x;
        const finalY = y + rect.height > window.innerHeight ? y - rect.height : y;
        
        this.contextMenuContainer.style.left = finalX + 'px';
        this.contextMenuContainer.style.top = finalY + 'px';
        
        // Add show class for animation
        setTimeout(() => this.contextMenuContainer.classList.add('show'), 10);
        
        this.activeContextMenu = menuId;
    }
    
    hideContextMenu() {
        this.contextMenuContainer.classList.remove('show');
        setTimeout(() => {
            this.contextMenuContainer.style.display = 'none';
        }, this.config.animations.duration);
        this.activeContextMenu = null;
    }
    
    // ===== TAB SYSTEM =====
    initTabSystem() {
        // Find all tab containers
        document.querySelectorAll('.tabs, [role="tablist"]').forEach(container => {
            this.setupTabs(container);
        });
    }
    
    setupTabs(container) {
        const tabs = container.querySelectorAll('[role="tab"]');
        const panels = [];
        
        tabs.forEach(tab => {
            const panelId = tab.getAttribute('aria-controls');
            const panel = document.getElementById(panelId);
            if (panel) {
                panels.push(panel);
            }
            
            // Click handler
            tab.addEventListener('click', () => {
                this.activateTab(container, tab);
            });
            
            // Keyboard navigation
            tab.addEventListener('keydown', (e) => {
                this.handleTabKeyboard(e, container, tabs);
            });
        });
        
        // Store tab group
        this.tabs.set(container, { tabs, panels });
    }
    
    activateTab(container, activeTab) {
        const tabGroup = this.tabs.get(container);
        if (!tabGroup) return;
        
        // Deactivate all tabs
        tabGroup.tabs.forEach(tab => {
            tab.classList.remove('active');
            tab.setAttribute('aria-selected', 'false');
            tab.setAttribute('tabindex', '-1');
        });
        
        // Activate selected tab
        activeTab.classList.add('active');
        activeTab.setAttribute('aria-selected', 'true');
        activeTab.setAttribute('tabindex', '0');
        activeTab.focus();
        
        // Show corresponding panel
        const panelId = activeTab.getAttribute('aria-controls');
        tabGroup.panels.forEach(panel => {
            if (panel.id === panelId) {
                panel.classList.add('active');
                panel.removeAttribute('hidden');
            } else {
                panel.classList.remove('active');
                panel.setAttribute('hidden', '');
            }
        });
        
        // Emit event
        this.emit('tab:changed', { 
            container: container,
            tab: activeTab,
            panelId: panelId 
        });
    }
    
    handleTabKeyboard(event, container, tabs) {
        const currentIndex = Array.from(tabs).indexOf(event.target);
        let newIndex;
        
        switch(event.key) {
            case 'ArrowLeft':
            case 'ArrowUp':
                event.preventDefault();
                newIndex = currentIndex - 1;
                if (newIndex < 0) newIndex = tabs.length - 1;
                this.activateTab(container, tabs[newIndex]);
                break;
                
            case 'ArrowRight':
            case 'ArrowDown':
                event.preventDefault();
                newIndex = currentIndex + 1;
                if (newIndex >= tabs.length) newIndex = 0;
                this.activateTab(container, tabs[newIndex]);
                break;
                
            case 'Home':
                event.preventDefault();
                this.activateTab(container, tabs[0]);
                break;
                
            case 'End':
                event.preventDefault();
                this.activateTab(container, tabs[tabs.length - 1]);
                break;
        }
    }
    
    // ===== ANIMATION SYSTEM =====
    animateIn(element, animation) {
        element.classList.add('animate-in', animation);
        
        const duration = this.config.animations.duration;
        setTimeout(() => {
            element.classList.remove('animate-in', animation);
        }, duration);
    }
    
    animateOut(element, animation, callback) {
        element.classList.add('animate-out', animation);
        
        const duration = this.config.animations.duration;
        setTimeout(() => {
            element.classList.remove('animate-out', animation);
            if (callback) callback();
        }, duration);
    }
    
    // ===== SEARCH & FILTER =====
    setupSearchInput(inputElement, targetElements, options = {}) {
        const config = {
            searchIn: ['textContent'],
            highlight: true,
            minLength: 1,
            debounce: 300,
            noResultsMessage: '검색 결과가 없습니다',
            ...options
        };
        
        let debounceTimer;
        
        inputElement.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                this.performSearch(e.target.value, targetElements, config);
            }, config.debounce);
        });
        
        // Clear button
        const clearBtn = document.createElement('button');
        clearBtn.className = 'search-clear';
        clearBtn.innerHTML = '×';
        clearBtn.style.display = 'none';
        clearBtn.addEventListener('click', () => {
            inputElement.value = '';
            this.performSearch('', targetElements, config);
            clearBtn.style.display = 'none';
        });
        
        inputElement.parentNode.style.position = 'relative';
        inputElement.parentNode.appendChild(clearBtn);
        
        // Show/hide clear button
        inputElement.addEventListener('input', (e) => {
            clearBtn.style.display = e.target.value ? 'block' : 'none';
        });
    }
    
    performSearch(query, elements, config) {
        const searchTerm = query.toLowerCase().trim();
        
        if (searchTerm.length < config.minLength) {
            // Show all elements
            elements.forEach(el => {
                el.style.display = '';
                if (config.highlight) {
                    this.removeHighlight(el);
                }
            });
            return;
        }
        
        let hasResults = false;
        
        elements.forEach(el => {
            let found = false;
            
            config.searchIn.forEach(prop => {
                const content = el[prop] || el.getAttribute(prop) || '';
                if (content.toLowerCase().includes(searchTerm)) {
                    found = true;
                }
            });
            
            if (found) {
                hasResults = true;
                el.style.display = '';
                if (config.highlight) {
                    this.highlightText(el, searchTerm);
                }
            } else {
                el.style.display = 'none';
            }
        });
        
        // Show no results message
        if (!hasResults && config.noResultsMessage) {
            this.showNoResults(elements[0].parentNode, config.noResultsMessage);
        } else {
            this.hideNoResults(elements[0].parentNode);
        }
        
        // Emit search event
        this.emit('search:performed', { query, hasResults });
    }
    
    highlightText(element, searchTerm) {
        const regex = new RegExp(`(${searchTerm})`, 'gi');
        const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );
        
        const textNodes = [];
        let node;
        
        while (node = walker.nextNode()) {
            textNodes.push(node);
        }
        
        textNodes.forEach(textNode => {
            const matches = textNode.textContent.match(regex);
            if (matches) {
                const span = document.createElement('span');
                span.innerHTML = textNode.textContent.replace(regex, '<mark>$1</mark>');
                textNode.parentNode.replaceChild(span, textNode);
            }
        });
    }
    
    removeHighlight(element) {
        element.querySelectorAll('mark').forEach(mark => {
            const parent = mark.parentNode;
            parent.replaceChild(document.createTextNode(mark.textContent), mark);
            parent.normalize();
        });
    }
    
    // ===== LOADING STATES =====
    showLoading(element, options = {}) {
        const config = {
            type: 'spinner',
            text: 'Loading...',
            overlay: true,
            ...options
        };
        
        element.classList.add('loading');
        
        if (config.overlay) {
            const overlay = document.createElement('div');
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    ${config.type === 'spinner' ? '<div class="spinner"></div>' : ''}
                    ${config.type === 'skeleton' ? '<div class="skeleton"></div>' : ''}
                    ${config.text ? `<div class="loading-text">${config.text}</div>` : ''}
                </div>
            `;
            element.appendChild(overlay);
            element._loadingOverlay = overlay;
        }
    }
    
    hideLoading(element) {
        element.classList.remove('loading');
        if (element._loadingOverlay) {
            element._loadingOverlay.remove();
            delete element._loadingOverlay;
        }
    }
    
    // ===== PROGRESS INDICATORS =====
    createProgressBar(options = {}) {
        const config = {
            min: 0,
            max: 100,
            value: 0,
            label: '',
            showPercent: true,
            animated: true,
            ...options
        };
        
        const container = document.createElement('div');
        container.className = 'progress-container';
        container.innerHTML = `
            ${config.label ? `<div class="progress-label">${config.label}</div>` : ''}
            <div class="progress-bar" role="progressbar" 
                 aria-valuenow="${config.value}" 
                 aria-valuemin="${config.min}" 
                 aria-valuemax="${config.max}">
                <div class="progress-fill" style="width: ${config.value}%">
                    ${config.showPercent ? `<span class="progress-text">${config.value}%</span>` : ''}
                </div>
            </div>
        `;
        
        const progressBar = {
            container: container,
            bar: container.querySelector('.progress-bar'),
            fill: container.querySelector('.progress-fill'),
            text: container.querySelector('.progress-text'),
            config: config
        };
        
        return {
            element: container,
            update: (value) => this.updateProgressBar(progressBar, value),
            destroy: () => container.remove()
        };
    }
    
    updateProgressBar(progressBar, value) {
        const percent = ((value - progressBar.config.min) / 
                        (progressBar.config.max - progressBar.config.min)) * 100;
        
        progressBar.fill.style.width = percent + '%';
        progressBar.bar.setAttribute('aria-valuenow', value);
        
        if (progressBar.text) {
            progressBar.text.textContent = Math.round(percent) + '%';
        }
        
        // Color based on value
        if (percent < 30) {
            progressBar.fill.classList.add('progress-danger');
        } else if (percent < 70) {
            progressBar.fill.classList.add('progress-warning');
        } else {
            progressBar.fill.classList.add('progress-success');
        }
    }
    
    // ===== VIRTUAL SCROLLING =====
    createVirtualScroller(container, items, options = {}) {
        const config = {
            itemHeight: 40,
            buffer: 5,
            renderItem: (item) => `<div>${item}</div>`,
            ...options
        };
        
        const scroller = {
            container: container,
            items: items,
            config: config,
            scrollTop: 0,
            visibleStart: 0,
            visibleEnd: 0,
            displayItems: []
        };
        
        // Create viewport
        const viewport = document.createElement('div');
        viewport.className = 'virtual-viewport';
        viewport.style.height = '100%';
        viewport.style.overflow = 'auto';
        
        // Create spacer
        const spacer = document.createElement('div');
        spacer.style.height = items.length * config.itemHeight + 'px';
        
        // Create content
        const content = document.createElement('div');
        content.className = 'virtual-content';
        content.style.position = 'absolute';
        content.style.top = '0';
        content.style.left = '0';
        content.style.right = '0';
        
        viewport.appendChild(spacer);
        viewport.appendChild(content);
        container.appendChild(viewport);
        
        // Scroll handler
        viewport.addEventListener('scroll', () => {
            this.updateVirtualScroller(scroller, viewport, content);
        });
        
        // Initial render
        this.updateVirtualScroller(scroller, viewport, content);
        
        return {
            update: (newItems) => {
                scroller.items = newItems;
                spacer.style.height = newItems.length * config.itemHeight + 'px';
                this.updateVirtualScroller(scroller, viewport, content);
            },
            destroy: () => viewport.remove()
        };
    }
    
    updateVirtualScroller(scroller, viewport, content) {
        const scrollTop = viewport.scrollTop;
        const viewportHeight = viewport.clientHeight;
        
        const visibleStart = Math.floor(scrollTop / scroller.config.itemHeight);
        const visibleEnd = Math.ceil((scrollTop + viewportHeight) / scroller.config.itemHeight);
        
        const displayStart = Math.max(0, visibleStart - scroller.config.buffer);
        const displayEnd = Math.min(scroller.items.length, visibleEnd + scroller.config.buffer);
        
        // Only update if range changed
        if (displayStart !== scroller.visibleStart || displayEnd !== scroller.visibleEnd) {
            scroller.visibleStart = displayStart;
            scroller.visibleEnd = displayEnd;
            
            // Render items
            const html = [];
            for (let i = displayStart; i < displayEnd; i++) {
                const item = scroller.items[i];
                const top = i * scroller.config.itemHeight;
                html.push(`
                    <div style="position: absolute; top: ${top}px; height: ${scroller.config.itemHeight}px;">
                        ${scroller.config.renderItem(item, i)}
                    </div>
                `);
            }
            
            content.innerHTML = html.join('');
        }
    }
    
    // ===== DRAG & DROP =====
    enableDragDrop(container, options = {}) {
        const config = {
            draggable: '.draggable',
            handle: null,
            dropzone: '.dropzone',
            ghostClass: 'dragging',
            dragClass: 'drag-over',
            onStart: null,
            onEnd: null,
            onDrop: null,
            ...options
        };
        
        let draggedElement = null;
        
        // Make elements draggable
        container.querySelectorAll(config.draggable).forEach(el => {
            el.draggable = true;
            
            el.addEventListener('dragstart', (e) => {
                draggedElement = el;
                el.classList.add(config.ghostClass);
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/html', el.innerHTML);
                
                if (config.onStart) config.onStart(el);
            });
            
            el.addEventListener('dragend', (e) => {
                el.classList.remove(config.ghostClass);
                
                // Remove all drag-over classes
                container.querySelectorAll('.' + config.dragClass).forEach(zone => {
                    zone.classList.remove(config.dragClass);
                });
                
                if (config.onEnd) config.onEnd(el);
            });
        });
        
        // Setup dropzones
        container.querySelectorAll(config.dropzone).forEach(zone => {
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                zone.classList.add(config.dragClass);
            });
            
            zone.addEventListener('dragleave', (e) => {
                if (e.target === zone) {
                    zone.classList.remove(config.dragClass);
                }
            });
            
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                zone.classList.remove(config.dragClass);
                
                if (draggedElement && config.onDrop) {
                    config.onDrop(draggedElement, zone);
                }
            });
        });
    }
    
    // ===== KEYBOARD SHORTCUTS =====
    setupKeyboardShortcuts() {
        const shortcuts = {
            'Escape': () => {
                if (this.activeModal) {
                    this.closeModal(this.activeModal);
                } else if (this.activeContextMenu) {
                    this.hideContextMenu();
                }
            },
            'F1': (e) => {
                e.preventDefault();
                this.openModal('keyboard-help');
            }
        };
        
        document.addEventListener('keydown', (e) => {
            const key = e.key;
            const handler = shortcuts[key];
            
            if (handler) {
                handler(e);
            }
        });
    }
    
    // ===== UTILITY FUNCTIONS =====
    setupGlobalListeners() {
        // Window resize
        let resizeTimer;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => {
                this.emit('window:resized');
                
                // Update components that need repositioning
                if (this.activeTooltip) {
                    this.positionTooltip(this.activeTooltip);
                }
            }, 250);
        });
        
        // Visibility change
        document.addEventListener('visibilitychange', () => {
            this.emit('visibility:changed', { hidden: document.hidden });
        });
    }
    
    trapFocus(container) {
        const focusableElements = container.querySelectorAll(
            'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select'
        );
        
        const firstFocusable = focusableElements[0];
        const lastFocusable = focusableElements[focusableElements.length - 1];
        
        container.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                if (e.shiftKey) {
                    if (document.activeElement === firstFocusable) {
                        lastFocusable.focus();
                        e.preventDefault();
                    }
                } else {
                    if (document.activeElement === lastFocusable) {
                        firstFocusable.focus();
                        e.preventDefault();
                    }
                }
            }
        });
        
        // Focus first element
        if (firstFocusable) {
            firstFocusable.focus();
        }
    }
    
    restoreFocus() {
        // Restore focus to previously focused element
        if (this._previousFocus && this._previousFocus.focus) {
            this._previousFocus.focus();
        }
    }
    
    showNoResults(container, message) {
        let noResults = container.querySelector('.no-results');
        if (!noResults) {
            noResults = document.createElement('div');
            noResults.className = 'no-results';
            container.appendChild(noResults);
        }
        noResults.textContent = message;
        noResults.style.display = 'block';
    }
    
    hideNoResults(container) {
        const noResults = container.querySelector('.no-results');
        if (noResults) {
            noResults.style.display = 'none';
        }
    }
    
    // ===== STATE MANAGEMENT =====
    saveUIStates() {
        const states = {
            panels: {},
            theme: this.theme,
            notifications: {
                position: this.config.notifications.position
            }
        };
        
        // Save panel states
        this.panels.forEach((panel, id) => {
            states.panels[id] = {
                collapsed: panel.isCollapsed,
                maximized: panel.isMaximized
            };
        });
        
        localStorage.setItem('tradingbot-ui-states', JSON.stringify(states));
    }
    
    loadUIStates() {
        try {
            const states = JSON.parse(localStorage.getItem('tradingbot-ui-states') || '{}');
            
            // Restore theme
            if (states.theme) {
                this.setTheme(states.theme);
            }
            
            // Restore panel states
            if (states.panels) {
                Object.entries(states.panels).forEach(([id, state]) => {
                    const panel = this.panels.get(id);
                    if (panel) {
                        if (state.collapsed) {
                            this.togglePanelCollapse(id);
                        }
                        if (state.maximized) {
                            this.togglePanelMaximize(id);
                        }
                    }
                });
            }
            
        } catch (error) {
            console.error('Failed to load UI states:', error);
        }
    }
    
    // ===== THEME MANAGEMENT =====
    setTheme(theme) {
        this.theme = theme;
        document.documentElement.setAttribute('data-theme', theme);
        
        // Update theme-specific styles
        if (theme === 'light') {
            document.documentElement.classList.add('light-theme');
            document.documentElement.classList.remove('dark-theme');
        } else {
            document.documentElement.classList.add('dark-theme');
            document.documentElement.classList.remove('light-theme');
        }
        
        this.emit('theme:changed', { theme });
        this.saveUIStates();
    }
    
    toggleTheme() {
        this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
    }
    
    // ===== PUBLIC API =====
    alert(message, type = 'info') {
        return this.showNotification({
            type: type,
            message: message,
            duration: 5000
        });
    }
    
    confirm(message, onConfirm, onCancel) {
        return this.showNotification({
            type: 'warning',
            message: message,
            duration: 0,
            actions: [
                {
                    id: 'confirm',
                    label: '확인',
                    handler: onConfirm
                },
                {
                    id: 'cancel',
                    label: '취소',
                    handler: onCancel || (() => {})
                }
            ]
        });
    }
    
    loading(show = true, target = document.body, options = {}) {
        if (show) {
            this.showLoading(target, options);
        } else {
            this.hideLoading(target);
        }
    }
    
    // ===== CLEANUP =====
    destroy() {
        // Remove event listeners
        this.removeAllListeners();
        
        // Remove created elements
        if (this.notificationContainer) this.notificationContainer.remove();
        if (this.tooltipContainer) this.tooltipContainer.remove();
        if (this.contextMenuContainer) this.contextMenuContainer.remove();
        
        // Clear timeouts
        this.notifications.forEach(n => {
            if (n.timer) clearTimeout(n.timer);
        });
        
        // Clear maps
        this.modals.clear();
        this.notifications.clear();
        this.panels.clear();
        this.tooltips.clear();
        this.contextMenus.clear();
        this.tabs.clear();
        this.animations.clear();
    }
}

export default UIComponents;