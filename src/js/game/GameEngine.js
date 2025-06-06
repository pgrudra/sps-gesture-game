import * as THREE from 'three';
import { SceneManager } from './SceneManager.js';
import { ObstacleManager } from './ObstacleManager.js';
import { CollisionDetector } from './CollisionDetector.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export class GameEngine {
    constructor(canvas, audioManager) {
        this.canvas = canvas;
        this.audioManager = audioManager;
        
        // Three.js components
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        
        // Game managers
        this.sceneManager = null;
        this.obstacleManager = null;
        this.collisionDetector = null;
        
        // Game state
        this.isRunning = false;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.speed = 1.0;
        this.baseSpeed = 0.03; // Increased base speed
        this.speedIncrement = 0.0005; // More gradual speed increase
        this.maxSpeed = 0.08;
        
        // Player state
        this.playerGesture = 'none';
        this.playerGestureObject = null;
        this.gestureIndicator = null;
        
        // Spawn control
        this.lastSpawnTime = 0;
        this.minSpawnInterval = 2000; // Minimum 2 seconds between spawns
        this.spawnIntervalVariation = 1000; // +/- 1 second variation
        this.nextSpawnTime = 0;
        
        // Callbacks
        this.onGameOverCallback = null;
        this.onScoreUpdateCallback = null;
        this.onComboUpdateCallback = null;
        
        // Animation
        this.animationId = null;
        this.lastTime = 0;
        
        // Gesture to obstacle mapping
        this.gestureMap = {
            'rock': 'scissors',    // rock beats scissors
            'paper': 'rock',       // paper beats rock
            'scissors': 'paper'    // scissors beats paper
        };
        
        this.gestureColors = {
            'rock': 0x8B4513,      // brown
            'paper': 0xFFFFFF,     // white
            'scissors': 0xC0C0C0,  // silver
            'none': 0x4ecdc4       // teal
        };

        // Hint system
        this.hintObjects = [];
        this.showHints = true;

        // GLB Loader for player gestures
        this.gltfLoader = new GLTFLoader();
        this.playerModelPaths = {
            rock: '/assets/models/rock.glb',
            paper: '/assets/models/paper.glb',
            scissors: '/assets/models/scissors.glb',
            none: null // No model for 'none' state initially
        };
        this.loadedPlayerModels = {
            rock: null,
            paper: null,
            scissors: null,
            none: null
        };
    }

    async init() {
        this.initThreeJS();
        await this.loadPlayerModels(); // Load player models first
        await this.initManagers();
        this.setupEventListeners();
        // this.createUI(); // UI creation might be handled differently or within initManagers/createPlayerGesture
        this.startRenderLoop();
        this.setPlayerGesture('rock'); // Set default gesture after everything is initialized
    }
    async loadPlayerModels() {
        console.log('GameEngine: Starting to load player GLB models...');
        const loadPromises = Object.keys(this.playerModelPaths).map(async (type) => {
            const path = this.playerModelPaths[type];
            if (!path) {
                this.loadedPlayerModels[type] = null;
                return { type, success: true, skipped: true };
            }
            try {
                const gltf = await this.gltfLoader.loadAsync(path);
                const model = gltf.scene;

                // Normalize model scale and position
                const box = new THREE.Box3().setFromObject(model);
                const size = box.getSize(new THREE.Vector3());
                const maxDimension = Math.max(size.x, size.y, size.z);
                const targetSize = 1.0; // Player hand model size (matched to obstacles)
                const scale = targetSize / maxDimension;
                model.scale.setScalar(scale);
                
                const center = box.getCenter(new THREE.Vector3());
                model.position.sub(center.multiplyScalar(scale));

                model.traverse((child) => {
                    if (child.isMesh) {
                        child.castShadow = true;
                        // child.receiveShadow = true; // Player hand likely doesn't need to receive shadows
                    }
                });

                this.loadedPlayerModels[type] = model;
                console.log(`GameEngine: Loaded player ${type} model successfully from ${path}.`);
                return { type, success: true };
            } catch (error) {
                console.error(`GameEngine: Failed to load player ${type} model from ${path}:`, error);
                this.loadedPlayerModels[type] = null;
                return { type, success: false, error };
            }
        });
        await Promise.all(loadPromises);
        console.log('GameEngine: Player GLB models loading process complete.');
    }

    getLoadingStatus() {
        return this.obstacleManager ? this.obstacleManager.getModelLoadingStatus() : null;
    }
    
    initThreeJS() {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.fog = new THREE.Fog(0x000033, 15, 70); // Dark blue fog, closer
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            this.canvas.offsetWidth / this.canvas.offsetHeight,
            0.1,
            1000
        );
        this.camera.position.set(0, 3, 6);
        this.camera.lookAt(0, 0, 0);
        
        // Renderer
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(this.canvas.offsetWidth, this.canvas.offsetHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        this.renderer.setClearColor(0x000022, 1); // Very dark blue background
        
        // Enhanced lighting
        const ambientLight = new THREE.AmbientLight(0x404060, 0.3); // Dim, bluish ambient light
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0xaaaaff, 0.5); // Cool moonlight
        directionalLight.position.set(-10, 15, -5); // Reposition moonlight
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        directionalLight.shadow.camera.near = 0.5;
        directionalLight.shadow.camera.far = 50;
        this.scene.add(directionalLight);

        // Add rim lighting
        const rimLight = new THREE.DirectionalLight(0x6060aa, 0.2); // Subtle cool rim light
        rimLight.position.set(-5, 5, -5);
        this.scene.add(rimLight);
    }

    async initManagers() { // Made async
        this.sceneManager = new SceneManager(this.scene);
        this.obstacleManager = new ObstacleManager(this.scene);
        this.collisionDetector = new CollisionDetector();

        console.log('GameEngine: Waiting for ObstacleManager models to load...');
        await this.obstacleManager.loadingPromise; // Wait for obstacle models
        console.log('GameEngine: ObstacleManager models loaded.');
        
        this.sceneManager.createEnvironment();
        this.createPlayerGesture(); // Creates the group and BoxHelper
        // this.createGestureIndicator(); // Gesture indicator might be part of UI now
        this.scheduleNextSpawn();
    }

    createPlayerGesture() {
        this.playerGestureObject = new THREE.Group();
        this.playerGestureObject.position.set(0, 1, 4); // Adjust Y as needed, should match GLB model center
        this.scene.add(this.playerGestureObject); // Add to scene before creating BoxHelper

        // Bounding Box Helper for Player
        this.playerBoxHelper = new THREE.BoxHelper(this.playerGestureObject, 0x00ff00); // Green
        // this.playerBoxHelper.visible = true; // Make it visible for debugging
        // this.scene.add(this.playerBoxHelper);

        // Initial gesture will be set by init() after models are loaded
        // this.updatePlayerGestureVisual('rock'); // Moved to init()
    }

    createGestureIndicator() {
        // Create a small indicator showing current gesture
        const geometry = new THREE.PlaneGeometry(0.5, 0.5);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xffffff,
            transparent: true,
            opacity: 0.8
        });
        this.gestureIndicator = new THREE.Mesh(geometry, material);
        this.gestureIndicator.position.set(-3, 2, 4);
        this.gestureIndicator.lookAt(this.camera.position);
        this.scene.add(this.gestureIndicator);
    }

    updatePlayerGestureVisual(gestureToDisplay) {
        if (!this.playerGestureObject) {
            console.warn('GameEngine: playerGestureObject is null, cannot update visual.');
            return;
        }

        // Clear previous model
        while (this.playerGestureObject.children.length > 0) {
            const child = this.playerGestureObject.children[0];
            this.playerGestureObject.remove(child);
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        }

        let model = this.loadedPlayerModels[gestureToDisplay];
        let finalGestureShown = gestureToDisplay;

        if (!model) {
            // If the intended model is not found (e.g., 'unknown' was passed by mistake, or a valid model failed to load)
            // try to fall back to 'rock'.
            console.warn(`GameEngine: No GLB model loaded for intended gesture '${gestureToDisplay}'. Attempting fallback to 'rock'.`);
            model = this.loadedPlayerModels['rock'];
            finalGestureShown = 'rock'; // We are now attempting to show 'rock'

            if (!model) {
                // If 'rock' model itself is not available, then display empty.
                console.error(`GameEngine: Fallback 'rock' model also not loaded. Displaying empty. playerGestureObject will be empty.`);
                if (this.playerBoxHelper) {
                    this.playerBoxHelper.update(); // Update box helper for empty group
                }
                return; // Exit, nothing to display
            }
        }

        // At this point, 'model' is either the model for 'gestureToDisplay' or the fallback 'rock' model.
        // 'finalGestureShown' is the gesture corresponding to 'model'.
        const modelClone = model.clone();
        this.playerGestureObject.add(modelClone);

        // Apply gesture-specific transformations based on the model actually being displayed
        if (finalGestureShown === 'paper' || finalGestureShown === 'scissors') {
            modelClone.rotation.y = Math.PI; // Rotate 180 degrees around Y-axis
        } else {
            modelClone.rotation.y = 0; // Ensure non-paper/scissors (like rock) have default rotation
        }

        console.log(`GameEngine: Displaying ${finalGestureShown} GLB model (intended: ${gestureToDisplay}).`);

        if (this.playerBoxHelper) {
            this.playerBoxHelper.update();
        }
    } // Correctly closes updatePlayerGestureVisual

    animatePlayerGesture() {
        if (!this.playerGestureObject || !this.playerGestureObject.children.length) return; // Semicolon added

        // The playerGestureObject (the group) itself is clamped to Y=1.0 in the update() method.
        // This animation should apply to the model *within* the group, and only for non-Y axes if Y is already controlled.
        const time = Date.now() * 0.0025;
        const floatAmplitudeX = 0.03; // Amplitude for X sway

        // Apply to the currently displayed model within the playerGestureObject group
        const currentModel = this.playerGestureObject.children[0];
        if (currentModel) {
            // Y-animation removed, playerGestureObject.position.y is clamped in update()
            // Ensure model's local Y is 0 if playerGestureObject (the group) handles global Y positioning
            currentModel.position.y = 0; 
            currentModel.position.x = Math.cos(time * 0.7) * floatAmplitudeX; // Slower sway on X // Semicolon added
        }
    }

    createUI() {
        // Create hint system for upcoming obstacles
        this.createHintSystem();
    }

    createHintSystem() {
        // Create hint indicators on the sides of the screen
        const hintDistance = 8;
        const hintPositions = [
            { x: -2, z: -hintDistance },
            { x: 0, z: -hintDistance },
            { x: 2, z: -hintDistance }
        ];
        
        hintPositions.forEach((pos, index) => {
            const hintGeometry = new THREE.RingGeometry(0.3, 0.5, 8);
            const hintMaterial = new THREE.MeshBasicMaterial({ 
                color: 0xffffff,
                transparent: true,
                opacity: 0.3,
                side: THREE.DoubleSide
            });
            const hint = new THREE.Mesh(hintGeometry, hintMaterial);
            hint.position.set(pos.x, 1.5, pos.z);
            hint.rotation.x = -Math.PI / 2;
            hint.visible = false;
            this.scene.add(hint);
            this.hintObjects.push(hint);
        });
    }

    scheduleNextSpawn() {
        const baseInterval = this.minSpawnInterval / this.speed;
        const variation = (Math.random() - 0.5) * this.spawnIntervalVariation;
        this.nextSpawnTime = Date.now() + baseInterval + variation;
    }

    setupEventListeners() {
        window.addEventListener('resize', () => this.handleResize());
    }

    handleResize() {
        const width = this.canvas.offsetWidth;
        const height = this.canvas.offsetHeight;
        
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(width, height);
    }

    startGame(onGameOverCallback, onScoreUpdateCallback, onComboUpdateCallback) {
        this.onGameOverCallback = onGameOverCallback;
        this.onScoreUpdateCallback = onScoreUpdateCallback;
        this.onComboUpdateCallback = onComboUpdateCallback;
        
        this.isRunning = true;
        this.score = 0;
        this.combo = 0;
        this.maxCombo = 0;
        this.speed = 1.0;
        this.playerGesture = 'none';
        
        this.obstacleManager.reset();
        this.scheduleNextSpawn();
        this.updateScore();
        this.updateCombo();
    }

    restartGame() {
        this.startGame(this.onGameOverCallback, this.onScoreUpdateCallback, this.onComboUpdateCallback);
    }

    setPlayerGesture(newGestureInput) {
        let newGesture = newGestureInput; // work with a mutable copy

        // Sanitize newGesture: if it's 'unknown', treat it as 'none' for decision making below.
        if (newGesture === 'unknown') {
            console.log(`GameEngine: Received 'unknown' gesture from recognizer.`);
            newGesture = 'none'; // Treat 'unknown' as 'none' for the logic that follows
        }

        if (!newGesture || newGesture === 'none') {
            // Case 1: Incoming gesture is effectively invalid (none, or was unknown)
            if (this.playerGesture === 'none' || !this.playerGesture) {
                // Subcase 1a: Current player gesture is also 'none' or uninitialized (e.g., at game start before first valid gesture)
                // -> Default to 'rock' for game logic and visual display.
                if (this.playerGesture !== 'rock') { // Avoid redundant update if somehow already rock
                    this.playerGesture = 'rock';
                    console.log(`GameEngine: No valid gesture input, current player gesture is '${this.playerGesture || 'uninitialized'}'. Defaulting to 'rock'.`);
                    this.updatePlayerGestureVisual('rock');
                }
            } else {
                // Subcase 1b: Current player gesture is valid. Maintain it.
                // console.log(`GameEngine: No valid gesture input. Maintaining current gesture: "${this.playerGesture}".`);
                // No change needed for this.playerGesture or its visual, as it's already showing the last valid one.
            }
            return; // Exit after handling invalid/unknown input
        }

        // Case 2: Incoming gesture is valid (rock, paper, or scissors)
        if (this.playerGesture === newGesture) {
            // console.log(`GameEngine: Player gesture "${newGesture}" is already active.`);
            return; // No change needed if the new valid gesture is the same as the current one.
        }
        
        // New valid gesture is different from current player gesture.
        this.playerGesture = newGesture;
        console.log(`GameEngine: Player gesture for logic set to: "${this.playerGesture}".`);
        this.updatePlayerGestureVisual(this.playerGesture);
    }

    update(deltaTime) {
        if (!this.isRunning) return;

        // Clamp player Y-position
        if (this.playerGestureObject) {
            this.playerGestureObject.position.y = 1.0;
        }
        
        // More gradual speed scaling
        this.speed = Math.min(1.0 + (this.score * 0.05), 2.5);
        const currentSpeed = this.baseSpeed * this.speed;
        
        // Update obstacles
        this.obstacleManager.update(currentSpeed);
        
        // Controlled obstacle spawning
        if (Date.now() >= this.nextSpawnTime) {
            this.obstacleManager.spawnRandomObstacle();
            this.scheduleNextSpawn();
        }
        
        // Update hints
        this.updateHints();
        
        // Check collisions
        const obstacles = this.obstacleManager.getActiveObstacles();
        for (let obstacle of obstacles) {
            // Bounding Box Debug Logging for Rock vs Scissors
            if (obstacle.type === 'scissors' && this.playerGesture === 'rock' && obstacle.mesh.position.z < 5 && obstacle.mesh.position.z > 3) { // Log when scissors is in interaction zone
                const playerBox = new THREE.Box3().setFromObject(this.playerGestureObject);
                const obstacleBox = new THREE.Box3().setFromObject(obstacle.mesh);
                const playerPos = this.playerGestureObject.position;
                const obsPos = obstacle.mesh.position;
                console.log(`[BBoxDebug] Player(Rock) z:${playerPos.z.toFixed(2)} vs Obstacle(Scissors) z:${obsPos.z.toFixed(2)}`);
                console.log(`[BBoxDebug] Player Box: Min(${playerBox.min.x.toFixed(2)},${playerBox.min.y.toFixed(2)},${playerBox.min.z.toFixed(2)}) Max(${playerBox.max.x.toFixed(2)},${playerBox.max.y.toFixed(2)},${playerBox.max.z.toFixed(2)})`);
                console.log(`[BBoxDebug] Obstacle Box: Min(${obstacleBox.min.x.toFixed(2)},${obstacleBox.min.y.toFixed(2)},${obstacleBox.min.z.toFixed(2)}) Max(${obstacleBox.max.x.toFixed(2)},${obstacleBox.max.y.toFixed(2)},${obstacleBox.max.z.toFixed(2)})`);
                console.log(`[BBoxDebug] Intersection Check Result: ${playerBox.intersectsBox(obstacleBox)}`);
            }

            // Check collision with player
            if (this.collisionDetector.checkCollision(this.playerGestureObject, obstacle.mesh)) {
                this.handleCollision(obstacle);
                break;
            }
            
            // Check if obstacle passed without interaction (game over)
            if (obstacle.mesh.position.z > 5) {
                console.log(`[GameOverDebug] Obstacle passed triggering GameOver. Obstacle Type: "${obstacle.type}", Z-Pos: ${obstacle.mesh.position.z.toFixed(2)}. Player Gesture: "${this.playerGesture}"`);
                this.gameOver();
                break;
            }
        }
        
        // Update scene effects
        this.sceneManager.update(deltaTime);
        
        // Animate player gesture
        this.animatePlayerGesture();
    }

    updateHints() {
        const obstacles = this.obstacleManager.getActiveObstacles();
        
        // Reset hint visibility
        this.hintObjects.forEach(hint => {
            hint.visible = false;
        });
        
        if (!this.showHints) return;
        
        // Show hints for obstacles in range
        obstacles.forEach(obstacle => {
            const distance = obstacle.mesh.position.z - this.playerGestureObject.position.z;
            
            // Show hint when obstacle is at medium distance
            if (distance < -3 && distance > -8) {
                const laneIndex = obstacle.lane + 1; // Convert -1,0,1 to 0,1,2
                if (laneIndex >= 0 && laneIndex < this.hintObjects.length) {
                    const hint = this.hintObjects[laneIndex];
                    hint.visible = true;
                    
                    // Set hint color based on required gesture
                    const requiredGesture = this.getRequiredGesture(obstacle.type);
                    const color = this.gestureColors[requiredGesture] || 0xffffff;
                    hint.material.color.setHex(color);
                    
                    // Animate hint
                    const time = Date.now() * 0.01;
                    hint.rotation.z = time;
                    hint.material.opacity = 0.5 + Math.sin(time * 2) * 0.2;
                } // Closes: if (laneIndex >= 0 && laneIndex < this.hintObjects.length)
            } // Closes: if (distance < -3 && distance > -8)
        }); // Closes: obstacles.forEach(obstacle => {
    } // Closes: updateHints()

    handleCollision(obstacle) {
        const obstacleType = obstacle.type;
        const requiredGesture = this.getRequiredGesture(obstacleType);

        console.log(`[CollisionDebug] Player Gesture: "${this.playerGesture}", Obstacle Type: "${obstacleType}", Required Gesture to Win: "${requiredGesture}"`);

        if (this.playerGesture === 'none' || !this.playerGesture) {
            console.log("[CollisionDebug] Result: Player gesture is 'none' or invalid. Triggering GameOver.");
            this.gameOver();
            return;
        }

        if (this.playerGesture === requiredGesture) {
            const basePoints = 10;
            const speedBonus = Math.floor(this.speed * 5);
            const comboBonus = this.combo * 2;
            const points = basePoints + speedBonus + comboBonus;

            this.score += points;
            this.combo++;
            this.maxCombo = Math.max(this.maxCombo, this.combo);

            this.audioManager.playSuccessSound();
            this.obstacleManager.removeObstacle(obstacle);
            this.updateScore();
            this.updateCombo();
            this.sceneManager.createSuccessEffect(obstacle.mesh.position, points);

            if (this.combo > 5) {
                this.createScreenShake();
            }
            console.log("[CollisionDebug] Result: Player WINS interaction.");
        } else if (this.playerGesture === obstacleType) {
            console.log(`[CollisionDebug] Result: Player TIES with obstacle. Player: ${this.playerGesture}, Obstacle: ${obstacleType}. Deducting points.`);
            this.score -= 10*this.speed;
            this.updateScore(); // Update score display immediately

            if (this.score < 0) {
                console.log("[CollisionDebug] Score became negative. Triggering GameOver.");
                if (this.audioManager && typeof this.audioManager.playErrorSound === 'function') {
                    this.audioManager.playErrorSound(); // Play sound on game over due to negative score
                }
                this.gameOver();
                return; 
            }
            this.combo = 0;

            if (this.audioManager && typeof this.audioManager.playErrorSound === 'function') {
                this.audioManager.playErrorSound();
            } else {
                console.warn("[AudioManager] playErrorSound method not found or audioManager is not available. Skipping penalty sound.");
            }

            this.obstacleManager.removeObstacle(obstacle);
            // this.updateScore(); // Moved up
            this.updateCombo();
            console.log(`[CollisionDebug] Game continues after tie/penalty. Current score: ${this.score}`);
        } else {
            console.log(`[CollisionDebug] Result: Player LOSES interaction (Wrong gesture: Player ${this.playerGesture} vs Obstacle ${obstacleType}, Required ${requiredGesture}). Triggering GameOver.`);
            this.gameOver();
        }
    }

    createScreenShake() {
        const originalPosition = this.camera.position.clone();
        const shakeIntensity = Math.min(0.1, this.combo * 0.01);

        if (this.combo <= 5 || shakeIntensity <= 0) {
            return;
        }

        let shakeTime = 0;
        const duration = 200; // ms
        const interval = 16; // ms

        const shakeIntervalId = setInterval(() => {
            this.camera.position.x = originalPosition.x + (Math.random() - 0.5) * shakeIntensity * 2;
            this.camera.position.y = originalPosition.y + (Math.random() - 0.5) * shakeIntensity * 2;

            shakeTime += interval;
            if (shakeTime >= duration) {
                clearInterval(shakeIntervalId);
                this.camera.position.copy(originalPosition);
            }
        }, interval);
    }

    getRequiredGesture(obstacleType) {
        // Return the gesture that beats the obstacle
        switch (obstacleType) {
            case 'rock': return 'paper';     // paper beats rock
            case 'paper': return 'scissors'; // scissors beats paper
            case 'scissors': return 'rock';  // rock beats scissors
            default: return 'none';
        }
    }

    updateScore() {
        if (this.onScoreUpdateCallback) {
            this.onScoreUpdateCallback(this.score, this.speed.toFixed(1));
        }
    }

    updateCombo() {
        if (this.onComboUpdateCallback) {
            this.onComboUpdateCallback(this.combo, this.maxCombo);
        }
    }

    gameOver() {
        console.log(`[GameOverDebug] gameOver() method entered. Player Gesture: "${this.playerGesture}", Score: ${this.score}, Max Combo: ${this.maxCombo}, IsRunning: ${this.isRunning}`);
        if (!this.isRunning) {
            console.warn("[GameOverDebug] gameOver() called, but game is already not running. This might indicate multiple gameOver triggers.");
            // return; // Optional: prevent multiple executions if it causes issues, but log first.
        }
        this.isRunning = false;
        this.combo = 0;
        this.sceneManager.createGameOverEffect();
        
        if (this.onGameOverCallback) {
            this.onGameOverCallback(this.score, this.maxCombo);
        }
    }

    startRenderLoop() {
        const animate = (currentTime) => {
            this.animationId = requestAnimationFrame(animate);
            
            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            
            this.update(deltaTime);
            this.renderer.render(this.scene, this.camera);
        };
        
        animate(0);
    }

    // Settings
    toggleHints() {
        this.showHints = !this.showHints;
        if (!this.showHints) {
            this.hintObjects.forEach(hint => hint.visible = false);
        }
    }

    setDifficulty(level) {
        switch (level) {
            case 'easy':
                this.minSpawnInterval = 3000;
                this.baseSpeed = 0.01;
                this.speedIncrement = 0.0003;
                break;
            case 'normal':
                this.minSpawnInterval = 2000;
                this.baseSpeed = 0.015;
                this.speedIncrement = 0.0005;
                break;
            case 'hard':
                this.minSpawnInterval = 1500;
                this.baseSpeed = 0.02;
                this.speedIncrement = 0.0008;
                break;
        }
    }

    dispose() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        // Clean up Three.js resources
        this.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
        
        this.renderer.dispose();

        if (this.playerBoxHelper) {
            this.scene.remove(this.playerBoxHelper);
            this.playerBoxHelper.dispose();
            this.playerBoxHelper = null;
        }

        // Dispose loaded player models (basic attempt)
        Object.values(this.loadedPlayerModels).forEach(model => {
            if (model && model.traverse) {
                model.traverse(child => {
                    if (child.isMesh) {
                        if (child.geometry) child.geometry.dispose();
                        if (child.material) {
                            if (Array.isArray(child.material)) {
                                child.material.forEach(m => m.dispose());
                            } else {
                                child.material.dispose();
                            }
                        }
                    }
                });
            }
        });
        this.loadedPlayerModels = {}; // Clear references
    }


}