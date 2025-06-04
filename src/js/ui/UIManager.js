export class UIManager {
    constructor() {
        // UI Elements
        this.elements = {
            loadingScreen: document.getElementById('loadingScreen'),
            startScreen: document.getElementById('startScreen'),
            gameOverScreen: document.getElementById('gameOverScreen'),
            scoreValue: document.getElementById('scoreValue'),
            speedValue: document.getElementById('speedValue'),
            currentGesture: document.getElementById('currentGesture'),
            finalScore: document.getElementById('finalScore'),
            startButton: document.getElementById('startButton'),
            videoElement: document.getElementById('videoElement')
        };
        
        // Animation states
        this.animationStates = {
            scoreAnimation: null,
            gestureAnimation: null
        };
        
        // Gesture display colors
        this.gestureColors = {
            'rock': '#8B4513',
            'paper': '#FFFFFF',
            'scissors': '#C0C0C0',
            'none': '#4ecdc4',
            'unknown': '#ff6b6b'
        };
        
        // Gesture display emojis
        this.gestureEmojis = {
            'rock': '✊',
            'paper': '✋',
            'scissors': '✌️',
            'none': '❓',
            'unknown': '❌'
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.initializeAnimations();
    }

    setupEventListeners() {
        // Handle window resize for responsive design
        window.addEventListener('resize', () => {
            this.handleResize();
        });
        
        // Handle visibility change (tab switching)
        document.addEventListener('visibilitychange', () => {
            this.handleVisibilityChange();
        });
        
        // Handle fullscreen changes
        document.addEventListener('fullscreenchange', () => {
            this.handleFullscreenChange();
        });
        
        // Touch events for mobile
        if ('ontouchstart' in window) {
            this.setupTouchEvents();
        }
    }

    setupTouchEvents() {
        // Prevent default touch behaviors that might interfere with the game
        document.addEventListener('touchmove', (e) => {
            if (e.target === document.body) {
                e.preventDefault();
            }
        }, { passive: false });
        
        // Handle touch for UI interactions
        this.elements.startButton.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.elements.startButton.click();
        });
    }

    initializeAnimations() {
        // Set up CSS animations and transitions
        this.addCustomStyles();
    }

    addCustomStyles() {
        const style = document.createElement('style');
        style.textContent = `
            @keyframes scoreBoost {
                0% { transform: scale(1); }
                50% { transform: scale(1.2); color: #4ecdc4; }
                100% { transform: scale(1); }
            }
            
            @keyframes gestureChange {
                0% { transform: scale(1) rotate(0deg); }
                50% { transform: scale(1.1) rotate(5deg); }
                100% { transform: scale(1) rotate(0deg); }
            }
            
            @keyframes slideInFromRight {
                0% { transform: translateX(100%); opacity: 0; }
                100% { transform: translateX(0); opacity: 1; }
            }
            
            @keyframes slideOutToLeft {
                0% { transform: translateX(0); opacity: 1; }
                100% { transform: translateX(-100%); opacity: 0; }
            }
            
            @keyframes shakeError {
                0%, 100% { transform: translateX(0); }
                25% { transform: translateX(-5px); }
                75% { transform: translateX(5px); }
            }
            
            .score-boost {
                animation: scoreBoost 0.3s ease-out;
            }
            
            .gesture-change {
                animation: gestureChange 0.2s ease-out;
            }
            
            .slide-in {
                animation: slideInFromRight 0.5s ease-out;
            }
            
            .slide-out {
                animation: slideOutToLeft 0.5s ease-out;
            }
            
            .shake-error {
                animation: shakeError 0.5s ease-out;
            }
        `;
        document.head.appendChild(style);
    }

    // Screen Management
    hideLoading() {
        if (this.elements.loadingScreen) {
            this.elements.loadingScreen.style.display = 'none';
        }
    }

    showLoading(message = 'Loading...') {
        if (this.elements.loadingScreen) {
            this.elements.loadingScreen.textContent = message;
            this.elements.loadingScreen.style.display = 'block';
        }
    }

    hideStartScreen() {
        if (this.elements.startScreen) {
            this.elements.startScreen.classList.add('hide');
        }
    }

    showStartScreen() {
        if (this.elements.startScreen) {
            this.elements.startScreen.classList.remove('hide');
        }
    }

    showGameOver(finalScore) {
        if (this.elements.gameOverScreen && this.elements.finalScore) {
            this.elements.finalScore.textContent = finalScore;
            this.elements.gameOverScreen.classList.add('show');
            
            // Add slide-in animation
            this.elements.gameOverScreen.classList.add('slide-in');
            
            // Start background music change or sound effect
            this.playGameOverAnimation();
        }
    }

    hideGameOver() {
        if (this.elements.gameOverScreen) {
            this.elements.gameOverScreen.classList.remove('show');
            this.elements.gameOverScreen.classList.remove('slide-in');
        }
    }

    // Score and Game State Updates
    updateScore(score, speed) {
        if (this.elements.scoreValue) {
            const previousScore = parseInt(this.elements.scoreValue.textContent) || 0;
            this.elements.scoreValue.textContent = score;
            
            // Animate score increase
            if (score > previousScore) {
                this.animateScoreIncrease();
            }
        }
        
        if (this.elements.speedValue) {
            this.elements.speedValue.textContent = speed + 'x';
        }
    }

    animateScoreIncrease() {
        if (this.elements.scoreValue) {
            this.elements.scoreValue.classList.remove('score-boost');
            // Force reflow
            this.elements.scoreValue.offsetHeight;
            this.elements.scoreValue.classList.add('score-boost');
            
            // Remove class after animation
            setTimeout(() => {
                this.elements.scoreValue.classList.remove('score-boost');
            }, 300);
        }
    }

    // Gesture Display Updates
    updateGestureDisplay(gesture, confidence) {
        if (!this.elements.currentGesture) return;
        
        const emoji = this.gestureEmojis[gesture] || '❓';
        const color = this.gestureColors[gesture] || '#4ecdc4';
        const confidenceText = confidence ? ` (${Math.round(confidence * 100)}%)` : '';
        
        // Update text content
        const gestureText = gesture.charAt(0).toUpperCase() + gesture.slice(1);
        this.elements.currentGesture.innerHTML = `${emoji} ${gestureText}${confidenceText}`;
        
        // Update color
        this.elements.currentGesture.style.color = color;
        
        // Animate gesture change
        this.animateGestureChange();
        
        // Show confidence level with visual feedback
        this.updateConfidenceVisual(confidence);
    }

    animateGestureChange() {
        if (this.elements.currentGesture) {
            this.elements.currentGesture.classList.remove('gesture-change');
            // Force reflow
            this.elements.currentGesture.offsetHeight;
            this.elements.currentGesture.classList.add('gesture-change');
            
            setTimeout(() => {
                this.elements.currentGesture.classList.remove('gesture-change');
            }, 200);
        }
    }

    updateConfidenceVisual(confidence) {
        if (!this.elements.currentGesture) return;
        
        const gestureDisplay = this.elements.currentGesture.parentElement;
        
        if (confidence < 0.5) {
            gestureDisplay.style.opacity = '0.6';
            gestureDisplay.style.filter = 'grayscale(0.3)';
        } else if (confidence < 0.8) {
            gestureDisplay.style.opacity = '0.8';
            gestureDisplay.style.filter = 'grayscale(0.1)';
        } else {
            gestureDisplay.style.opacity = '1';
            gestureDisplay.style.filter = 'none';
        }
    }

    // Error and Feedback
    showError(message) {
        // Create temporary error message
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        errorElement.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(255, 107, 107, 0.9);
            color: white;
            padding: 20px;
            border-radius: 10px;
            font-size: 18px;
            z-index: 1000;
            backdrop-filter: blur(10px);
        `;
        
        document.body.appendChild(errorElement);
        
        // Add shake animation
        errorElement.classList.add('shake-error');
        
        // Remove after 3 seconds
        setTimeout(() => {
            document.body.removeChild(errorElement);
        }, 3000);
    }

    showSuccess(message) {
        // Similar to error but with success styling
        const successElement = document.createElement('div');
        successElement.className = 'success-message';
        successElement.textContent = message;
        successElement.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: rgba(78, 205, 196, 0.9);
            color: white;
            padding: 15px 20px;
            border-radius: 10px;
            font-size: 16px;
            z-index: 1000;
            backdrop-filter: blur(10px);
            animation: slideInFromRight 0.3s ease-out;
        `;
        
        document.body.appendChild(successElement);
        
        setTimeout(() => {
            successElement.style.animation = 'slideOutToLeft 0.3s ease-out';
            setTimeout(() => {
                if (document.body.contains(successElement)) {
                    document.body.removeChild(successElement);
                }
            }, 300);
        }, 2000);
    }

    // Responsive Design
    handleResize() {
        // Adjust UI elements for different screen sizes
        const width = window.innerWidth;
        const height = window.innerHeight;
        
        if (width < 768) {
            // Mobile adjustments
            this.applyMobileLayout();
        } else {
            // Desktop adjustments
            this.applyDesktopLayout();
        }
        
        // Update video element size
        this.updateVideoSize();
    }

    applyMobileLayout() {
        // Adjust UI for mobile devices
        if (this.elements.videoElement) {
            this.elements.videoElement.style.width = '120px';
            this.elements.videoElement.style.height = '90px';
        }
    }

    applyDesktopLayout() {
        // Adjust UI for desktop
        if (this.elements.videoElement) {
            this.elements.videoElement.style.width = '200px';
            this.elements.videoElement.style.height = '150px';
        }
    }

    updateVideoSize() {
        // Ensure video element maintains aspect ratio
        if (this.elements.videoElement) {
            const rect = this.elements.videoElement.getBoundingClientRect();
            const aspectRatio = 4/3; // Standard camera aspect ratio
            
            if (rect.width / rect.height !== aspectRatio) {
                this.elements.videoElement.style.height = `${rect.width / aspectRatio}px`;
            }
        }
    }

    // Utility Methods
    handleVisibilityChange() {
        if (document.hidden) {
            // Page is hidden, pause or reduce functionality
            this.onPageHidden();
        } else {
            // Page is visible, resume functionality
            this.onPageVisible();
        }
    }

    onPageHidden() {
        // Reduce performance when tab is not active
        console.log('Game tab hidden - performance mode activated');
    }

    onPageVisible() {
        // Resume full performance when tab is active
        console.log('Game tab visible - full performance restored');
    }

    handleFullscreenChange() {
        if (document.fullscreenElement) {
            // Entered fullscreen
            this.onEnterFullscreen();
        } else {
            // Exited fullscreen
            this.onExitFullscreen();
        }
    }

    onEnterFullscreen() {
        // Adjust UI for fullscreen mode
        document.body.classList.add('fullscreen-mode');
    }

    onExitFullscreen() {
        // Restore UI from fullscreen mode
        document.body.classList.remove('fullscreen-mode');
    }

    // Animation Helpers
    playGameOverAnimation() {
        // Add special effects for game over
        const gameOverScreen = this.elements.gameOverScreen;
        if (gameOverScreen) {
            // Add subtle background animation or effects
            gameOverScreen.style.animation = 'fadeIn 0.5s ease-out';
        }
    }

    // Cleanup
    dispose() {
        // Clean up event listeners and animations
        Object.values(this.animationStates).forEach(animation => {
            if (animation) {
                cancelAnimationFrame(animation);
            }
        });
    }
}