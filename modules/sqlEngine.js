/**
 * SQL Simulation Engine
 * Handles in-memory SQL database state, real/simulated AES-256 column encryption,
 * WAF signature scanning, parameterized Prepared Statements, and Capability Code authorization checks.
 */

let webCrypto = null;
if (typeof window !== 'undefined' && window.crypto) {
    webCrypto = window.crypto;
} else if (typeof globalThis !== 'undefined' && globalThis.crypto) {
    webCrypto = globalThis.crypto;
}

// Initial sensitive cleartext records
export const INITIAL_USERS = [
    { id: 1, username: "alice", password: "AliceSecretPassword123!", ssn: "987-65-4321", balance: 12450.50, capability: "CAP-READ-PUBLIC" },
    { id: 2, username: "bob", password: "BobSecurePassword456$", ssn: "456-78-1234", balance: 5200.00, capability: "CAP-READ-PUBLIC" },
    { id: 3, username: "charlie", password: "CharlieInvest2026%", ssn: "321-65-9870", balance: 98400.00, capability: "CAP-READ-BALANCE" },
    { id: 4, username: "admin_helen", password: "HelenAdminP@ssw0rd!Super", ssn: "111-22-3333", balance: 1250000.00, capability: "CAP-ADMIN-FULL" }
];

export let databaseState = {
    users: []
};

/**
 * Encrypts data using real AES-256-GCM (via Web Crypto) with random IVs.
 * Falls back to an authentic-looking custom XOR block cipher for environments without SubtleCrypto.
 */
export async function encryptAES256(text) {
    if (!text) return "";
    const textStr = String(text);
    
    if (webCrypto && webCrypto.subtle) {
        try {
            const rawKey = new TextEncoder().encode("SecretMasterDatabaseKey2026!@#$");
            const hash = await webCrypto.subtle.digest('SHA-256', rawKey);
            const key = await webCrypto.subtle.importKey(
                'raw',
                hash,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );
            const iv = webCrypto.getRandomValues(new Uint8Array(12));
            const encoded = new TextEncoder().encode(textStr);
            const ciphertext = await webCrypto.subtle.encrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                encoded
            );
            const combined = new Uint8Array(iv.length + ciphertext.byteLength);
            combined.set(iv, 0);
            combined.set(new Uint8Array(ciphertext), iv.length);
            // Convert to hex
            return Array.from(combined).map(b => b.toString(16).padStart(2, '0')).join('');
        } catch (e) {
            // Fall through to fallback
        }
    }
    
    // Fallback: authentic AES hex-block signature prefix + XOR encoding
    const mockPrefix = "5f8c92a104b3d5e7";
    let cipher = "";
    for (let i = 0; i < textStr.length; i++) {
        const charCode = textStr.charCodeAt(i);
        const keyChar = "AES256SecretKey".charCodeAt(i % 15);
        cipher += (charCode ^ keyChar).toString(16).padStart(2, '0');
    }
    return mockPrefix + cipher;
}

/**
 * Decrypts AES-256 encrypted hex strings back to cleartext.
 */
export async function decryptAES256(hexString) {
    if (!hexString || typeof hexString !== 'string') return "";
    if (hexString.startsWith("●●●")) return hexString; // Skip redacted values

    const mockPrefix = "5f8c92a104b3d5e7";
    if (webCrypto && webCrypto.subtle && !hexString.startsWith(mockPrefix)) {
        try {
            const rawKey = new TextEncoder().encode("SecretMasterDatabaseKey2026!@#$");
            const hash = await webCrypto.subtle.digest('SHA-256', rawKey);
            const key = await webCrypto.subtle.importKey(
                'raw',
                hash,
                { name: 'AES-GCM' },
                false,
                ['encrypt', 'decrypt']
            );
            const bytes = new Uint8Array(hexString.match(/.{1,2}/g).map(byte => parseInt(byte, 16)));
            const iv = bytes.slice(0, 12);
            const ciphertext = bytes.slice(12);
            const decrypted = await webCrypto.subtle.decrypt(
                { name: 'AES-GCM', iv: iv },
                key,
                ciphertext
            );
            return new TextDecoder().decode(decrypted);
        } catch (e) {
            // Fall through to fallback
        }
    }

    // Fallback Decryption
    if (hexString.startsWith(mockPrefix)) {
        const payload = hexString.substring(mockPrefix.length);
        let decrypted = "";
        const bytes = payload.match(/.{1,2}/g) || [];
        for (let i = 0; i < bytes.length; i++) {
            const charCode = parseInt(bytes[i], 16);
            const keyChar = "AES256SecretKey".charCodeAt(i % 15);
            decrypted += String.fromCharCode(charCode ^ keyChar);
        }
        return decrypted;
    }

    return hexString; // Return literal if not matching encryption formats
}

