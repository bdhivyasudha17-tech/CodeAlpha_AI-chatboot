/**
 * Skylines Secure Bus Pass System - Orchestration Script
 * Connects UI interactions, step-by-step wizards, ticket check-in gates, 
 * and real-time cloud auto-scaling.
 */

import { CloudSimulator } from './modules/simulator.js';
import { verifyFareIntegrity, checkInPass, resetLedger } from './modules/security.js';
import { ROUTES, generateBusSeats, computeTicketPrice, createBusPass } from './modules/booking.js';

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

// Initialize DOM Nodes
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    // Load local storage wallet database
    loadWallet();

    // 1. Initialize Simulator
    simulator = new CloudSimulator(updateClusterUi, appendTerminalLog);
    simulator.start();

    // 2. Wire Tab Navigation
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            switchTab(e.target.dataset.tab);
        });
    });

    // 3. Render Route Cards (Step 1)
    renderRoutesList();

    // 4. Set up Booking Wizard Event Handlers
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
        // Collect form data
        const name = document.getElementById('passenger-name').value.trim();
        const email = document.getElementById('passenger-email').value.trim();
        
        if (!name || !email) {
            showToast("Please input passenger details.", "warning");
            return;
        }

        if (!bookingWizardState.selectedSeat) {
            showToast("Please allocate a seat on the bus layout.", "warning");
            return;
        }

        bookingWizardState.passengerName = name;
        bookingWizardState.passengerEmail = email;

        // Render Step 3 summary
        const routeObj = ROUTES.find(r => r.id === bookingWizardState.selectedRoute);
        document.getElementById('final-passenger-name').textContent = name;
        document.getElementById('final-route-name').textContent = `${routeObj.from} to ${routeObj.to}`;
        document.getElementById('final-seat-number').textContent = `Seat ${bookingWizardState.selectedSeat}`;
        document.getElementById('final-class-option').textContent = document.getElementById('ticket-class').options[document.getElementById('ticket-class').selectedIndex].text;
        
        // Dynamic Pricing validation prep
        let checkoutPrice = bookingWizardState.estimatedPrice;
        const hackToggle = document.getElementById('hacker-price-manipulate');
        if (hackToggle.checked) {
            checkoutPrice = 1.00; // Alter price for simulation test
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
            document.querySelectorAll('.btn-preset').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            
            const preset = e.target.dataset.preset;
            simulator.setPreset(preset);
            
            // Sync slider value visually
            const snapshot = simulator.getSnapshot();
            rpsSlider.value = snapshot.targetRps;
            rpsLabel.textContent = `${snapshot.targetRps} RPS`;
        });
    });

    document.getElementById('btn-clear-logs').addEventListener('click', () => {
        document.getElementById('terminal-logs-view').innerHTML = '';
    });

    // 6. Access Control Scanning Gate Wires
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

    // Initial Wallet Draw & Scan options
    renderWalletUI();
    populateScannerOptions();
}

/**
 * Navigation tab switching
 */
function switchTab(tabId) {
    activeTab = tabId;
    
    // Tab buttons active classes
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.dataset.tab === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    // Tab content panel display toggle
    document.querySelectorAll('.tab-content').forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });

    // Specific tab triggers
    if (tabId === 'wallet-tab') {
        renderWalletUI();
    } else if (tabId === 'scanner-tab') {
        populateScannerOptions();
    }
}

/**
 * Step Navigation inside Booking Wizard
 */
