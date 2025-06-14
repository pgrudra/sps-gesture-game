export class AudioManager {
    constructor() {
        this.audioContext = null;
        this.sounds = {};
        this.isEnabled = true;
        this.masterVolume = 0.7;
        this.sfxVolume = 0.8;
        this.musicVolume = 0.3;
        
        // Audio buffers
        this.buffers = {};
        
        // Background music
        this.backgroundMusic = null;
        this.backgroundMusicSource = null;
        this.backgroundMusicGain = null;
        this.isMusicPlaying = false;
        this.musicBuffer = null;
        
        this.init();
    }

    async init() {
        try {
            // Initialize Web Audio API context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Create sound effects using oscillators (no external files needed)
            this.createSoundEffects();
            
            // Load background music
            await this.loadBackgroundMusic();
            
            console.log('Audio system initialized');
        } catch (error) {
            console.warn('Failed to initialize audio:', error);
            this.isEnabled = false;
        }
    }

    async loadBackgroundMusic() {
        try {
            const response = await fetch('/assets/sounds/bg_music.mp3');
            if (!response.ok) {
                throw new Error(`Failed to load background music: ${response.status}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            this.musicBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('Background music loaded successfully');
        } catch (error) {
            console.warn('Failed to load background music:', error);
            // Fallback to generated ambient music if file loading fails
            this.musicBuffer = null;
        }
    }

    createSoundEffects() {
        // Define sound effects using Web Audio API oscillators
        this.soundDefinitions = {
            success: {
                type: 'oscillator',
                frequency: [440, 554, 659], // A, C#, E (major chord)
                duration: 0.3,
                volume: 0.6,
                envelope: { attack: 0.1, decay: 0.2, sustain: 0.7, release: 0.1 }
            },
            error: {
                type: 'oscillator',
                frequency: [200, 150], // Lower, dissonant tones
                duration: 0.5,
                volume: 0.5,
                envelope: { attack: 0.05, decay: 0.2, sustain: 0.3, release: 0.25 }
            },
            gameOver: {
                type: 'oscillator',
                frequency: [220, 185, 147], // Descending minor chord
                duration: 0.8,
                volume: 0.7,
                envelope: { attack: 0.1, decay: 0.3, sustain: 0.4, release: 0.4 }
            },
            start: {
                type: 'oscillator',
                frequency: [330, 440, 550, 660], // Ascending scale
                duration: 0.6,
                volume: 0.5,
                envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.15 }
            },
            collision: {
                type: 'noise',
                duration: 0.2,
                volume: 0.4,
                filter: { type: 'highpass', frequency: 1000 }
            },
            powerUp: {
                type: 'oscillator',
                frequency: [440, 523, 659, 784], // C major scale up
                duration: 0.4,
                volume: 0.5,
                envelope: { attack: 0.05, decay: 0.1, sustain: 0.8, release: 0.1 }
            }
        };
    }

    async playSound(soundName, options = {}) {
        if (!this.isEnabled || !this.audioContext) return;
        
        // Resume audio context if suspended (required by browsers)
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }

        const soundDef = this.soundDefinitions[soundName];
        if (!soundDef) {
            console.warn(`Sound '${soundName}' not found`);
            return;
        }

        try {
            switch (soundDef.type) {
                case 'oscillator':
                    this.playOscillatorSound(soundDef, options);
                    break;
                case 'noise':
                    this.playNoiseSound(soundDef, options);
                    break;
            }
        } catch (error) {
            console.error('Error playing sound:', error);
        }
    }

    playOscillatorSound(soundDef, options) {
        const frequencies = Array.isArray(soundDef.frequency) ? 
            soundDef.frequency : [soundDef.frequency];
        
        const volume = (options.volume || soundDef.volume) * this.sfxVolume * this.masterVolume;
        const duration = options.duration || soundDef.duration;
        
        frequencies.forEach((freq, index) => {
            setTimeout(() => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                // Connect audio graph
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                // Configure oscillator
                oscillator.type = options.waveType || 'sine';
                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                
                // Apply envelope
                const now = this.audioContext.currentTime;
                const envelope = soundDef.envelope;
                
                if (envelope) {
                    gainNode.gain.setValueAtTime(0, now);
                    gainNode.gain.linearRampToValueAtTime(volume, now + envelope.attack);
                    gainNode.gain.linearRampToValueAtTime(
                        volume * envelope.sustain, 
                        now + envelope.attack + envelope.decay
                    );
                    gainNode.gain.linearRampToValueAtTime(
                        0, 
                        now + duration - envelope.release
                    );
                } else {
                    gainNode.gain.setValueAtTime(volume, now);
                    gainNode.gain.linearRampToValueAtTime(0, now + duration);
                }
                
                // Start and stop oscillator
                oscillator.start(now);
                oscillator.stop(now + duration);
                
            }, index * 100); // Slight delay between chord notes
        });
    }

    playNoiseSound(soundDef, options) {
        const bufferSize = this.audioContext.sampleRate * soundDef.duration;
        const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
        const output = buffer.getChannelData(0);
        
        // Generate white noise
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        const source = this.audioContext.createBufferSource();
        const gainNode = this.audioContext.createGain();
        let filterNode = null;
        
        source.buffer = buffer;
        
        // Apply filter if specified
        if (soundDef.filter) {
            filterNode = this.audioContext.createBiquadFilter();
            filterNode.type = soundDef.filter.type;
            filterNode.frequency.setValueAtTime(soundDef.filter.frequency, this.audioContext.currentTime);
            source.connect(filterNode);
            filterNode.connect(gainNode);
        } else {
            source.connect(gainNode);
        }
        
        gainNode.connect(this.audioContext.destination);
        
        // Set volume
        const volume = (options.volume || soundDef.volume) * this.sfxVolume * this.masterVolume;
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + soundDef.duration);
        
        source.start();
    }

    playSuccessSound() {
        this.playSound('success');
    }

    playErrorSound() {
        this.playSound('error');
    }

    playGameOverSound() {
        this.playSound('gameOver');
    }

    playStartSound() {
        this.playSound('start');
    }

    playCollisionSound() {
        this.playSound('collision');
    }

    playPowerUpSound() {
        this.playSound('powerUp');
    }

    async startBackgroundMusic() {
        if (!this.isEnabled || this.isMusicPlaying) return;
        
        // Resume audio context if suspended
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
        
        if (this.musicBuffer) {
            // Play the loaded MP3 file
            this.playBackgroundMusicFile();
        } else {
            // Fallback to generated ambient music
            this.createBackgroundMusic();
        }
        
        this.isMusicPlaying = true;
    }

    playBackgroundMusicFile() {
        // Stop any existing background music
        this.stopBackgroundMusic();
        
        // Create new audio source and gain node
        this.backgroundMusicSource = this.audioContext.createBufferSource();
        this.backgroundMusicGain = this.audioContext.createGain();
        
        // Connect audio graph
        this.backgroundMusicSource.connect(this.backgroundMusicGain);
        this.backgroundMusicGain.connect(this.audioContext.destination);
        
        // Set buffer and properties
        this.backgroundMusicSource.buffer = this.musicBuffer;
        this.backgroundMusicSource.loop = true; // Enable looping
        this.backgroundMusicSource.loopStart = 0;
        this.backgroundMusicSource.loopEnd = this.musicBuffer.duration;
        
        // Set volume
        const volume = this.musicVolume * this.masterVolume;
        this.backgroundMusicGain.gain.setValueAtTime(0, this.audioContext.currentTime);
        this.backgroundMusicGain.gain.linearRampToValueAtTime(volume, this.audioContext.currentTime + 1); // Fade in over 1 second
        
        // Handle end event (shouldn't happen with loop=true, but just in case)
        this.backgroundMusicSource.onended = () => {
            if (this.isMusicPlaying) {
                // Restart the music if it ended unexpectedly
                setTimeout(() => this.playBackgroundMusicFile(), 100);
            }
        };
        
        // Start playing
        this.backgroundMusicSource.start(0);
        console.log('Background music started (MP3 file)');
    }

    createBackgroundMusic() {
        console.log('Using fallback generated ambient music');
        const playAmbientTone = () => {
            if (!this.isMusicPlaying) return;
            
            const frequencies = [220, 330, 440]; // Base chord
            const duration = 4; // 4 seconds per chord
            
            frequencies.forEach((freq, index) => {
                const oscillator = this.audioContext.createOscillator();
                const gainNode = this.audioContext.createGain();
                
                oscillator.connect(gainNode);
                gainNode.connect(this.audioContext.destination);
                
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(freq, this.audioContext.currentTime);
                
                const volume = this.musicVolume * this.masterVolume * 0.1;
                const now = this.audioContext.currentTime;
                
                gainNode.gain.setValueAtTime(0, now);
                gainNode.gain.linearRampToValueAtTime(volume, now + 1);
                gainNode.gain.linearRampToValueAtTime(volume * 0.7, now + duration - 1);
                gainNode.gain.linearRampToValueAtTime(0, now + duration);
                
                oscillator.start(now);
                oscillator.stop(now + duration);
            });
            
            // Schedule next chord
            setTimeout(playAmbientTone, duration * 1000);
        };
        
        playAmbientTone();
    }

    stopBackgroundMusic() {
        this.isMusicPlaying = false;
        
        if (this.backgroundMusicSource) {
            try {
                // Fade out before stopping
                if (this.backgroundMusicGain) {
                    this.backgroundMusicGain.gain.linearRampToValueAtTime(0, this.audioContext.currentTime + 0.5);
                }
                
                // Stop after fade out
                setTimeout(() => {
                    if (this.backgroundMusicSource) {
                        this.backgroundMusicSource.stop();
                        this.backgroundMusicSource = null;
                        this.backgroundMusicGain = null;
                    }
                }, 500);
            } catch (error) {
                console.warn('Error stopping background music:', error);
                this.backgroundMusicSource = null;
                this.backgroundMusicGain = null;
            }
        }
    }

    setMasterVolume(volume) {
        this.masterVolume = Math.max(0, Math.min(1, volume));
        // Update background music volume if playing
        if (this.backgroundMusicGain && this.isMusicPlaying) {
            const newVolume = this.musicVolume * this.masterVolume;
            this.backgroundMusicGain.gain.linearRampToValueAtTime(newVolume, this.audioContext.currentTime + 0.1);
        }
    }

    setSfxVolume(volume) {
        this.sfxVolume = Math.max(0, Math.min(1, volume));
    }

    setMusicVolume(volume) {
        this.musicVolume = Math.max(0, Math.min(1, volume));
        // Update background music volume if playing
        if (this.backgroundMusicGain && this.isMusicPlaying) {
            const newVolume = this.musicVolume * this.masterVolume;
            this.backgroundMusicGain.gain.linearRampToValueAtTime(newVolume, this.audioContext.currentTime + 0.1);
        }
    }

    toggleSound() {
        this.isEnabled = !this.isEnabled;
        if (!this.isEnabled) {
            this.stopBackgroundMusic();
        }
        return this.isEnabled;
    }

    toggleBackgroundMusic() {
        if (this.isMusicPlaying) {
            this.stopBackgroundMusic();
        } else {
            this.startBackgroundMusic();
        }
        return this.isMusicPlaying;
    }

    // Utility method to ensure audio context is ready
    async ensureAudioContext() {
        if (!this.audioContext) {
            await this.init();
        }
        
        if (this.audioContext.state === 'suspended') {
            await this.audioContext.resume();
        }
    }

    // Clean up resources
    dispose() {
        this.stopBackgroundMusic();
        if (this.audioContext) {
            this.audioContext.close();
        }
    }
}