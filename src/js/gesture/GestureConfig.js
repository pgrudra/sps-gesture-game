export class GestureConfig {
    constructor() {
        // MediaPipe configuration
        this.minDetectionConfidence = 0.7;
        this.minTrackingConfidence = 0.5;
        
        // Gesture recognition thresholds
        this.fingerExtensionThreshold = 0.05;  // How far tip must be from pip to be "extended"
        this.thumbExtensionThreshold = 0.08;   // Thumb extension threshold (different due to orientation)
        
        // Stability and timing
        this.minGestureHoldTime = 200;         // ms - how long gesture must be held to register
        this.maintainLastGesture = true;       // Keep last gesture when no hand detected
        
        // Performance
        this.maxDetectionRate = 10;            // Max detections per second
        
        // Gesture-specific configurations
        this.gestureConfigs = {
            rock: {
                description: "Closed fist - all fingers down",
                requiredFingers: [false, false, false, false, false], // thumb, index, middle, ring, pinky
                tolerance: 0.1
            },
            paper: {
                description: "Open hand - all fingers extended",
                requiredFingers: [true, true, true, true, true],
                tolerance: 0.2
            },
            scissors: {
                description: "Index and middle finger extended",
                requiredFingers: [false, true, true, false, false],
                tolerance: 0.1,
                alternativePatterns: [
                    [true, true, true, false, false]  // Allow thumb extended too
                ]
            }
        };
    }

    // Preset configurations for different use cases
    static getPresetConfig(preset) {
        const config = new GestureConfig();
        
        switch (preset) {
            case 'strict':
                config.minDetectionConfidence = 0.8;
                config.minTrackingConfidence = 0.7;
                config.fingerExtensionThreshold = 0.03;
                config.thumbExtensionThreshold = 0.06;
                config.minGestureHoldTime = 300;
                break;
                
            case 'relaxed':
                config.minDetectionConfidence = 0.6;
                config.minTrackingConfidence = 0.4;
                config.fingerExtensionThreshold = 0.07;
                config.thumbExtensionThreshold = 0.1;
                config.minGestureHoldTime = 150;
                break;
                
            case 'mobile':
                config.minDetectionConfidence = 0.65;
                config.minTrackingConfidence = 0.45;
                config.fingerExtensionThreshold = 0.06;
                config.thumbExtensionThreshold = 0.09;
                config.minGestureHoldTime = 250;
                config.maxDetectionRate = 8; // Lower for mobile performance
                break;
                
            case 'desktop':
                config.minDetectionConfidence = 0.75;
                config.minTrackingConfidence = 0.55;
                config.fingerExtensionThreshold = 0.04;
                config.thumbExtensionThreshold = 0.07;
                config.minGestureHoldTime = 200;
                config.maxDetectionRate = 12;
                break;
                
            default:
                // Use default values
                break;
        }
        
        return config;
    }

    // Dynamic configuration based on device capabilities
    static getConfigForDevice() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        const isLowPower = navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 2;
        
        if (isMobile || isLowPower) {
            return GestureConfig.getPresetConfig('mobile');
        } else {
            return GestureConfig.getPresetConfig('desktop');
        }
    }

    // Validation methods
    validateFingerPattern(extendedFingers, gestureType) {
        const config = this.gestureConfigs[gestureType];
        if (!config) return false;
        
        const requiredPattern = config.requiredFingers;
        let matches = 0;
        
        for (let i = 0; i < 5; i++) {
            if (extendedFingers[i] === requiredPattern[i]) {
                matches++;
            }
        }
        
        const accuracy = matches / 5;
        const threshold = 1 - config.tolerance;
        
        if (accuracy >= threshold) {
            return true;
        }
        
        // Check alternative patterns if available
        if (config.alternativePatterns) {
            for (let altPattern of config.alternativePatterns) {
                matches = 0;
                for (let i = 0; i < 5; i++) {
                    if (extendedFingers[i] === altPattern[i]) {
                        matches++;
                    }
                }
                accuracy = matches / 5;
                if (accuracy >= threshold) {
                    return true;
                }
            }
        }
        
        return false;
    }

    // Configuration adjustment methods
    adjustForLighting(lightingQuality) {
        // lightingQuality: 'poor', 'average', 'good'
        switch (lightingQuality) {
            case 'poor':
                this.minDetectionConfidence = Math.max(0.4, this.minDetectionConfidence - 0.2);
                this.minTrackingConfidence = Math.max(0.3, this.minTrackingConfidence - 0.2);
                this.minGestureHoldTime += 100;
                break;
            case 'good':
                this.minDetectionConfidence = Math.min(0.9, this.minDetectionConfidence + 0.1);
                this.minTrackingConfidence = Math.min(0.8, this.minTrackingConfidence + 0.1);
                this.minGestureHoldTime = Math.max(100, this.minGestureHoldTime - 50);
                break;
            // 'average' uses default values
        }
    }

    adjustForPerformance(performanceLevel) {
        // performanceLevel: 'low', 'medium', 'high'
        switch (performanceLevel) {
            case 'low':
                this.maxDetectionRate = 6;
                this.minGestureHoldTime += 50;
                break;
            case 'high':
                this.maxDetectionRate = 15;
                this.minGestureHoldTime = Math.max(100, this.minGestureHoldTime - 50);
                break;
            // 'medium' uses default values
        }
    }

    // Export/Import configuration
    toJSON() {
        return JSON.stringify(this, null, 2);
    }

    static fromJSON(jsonString) {
        const data = JSON.parse(jsonString);
        const config = new GestureConfig();
        Object.assign(config, data);
        return config;
    }
}