/**
 * Apex AI Wealth Advisor & Security Copilot Module
 * Handles natural language matching, dialog states, suggested prompts,
 * generative simulation fallback, and direct dashboard integration hooks.
 */

export class ApexChatbot {
    constructor(elements) {
        this.elements = elements;
        this.chatHistory = [];
        this.isTyping = false;

        // Custom dialogue intents with regex patterns and structured responses
        this.intents = [
            {
                name: "greeting",
                patterns: [/\b(hi|hello|hey|greetings|good morning|good afternoon|assistant|advisor)\b/i],
                response: "Hello! I am <span class='chat-highlight'>Apex AI</span>, your intelligent wealth advisor and security copilot. I can help you allocate assets, switch tabs, check ledger security, or simulate infrastructure stress tests. What can I do for you today?",
                actions: {},
                suggestions: ["Show available portfolios", "Explain ledger security", "Simulate a traffic spike"]
            },
            {
                name: "portfolios_list",
                patterns: [/\b(portfolios|funds|yields|investments|assets|interest|apy|available funds)\b/i],
                response: "We offer 4 high-availability digital ledger portfolios:\n" +
                          "1. <span class='chat-highlight'>Apex Alpha</span> (R-101): Tech growth equities | <span class='chat-code'>12.5% APY</span>\n" +
                          "2. <span class='chat-highlight'>West Coast Capital</span> (R-102): Sovereign bond ledger | <span class='chat-code'>4.8% APY</span>\n" +
                          "3. <span class='chat-highlight'>Cyber Shield</span> (R-103): Security infrastructure ETF | <span class='chat-code'>8.9% APY</span>\n" +
                          "4. <span class='chat-highlight'>Eco-Yield</span> (R-104): Green energy trust | <span class='chat-code'>6.5% APY</span>\n\n" +
                          "You can tell me <span class='chat-code'>'Invest in Apex Alpha'</span> to start booking immediately!",
                actions: { tab: "booking-tab" },
                suggestions: ["Invest in Apex Alpha", "Invest in Cyber Shield", "Show Asset Vault"]
            },
            {
                name: "invest_alpha",
                patterns: [/\b(invest|select|choose|book|buy)\s+(in\s+)?(apex\s+)?alpha\b/i],
                response: "Acknowledged. Selecting <span class='chat-highlight'>Apex Alpha Tech Growth ETF</span> in the Investment Portal. Please choose your risk tranche blocks and enter checkout details to finalize.",
                actions: { tab: "booking-tab", selectPortfolio: "R-101", autofill: true },
                suggestions: ["Show Asset Vault", "Explain price tampering", "What is APY?"]
            },
            {
                name: "invest_bonds",
                patterns: [/\b(invest|select|choose|book|buy)\s+(in\s+)?(west\s+coast|sovereign|bonds)\b/i],
                response: "Selecting <span class='chat-highlight'>West Coast Capital Sovereign Bond Vault</span> in the Investment Portal. Safe choice! Let's fill out details.",
                actions: { tab: "booking-tab", selectPortfolio: "R-102", autofill: true },
                suggestions: ["Show Asset Vault", "How does WAF block attacks?"]
            },
            {
                name: "invest_cyber",
                patterns: [/\b(invest|select|choose|book|buy)\s+(in\s+)?(cyber\s+)?shield\b/i],
                response: "Selecting <span class='chat-highlight'>Cyber Shield Security Infrastructure ETF</span>. Initializing asset tranche loader. Excellent selection for balanced steady yield.",
                actions: { tab: "booking-tab", selectPortfolio: "R-103", autofill: true },
                suggestions: ["Show Asset Vault", "How does signature signing work?"]
            },
            {
                name: "invest_eco",
                patterns: [/\b(invest|select|choose|book|buy)\s+(in\s+)?(eco-yield|eco|green)\b/i],
                response: "Selecting <span class='chat-highlight'>Eco-Yield Green Energy Trust</span>. Green infrastructure asset blocks loading.",
                actions: { tab: "booking-tab", selectPortfolio: "R-104", autofill: true },
                suggestions: ["Show Asset Vault", "Explain double spending"]
            },
            {
                name: "show_vault",
                patterns: [/\b(vault|wallet|tickets|my accounts|assets|portfolio|show my ledger|balance)\b/i],
                response: "Switching to your <span class='chat-highlight'>Asset Vault</span>. Here you can track active receipts, purchase signatures, interest accumulations, and trigger cash-out checks at the terminal.",
                actions: { tab: "wallet-tab" },
                suggestions: ["How to scan a receipt?", "Reset ledger vault"]
            },
            {
                name: "show_gate",
                patterns: [/\b(gate|scanner|terminal|checkout|scan|check-in|merchant|validate)\b/i],
                response: "Loading the <span class='chat-highlight'>Merchant Authorization Terminal</span> tab. Select a signed transaction receipt and scan it to check-in, authorize payments, or test ledger validation loops.",
                actions: { tab: "scanner-tab" },
                suggestions: ["Explain double spending", "Trigger double spend check"]
            },
            {
                name: "explain_security",
                patterns: [/\b(cryptography|security|hmac|signature|sha-256|ledger security|tamper|prevent|verify)\b/i],
                response: "ApexBank uses asymmetric HMAC signatures using a <span class='chat-code'>SHA-256</span> hashing algorithm. When you commit a transaction, details like your account ID, investment amount, and risk tranche block are joined with a secure backend key to generate a unique 64-character verification hash. \n\n" +
                          "If someone alters the details (e.g. attempting to pay $1 instead of $27.00), the signature fails verification at the payment gate, and the WAF alerts security immediately.",
                actions: {},
                suggestions: ["Test price tampering", "What is double spending?"]
            },
            {
                name: "explain_doublespend",
                patterns: [/\b(double spend|double-spend|duplicate|ticket reuse|ledger fraud)\b/i],
                response: "To prevent duplicate asset redemption, our core ledger maintains an in-memory transactional validator cache. When a signature is verified at the gate, it is locked. \n\n" +
                          "If an identical transaction is submitted again (double-spending), the validation cache blocks the request and sounds a <span class='chat-highlight'>WAF Security Alarm</span>.",
                actions: {},
                suggestions: ["Reset double-spend ledger", "Simulate DDoS attack"]
            },
            {
                name: "hacker_manipulation",
                patterns: [/\b(hacker|manipulation|tamper price|hack price|client tampering|alter price)\b/i],
                response: "You can test our pricing integrity checks using the simulator! \n" +
                          "1. Go to tab <span class='chat-highlight'>Book Asset</span>, select a portfolio (e.g., Apex Alpha), and proceed to Step 2.\n" +
                          "2. Under selection summary, toggle the **'Hacker Sim: Client Price Manipulator'** switch (this overrides the price to $1.00).\n" +
                          "3. Complete step 3 checkout. The Core Web Application Firewall will detect the discrepancy, block the transaction, and log the attack to the security console!",
                actions: { tab: "booking-tab" },
                suggestions: ["Invest in Apex Alpha", "Clear WAF logs"]
            },
            {
                name: "simulate_ddos",
                patterns: [/\b(ddos|attack|botnet|simulate ddos|flood|zombie)\b/i],
                response: "Warning! Triggering the <span class='chat-highlight'>DDoS Botnet Simulation preset</span>. You will see traffic scale up to 3,500 RPS. The Load Balancer will route requests to active nodes, and the WAF firewall filter will drop 75% of packets as malicious bots to protect core banking ledgers.",
                actions: { preset: "ddos" },
                suggestions: ["Simulate mid-day normal", "Show scale metrics"]
            },
            {
                name: "simulate_rush",
                patterns: [/\b(rush hour|commuters|high load|spike|simulate spike|deposit flood)\b/i],
                response: "Simulating a <span class='chat-highlight'>Direct Deposit Clearing Spike (High Load)</span>. Ingress volume scales to 950 RPS. Observe the Auto-Scaling Group boot up new ledger nodes dynamically as CPU exceeds 70%!",
                actions: { preset: "rush-hour" },
                suggestions: ["How does scaling work?", "Simulate failure"]
            },
            {
                name: "simulate_normal",
                patterns: [/\b(normal|midday|reset traffic|low load|night load|low preset|normal preset)\b/i],
                response: "Setting transaction traffic generator to <span class='chat-highlight'>NORMAL (120 RPS)</span>. Nodes will scale back down gracefully to idle levels (min 2 instances) as load cools.",
                actions: { preset: "normal" },
                suggestions: ["Simulate a failure", "Show available portfolios"]
            },
            {
                name: "simulate_failure",
                patterns: [/\b(failure|crash|chaos monkey|break server|simulate crash)\b/i],
                response: "Dispatching the Chaos Monkey! This will crash one of the healthy Core Banking nodes. Observe the ledger scaler alarms detect the failure, isolate the crashed node, and boot up a replacement.",
                actions: { preset: "failure" },
                suggestions: ["Reset double-spend ledger", "Clear WAF logs"]
            },
            {
                name: "clear_logs",
                patterns: [/\b(clear logs|clear terminal|wipe logs|reset console)\b/i],
                response: "WAF & Security Audit console terminal cleared.",
                actions: { clearLogs: true },
                suggestions: ["Simulate a DDoS", "Explain ledger security"]
            },
            {
                name: "reset_ledger",
                patterns: [/\b(reset ledger|clear double spend|reset double-spend|clear database|empty vault)\b/i],
                response: "Core banking database reset: Scanned transaction ledger cleared. Previously scanned asset receipts can now be verified again for testing.",
                actions: { resetLedger: true },
                suggestions: ["Explain double spending", "Show Asset Vault"]
            },
            {
                name: "scaling_explanation",
                patterns: [/\b(scaling|nodes|instances|autoscaling|cpu|how does scaling work)\b/i],
                response: "ApexBank uses dynamic AWS-like target tracking policies. A single Core Banking node can safely process 200 RPS. \n\n" +
                          "When the overall node CPU average exceeds <span class='chat-code'>70%</span>, our system scale-out policy provisions new instances. When load cools below <span class='chat-code'>30%</span>, instances are gracefully decommissioned (drained and terminated) to minimize cloud scaling overheads.",
                actions: {},
                suggestions: ["Simulate a spike", "Simulate a crash"]
            },
            {
                name: "explain_sqli",
                patterns: [/\b(sql injection|sqli|inject sql|leak data|data leak|sql attack)\b/i],
                response: "SQL Injection (SQLi) occurs when user inputs are directly concatenated into SQL queries without validation. This allows an attacker to manipulate the SQL statement structure. \n\n" +
                          "For example, injecting <span class='chat-code'>' OR '1'='1</span> forces the query conditional to always evaluate to true, bypassing login checks or dumping all user rows. Try it in the <span class='chat-highlight'>SQL Leak Shield</span> tab!",
                actions: { tab: "sql-shield-tab" },
                suggestions: ["How to stop SQLi?", "Explain AES-256 database", "Explain capability codes"]
            },
            {
                name: "explain_waf_prepare",
                patterns: [/\b(prevent sqli|prepared statements|waf|double-layer|prepared query|parameterized)\b/i],
                response: "We secure database queries using a **Double-Layer Security Protocol**:\n\n" +
                          "1. <span class='chat-highlight'>Layer 1: Web Application Firewall (WAF)</span>: Scans input text for patterns like UNION, comment markers, or tautologies, blocking attacks at the perimeter.\n" +
                          "2. <span class='chat-highlight'>Layer 2: Parameterized Queries (Prepared Statements)</span>: Pre-compiles the query template so input parameters are treated strictly as data literals. Even if a user injects SQL code, it won't alter the syntax structure.",
                actions: { tab: "sql-shield-tab" },
                suggestions: ["Explain capability codes", "Explain AES-256 database", "Trigger SQL Injection"]
            },
            {
                name: "explain_aes256",
                patterns: [/\b(aes-256|aes|encryption|encrypted password|secure storage|column encryption)\b/i],
                response: "To secure credentials against data leaks, we implement **AES-256 column-level encryption** for sensitive fields (passwords, SSNs, balances) in the database. \n\n" +
                          "Even if an attacker successfully injects SQL and leaks rows, they only obtain encrypted ciphertext hex blocks. The data remains completely safe unless decrypted using the secure master key.",
                actions: { tab: "sql-shield-tab" },
                suggestions: ["Explain capability codes", "How to stop SQLi?", "Explain SQL Injection"]
            },
            {
                name: "explain_capability",
                patterns: [/\b(capability|capability code|token scope|access control|token)\b/i],
                response: "A **Capability Code** acts as a cryptographically verifiable token representing access scopes. Before executing a query, the database server verifies the code's scope (e.g. `CAP-READ-BALANCE` or `CAP-ADMIN-FULL`). \n\n" +
                          "If the code lacks scope, the server redacts sensitive columns before returning them to the client, forming an API-level access gate that prevents data leaks.",
                actions: { tab: "sql-shield-tab" },
                suggestions: ["Explain AES-256 database", "Trigger SQL Injection", "How to stop SQLi?"]
            },
            {
                name: "run_sqli_sim",
                patterns: [/\b(simulate injection|run sql injection|trigger sqli|attack database|inject payload)\b/i],
                response: "Warning! Switching to <span class='chat-highlight'>SQL Leak Shield</span>, disabling firewall protections, loading the Tautology auth bypass payload, and executing query. Observe how the database leaks all rows to the screen!",
                actions: { tab: "sql-shield-tab", runSqli: true },
                suggestions: ["How to stop SQLi?", "Explain AES-256 database", "Explain capability codes"]
            }
        ];

        // Financial Fallbacks database (simulating Generative LLM logic)
        this.fallbacks = [
            "Interesting query. As your Apex financial assistant, I recommend checking our asset allocation wizard or testing the ledger nodes under spike loads.",
            "I'm designed to guide you through investment allocations, cryptographic validations, and WAF rate limits. Could you clarify your financial query?",
            "ApexBank is a simulated high-availability ledger. You can control it using commands like 'Simulate DDoS', 'Invest in Cyber Shield', or 'Clear logs'.",
            "To test WAF firewalls, try scaling the RPS slider on the right panel or select the DDoS Presets button.",
            "That query falls outside my wealth advising scope, but I can help you configure your portfolios or analyze database replica lag in the right-side metrics panel."
        ];
    }

