/**
 * ApexBank Core Ledger — Orchestration Script
 * Connects UI interactions, investment wizard steps, asset vault, 
 * merchant authorization gate, real-time cloud node auto-scaling,
 * and the Apex AI Wealth Advisor chatbot.
 */

import { CloudSimulator } from './modules/simulator.js';
import { verifyFareIntegrity, checkInPass, resetLedger } from './modules/security.js';
import { ROUTES, generateBusSeats, computeTicketPrice, createBusPass } from './modules/booking.js';
import { ApexChatbot } from './modules/chatbot.js';
import { initDatabase, executeQuery, decryptAES256, databaseState } from './modules/sqlEngine.js';

// Application State
let activeTab = 'booking-tab';
let bookingWizardState = {
    step: 1,
    selectedRoute: null,
    selectedSeat: null,
    ticketClass: 'economy',
    passengerName: '',
    passengerEmail: '',
    estimatedPrice: 0.00
};

let userWallet = [];
let simulator = null;
let currentSeatMap = [];
let chatbot = null;

// Initialize DOM Nodes
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Load local storage wallet database
    loadWallet();

    // 1. Initialize Cloud Simulator
    simulator = new CloudSimulator(updateClusterUi, appendTerminalLog);
    simulator.start();

    // 2. Wire Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // 3. Render Portfolio Cards (Step 1)
    renderRoutesList();

    // 4. Set up Investment Wizard Event Handlers
    document.getElementById('ticket-class').addEventListener('change', (e) => {
        bookingWizardState.ticketClass = e.target.value;
        updateLiveFares();
    });

    document.getElementById('schedule-date').valueAsDate = new Date();
    document.getElementById('schedule-date').addEventListener('change', () => {
        updateLiveFares();
    });

    document.getElementById('btn-next-step-1').addEventListener('click', () => {
        goToWizardStep(2);
    });

    document.getElementById('btn-back-step-2').addEventListener('click', () => {
        goToWizardStep(1);
    });

    document.getElementById('btn-next-step-2').addEventListener('click', () => {
        const name = document.getElementById('passenger-name').value.trim();
        const email = document.getElementById('passenger-email').value.trim();
        
        if (!name || !email) {
            showToast("Please enter account holder details.", "warning");
            return;
        }

        if (!bookingWizardState.selectedSeat) {
            showToast("Please select a risk tranche block.", "warning");
            return;
        }

        bookingWizardState.passengerName = name;
        bookingWizardState.passengerEmail = email;

        // Render Step 3 summary
        const portfolioObj = ROUTES.find(r => r.id === bookingWizardState.selectedRoute);
        document.getElementById('final-passenger-name').textContent = name;
        document.getElementById('final-route-name').textContent = `${portfolioObj.from} → ${portfolioObj.to}`;
        document.getElementById('final-seat-number').textContent = `Tranche Block #${bookingWizardState.selectedSeat}`;
        document.getElementById('final-class-option').textContent = document.getElementById('ticket-class').options[document.getElementById('ticket-class').selectedIndex].text;
        
        // Dynamic pricing validation prep
        let checkoutPrice = bookingWizardState.estimatedPrice;
        const hackToggle = document.getElementById('hacker-price-manipulate');
        if (hackToggle.checked) {
            checkoutPrice = 1.00; // Override price to simulate client-side tampering
        }
        document.getElementById('final-fare-price').textContent = `$${checkoutPrice.toFixed(2)}`;

        goToWizardStep(3);
    });

    document.getElementById('btn-back-step-3').addEventListener('click', () => {
        goToWizardStep(2);
    });

    document.getElementById('btn-confirm-checkout').addEventListener('click', () => {
        processSecureCheckout();
    });

    // 5. Wire Simulator Slider & Controls
    const rpsSlider = document.getElementById('input-rps-slider');
    const rpsLabel = document.getElementById('label-rps-value');
    
    rpsSlider.addEventListener('input', (e) => {
        const val = e.target.value;
        rpsLabel.textContent = `${val} RPS`;
        simulator.setTargetRps(val);
    });

    document.querySelectorAll('.btn-preset').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const clickedBtn = e.target.closest('.btn-preset');
            if (!clickedBtn || !clickedBtn.dataset.preset) return;
            document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            clickedBtn.classList.add('active');
            
            const preset = clickedBtn.dataset.preset;
            simulator.setPreset(preset);
            
            const snapshot = simulator.getSnapshot();
            rpsSlider.value = snapshot.targetRps;
            rpsLabel.textContent = `${snapshot.targetRps} RPS`;
        });
    });

    document.getElementById('btn-clear-logs').addEventListener('click', () => {
        document.getElementById('terminal-logs-view').innerHTML = '';
    });

    // 6. Transfer Authorization Gate Wires
    document.getElementById('btn-scan-trigger').addEventListener('click', () => {
        triggerScannerVerification();
    });

    document.getElementById('scanner-select-ticket').addEventListener('change', (e) => {
        const hasTicket = e.target.value !== "";
        document.getElementById('btn-scan-trigger').disabled = !hasTicket;
    });

    // 7. Watch fields to validate button states
    const checkStep2Progress = () => {
        const name = document.getElementById('passenger-name').value.trim();
        const email = document.getElementById('passenger-email').value.trim();
        const seat = bookingWizardState.selectedSeat;
        document.getElementById('btn-next-step-2').disabled = !(name && email && seat);
    };

    document.getElementById('passenger-name').addEventListener('input', checkStep2Progress);
    document.getElementById('passenger-email').addEventListener('input', checkStep2Progress);

    // 8. Initial Vault Draw & Scan options
    renderWalletUI();
    populateScannerOptions();

    // 9. Expose global control hooks for Apex AI chatbot
    exposeApexBankControls();

    // 10. Initialize Apex AI Chatbot
    initChatbot();

    // 11. Initialize Task 2: SQL Injection Shield Simulator
    initSqlShieldTab();
}

