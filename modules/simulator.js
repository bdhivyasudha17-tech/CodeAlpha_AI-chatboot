/**
 * Cloud Infrastructure Simulator - Cloud-Based Bus Pass System
 * Models Load Balancer, Auto Scaling Group (EC2 nodes), Caching (Redis), 
 * Database replication, dynamic loads, and traffic configurations.
 */

export class CloudSimulator {
    constructor(onStateChange, onLog) {
        this.onStateChange = onStateChange;
        this.onLog = onLog;

        // Configuration limits
        this.config = {
            minInstances: 2,
            maxInstances: 10,
            targetCpuScaleOut: 70, // %
            targetCpuScaleIn: 30,  // %
            instanceCapacityRps: 200 // Max requests a single node can handle comfortably
        };

        // System state variables
        this.instances = [];
        this.instanceCounter = 0;
        this.metrics = {
            rps: 0,
            avgCpu: 0,
            avgResponseTime: 120, // ms
            cacheHitRate: 85, // %
            activeConnections: 0,
            droppedRequests: 0,
            totalRequestsProcessed: 0,
            totalBookingsMade: 0,
            dbLoad: 15 // %
        };

        // Replication status
        this.database = {
            masterLoad: 10,
            replicaLoad: 8,
            replicaLagMs: 2
        };

        this.trafficPreset = "normal"; // normal, rush-hour, ddos, server-failure
        this.targetRps = 100;
        this.isDdosMode = false;
        
        // Internal loop handles
        this.intervalId = null;

        // Initialize minimum instances
        this.scaleOut(this.config.minInstances);
    }

    start() {
        if (this.intervalId) return;

        this.intervalId = setInterval(() => {
            this.tick();
        }, 1000);
        
        this.log("System", "INFO: ApexBank Core Infrastructure Ledger Simulation initialized.", "sys");
    }

    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    log(type, message, category = "sys") {
        if (this.onLog) {
            this.onLog(type, message, category);
        }
    }

    /**
     * Set simulated traffic RPS manually
     */
    setTargetRps(value) {
        this.targetRps = parseInt(value, 10);
    }

    /**
     * Switch traffic profiles
     */
    setPreset(preset) {
        this.trafficPreset = preset;
        this.isDdosMode = false;

        switch (preset) {
            case "low":
                this.targetRps = 30;
                this.log("System", "Transaction load preset: LOW (After-hours liquidity).", "sys");
                break;
            case "normal":
                this.targetRps = 120;
                this.log("System", "Transaction load preset: NORMAL (Standard clearing cycle).", "sys");
                break;
            case "rush-hour":
                this.targetRps = 950;
                this.log("System", "Transaction load preset: HIGH VOLUME (Direct deposit clearance spike!).", "sys");
                break;
            case "ddos":
                this.targetRps = 3500;
                this.isDdosMode = true;
                this.log("System", "WAF WARN: Distributed Transaction Injection Botnet simulated. Fraud mitigation active.", "sec");
                break;
            case "failure":
                this.targetRps = 200;
                // Force fail some nodes
                this.triggerServerFailure();
                break;
        }
    }

    triggerServerFailure() {
        const healthyNodes = this.instances.filter(i => i.status === "healthy");
        if (healthyNodes.length > 0) {
            const victim = healthyNodes[Math.floor(Math.random() * healthyNodes.length)];
            victim.status = "failed";
            victim.cpu = 100;
            this.log("Ledger-Scaler", `CRITICAL: Ledger Node ${victim.id} memory saturation crash. Offline.`, "sc");
        }
    }

    /**
     * Add virtual server instances (Scale Out)
     */
    scaleOut(count = 1) {
        let added = 0;
        for (let i = 0; i < count; i++) {
            if (this.instances.length < this.config.maxInstances) {
                this.instanceCounter++;
                const newInstance = {
                    id: `node-${String(this.instanceCounter).padStart(3, '0')}`,
                    status: "spinning-up", // spinning-up, healthy, draining, failed
                    cpu: 5,
                    activeConns: 0,
                    uptime: 0,
                    provisionProgress: 0 // reaches 100 to become healthy
                };
                this.instances.push(newInstance);
                added++;
                this.log("Ledger-Scaler", `PROVISIONING: Cluster scale-out, booting Ledger Node ${newInstance.id}.`, "sc");
            }
        }
        return added;
    }

