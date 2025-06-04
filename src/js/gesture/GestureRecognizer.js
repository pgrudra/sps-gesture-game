import { GestureConfig } from './GestureConfig.js';

export class GestureRecognizer {
    constructor(videoElement, onGestureCallback) {
        this.videoElement = videoElement;
        this.onGestureCallback = onGestureCallback;
        
        // MediaPipe components
        this.hands = null;
        this.camera = null;
        
        // Gesture detection state
        this.currentGesture = 'none';
        this.gestureConfidence = 0;
        this.lastGesture = 'none';
        this.gestureHoldTime = 0;
        this.gestureStabilityBuffer = [];
        this.bufferSize = 5;
        
        // Configuration
        this.config = new GestureConfig();
        
        // Performance tracking
        this.lastDetectionTime = 0;
        this.detectionInterval = 100; // ms between detections
    }

    async init() {
        try {
            // Import MediaPipe modules
            const { Hands } = await import('@mediapipe/hands');
            const { Camera } = await import('@mediapipe/camera_utils');
            
            // Initialize MediaPipe Hands
            this.hands = new Hands({
                locateFile: (file) => {
                    return `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`;
                }
            });
            
            this.hands.setOptions({
                maxNumHands: 1,
                modelComplexity: 1,
                minDetectionConfidence: this.config.minDetectionConfidence,
                minTrackingConfidence: this.config.minTrackingConfidence
            });
            
            this.hands.onResults(this.onResults.bind(this));
            
            // Initialize camera
            this.camera = new Camera(this.videoElement, {
                onFrame: async () => {
                    if (Date.now() - this.lastDetectionTime > this.detectionInterval) {
                        await this.hands.send({ image: this.videoElement });
                        this.lastDetectionTime = Date.now();
                    }
                },
                width: 640,
                height: 480
            });
            
            await this.camera.start();
            
            console.log('Gesture recognition initialized successfully');
            
        } catch (error) {
            console.error('Failed to initialize gesture recognition:', error);
            throw error;
        }
    }

    onResults(results) {
        if (results.multiHandLandmarks && results.multiHandLandmarks.length > 0) {
            const landmarks = results.multiHandLandmarks[0];
            const gesture = this.recognizeGesture(landmarks);
            this.updateGestureState(gesture);
        } else {
            // No hand detected - maintain last gesture if configured
            if (this.config.maintainLastGesture) {
                // Keep current gesture
            } else {
                this.updateGestureState('none');
            }
        }
    }

    recognizeGesture(landmarks) {
        const fingerPositions = this.getFingerPositions(landmarks);
        const extendedFingers = this.getExtendedFingers(fingerPositions);
        
        // Rock: All fingers closed (fist)
        if (extendedFingers.every(extended => !extended)) {
            return 'rock';
        }
        
        // Paper: All fingers extended (open hand)
        if (extendedFingers.every(extended => extended)) {
            return 'paper';
        }
        
        // Scissors: Index and middle finger extended, others closed
        if (extendedFingers[1] && extendedFingers[2] && 
            !extendedFingers[0] && !extendedFingers[3] && !extendedFingers[4]) {
            return 'scissors';
        }
        
        // Alternative scissors detection (more lenient)
        if (extendedFingers[1] && extendedFingers[2] && 
            (!extendedFingers[3] || !extendedFingers[4])) {
            return 'scissors';
        }
        
        return 'unknown';
    }

    getFingerPositions(landmarks) {
        // MediaPipe hand landmark indices
        const fingerTips = [4, 8, 12, 16, 20];    // Thumb, Index, Middle, Ring, Pinky tips
        const fingerPips = [3, 6, 10, 14, 18];    // PIP joints
        const fingerMcps = [2, 5, 9, 13, 17];     // MCP joints
        
        return {
            tips: fingerTips.map(i => landmarks[i]),
            pips: fingerPips.map(i => landmarks[i]),
            mcps: fingerMcps.map(i => landmarks[i]),
            wrist: landmarks[0]
        };
    }