/**
 * Expose a global bridge for the chatbot to interact with the dashboard
 */
function exposeApexBankControls() {
    window.ApexBankControls = {
        switchTab: (tabId) => switchTab(tabId),

        selectPortfolio: (routeId) => {
            const card = document.querySelector(`.route-card[data-id="${routeId}"]`);
            if (card) {
                card.click();
                card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        },

        autofillPassenger: (name, email) => {
            const nameEl = document.getElementById('passenger-name');
            const emailEl = document.getElementById('passenger-email');
            if (nameEl) nameEl.value = name;
            if (emailEl) emailEl.value = email;
            // Trigger validation check
            const evt = new Event('input');
            nameEl.dispatchEvent(evt);
            emailEl.dispatchEvent(evt);
        },

        setTrafficPreset: (preset) => {
            // Click the matching preset button
            const btn = document.querySelector(`.btn-preset[data-preset="${preset}"]`);
            if (btn) {
                btn.click();
            } else {
                simulator.setPreset(preset);
                const snapshot = simulator.getSnapshot();
                document.getElementById('input-rps-slider').value = snapshot.targetRps;
                document.getElementById('label-rps-value').textContent = `${snapshot.targetRps} RPS`;
            }
        },

        clearLogs: () => {
            document.getElementById('terminal-logs-view').innerHTML = '';
        },

        resetLedger: () => {
            resetLedger();
            showToast("Core ledger transaction cache cleared. Ready for fresh verification.", "success");
            appendTerminalLog("Ledger-DB", "ADMIN: Transaction verification ledger reset. Double-spend cache flushed.", "acc");
        },

        // Task 2 hooks
        setSqlPolicy: (policy, active) => {
            const el = document.getElementById(policy === 'waf' ? 'sql-policy-waf' : 'sql-policy-prepare');
            if (el) {
                el.checked = active;
                appendSqlLog("CLIENT", `System policy modified via API: ${policy.toUpperCase()} = ${active ? 'ACTIVE' : 'INACTIVE'}`);
            }
        },

        loadSqlPreset: (preset) => {
            const select = document.getElementById('sql-payload-preset');
            if (select) {
                select.value = preset;
                const evt = new Event('change');
                select.dispatchEvent(evt);
            }
        },

        runSqlSandbox: async (searchVal) => {
            const input = document.getElementById('sql-search-input');
            if (input) {
                input.value = searchVal;
                await handleSqlSandboxQuery();
            }
        }
    };
}

/**
 * Initialize the Apex AI Chatbot widget
 */
function initChatbot() {
    const toggleBtn = document.getElementById('chatbot-toggle-btn');
    const closeBtn = document.getElementById('chatbot-close-btn');
    const chatWindow = document.getElementById('chatbot-window');
    const sendBtn = document.getElementById('chatbot-send-btn');
    const inputField = document.getElementById('chatbot-input');
    const messagesContainer = document.getElementById('chatbot-messages');
    const suggestionsContainer = document.getElementById('chatbot-suggestions');

    chatbot = new ApexChatbot({
        messagesContainer,
        suggestionsContainer,
        inputField
    });

    // Open/Close chatbot window
    toggleBtn.addEventListener('click', () => {
        const isOpen = chatWindow.classList.toggle('open');
        if (isOpen && chatbot.chatHistory.length === 0) {
            chatbot.init();
        }
        // Hide notification dot when opened
        if (isOpen) {
            toggleBtn.style.setProperty('--dot-display', 'none');
            toggleBtn.classList.add('no-dot');
        }
    });

    closeBtn.addEventListener('click', () => {
        chatWindow.classList.remove('open');
    });

    // Send message on button click
    sendBtn.addEventListener('click', () => {
        const text = inputField.value.trim();
        if (text) chatbot.handleUserInput(text);
    });

    // Send message on Enter key
    inputField.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const text = inputField.value.trim();
            if (text) chatbot.handleUserInput(text);
        }
    });
}