    init() {
        this.addMessage("bot", "Welcome to ApexBank. I am your AI Wealth Advisor & Security Copilot. Ask me about our yields, how transaction signatures work, or tell me to run infrastructure traffic presets!");
        this.renderSuggestions(this.intents[0].suggestions);
    }

    addMessage(sender, text) {
        const bubble = document.createElement("div");
        bubble.className = `chat-bubble ${sender}`;
        
        // Convert line breaks to HTML breaks
        const formattedText = text.replace(/\n/g, "<br>");
        
        bubble.innerHTML = `
            ${formattedText}
            <span class="chat-timestamp">${new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        `;
        
        this.elements.messagesContainer.appendChild(bubble);
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
        
        this.chatHistory.push({ sender, text });
    }

    showTypingIndicator() {
        if (this.isTyping) return;
        this.isTyping = true;
        
        const indicator = document.createElement("div");
        indicator.className = "chat-bubble bot typing-indicator-bubble";
        indicator.innerHTML = `
            <div class="typing-indicator">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        `;
        
        this.elements.messagesContainer.appendChild(indicator);
        this.elements.messagesContainer.scrollTop = this.elements.messagesContainer.scrollHeight;
    }

    hideTypingIndicator() {
        if (!this.isTyping) return;
        this.isTyping = false;
        const bubble = this.elements.messagesContainer.querySelector(".typing-indicator-bubble");
        if (bubble) bubble.remove();
    }

