# SkyRoute: Secure Cloud-Based Bus Pass System

A high-fidelity, secure, and interactive cloud-hosted Single Page Application (SPA) showcasing secure digital pass management, cryptographic ticket signing, and elastic auto-scaling infrastructure.

## 🚀 Live Demo & Deployment
* **Live Web App**: [GitHub Pages Deploy Link] (Update this with your live link!)
* **Local Run**: `http://localhost:3000`

---

## 🛠️ Key Architectural & Security Features

* **Cryptographic Theft Prevention**: Generates an asymmetric SHA-256 HMAC digital signature for each ticket based on user variables and a secure backend key. Prevents seat transfer and code forgery.
* **Double-Spend Verification**: The scan gate terminal maintains a secure check-in ledger. Scanning a ticket QR code twice triggers a double-spend alarm, blocking entry.
* **Price Tampering Protection**: Prevents client-side price hacks. If a user modifies the DOM to submit a lower ticket price, the backend validator intercepts the request and logs a WAF security exception.
* **Cloud Elastic Auto-Scaling Simulator**: Demonstrates dynamic scale-out/scale-in triggers (based on CPU thresholds), load-balanced routing, Redis in-memory cache hits, and PostgreSQL database replication lag under simulated high traffic volumes.

---

## 💻 Tech Stack
* **Frontend**: HTML5, Vanilla ES Modules, Vanilla CSS (Glassmorphism & animations)
* **Backend Simulation & Dev Server**: Node.js (HTTP and FS libraries)
* **Testing**: Native JavaScript assertions engine

---

## ⚙️ How to Setup & Run Locally

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/YOUR-USERNAME/YOUR-REPO-NAME.git
   cd YOUR-REPO-NAME
   ```
   
2. **Start the Development Server**:
   ```bash
   node dev-server.js
   ```
   * Open your browser and navigate to: **`http://localhost:3000`**

3. **Run the Security Unit Tests**:
   ```bash
   node test.js
   ```
"# CodeAlpha_AI-chatboot" 