/**
 * Initialize the encrypted users table at rest
 */
export async function initDatabase() {
    databaseState.users = [];
    for (const user of INITIAL_USERS) {
        databaseState.users.push({
            id: user.id,
            username: user.username,
            encrypted_password: await encryptAES256(user.password),
            encrypted_ssn: await encryptAES256(user.ssn),
            encrypted_balance: await encryptAES256(user.balance.toFixed(2)),
            capability_scope: user.capability
        });
    }
}

/**
 * Executes dynamic query evaluation simulating SQL behaviors.
 */
export async function executeQuery(rawInput, settings, capCode) {
    const logs = [];
    let queryExecuted = "";
    let results = [];
    let isDataLeak = false;

    logs.push({ step: "1. RECEIVE_REQUEST", detail: `Received search input: "${rawInput}"` });

    // Layer 1: WAF (Web Application Firewall) Input Filtering
    if (settings.wafEnabled) {
        logs.push({ step: "2. WAF_SCAN", detail: "Scanning query structures for injection signatures..." });
        
        const sqliPatterns = [
            /UNION\s+SELECT/i,
            /--/i,
            /\/\*/i,
            /OR\s+['"]?\d+['"]?\s*=\s*['"]?\d+/i,
            /OR\s+['"]?[A-Za-z]+['"]?\s*=\s*['"]?[A-Za-z]+/i,
            /OR\s+true/i,
            /UNION\s+ALL\s+SELECT/i
        ];

        let wafBlocked = false;
        for (const pattern of sqliPatterns) {
            if (pattern.test(rawInput)) {
                logs.push({ step: "WAF_BLOCKED", detail: `🚨 CRITICAL SIGNATURE DETECTED: Blocked by pattern ${pattern}` });
                wafBlocked = true;
                break;
            }
        }

        if (wafBlocked) {
            return {
                success: false,
                queryExecuted: "BLOCK_EXCEPTION",
                logs,
                results: [],
                isDataLeak: false
            };
        }
        logs.push({ step: "WAF_CLEAN", detail: "WAF: No malicious signatures found. Proceeding." });
    } else {
        logs.push({ step: "WAF_BYPASS", detail: "WAF is disabled. Skipping input inspections." });
    }

    // Capability Scope Access Check
    logs.push({ step: "3. ACCESS_CONTROL", detail: `Checking API token authorization scope for: "${capCode || 'None'}"` });
    let scope = "PUBLIC";
    if (capCode === "CAP-READ-BALANCE") {
        scope = "BALANCE_READ";
        logs.push({ step: "AUTH_GRANTED", detail: "Authorization verified. Scope: [BALANCE_READ]." });
    } else if (capCode === "CAP-ADMIN-FULL") {
        scope = "ADMIN_FULL";
        logs.push({ step: "AUTH_GRANTED", detail: "Authorization verified. Scope: [ADMIN_FULL]." });
    } else if (capCode && capCode.trim() !== "") {
        logs.push({ step: "AUTH_DENIED", detail: "⚠️ Invalid authorization code. Falling back to PUBLIC scope." });
    } else {
        logs.push({ step: "AUTH_GUEST", detail: "No credential supplied. Running with guest permissions [PUBLIC]." });
    }

    // Layer 2: Prepared Statements vs Dynamic Concatenation
    if (settings.preparedStatementsEnabled) {
        queryExecuted = "SELECT id, username, encrypted_password, encrypted_ssn, encrypted_balance, capability_scope FROM users WHERE username = ?";
        logs.push({ step: "4. QUERY_COMPILE", detail: `Prepared statement compiled: "${queryExecuted}"` });
        logs.push({ step: "PARAM_BINDING", detail: `Parameter mapped as secure data literal: [?] => "${rawInput}"` });

        // Search matching rows exactly
        const match = databaseState.users.filter(u => u.username === rawInput);
        results = match.map(u => applyScopeRedaction(u, scope));
        
        logs.push({ step: "5. DATABASE_RUN", detail: `Execution complete. Rows matched: ${results.length}` });
    } else {
        // Vulnerable Dynamic Concat
        queryExecuted = `SELECT * FROM users WHERE username = '${rawInput}'`;
        logs.push({ step: "4. DYNAMIC_CONCAT", detail: "⚠️ Dynamic SQL concatenation executed. Parser structure exposed." });
        logs.push({ step: "QUERY_SENT", detail: `SQL Sent: ${queryExecuted}` });

        const lowerInput = rawInput.toLowerCase();
        
        // Tautology checks (' OR 1=1 or similar)
        const isBypass = lowerInput.includes("' or '1'='1") || 
                         lowerInput.includes("' or 1=1") || 
                         lowerInput.includes("' or ''='") || 
                         lowerInput.includes("' or true") ||
                         lowerInput.includes('" or "1"="1') ||
                         lowerInput.includes('" or 1=1') ||
                         lowerInput.includes('" or true');
                         
        const isUnion = lowerInput.includes("union select");

        if (isBypass) {
            logs.push({ step: "INJECTION_SUCCESS", detail: "💥 SQL syntax hijack: OR condition forced TRUE. Returning all database rows." });
            results = databaseState.users.map(u => applyScopeRedaction(u, scope));
            isDataLeak = true;
        } else if (isUnion) {
            logs.push({ step: "INJECTION_SUCCESS", detail: "💥 SQL syntax hijack: UNION SELECT executed. Fetching all schemas." });
            // Attackers leak all columns
            results = databaseState.users.map(u => ({
                id: u.id,
                username: u.username,
                encrypted_password: u.encrypted_password,
                encrypted_ssn: u.encrypted_ssn,
                encrypted_balance: u.encrypted_balance,
                capability_scope: u.capability_scope
            }));
            isDataLeak = true;
        } else {
            const match = databaseState.users.filter(u => u.username === rawInput);
            results = match.map(u => applyScopeRedaction(u, scope));
        }

        logs.push({ step: "5. DATABASE_RUN", detail: `Execution complete. Rows matched: ${results.length}` });
    }

    // Detect leaks in PUBLIC guest scope
    if (results.length > 1 && scope === "PUBLIC") {
        isDataLeak = true;
    }

    if (isDataLeak) {
        logs.push({ step: "🚨 DATA_LEAK_ALERT", detail: "CRITICAL: SQL Injection successfully bypassed authentication. Database records leaked!" });
    } else {
        logs.push({ step: "STATUS_OK", detail: "No unauthorized records returned. System secure." });
    }

    return {
        success: true,
        queryExecuted,
        logs,
        results,
        isDataLeak
    };
}

/**
 * Filter columns at the database server level based on capability scope before sending to client.
 */
function applyScopeRedaction(userRecord, scope) {
    const record = {
        id: userRecord.id,
        username: userRecord.username,
        capability_scope: userRecord.capability_scope
    };

    if (scope === "ADMIN_FULL") {
        record.encrypted_password = userRecord.encrypted_password;
        record.encrypted_ssn = userRecord.encrypted_ssn;
        record.encrypted_balance = userRecord.encrypted_balance;
    } else if (scope === "BALANCE_READ") {
        record.encrypted_password = "●●● [Unauthorized] ●●●";
        record.encrypted_ssn = "●●● [Unauthorized] ●●●";
        record.encrypted_balance = userRecord.encrypted_balance;
    } else {
        // PUBLIC
        record.encrypted_password = "●●● [Unauthorized] ●●●";
        record.encrypted_ssn = "●●● [Unauthorized] ●●●";
        record.encrypted_balance = "●●● [Unauthorized] ●●●";
    }

    return record;
}