    renderSuggestions(suggestions) {
        this.elements.suggestionsContainer.innerHTML = '';
        if (!suggestions || suggestions.length === 0) return;

        suggestions.forEach(text => {
            const chip = document.createElement("button");
            chip.className = "suggest-chip";
            chip.textContent = text;
            chip.addEventListener("click", () => {
                this.handleUserInput(text);
            });
            this.elements.suggestionsContainer.appendChild(chip);
        });
    }

    async handleUserInput(text) {
        const query = text.trim();
        if (!query) return;

        // 1. Add user message
        this.addMessage("user", query);
        this.elements.inputField.value = '';

        // 2. Trigger typing indicator
        this.showTypingIndicator();

        // 3. Simulating network and model processing delay (600ms - 900ms)
        const delay = 600 + Math.random() * 300;
        await new Promise(resolve => setTimeout(resolve, delay));

        this.hideTypingIndicator();

        // 4. Process matches
        let matchedIntent = null;
        for (const intent of this.intents) {
            for (const pattern of intent.patterns) {
                if (pattern.test(query)) {
                    matchedIntent = intent;
                    break;
                }
            }
            if (matchedIntent) break;
        }

        let botReply = "";
        let botSuggestions = ["Show available portfolios", "Explain ledger security", "Clear WAF logs"];

        if (matchedIntent) {
            botReply = matchedIntent.response;
            botSuggestions = matchedIntent.suggestions || botSuggestions;
            
            // Execute related page action
            this.executeAction(matchedIntent.actions);
        } else {
            // Generative fallback selector
            const randIndex = Math.floor(Math.random() * this.fallbacks.length);
            botReply = this.fallbacks[randIndex];
        }

        // 5. Add bot response
        this.addMessage("bot", botReply);
        this.renderSuggestions(botSuggestions);
    }