/**
 * Navigation tab switching
 */
function switchTab(tabId) {
    activeTab = tabId;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    document.querySelectorAll('.tab-content').forEach(pane => {
        pane.classList.toggle('active', pane.id === tabId);
    });

    if (tabId === 'wallet-tab') {
        renderWalletUI();
    } else if (tabId === 'scanner-tab') {
        populateScannerOptions();
    }
}

/**
 * Step Navigation inside Investment Wizard
 */
function goToWizardStep(stepNumber) {
    bookingWizardState.step = stepNumber;
    
    document.querySelectorAll('.wizard-step-pane').forEach(pane => {
        pane.style.display = 'none';
    });

    document.getElementById(`wizard-pane-${stepNumber}`).style.display = 'block';

    for (let i = 1; i <= 3; i++) {
        const ind = document.getElementById(`indicator-step-${i}`);
        ind.classList.remove('active', 'completed');
        
        if (i < stepNumber) {
            ind.classList.add('completed');
        } else if (i === stepNumber) {
            ind.classList.add('active');
        }
    }
}

/**
 * Render the list of investment portfolio cards in Step 1
 */
function renderRoutesList() {
    const container = document.getElementById('routes-selector-container');
    container.innerHTML = '';

    ROUTES.forEach(route => {
        const card = document.createElement('div');
        card.className = 'route-card';
        card.dataset.id = route.id;
        
        const snapshot = simulator ? simulator.getSnapshot() : { metrics: { avgCpu: 0 } };
        const occupancy = Math.min(0.9, (snapshot.metrics.avgCpu / 120) + 0.2);
        const pricing = computeTicketPrice(route.id, bookingWizardState.ticketClass, occupancy);

        card.innerHTML = `
            <div class="route-info">
                <span class="route-title">${route.from} &rarr; ${route.to}</span>
                <div class="route-details">
                    <span>
                        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        Yield: ${route.duration}
                    </span>
                    <span>
                        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z"/></svg>
                        Ledger ID: ${route.id}
                    </span>
                </div>
            </div>
            <div class="route-price-tag">
                <span class="route-fare" id="fare-val-${route.id}">$${pricing.toFixed(2)}</span>
                <span class="route-availability">Verified Portfolio</span>
            </div>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            bookingWizardState.selectedRoute = route.id;
            document.getElementById('btn-next-step-1').disabled = false;
            
            buildSeatLayout(route.id);
            updateLiveFares();
        });

        container.appendChild(card);
    });
}

/**
 * Dynamically update portfolio investment fees as CPU/load changes
 */
function updateLiveFares() {
    const snapshot = simulator ? simulator.getSnapshot() : { metrics: { avgCpu: 0 } };
    const occupancy = Math.min(0.9, (snapshot.metrics.avgCpu / 125) + 0.2);

    ROUTES.forEach(route => {
        const textNode = document.getElementById(`fare-val-${route.id}`);
        if (textNode) {
            const pricing = computeTicketPrice(route.id, bookingWizardState.ticketClass, occupancy);
            textNode.textContent = `$${pricing.toFixed(2)}`;
        }
    });

    if (bookingWizardState.selectedRoute) {
        const routeObj = ROUTES.find(r => r.id === bookingWizardState.selectedRoute);
        const finalPrice = computeTicketPrice(routeObj.id, bookingWizardState.ticketClass, occupancy);
        bookingWizardState.estimatedPrice = finalPrice;

        document.getElementById('summary-base-fare').textContent = `$${routeObj.baseFare.toFixed(2)}`;
        
        let premiumStr = "1.0 (Standard)";
        if (bookingWizardState.ticketClass === 'luxury-ac') premiumStr = "1.5 (Gold Premium)";
        else if (bookingWizardState.ticketClass === 'sleeper') premiumStr = "1.8 (Institutional VIP)";
        document.getElementById('summary-class-premium').textContent = `x ${premiumStr}`;
        
        let surgeStr = "1.00 (Normal Volume)";
        if (occupancy >= 0.8) surgeStr = "1.40 (Critical Volume Surge)";
        else if (occupancy >= 0.5) surgeStr = "1.15 (Moderate Surge)";
        document.getElementById('summary-surge-multiplier').textContent = `x ${surgeStr}`;

        document.getElementById('summary-total-fare').textContent = `$${finalPrice.toFixed(2)}`;
    }
}

/**
 * Load risk tranche block grid for Step 2
 */
function buildSeatLayout(routeId) {
    const container = document.getElementById('bus-seats-container');
    container.innerHTML = '';
    
    currentSeatMap = generateBusSeats(routeId, 40);
    bookingWizardState.selectedSeat = null;

    currentSeatMap.forEach(seat => {
        const el = document.createElement('div');
        el.className = `seat ${seat.status}`;
        el.textContent = seat.number;
        
        if (seat.status === 'available') {
            el.addEventListener('click', () => {
                document.querySelectorAll('.seat.selected').forEach(s => s.classList.remove('selected'));
                el.classList.add('selected');
                bookingWizardState.selectedSeat = seat.number;
                
                const name = document.getElementById('passenger-name').value.trim();
                const email = document.getElementById('passenger-email').value.trim();
                document.getElementById('btn-next-step-2').disabled = !(name && email && bookingWizardState.selectedSeat);
            });
        }

        container.appendChild(el);
    });
}

/**
 * Handle secure checkout submission with ledger fare integrity verification
 */
async function processSecureCheckout() {
    const routeObj = ROUTES.find(r => r.id === bookingWizardState.selectedRoute);
    
    const isHacking = document.getElementById('hacker-price-manipulate').checked;
    const submittedPrice = isHacking ? 1.00 : bookingWizardState.estimatedPrice;

    const snapshot = simulator.getSnapshot();
    const occupancy = Math.min(0.9, (snapshot.metrics.avgCpu / 125) + 0.2);

    appendTerminalLog("API-Gateway", `POST /api/v1/ledger/invest — Payload: Value=$${submittedPrice}, Portfolio=${routeObj.id}, Tranche=#${bookingWizardState.selectedSeat}`, "sys");

    // 1. Server-side Transaction Value Integrity Validation
    const isPriceLegit = verifyFareIntegrity(routeObj.distance, bookingWizardState.ticketClass, occupancy, submittedPrice);

    if (!isPriceLegit) {
        appendTerminalLog("WAF-SHIELD", `CRITICAL: Client-Side Transaction Manipulation Detected! Submitted: $${submittedPrice}, Expected: $${bookingWizardState.estimatedPrice.toFixed(2)}. Blocking IP 185.22.41.9`, "sec");
        showToast("SECURITY ALERT: Transaction rejected — pricing integrity violation detected.", "error");
        goToWizardStep(2);
        return;
    }

    // 2. Successful transaction — create cryptographically sealed ledger receipt
    const bookingPayload = {
        seatNumber: bookingWizardState.selectedSeat,
        ticketClass: bookingWizardState.ticketClass,
        passengerName: bookingWizardState.passengerName,
        passengerEmail: bookingWizardState.passengerEmail,
        farePaid: submittedPrice
    };

    const newPass = await createBusPass(bookingPayload, routeObj);
    
    userWallet.push(newPass);
    saveWallet();

    simulator.recordBooking();

    appendTerminalLog("Oracle-DB", `INSERT INTO ledger_receipts (tx_id, portfolio_id, tranche, value) VALUES ('${newPass.id}', '${newPass.routeId}', ${newPass.seatNumber}, ${newPass.fare})`, "sys");
    appendTerminalLog("Ledger-Service", `SHA-256 Digital signature sealed for receipt ${newPass.id}: ${newPass.signature.substr(0, 32)}...`, "acc");

    showToast("Investment committed! Ledger receipt cryptographically signed and stored.", "success");

    resetWizardState();
    switchTab('wallet-tab');
}

function resetWizardState() {
    bookingWizardState = {
        step: 1,
        selectedRoute: null,
        selectedSeat: null,
        ticketClass: 'economy',
        passengerName: '',
        passengerEmail: '',
        estimatedPrice: 0.00
    };
    
    document.getElementById('passenger-name').value = '';
    document.getElementById('passenger-email').value = '';
    document.getElementById('hacker-price-manipulate').checked = false;
    document.getElementById('btn-next-step-1').disabled = true;
    document.getElementById('btn-next-step-2').disabled = true;

    renderRoutesList();
    goToWizardStep(1);
}

/**
 * LocalStorage Vault persistence
 */
function loadWallet() {
    const raw = localStorage.getItem('apexbank_ledger');
    if (raw) {
        try { userWallet = JSON.parse(raw); }
        catch (e) { userWallet = []; }
    } else {
        userWallet = [];
    }
}

function saveWallet() {
    localStorage.setItem('apexbank_ledger', JSON.stringify(userWallet));
}

/**
 * Redraw Asset Vault DOM list
 */
function renderWalletUI() {
    const container = document.getElementById('wallet-tickets-container');
    container.innerHTML = '';

    if (userWallet.length === 0) {
        container.innerHTML = `
            <div class="empty-wallet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
                </svg>
                <p>No investment receipts found. Use the Investment Portal to allocate assets to a portfolio.</p>
            </div>
        `;
        return;
    }

    userWallet.forEach((pass) => {
        const card = document.createElement('div');
        card.className = `pass-card ${pass.validated ? 'validated' : ''}`;
        
        card.innerHTML = `
            <div class="pass-card-header">
                <div>
                    <strong style="color: var(--primary); font-size: 14px;">${pass.id}</strong>
                    <span style="font-size: 11px; margin-left: 10px; padding: 2px 8px; border-radius: 20px; font-weight: 700; ${pass.validated ? 'background: var(--success-glow); color: var(--success);' : 'background: var(--warning-glow); color: var(--warning);'}">
                        ${pass.validated ? 'AUTHORIZED & SETTLED' : 'ACTIVE / PENDING'}
                    </span>
                </div>
                <span style="font-size: 12px; font-weight: 700; color: var(--success);">$${pass.fare.toFixed(2)}</span>
            </div>
            
            <div class="pass-card-body">
                <div class="pass-info-grid">
                    <div class="pass-item">
                        <label>Portfolio</label>
                        <span>${pass.routeName}</span>
                    </div>
                    <div class="pass-item">
                        <label>Risk Tranche</label>
                        <span>Block #${pass.seatNumber}</span>
                    </div>
                    <div class="pass-item">
                        <label>Account Holder</label>
                        <span>${pass.passengerName}</span>
                    </div>
                    <div class="pass-item">
                        <label>Account Tier</label>
                        <span style="text-transform: capitalize;">${pass.ticketClass}</span>
                    </div>
                </div>
                
                <div class="pass-security-panel">
                    <div class="qr-code-box">
                        <img src="${pass.qrCodeUrl}" alt="Ledger Authorization QR">
                    </div>
                    <span class="pass-hash" title="${pass.signature}">Sig: ${pass.signature}</span>
                    <button class="btn btn-secondary btn-preset" style="padding: 4px 10px; font-size: 11px; border-radius: 4px; margin-top: 6px; width: 100%;" onclick="window.navToScanner('${pass.id}')">
                        Authorize at Terminal
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Global hook to jump to authorization terminal from vault cards
window.navToScanner = (receiptId) => {
    switchTab('scanner-tab');
    const select = document.getElementById('scanner-select-ticket');
    select.value = receiptId;
    document.getElementById('btn-scan-trigger').disabled = false;
};

/**
 * Populate Authorization Terminal receipt selector
 */
function populateScannerOptions() {
    const select = document.getElementById('scanner-select-ticket');
    select.innerHTML = '';

    if (userWallet.length === 0) {
        select.innerHTML = '<option value="">-- No receipts in vault --</option>';
        document.getElementById('btn-scan-trigger').disabled = true;
        return;
    }

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Select a receipt to authorize --';
    select.appendChild(defaultOpt);

    userWallet.forEach(pass => {
        const opt = document.createElement('option');
        opt.value = pass.id;
        opt.textContent = `${pass.id} (${pass.passengerName} — Tranche #${pass.seatNumber})`;
        select.appendChild(opt);
    });

    document.getElementById('btn-scan-trigger').disabled = true;
}

/**
 * Visual laser scan flow — authorization verification
 */
function triggerScannerVerification() {
    const select = document.getElementById('scanner-select-ticket');
    const receiptId = select.value;
    if (!receiptId) return;

    const pass = userWallet.find(p => p.id === receiptId);
    if (!pass) return;

    const laser = document.getElementById('scanner-laser-bar');
    const statusBox = document.getElementById('scanner-status-feedback');
    const triggerBtn = document.getElementById('btn-scan-trigger');

    triggerBtn.disabled = true;
    laser.style.display = 'block';
    statusBox.className = "scanner-feedback idle";
    statusBox.textContent = "Connecting to authorization ledger... verifying cryptographic signature.";

    setTimeout(async () => {
        laser.style.display = 'none';
        
        appendTerminalLog("Auth-Gateway", `Validating receipt signature: ID=${pass.id}`, "sys");

        const scanResult = await checkInPass(pass);

        if (scanResult.success) {
            statusBox.className = "scanner-feedback success";
            statusBox.textContent = `AUTHORIZED: Transaction confirmed for ${pass.passengerName}. Receipt settled.`;
            showToast(`Receipt ${pass.id} authorized and settled in ledger.`, "success");
            
            pass.validated = true;
            saveWallet();
            
            appendTerminalLog("Auth-Gateway", `Signature VALID. Transaction Authorized. Holder: ${pass.passengerName}. Portfolio: ${pass.routeName}`, "acc");
        } else {
            statusBox.className = "scanner-feedback error";
            statusBox.textContent = `ACCESS DENIED: ${scanResult.reason}`;
            showToast("AUTHORIZATION DENIED: Ledger security validation failed.", "error");
            
            appendTerminalLog("Auth-Gateway", `SECURITY VIOLATION: Authorization denied. Reason: ${scanResult.reason}`, "sec");
        }

        triggerBtn.disabled = false;
        populateScannerOptions();
    }, 1500);
}

/**
 * Simulator State updates: refresh UI cluster maps
 */
function updateClusterUi(snapshot) {
    const activeNodes = snapshot.instances.filter(i => i.status === 'healthy').length;
    document.getElementById('system-status-dot').className = `status-dot ${activeNodes > 0 ? '' : 'failed'}`;
    document.getElementById('system-status-text').textContent = `ASG: Running (${activeNodes}/${snapshot.instances.length} Active Nodes)`;

    const clusterContainer = document.getElementById('infra-cluster-container');
    clusterContainer.innerHTML = '';

    snapshot.instances.forEach(instance => {
        const node = document.createElement('div');
        node.className = `server-node ${instance.status}`;
        node.dataset.load = instance.cpu;

        let loadLabel = `${instance.cpu}%`;
        if (instance.status === 'spinning-up') loadLabel = `Boot: ${instance.provisionProgress}%`;
        else if (instance.status === 'draining') loadLabel = 'Draining';
        else if (instance.status === 'failed') loadLabel = 'CRASHED';

        node.innerHTML = `
            <div class="server-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/>
                    <rect x="2" y="14" width="20" height="8" rx="2" ry="2"/>
                </svg>
            </div>
            <strong style="font-size: 9px; opacity:0.8;">${instance.id}</strong>
            <span style="font-size: 10px; font-weight:700; margin-top:2px;">${loadLabel}</span>
            <div class="server-load-bar">
                <div class="server-load-fill" style="width: ${instance.status === 'healthy' ? instance.cpu : 0}%"></div>
            </div>
        `;
        clusterContainer.appendChild(node);
    });

    // Flow particles based on RPS
    const particlesContainer = document.getElementById('lb-particles-container');
    particlesContainer.innerHTML = '';
    
    if (activeNodes > 0 && snapshot.metrics.rps > 10) {
        const flowDensity = Math.min(6, Math.max(1, Math.floor(snapshot.metrics.rps / 150)));
        for (let i = 0; i < flowDensity; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle to-server';
            particle.style.left = `${40 + Math.random() * 20}%`;
            particle.style.animationDuration = `${0.5 + Math.random() * 0.6}s`;
            particle.style.animationDelay = `${Math.random() * 0.8}s`;
            particlesContainer.appendChild(particle);
        }
    }

    document.getElementById('node-count-label').textContent = `${snapshot.instances.length} Nodes Running`;
    document.getElementById('redis-cache-hit').textContent = `Hit Rate: ${snapshot.metrics.cacheHitRate}%`;
    document.getElementById('db-master-load').textContent = `Load: ${snapshot.database.masterLoad}%`;
    document.getElementById('db-replica-delay').textContent = `Sync Lag: ${snapshot.database.replicaLagMs}ms | Replica CPU: ${snapshot.database.replicaLoad}%`;
    
    document.getElementById('metrics-avg-cpu').textContent = `${snapshot.metrics.avgCpu}%`;
    document.getElementById('metrics-avg-latency').textContent = `${snapshot.metrics.avgResponseTime}ms`;
    document.getElementById('metrics-dropped-req').textContent = snapshot.metrics.droppedRequests;
    document.getElementById('metrics-dropped-req').style.color = snapshot.metrics.droppedRequests > 0 ? 'var(--danger)' : 'var(--text-secondary)';
    document.getElementById('metrics-total-vol').textContent = snapshot.metrics.totalRequestsProcessed;

    updateLiveFares();
}

/**
 * WAF Logger / Ledger Audit Console
 */
function appendTerminalLog(service, message, category = "sys") {
    const view = document.getElementById('terminal-logs-view');
    if (!view) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const time = new Date().toLocaleTimeString();
    
    let badge = 'SYS';
    if (category === 'sec') badge = 'WAF';
    else if (category === 'acc') badge = 'KEY';
    else if (category === 'sc') badge = 'ASG';

    entry.innerHTML = `
        <span class="log-timestamp">[${time}]</span>
        <span class="log-type ${category}">${badge}</span>
        <span class="log-message"><strong>[${service}]</strong> ${message}</span>
    `;

    view.appendChild(entry);
    view.scrollTop = view.scrollHeight;
}

/**
 * Toast notifications UI overlays helper
 */
function showToast(message, type = 'success') {
    const layer = document.getElementById('toast-notification-layer');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let symbol = '✓';
    if (type === 'error') symbol = '✕';
    else if (type === 'warning') symbol = '⚠';

    toast.innerHTML = `
        <span style="font-weight: 700; font-size: 16px;">${symbol}</span>
        <span>${message}</span>
    `;

    layer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInLeft 0.3s ease-in reverse forwards';
        setTimeout(() => { toast.remove(); }, 300);
    }, 4000);
}

/**
 * Task 2: SQL Injection Shield Simulator Dashboard Initializer
 */
async function initSqlShieldTab() {
    // 1. Initialize data entries encrypted using real AES-256
    await initDatabase();
    
    // 2. Render database table visualization
    await renderSqlDatabaseTable();

    // 3. Set up Action Listeners
    document.getElementById('btn-sql-execute').addEventListener('click', () => {
        handleSqlSandboxQuery();
    });

    document.getElementById('sql-payload-preset').addEventListener('change', (e) => {
        const input = document.getElementById('sql-search-input');
        const select = e.target;
        if (select.value === 'bypass_auth') {
            input.value = "' OR '1'='1";
            appendSqlLog("SANDBOX", "Loaded SQL payload: Tautology authentication bypass.");
        } else if (select.value === 'union_harvest') {
            input.value = "' UNION SELECT 1, username, encrypted_ssn, encrypted_password, 5, 6 FROM users --";
            appendSqlLog("SANDBOX", "Loaded SQL payload: UNION schema harvesting attack.");
        } else if (select.value === 'comment_truncate') {
            input.value = "admin_helen' --";
            appendSqlLog("SANDBOX", "Loaded SQL payload: Truncate search query comment.");
        } else {
            input.value = "";
        }
    });

    document.getElementById('sql-db-decrypt-toggle').addEventListener('change', () => {
        renderSqlDatabaseTable();
    });

    document.getElementById('btn-clear-sql-logs').addEventListener('click', () => {
        document.getElementById('sql-logs-view').innerHTML = '';
        appendSqlLog("CONSOLE", "Security monitor logs cleared.");
    });

    // Populate initial logs
    appendSqlLog("DATABASE", "Cloud Database users_ledger initialized. Credentials encrypted under AES-256.", "acc");
    appendSqlLog("FIREWALL", "Layer 1 Web Application Firewall (WAF) rule sets loaded.", "sys");
    appendSqlLog("SEC-ENGINE", "Layer 2 Parameterized query compiler validated.", "sys");
}

/**
 * Redraw database table with encrypted or decrypted content
 */
async function renderSqlDatabaseTable() {
    const decryptEnabled = document.getElementById('sql-db-decrypt-toggle').checked;
    const body = document.getElementById('sql-db-table-body');
    body.innerHTML = '';

    for (const user of databaseState.users) {
        const tr = document.createElement('tr');
        
        let displayPassword = user.encrypted_password;
        let displaySsn = user.encrypted_ssn;
        let displayBalance = user.encrypted_balance;

        if (decryptEnabled) {
            // Decrypt columns at runtime demonstrating AES-256 decryption process
            displayPassword = await decryptAES256(user.encrypted_password);
            displaySsn = await decryptAES256(user.encrypted_ssn);
            displayBalance = '$' + (await decryptAES256(user.encrypted_balance));
        }

        tr.innerHTML = `
            <td><strong>${user.id}</strong></td>
            <td><code>${user.username}</code></td>
            <td title="${user.encrypted_password}">${displayPassword}</td>
            <td title="${user.encrypted_ssn}">${displaySsn}</td>
            <td title="${user.encrypted_balance}">${displayBalance}</td>
            <td><span class="brand-tag" style="background: hsla(245, 80%, 65%, 0.15); color: hsl(245, 100%, 75%);">${user.capability_scope}</span></td>
        `;
        body.appendChild(tr);
    }
}

/**
 * Handle query submission, run WAF, Prepared statements, and capability scopes checks
 */
async function handleSqlSandboxQuery() {
    const searchVal = document.getElementById('sql-search-input').value;
    const wafEnabled = document.getElementById('sql-policy-waf').checked;
    const preparedEnabled = document.getElementById('sql-policy-prepare').checked;
    const capCode = document.getElementById('sql-cap-input').value;
    const decryptEnabled = document.getElementById('sql-db-decrypt-toggle').checked;

    const executeBtn = document.getElementById('btn-sql-execute');
    executeBtn.disabled = true;

    appendSqlLog("GATEWAY", `Incoming request: Search query="${searchVal}", CapToken="${capCode || 'None'}"`, "sys");

    // Execute through SQL engine
    const response = await executeQuery(searchVal, { wafEnabled, preparedStatementsEnabled: preparedEnabled }, capCode);

    // Write steps to security console logs
    for (const log of response.logs) {
        let category = "sys";
        if (log.step.includes("BLOCKED") || log.step.includes("LEAK") || log.step.includes("INJECTION")) {
            category = "sec";
        } else if (log.step.includes("GRANTED") || log.step.includes("VERIFY") || log.step.includes("STATUS_OK")) {
            category = "acc";
        }
        appendSqlLog(log.step, log.detail, category);
    }

    const outputBody = document.getElementById('sql-output-table-body');
    outputBody.innerHTML = '';

    if (!response.success) {
        showToast("SECURITY BLOCK: Malicious SQL patterns intercepted by WAF.", "error");
        outputBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--danger); font-weight: 700; padding: 20px;">
                    ⚠️ EXCEPTION: Request blocked by WAF (SQL Injection signature match).
                </td>
            </tr>
        `;
        executeBtn.disabled = false;
        return;
    }

    if (response.results.length === 0) {
        outputBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">No rows matched user criteria.</td>
            </tr>
        `;
    } else {
        // Output rows returned to the UI
        for (const row of response.results) {
            const tr = document.createElement('tr');
            
            let displayPassword = row.encrypted_password;
            let displaySsn = row.encrypted_ssn;
            let displayBalance = row.encrypted_balance;

            // Decrypt output if decryption switch is enabled AND column value is not redacted by scope checks
            if (decryptEnabled && !row.encrypted_password.startsWith("●●●")) {
                displayPassword = await decryptAES256(row.encrypted_password);
            }
            if (decryptEnabled && !row.encrypted_ssn.startsWith("●●●")) {
                displaySsn = await decryptAES256(row.encrypted_ssn);
            }
            if (decryptEnabled && !row.encrypted_balance.startsWith("●●●")) {
                displayBalance = '$' + (await decryptAES256(row.encrypted_balance));
            }

            tr.innerHTML = `
                <td><strong>${row.id}</strong></td>
                <td><code>${row.username}</code></td>
                <td>${displayPassword}</td>
                <td>${displaySsn}</td>
                <td>${displayBalance}</td>
                <td><span class="brand-tag">${row.capability_scope}</span></td>
            `;
            outputBody.appendChild(tr);
        }

        if (response.isDataLeak) {
            showToast("SECURITY ALARM: Unauthorized database rows leaked to client!", "error");
        } else {
            showToast("Query completed successfully.", "success");
        }
    }

    executeBtn.disabled = false;
}

/**
 * Logger helper for SQL Shield console feed
 */
function appendSqlLog(service, message, category = "sys") {
    const view = document.getElementById('sql-logs-view');
    if (!view) return;

    const entry = document.createElement('div');
    entry.className = 'log-entry';

    const time = new Date().toLocaleTimeString();
    
    let badge = 'SYS';
    if (category === 'sec') badge = 'SEC';
    else if (category === 'acc') badge = 'AUTH';

    entry.innerHTML = `
        <span class="log-timestamp">[${time}]</span>
        <span class="log-type ${category}">${badge}</span>
        <span class="log-message"><strong>[${service}]</strong> ${message}</span>
    `;

    view.appendChild(entry);
    view.scrollTop = view.scrollHeight;
}