    getExtendedFingers(fingerPositions) {
        const extended = [];
        
        // Check each finger
        for (let i = 0; i < 5; i++) {
            if (i === 0) {
                // Thumb: compare tip with MCP (different logic due to thumb orientation)
                const tipX = fingerPositions.tips[i].x;
                const mcpX = fingerPositions.mcps[i].x;
                extended[i] = Math.abs(tipX - mcpX) > this.config.thumbExtensionThreshold;
            } else {
                // Other fingers: compare tip Y with PIP Y
                const tipY = fingerPositions.tips[i].y;
                const pipY = fingerPositions.pips[i].y;
                extended[i] = tipY < pipY - this.config.fingerExtensionThreshold;
            }
        }
        
        return extended;
    }

    updateGestureState(detectedGesture) {
        // Add to stability buffer
        this.gestureStabilityBuffer.push(detectedGesture);
        if (this.gestureStabilityBuffer.length > this.bufferSize) {
            this.gestureStabilityBuffer.shift();
        }
        
        // Determine stable gesture
        const stableGesture = this.getMostFrequentGesture();
        
        if (stableGesture !== this.currentGesture) {
            if (stableGesture === this.lastGesture) {
                this.gestureHoldTime += this.detectionInterval;
            } else {
                this.gestureHoldTime = 0;
                this.lastGesture = stableGesture;
            }
            
            // Only update if gesture is held long enough
            if (this.gestureHoldTime >= this.config.minGestureHoldTime) {
                this.currentGesture = stableGesture;
                this.gestureConfidence = this.calculateConfidence(stableGesture);
                
                if (this.onGestureCallback) {
                    this.onGestureCallback(this.currentGesture, this.gestureConfidence);
                }
            }
        }
    }

    getMostFrequentGesture() {
        if (this.gestureStabilityBuffer.length === 0) return 'none';
        
        const frequency = {};
        this.gestureStabilityBuffer.forEach(gesture => {
            frequency[gesture] = (frequency[gesture] || 0) + 1;
        });
        
        return Object.keys(frequency).reduce((a, b) => 
            frequency[a] > frequency[b] ? a : b
        );
    }

    calculateConfidence(gesture) {
        const occurrences = this.gestureStabilityBuffer.filter(g => g === gesture).length;
        return occurrences / this.gestureStabilityBuffer.length;
    }

    // Configuration methods
    setDetectionSensitivity(sensitivity) {
        // sensitivity: 0.1 (very strict) to 1.0 (very loose)
        this.config.minDetectionConfidence = Math.max(0.1, Math.min(0.9, 0.9 - sensitivity * 0.4));
        this.config.minTrackingConfidence = Math.max(0.1, Math.min(0.9, 0.9 - sensitivity * 0.4));
        this.config.fingerExtensionThreshold = 0.02 + (sensitivity * 0.03);
        this.config.thumbExtensionThreshold = 0.05 + (sensitivity * 0.05);
        
        if (this.hands) {
            this.hands.setOptions({
                minDetectionConfidence: this.config.minDetectionConfidence,
                minTrackingConfidence: this.config.minTrackingConfidence
            });
        }
    }

    setGestureHoldTime(timeMs) {
        this.config.minGestureHoldTime = timeMs;
    }

    setStabilityBufferSize(size) {
        this.bufferSize = Math.max(3, Math.min(10, size));
        this.gestureStabilityBuffer = this.gestureStabilityBuffer.slice(-this.bufferSize);
    }

    // Debug methods
    getDebugInfo() {
        return {
            currentGesture: this.currentGesture,
            confidence: this.gestureConfidence,
            bufferSize: this.gestureStabilityBuffer.length,
            gestureBuffer: [...this.gestureStabilityBuffer],
            holdTime: this.gestureHoldTime,
            config: { ...this.config }
        };
    }

    // Cleanup
    dispose() {
        if (this.camera) {
            this.camera.stop();
        }
        
        if (this.hands) {
            this.hands.close();
        }
    }
}