function goToWizardStep(stepNumber) {
    bookingWizardState.step = stepNumber;
    
    // Hide all steps
    document.querySelectorAll('.wizard-step-pane').forEach(pane => {
        pane.style.display = 'none';
    });

    // Show selected step
    document.getElementById(`wizard-pane-${stepNumber}`).style.display = 'block';

    // Update wizard steps header styling
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
 * Populate list of routes in Step 1
 */
function renderRoutesList() {
    const container = document.getElementById('routes-selector-container');
    container.innerHTML = '';

    ROUTES.forEach(route => {
        const card = document.createElement('div');
        card.className = 'route-card';
        card.dataset.id = route.id;
        
        // Estimated price incorporating current simulator load
        const snapshot = simulator ? simulator.getSnapshot() : { metrics: { avgCpu: 0 } };
        const occupancy = Math.min(0.9, (snapshot.metrics.avgCpu / 120) + 0.2);
        const pricing = computeTicketPrice(route.id, bookingWizardState.ticketClass, occupancy);

        card.innerHTML = `
            <div class="route-info">
                <span class="route-title">${route.from} to ${route.to}</span>
                <div class="route-details">
                    <span>
                        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                        ${route.duration}
                    </span>
                    <span>
                        <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z"/></svg>
                        ${route.distance} mi
                    </span>
                </div>
            </div>
            <div class="route-price-tag">
                <span class="route-fare" id="fare-val-${route.id}">$${pricing.toFixed(2)}</span>
                <span class="route-availability">Express Service</span>
            </div>
        `;

        card.addEventListener('click', () => {
            document.querySelectorAll('.route-card').forEach(c => c.classList.remove('selected'));
            card.classList.add('selected');
            
            bookingWizardState.selectedRoute = route.id;
            document.getElementById('btn-next-step-1').disabled = false;
            
            // Build fresh seat maps for the route selection
            buildSeatLayout(route.id);
            updateLiveFares();
        });

        container.appendChild(card);
    });
}

/**
 * Regenerate dynamically updated fares in UI
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

        // Populate summary box in Step 2
        document.getElementById('summary-base-fare').textContent = `$${routeObj.baseFare.toFixed(2)}`;
        
        let premiumStr = "1.0 (Economy)";
        if (bookingWizardState.ticketClass === 'luxury-ac') premiumStr = "1.5 (Premium)";
        else if (bookingWizardState.ticketClass === 'sleeper') premiumStr = "1.8 (Sleeper)";
        document.getElementById('summary-class-premium').textContent = `x ${premiumStr}`;
        
        let surgeStr = "1.00 (Normal Demand)";
        if (occupancy >= 0.8) surgeStr = "1.40 (Critical Surge)";
        else if (occupancy >= 0.5) surgeStr = "1.15 (Moderate Surge)";
        document.getElementById('summary-surge-multiplier').textContent = `x ${surgeStr}`;

        document.getElementById('summary-total-fare').textContent = `$${finalPrice.toFixed(2)}`;
    }
}

/**
 * Load seating layout grid for Step 2
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
                
                // Trigger button validation check
                const name = document.getElementById('passenger-name').value.trim();
                const email = document.getElementById('passenger-email').value.trim();
                document.getElementById('btn-next-step-2').disabled = !(name && email && bookingWizardState.selectedSeat);
            });
        }

        container.appendChild(el);
    });
}

/**
 * Handle checkout submission and perform server fare integrity verification
 */
async function processSecureCheckout() {
    const routeObj = ROUTES.find(r => r.id === bookingWizardState.selectedRoute);
    
    // Read the checkout amount from Step 3 display (could be modified if hacker-toggle is checked)
    const isHacking = document.getElementById('hacker-price-manipulate').checked;
    const submittedPrice = isHacking ? 1.00 : bookingWizardState.estimatedPrice;

    // Simulate cluster utilization metrics to match DB occupancy calculations
    const snapshot = simulator.getSnapshot();
    const occupancy = Math.min(0.9, (snapshot.metrics.avgCpu / 125) + 0.2);

    appendTerminalLog("API-Gateway", `POST /api/v1/tickets/purchase - Payload: Price=$${submittedPrice}, Route=${routeObj.id}, Seat=${bookingWizardState.selectedSeat}`, "sys");

    // 1. Perform server-side Pricing Integrity validation
    const isPriceLegit = verifyFareIntegrity(routeObj.distance, bookingWizardState.ticketClass, occupancy, submittedPrice);

    if (!isPriceLegit) {
        // Attack detected: Alert WAF system
        appendTerminalLog("WAF-SHIELD", `CRITICAL: Client-side Price Manipulation Attempt! Submitted: $${submittedPrice}, Expected: $${bookingWizardState.estimatedPrice}. Dropping request from IP 185.22.41.9`, "sec");
        showToast("SECURITY FAILURE: Transaction rejected due to pricing integrity failure (Client tampering suspected).", "error");
        
        // Return back to wizard selection
        goToWizardStep(2);
        return;
    }

    // 2. Successful transaction - Create cryptographically sealed pass
    const bookingPayload = {
        seatNumber: bookingWizardState.selectedSeat,
        ticketClass: bookingWizardState.ticketClass,
        passengerName: bookingWizardState.passengerName,
        passengerEmail: bookingWizardState.passengerEmail,
        farePaid: submittedPrice
    };

    const newPass = await createBusPass(bookingPayload, routeObj);
    
    // Save to user wallet state
    userWallet.push(newPass);
    saveWallet();

    // Trigger simulator write statistics
    simulator.recordBooking();

    appendTerminalLog("PostgreSQL", `INSERT INTO bookings (pass_id, route_id, seat, fare) VALUES ('${newPass.id}', '${newPass.routeId}', ${newPass.seatNumber}, ${newPass.fare})`, "sys");
    appendTerminalLog("Ledger-Service", `Generated digital signature for pass ${newPass.id}: ${newPass.signature.substr(0, 32)}...`, "acc");

    showToast("Ticket booked successfully! Pass cryptographically signed.", "success");

    // Clear wizard state and direct to wallet view
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

    // Redraw steps
    renderRoutesList();
    goToWizardStep(1);
}

/**
 * LocalStorage Wallet persistence
 */
function loadWallet() {
    const raw = localStorage.getItem('skyroute_tickets');
    if (raw) {
        try {
            userWallet = JSON.parse(raw);
        } catch (e) {
            userWallet = [];
        }
    } else {
        userWallet = [];
    }
}

function saveWallet() {
    localStorage.setItem('skyroute_tickets', JSON.stringify(userWallet));
}

/**
 * Redraw Ticket Wallet DOM list
 */
function renderWalletUI() {
    const container = document.getElementById('wallet-tickets-container');
    container.innerHTML = '';

    if (userWallet.length === 0) {
        container.innerHTML = `
            <div class="empty-wallet">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    <path stroke-linecap="round" stroke-linejoin="round" d="M9 10h.01M15 10h.01M9.75 15.5h4.5" />
                </svg>
                <p>No bus passes generated yet. Book a route schedule in the Purchase wizard.</p>
            </div>
        `;
        return;
    }

    userWallet.forEach((pass, index) => {
        const card = document.createElement('div');
        card.className = `pass-card ${pass.validated ? 'validated' : ''}`;
        
        card.innerHTML = `
            <div class="pass-card-header">
                <div>
                    <strong style="color: var(--primary); font-size: 14px;">${pass.id}</strong>
                    <span style="font-size: 11px; margin-left: 10px; padding: 2px 8px; border-radius: 20px; font-weight: 700; ${pass.validated ? 'background: var(--success-glow); color: var(--success);' : 'background: var(--warning-glow); color: var(--warning);'}">
                        ${pass.validated ? 'SCANNED & VALID' : 'ACTIVE / UNUSED'}
                    </span>
                </div>
                <span style="font-size: 12px; font-weight: 700; color: var(--success);">$${pass.fare.toFixed(2)}</span>
            </div>
            
            <div class="pass-card-body">
                <div class="pass-info-grid">
                    <div class="pass-item">
                        <label>Route</label>
                        <span>${pass.routeName}</span>
                    </div>
                    <div class="pass-item">
                        <label>Seat Allocation</label>
                        <span>Seat ${pass.seatNumber}</span>
                    </div>
                    <div class="pass-item">
                        <label>Passenger</label>
                        <span>${pass.passengerName}</span>
                    </div>
                    <div class="pass-item">
                        <label>Travel Class</label>
                        <span style="text-transform: capitalize;">${pass.ticketClass}</span>
                    </div>
                </div>
                
                <div class="pass-security-panel">
                    <div class="qr-code-box">
                        <img src="${pass.qrCodeUrl}" alt="Ticket Check-in QR">
                    </div>
                    <span class="pass-hash" title="${pass.signature}">Sig: ${pass.signature}</span>
                    <button class="btn btn-secondary btn-preset" style="padding: 4px 10px; font-size: 11px; border-radius: 4px; margin-top: 6px; width: 100%;" onclick="window.navToScanner('${pass.id}')">
                        Scan Ticket at Gate
                    </button>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

// Global hook to jump to scanner tab easily from ticket cards
window.navToScanner = (ticketId) => {
    switchTab('scanner-tab');
    const select = document.getElementById('scanner-select-ticket');
    select.value = ticketId;
    document.getElementById('btn-scan-trigger').disabled = false;
};

/**
 * Check-In Scanner options selector
 */
function populateScannerOptions() {
    const select = document.getElementById('scanner-select-ticket');
    select.innerHTML = '';

    if (userWallet.length === 0) {
        select.innerHTML = '<option value="">-- No passes in database --</option>';
        document.getElementById('btn-scan-trigger').disabled = true;
        return;
    }

    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '-- Choose a ticket --';
    select.appendChild(defaultOpt);

    userWallet.forEach(pass => {
        const opt = document.createElement('option');
        opt.value = pass.id;
        opt.textContent = `${pass.id} (${pass.passengerName} - Seat ${pass.seatNumber})`;
        select.appendChild(opt);
    });

    document.getElementById('btn-scan-trigger').disabled = true;
}

/**
 * Visual laser scan flow check-in verification
 */
function triggerScannerVerification() {
    const select = document.getElementById('scanner-select-ticket');
    const ticketId = select.value;
    if (!ticketId) return;

    const pass = userWallet.find(p => p.id === ticketId);
    if (!pass) return;

    const laser = document.getElementById('scanner-laser-bar');
    const statusBox = document.getElementById('scanner-status-feedback');
    const triggerBtn = document.getElementById('btn-scan-trigger');

    // Lock UI during scan
    triggerBtn.disabled = true;
    laser.style.display = 'block';
    statusBox.className = "scanner-feedback idle";
    statusBox.textContent = "Connecting to auth ledger... checking signature authenticity.";

    // Wait 1.5 seconds simulating scanning hardware delay
    setTimeout(async () => {
        laser.style.display = 'none';
        
        appendTerminalLog("Gate-Validator", `Validating ticket scanner signature query: ID=${pass.id}`, "sys");

        // Execute security checks
        const scanResult = await checkInPass(pass);

        if (scanResult.success) {
            // Success
            statusBox.className = "scanner-feedback success";
            statusBox.textContent = `ACCESS GRANTED: Hello ${pass.passengerName}, welcome aboard!`;
            showToast(`Ticket ${pass.id} successfully checked in.`, "success");
            
            // Mark ticket as scanned in wallet
            pass.validated = true;
            saveWallet();
            
            appendTerminalLog("Gate-Validator", `Signature VALID. Access Granted. Passenger: ${pass.passengerName}. Route: ${pass.routeName}`, "acc");
        } else {
            // Failure (Security Exception: Double Spend or Forgery)
            statusBox.className = "scanner-feedback error";
            statusBox.textContent = `ACCESS DENIED: ${scanResult.reason}`;
            showToast("ACCESS DENIED: Gate security check failed.", "error");
            
            appendTerminalLog("Gate-Validator", `SECURITY VIOLATION: Access denied. Reason: ${scanResult.reason}`, "sec");
        }

        // Release UI
        triggerBtn.disabled = false;
        populateScannerOptions();
    }, 1500);
}

/**
 * Simulator State updates: refresh UI cluster maps
 */
function updateClusterUi(snapshot) {
    // 1. Update status pill
    const activeNodes = snapshot.instances.filter(i => i.status === 'healthy').length;
    document.getElementById('system-status-dot').className = `status-dot ${activeNodes > 0 ? '' : 'failed'}`;
    document.getElementById('system-status-text').textContent = `ASG: Running (${activeNodes}/${snapshot.instances.length} Active Nodes)`;

    // 2. Render Server Node Cluster
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

    // 3. Scale flow particles based on RPS traffic
    const particlesContainer = document.getElementById('lb-particles-container');
    particlesContainer.innerHTML = '';
    
    // Ingress traffic flow representation: create animation flow nodes
    if (activeNodes > 0 && snapshot.metrics.rps > 10) {
        const flowDensity = Math.min(6, Math.max(1, Math.floor(snapshot.metrics.rps / 150)));
        for (let i = 0; i < flowDensity; i++) {
            const particle = document.createElement('div');
            particle.className = 'particle to-server';
            
            // Randomize speed/offset offsets
            particle.style.left = `${40 + Math.random() * 20}%`;
            particle.style.animationDuration = `${0.5 + Math.random() * 0.6}s`;
            particle.style.animationDelay = `${Math.random() * 0.8}s`;
            
            particlesContainer.appendChild(particle);
        }
    }

    // 4. Repaint metrics panels
    document.getElementById('node-count-label').textContent = `${snapshot.instances.length} Nodes Running`;
    document.getElementById('redis-cache-hit').textContent = `Hit Rate: ${snapshot.metrics.cacheHitRate}%`;
    document.getElementById('db-master-load').textContent = `Load: ${snapshot.database.masterLoad}%`;
    document.getElementById('db-replica-delay').textContent = `Sync Lag: ${snapshot.database.replicaLagMs}ms | Replica CPU: ${snapshot.database.replicaLoad}%`;
    
    document.getElementById('metrics-avg-cpu').textContent = `${snapshot.metrics.avgCpu}%`;
    document.getElementById('metrics-avg-latency').textContent = `${snapshot.metrics.avgResponseTime}ms`;
    document.getElementById('metrics-dropped-req').textContent = snapshot.metrics.droppedRequests;
    document.getElementById('metrics-dropped-req').style.color = snapshot.metrics.droppedRequests > 0 ? 'var(--danger)' : 'var(--text-secondary)';
    document.getElementById('metrics-total-vol').textContent = snapshot.metrics.totalRequestsProcessed;

    // Update dynamic pricing details inside wizard dynamically as CPU changes
    updateLiveFares();
}

/**
 * WAF Logger / System Console interface appender
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
    
    // Auto scroll down to latest log line
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
    
    // Fade out after 4 seconds
    setTimeout(() => {
        toast.style.animation = 'slideInLeft 0.3s ease-in reverse forwards';
        setTimeout(() => {
            toast.remove();
        }, 300);
    }, 4000);
}
