class SpeakingDetectionService {
  constructor() {
    this.audioContext = null;
    this.analyser = null;
    this.microphone = null;
    this.dataArray = null;
    this.isMonitoring = false;
    this.callbacks = new Set();
    this.speakingThreshold = 30; // Adjustable threshold
    this.silenceThreshold = 10;
    this.isSpeaking = false;
    this.speakingStartTime = null;
    this.lastAudioLevel = 0;
    this.smoothingFactor = 0.8;
    this.speakingHistory = [];
    this.maxHistoryLength = 100;
    this.monitoringInterval = null;
    this.participants = new Map(); // Track multiple participants
    this.audioLevelCallbacks = new Set();
    this.speakingCallbacks = new Set();
  }

  // Initialize audio context and start monitoring local audio
  async initialize(stream) {
    try {
      // Create audio context if it doesn't exist
      if (!this.audioContext) {
        this.audioContext = new (window.AudioContext ||
          window.webkitAudioContext)();
      }

      // Resume audio context if suspended
      if (this.audioContext.state === "suspended") {
        await this.audioContext.resume();
      }

      // Get audio tracks from stream
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) {
        throw new Error("No audio tracks found in stream");
      }

      // Create media stream source
      this.microphone = this.audioContext.createMediaStreamSource(stream);

      // Create analyser node
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect microphone to analyser
      this.microphone.connect(this.analyser);

      // Create data array for frequency analysis
      this.dataArray = new Uint8Array(this.analyser.frequencyBinCount);

      console.log("🎤 Speaking detection initialized");
      return true;
    } catch (error) {
      console.error("Failed to initialize speaking detection:", error);
      return false;
    }
  }

  // Start monitoring audio levels
  startMonitoring(userId = "local") {
    if (!this.analyser || this.isMonitoring) {
      return false;
    }

    this.isMonitoring = true;
    console.log("🎙️ Started speaking detection monitoring");

    // Monitor audio levels at 60fps for smooth detection
    const monitor = () => {
      if (!this.isMonitoring) return;

      const audioLevel = this.getAudioLevel();
      const wasSpeaking = this.isSpeaking;

      // Update speaking status based on threshold
      if (audioLevel > this.speakingThreshold && !this.isSpeaking) {
        this.isSpeaking = true;
        this.speakingStartTime = Date.now();
        this.notifySpeakingChange(userId, true, audioLevel);
      } else if (audioLevel < this.silenceThreshold && this.isSpeaking) {
        this.isSpeaking = false;
        const speakingDuration = Date.now() - this.speakingStartTime;
        this.notifySpeakingChange(userId, false, audioLevel, speakingDuration);
      }

      // Notify audio level changes regardless of speaking status
      this.notifyAudioLevel(userId, audioLevel, this.isSpeaking);

      // Store speaking history for analytics
      this.updateSpeakingHistory(audioLevel, this.isSpeaking);

      // Continue monitoring
      requestAnimationFrame(monitor);
    };

    monitor();
    return true;
  }

  // Stop monitoring audio levels
  stopMonitoring() {
    this.isMonitoring = false;

    if (this.isSpeaking) {
      this.isSpeaking = false;
      this.notifySpeakingChange("local", false, 0);
    }

    console.log("🛑 Stopped speaking detection monitoring");
  }

  // Get current audio level (0-100)
  getAudioLevel() {
    if (!this.analyser || !this.dataArray) return 0;

    this.analyser.getByteFrequencyData(this.dataArray);

    // Calculate RMS (Root Mean Square) for better voice detection
    let sum = 0;
    for (let i = 0; i < this.dataArray.length; i++) {
      sum += this.dataArray[i] * this.dataArray[i];
    }

    const rms = Math.sqrt(sum / this.dataArray.length);

    // Apply smoothing to reduce noise
    this.lastAudioLevel =
      this.lastAudioLevel * this.smoothingFactor +
      rms * (1 - this.smoothingFactor);

    return Math.min(100, this.lastAudioLevel);
  }

  // Get frequency analysis for advanced detection
  getFrequencyData() {
    if (!this.analyser || !this.dataArray) return null;

    const frequencyData = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(frequencyData);

    return frequencyData;
  }

  // Advanced voice activity detection using frequency analysis
  detectVoiceActivity() {
    const frequencyData = this.getFrequencyData();
    if (!frequencyData) return false;

    // Voice frequencies are typically between 85Hz and 4kHz
    const sampleRate = this.audioContext.sampleRate;
    const binSize = sampleRate / this.analyser.fftSize;

    const voiceStart = Math.floor(85 / binSize);
    const voiceEnd = Math.floor(4000 / binSize);

    let voiceEnergy = 0;
    let totalEnergy = 0;

    for (let i = 0; i < frequencyData.length; i++) {
      const energy = frequencyData[i];
      totalEnergy += energy;

      if (i >= voiceStart && i <= voiceEnd) {
        voiceEnergy += energy;
      }
    }

    // Calculate voice energy ratio
    const voiceRatio = totalEnergy > 0 ? voiceEnergy / totalEnergy : 0;

    // Voice activity detected if voice energy is significant and above threshold
    return voiceRatio > 0.3 && voiceEnergy > this.speakingThreshold;
  }

  // Update speaking history for analytics
  updateSpeakingHistory(audioLevel, isSpeaking) {
    const timestamp = Date.now();

    this.speakingHistory.push({
      timestamp,
      audioLevel,
      isSpeaking,
    });

    // Limit history size
    if (this.speakingHistory.length > this.maxHistoryLength) {
      this.speakingHistory.shift();
    }
  }

  // Get speaking statistics
  getSpeakingStats(timeRangeMs = 60000) {
    // Default: last 60 seconds
    const now = Date.now();
    const cutoff = now - timeRangeMs;

    const recentHistory = this.speakingHistory.filter(
      (entry) => entry.timestamp >= cutoff,
    );

    if (recentHistory.length === 0) {
      return {
        totalTime: 0,
        speakingTime: 0,
        speakingPercentage: 0,
        averageAudioLevel: 0,
        peakAudioLevel: 0,
        speakingBursts: 0,
      };
    }

    let speakingTime = 0;
    let totalAudioLevel = 0;
    let peakAudioLevel = 0;
    let speakingBursts = 0;
    let wasSpeaking = false;

    recentHistory.forEach((entry, index) => {
      if (entry.isSpeaking) {
        if (index > 0) {
          const timeDiff = entry.timestamp - recentHistory[index - 1].timestamp;
          speakingTime += timeDiff;
        }

        if (!wasSpeaking) {
          speakingBursts++;
        }
        wasSpeaking = true;
      } else {
        wasSpeaking = false;
      }

      totalAudioLevel += entry.audioLevel;
      peakAudioLevel = Math.max(peakAudioLevel, entry.audioLevel);
    });

    const totalTime = timeRangeMs;
    const averageAudioLevel = totalAudioLevel / recentHistory.length;
    const speakingPercentage = (speakingTime / totalTime) * 100;

    return {
      totalTime,
      speakingTime,
      speakingPercentage,
      averageAudioLevel,
      peakAudioLevel,
      speakingBursts,
    };
  }

  // Participant tracking for remote audio analysis
  addParticipant(userId, audioElement) {
    if (!audioElement) return false;

    try {
      const audioStream = audioElement.captureStream();
      const source = this.audioContext.createMediaElementSource(audioElement);
      const analyser = this.audioContext.createAnalyser();

      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.8;

      source.connect(analyser);
      source.connect(this.audioContext.destination); // Still output audio

      this.participants.set(userId, {
        audioElement,
        source,
        analyser,
        dataArray: new Uint8Array(analyser.frequencyBinCount),
        isSpeaking: false,
        lastAudioLevel: 0,
      });

      console.log(`🎤 Added participant ${userId} for speaking detection`);
      return true;
    } catch (error) {
      console.error(`Failed to add participant ${userId}:`, error);
      return false;
    }
  }

  // Remove participant from tracking
  removeParticipant(userId) {
    const participant = this.participants.get(userId);
    if (participant) {
      try {
        participant.source.disconnect();
        this.participants.delete(userId);
        console.log(`🎤 Removed participant ${userId} from speaking detection`);
      } catch (error) {
        console.error(`Error removing participant ${userId}:`, error);
      }
    }
  }

  // Monitor all participants
  monitorAllParticipants() {
    this.participants.forEach((participant, userId) => {
      const audioLevel = this.getParticipantAudioLevel(userId);
      const wasSpeaking = participant.isSpeaking;
      const isSpeaking = audioLevel > this.speakingThreshold;

      if (isSpeaking !== wasSpeaking) {
        participant.isSpeaking = isSpeaking;
        this.notifySpeakingChange(userId, isSpeaking, audioLevel);
      }

      this.notifyAudioLevel(userId, audioLevel, isSpeaking);
    });
  }

  // Get audio level for specific participant
  getParticipantAudioLevel(userId) {
    const participant = this.participants.get(userId);
    if (!participant || !participant.analyser) return 0;

    participant.analyser.getByteFrequencyData(participant.dataArray);

    let sum = 0;
    for (let i = 0; i < participant.dataArray.length; i++) {
      sum += participant.dataArray[i] * participant.dataArray[i];
    }

    const rms = Math.sqrt(sum / participant.dataArray.length);
    participant.lastAudioLevel =
      participant.lastAudioLevel * this.smoothingFactor +
      rms * (1 - this.smoothingFactor);

    return Math.min(100, participant.lastAudioLevel);
  }

  // Callback registration
  onSpeakingChange(callback) {
    this.speakingCallbacks.add(callback);
  }

  offSpeakingChange(callback) {
    this.speakingCallbacks.delete(callback);
  }

  onAudioLevel(callback) {
    this.audioLevelCallbacks.add(callback);
  }

  offAudioLevel(callback) {
    this.audioLevelCallbacks.delete(callback);
  }

  // Notification methods
  notifySpeakingChange(userId, isSpeaking, audioLevel, duration = null) {
    const data = {
      userId,
      isSpeaking,
      audioLevel,
      timestamp: Date.now(),
      ...(duration && { duration }),
    };

    this.speakingCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("Error in speaking change callback:", error);
      }
    });
  }

  notifyAudioLevel(userId, audioLevel, isSpeaking) {
    const data = {
      userId,
      audioLevel,
      isSpeaking,
      timestamp: Date.now(),
    };

    this.audioLevelCallbacks.forEach((callback) => {
      try {
        callback(data);
      } catch (error) {
        console.error("Error in audio level callback:", error);
      }
    });
  }

  // Configuration
  setSpeakingThreshold(threshold) {
    this.speakingThreshold = Math.max(0, Math.min(100, threshold));
  }

  setSilenceThreshold(threshold) {
    this.silenceThreshold = Math.max(0, Math.min(100, threshold));
  }

  setSmoothingFactor(factor) {
    this.smoothingFactor = Math.max(0, Math.min(1, factor));
  }

  // Cleanup
  cleanup() {
    this.stopMonitoring();

    // Disconnect all participants
    this.participants.forEach((participant, userId) => {
      this.removeParticipant(userId);
    });

    // Clean up local audio context
    if (this.microphone) {
      this.microphone.disconnect();
      this.microphone = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    this.analyser = null;
    this.dataArray = null;
    this.callbacks.clear();
    this.speakingCallbacks.clear();
    this.audioLevelCallbacks.clear();
    this.speakingHistory = [];

    console.log("🧹 Speaking detection service cleaned up");
  }

  // Utility methods
  getCurrentState() {
    return {
      isMonitoring: this.isMonitoring,
      isSpeaking: this.isSpeaking,
      audioLevel: this.lastAudioLevel,
      participantCount: this.participants.size,
      speakingThreshold: this.speakingThreshold,
      silenceThreshold: this.silenceThreshold,
    };
  }

  // Auto-calibration based on ambient noise
  async calibrateThresholds(calibrationTimeMs = 3000) {
    if (!this.isMonitoring) return false;

    console.log("🎯 Starting speaking threshold calibration...");
    const samples = [];
    const startTime = Date.now();

    return new Promise((resolve) => {
      const calibrate = () => {
        const audioLevel = this.getAudioLevel();
        samples.push(audioLevel);

        if (Date.now() - startTime < calibrationTimeMs) {
          requestAnimationFrame(calibrate);
        } else {
          // Calculate calibrated thresholds
          samples.sort((a, b) => a - b);
          const median = samples[Math.floor(samples.length / 2)];
          const q75 = samples[Math.floor(samples.length * 0.75)];
          const max = Math.max(...samples);

          // Set thresholds based on ambient noise
          this.silenceThreshold = Math.max(5, median + 5);
          this.speakingThreshold = Math.max(this.silenceThreshold + 10, q75);

          console.log(`🎯 Calibration complete:
            Samples: ${samples.length}
            Ambient level: ${median.toFixed(1)}
            Silence threshold: ${this.silenceThreshold}
            Speaking threshold: ${this.speakingThreshold}`);

          resolve({
            ambientLevel: median,
            silenceThreshold: this.silenceThreshold,
            speakingThreshold: this.speakingThreshold,
          });
        }
      };

      calibrate();
    });
  }
}

// Singleton instance
const speakingDetectionService = new SpeakingDetectionService();

export default speakingDetectionService;