    executeAction(actions) {
        if (!actions || Object.keys(actions).length === 0) return;

        // Bridge to window context controls
        const controls = window.ApexBankControls;
        if (!controls) return;

        if (actions.tab) {
            controls.switchTab(actions.tab);
        }

        if (actions.selectPortfolio) {
            // Wait slightly for tab animation
            setTimeout(() => {
                controls.selectPortfolio(actions.selectPortfolio);
            }, 150);
        }

        if (actions.autofill) {
            setTimeout(() => {
                controls.autofillPassenger("Simulated Investor", "investor@apexledger.com");
            }, 300);
        }

        if (actions.preset) {
            controls.setTrafficPreset(actions.preset);
        }

        if (actions.clearLogs) {
            controls.clearLogs();
        }

        if (actions.resetLedger) {
            controls.resetLedger();
        }

        if (actions.runSqli) {
            setTimeout(() => {
                // Disable protections
                const waf = document.getElementById('sql-policy-waf');
                const prep = document.getElementById('sql-policy-prepare');
                if (waf) waf.checked = false;
                if (prep) prep.checked = false;
                // Load preset payload
                const select = document.getElementById('sql-payload-preset');
                if (select) {
                    select.value = 'bypass_auth';
                    const evt = new Event('change');
                    select.dispatchEvent(evt);
                }
                // Run query
                setTimeout(() => {
                    const btn = document.getElementById('btn-sql-execute');
                    if (btn) btn.click();
                }, 300);
            }, 300);
        }
    }
}