    /**
     * Terminate virtual server instances (Scale In)
     */
    scaleIn() {
        // Find healthy instance to terminate (leave minInstances)
        const eligible = this.instances.filter(i => i.status === "healthy" || i.status === "spinning-up");
        if (eligible.length > this.config.minInstances) {
            // Pick the newest instance to terminate
            const victim = eligible[eligible.length - 1];
            victim.status = "draining";
            this.log("Ledger-Scaler", `DRAINING: Offloading connections from ${victim.id}. Graceful decommission active.`, "sc");
            return true;
        }
        return false;
    }

    /**
     * Central Clock Tick: updates system state every 1 second
     */
    tick() {
        // 1. Progress instance provisioning & grace shutdown
        this.instances.forEach(instance => {
            if (instance.status === "spinning-up") {
                instance.provisionProgress += 35; // Takes ~3 seconds
                if (instance.provisionProgress >= 100) {
                    instance.status = "healthy";
                    instance.provisionProgress = 100;
                    this.log("Ledger-Scaler", `HEALTHY: Node ${instance.id} synchronized to Core Banking cluster ledger.`, "sc");
                }
            } else if (instance.status === "draining") {
                instance.activeConns = Math.max(0, Math.floor(instance.activeConns * 0.3));
                if (instance.activeConns === 0) {
                    // Fully terminated
                    const index = this.instances.indexOf(instance);
                    if (index > -1) {
                        this.instances.splice(index, 1);
                        this.log("Ledger-Scaler", `DECOMMISSIONED: Node ${instance.id} resources released.`, "sc");
                    }
                }
            } else if (instance.status === "healthy") {
                instance.uptime += 1;
            }
        });

        // 2. Load Balancer distributes current traffic
        const healthyInstances = this.instances.filter(i => i.status === "healthy");
        const activeCount = healthyInstances.length;
        
        let totalIncomingRequests = this.targetRps + Math.floor((Math.random() - 0.5) * (this.targetRps * 0.1));
        if (totalIncomingRequests < 0) totalIncomingRequests = 0;
        
        this.metrics.rps = totalIncomingRequests;

        // WAF evaluation (evaluates simulated traffic logs if DDoS is active)
        let filteredRequests = totalIncomingRequests;
        let blockedRequests = 0;

        if (this.isDdosMode) {
            // Drop ~75% of high request traffic as malicious bots
            blockedRequests = Math.floor(totalIncomingRequests * 0.75);
            filteredRequests = totalIncomingRequests - blockedRequests;
            this.metrics.droppedRequests += blockedRequests;
            if (blockedRequests > 0 && Math.random() > 0.6) {
                this.log("WAF", `BLOCKED: WAF dropped ${blockedRequests} packet bursts from botnet IPs.`, "sec");
            }
        }

        this.metrics.activeConnections = filteredRequests;

        // Distribute load to healthy servers
        if (activeCount > 0) {
            const share = Math.floor(filteredRequests / activeCount);
            let sumCpu = 0;

            healthyInstances.forEach(instance => {
                // Calculate CPU load on instance based on Rps share
                // 100% load reached when RPS per instance hits configuration limit
                const targetCpu = Math.min(100, Math.floor((share / this.config.instanceCapacityRps) * 100));
                
                // Add smoothing to CPU transitions
                instance.cpu = Math.floor(instance.cpu * 0.4 + targetCpu * 0.6);
                instance.activeConns = share;
                sumCpu += instance.cpu;
            });

            // 3. Compute Average Infrastructure Metrics
            const averageCpu = Math.floor(sumCpu / activeCount);
            this.metrics.avgCpu = averageCpu;

            // Average Response Time is modeled as curve: 
            // base (80ms) + scaling delay factor as average CPU increases
            let baseLatency = 80;
            if (averageCpu > 90) {
                // System severely overloaded
                baseLatency = 2400 + Math.random() * 800;
                this.metrics.droppedRequests += Math.floor(filteredRequests * 0.1); // 10% connection timeout drop
                if (Math.random() > 0.7) {
                    this.log("LoadBalancer", `WARNING: Banking ledger throughput saturated. Avg CPU ${averageCpu}%. Processing delay queue engaged.`, "sec");
                }
            } else if (averageCpu > 70) {
                baseLatency = 350 + (averageCpu - 70) * 40;
            } else {
                baseLatency = 80 + averageCpu * 1.5;
            }
            this.metrics.avgResponseTime = Math.floor(baseLatency);

            // 4. Autoscaling Checks (Target Tracking Policy)
            if (averageCpu > this.config.targetCpuScaleOut && this.instances.length < this.config.maxInstances) {
                // Prevent scaling if currently spinning up to avoid thrashing
                const spinningUp = this.instances.filter(i => i.status === "spinning-up").length;
                if (spinningUp === 0) {
                    const scaled = this.scaleOut(1);
                    if (scaled > 0) {
                        this.log("Ledger-Scaler", `SCALE OUT: Average Node CPU ${averageCpu}% exceeds threshold. Launching 1 node.`, "sc");
                    }
                }
            } else if (averageCpu < this.config.targetCpuScaleIn && this.instances.length > this.config.minInstances) {
                const draining = this.instances.filter(i => i.status === "draining").length;
                if (draining === 0) {
                    const scaled = this.scaleIn();
                    if (scaled) {
                        this.log("Ledger-Scaler", `SCALE IN: Average Node CPU ${averageCpu}% is low. Terminating 1 idle node.`, "sc");
                    }
                }
            }

            // 5. Caching metrics (Higher RPS, cache shifts slightly, Redis absorbs reads)
            // Caching relieves DB loads
            this.metrics.cacheHitRate = Math.max(65, Math.floor(92 - (filteredRequests / 2000)));
            
            // Database load (Write loads from bookings + read cache misses)
            const cacheMisses = Math.floor(filteredRequests * (1 - this.metrics.cacheHitRate / 100));
            this.database.masterLoad = Math.min(100, Math.floor(10 + (cacheMisses * 0.08) + (this.metrics.totalBookingsMade * 0.1)));
            this.database.replicaLoad = Math.min(100, Math.floor(8 + (cacheMisses * 0.04)));
            this.database.replicaLagMs = Math.max(1, Math.floor(2 + (this.database.masterLoad * 0.05)));
            
            this.metrics.dbLoad = Math.floor((this.database.masterLoad + this.database.replicaLoad) / 2);

        } else {
            // All servers crashed or failed!
            this.metrics.avgCpu = 0;
            this.metrics.avgResponseTime = 5000; // Unresponsive
            this.metrics.dbLoad = 0;
            this.metrics.activeConnections = 0;
            if (this.instances.length === 0) {
                // Safety recovery scale
                this.scaleOut(this.config.minInstances);
            }
        }

        // Keep running totals
        this.metrics.totalRequestsProcessed += filteredRequests;

        // 6. Trigger state update callbacks to repaint UI
        if (this.onStateChange) {
            this.onStateChange(this.getSnapshot());
        }
    }

    getSnapshot() {
        return {
            instances: JSON.parse(JSON.stringify(this.instances)),
            metrics: { ...this.metrics },
            database: { ...this.database },
            preset: this.trafficPreset,
            targetRps: this.targetRps,
            isDdosMode: this.isDdosMode
        };
    }

    /**
     * Logs database insert behavior for ticket booking
     */
    recordBooking() {
        this.metrics.totalBookingsMade++;
        this.database.masterLoad = Math.min(100, this.database.masterLoad + 2); // DB spike for transaction write
    }
}
