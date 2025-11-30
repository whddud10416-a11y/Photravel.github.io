import * as T from 'three';

export class Navigation {
    constructor(gates, onGatePassedCallback) {
        this.gates = gates;
        this.onGatePassedCallback = onGatePassedCallback;
        this.currentTargetGate = null;
        this.visitedGates = new Set();
        this.justPassedGate = null; // To handle passing event outside the loop
        this.ARRIVAL_DISTANCE = 39.0;
        
        this.lastTargetNumber = -1; // For debugging

        console.log(`Navigation initialized with ${gates.length} gates.`);
    }

    update(playerWorldPosition) {
        // 1. Check for arrival at ANY gate to mark it as visited
        this.gates.forEach(gate => {
            if (!this.visitedGates.has(gate.uuid) && gate.userData.triggerPoint) {
                // Use the ground-level trigger point for distance check
                const distance = playerWorldPosition.distanceTo(gate.userData.triggerPoint);

                if (distance < this.ARRIVAL_DISTANCE) {
                    this.visitedGates.add(gate.uuid);
                    this.justPassedGate = gate; // Store the gate to be processed externally
                }
            }
        });

        // 2. In every frame, find the closest unvisited gate to be the new target
        let closestGate = null;
        let minDistance = Infinity;
        this.gates.forEach(gate => {
            if (!this.visitedGates.has(gate.uuid) && gate.userData.triggerPoint) {
                // Use the ground-level trigger point for distance check
                const distance = playerWorldPosition.distanceTo(gate.userData.triggerPoint);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestGate = gate;
                }
            }
        });
        
        // Only update and log if the target has actually changed
        if (this.currentTargetGate !== closestGate) {
            this.currentTargetGate = closestGate;

            if (this.currentTargetGate) {
                const newTargetNumber = this.currentTargetGate.userData.number;
                this.lastTargetNumber = newTargetNumber;
            } else if (this.lastTargetNumber !== null) {
                this.lastTargetNumber = null;
            }
        }
    }

    getJustPassedGate() {
        const gate = this.justPassedGate;
        this.justPassedGate = null; // Reset after getting it
        return gate;
    }

    getCurrentTarget() {
        return this.currentTargetGate;
    }
}