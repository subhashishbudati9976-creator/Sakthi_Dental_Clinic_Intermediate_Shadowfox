/**
 * Cursor-driven 2,400-frame gaze renderer. Pointer state is sampled in RAF;
 * source frames are decoded asynchronously and only the newest target draws.
 */
class FrameCacheManager {
  constructor({ totalFrames = 2400, basePath = 'assets/character_frames/', maxCacheSize = 16, maxConcurrentDecodes = 2 } = {}) {
    this.totalFrames = totalFrames;
    this.basePath = basePath;
    this.maxCacheSize = maxCacheSize;
    this.maxConcurrentDecodes = maxConcurrentDecodes;
    this.cache = new Map();
    this.inFlight = new Set();
    this.queue = [];
    this.activeDecodes = 0;
    this.latestRequestedFrame = 0;
    this.displayedFrame = 0;
    this.onLatestReady = null;
    this.fetchCount = 0;
    this.decodeMs = 0;
    this.lastDecodeMs = 0;
  }

  normalize(index) {
    return ((index % this.totalFrames) + this.totalFrames) % this.totalFrames;
  }

  getFrameUrl(index) {
    return `${this.basePath}frame_${String(this.normalize(index)).padStart(4, '0')}.webp`;
  }

  get(index) {
    const frame = this.normalize(index);
    if (!this.cache.has(frame)) return null;
    const image = this.cache.get(frame);
    this.cache.delete(frame);
    this.cache.set(frame, image);
    return image;
  }

  requestTarget(index, onReady) {
    const frame = this.normalize(index);
    this.latestRequestedFrame = frame;
    this.onLatestReady = onReady;

    const cached = this.get(frame);
    if (cached) {
      onReady(frame, cached);
      return;
    }
    // Keep the visual responding while an exact frame is decoding.
    let nearestFrame = -1;
    let nearestDistance = Infinity;
    for (const [candidate, image] of this.cache) {
      const difference = Math.abs(candidate - frame);
      const distance = Math.min(difference, this.totalFrames - difference);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestFrame = candidate;
        var nearestImage = image;
      }
    }
    if (nearestFrame >= 0 && nearestFrame !== this.displayedFrame) onReady(nearestFrame, nearestImage);
    this.queue = [frame, ...this.queue.filter(item => item !== frame)];
    // Nearby frames are likely next as the cursor moves. Keep a small window decoded.
    if (this.cache.size) {
      for (let offset = 1; offset <= 3; offset++) {
        for (const nearby of [this.normalize(frame - offset), this.normalize(frame + offset)]) {
          if (!this.cache.has(nearby) && !this.inFlight.has(nearby) && !this.queue.includes(nearby)) this.queue.push(nearby);
        }
      }
    }
    this._pump();
  }

  _pump() {
    if (this.activeDecodes >= this.maxConcurrentDecodes) return;
    while (this.queue.length && (this.cache.has(this.queue[0]) || this.inFlight.has(this.queue[0]))) this.queue.shift();
    const frame = this.queue.shift();
    if (frame === undefined) {
      const latest = this.latestRequestedFrame;
      if (this.cache.has(latest) || this.inFlight.has(latest)) return;
      this.queue.push(latest);
      return this._pump();
    }

    this.activeDecodes++;
    this.fetchCount++;
    this.inFlight.add(frame);
    const startedAt = performance.now();
    const image = new Image();
    image.decoding = 'async';
    image.src = this.getFrameUrl(frame);
    image.decode().then(() => {
      const elapsed = performance.now() - startedAt;
      this.lastDecodeMs = elapsed;
      this.decodeMs = elapsed;
      this.cache.set(frame, image);
      this._evictExcess();
      if (frame === this.latestRequestedFrame && this.onLatestReady) {
        this.onLatestReady(frame, image);
      }
    }).catch(error => {
      if (frame === this.latestRequestedFrame) {
        console.warn(`Could not decode hero frame ${frame}.`, error);
      }
    }).finally(() => {
      this.inFlight.delete(frame);
      this.activeDecodes--;
      // A rapid cursor move may have replaced the target while this decode ran.
      this._pump();
    });
  }

  _evictExcess() {
    while (this.cache.size > this.maxCacheSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest === this.displayedFrame || oldest === this.latestRequestedFrame) {
        const image = this.cache.get(oldest);
        this.cache.delete(oldest);
        this.cache.set(oldest, image);
        if ([...this.cache.keys()][0] === oldest) break;
      } else {
        this.cache.delete(oldest);
      }
    }
  }
}

class InteractiveCharacterHero {
  static TELEMETRY_INTERVAL_MS = 250;

  constructor(options = {}) {
    this.container = typeof options.container === 'string'
      ? document.querySelector(options.container)
      : options.container;
    this.canvas = typeof options.canvas === 'string'
      ? document.querySelector(options.canvas)
      : (options.canvas || document.getElementById('characterCanvas'));
    if (!this.canvas) throw new Error('InteractiveCharacterHero requires a canvas element.');

    this.canvas.width = 1920;
    this.canvas.height = 1080;
    this.ctx = this.canvas.getContext('2d', { alpha: false, desynchronized: true });
    this.duration = 10;
    this.totalFrames = 2400;
    this.responseSpeed = options.responseSpeed || 32;
    this.deadZoneRadius = options.deadZoneRadius || 0.045;
    this.maxRadius = options.maxRadius || 0.42;
    this._vpW = window.innerWidth || 1;
    this._vpH = window.innerHeight || 1;
    this._rawX = this.currentX = 0.5;
    this._rawY = this.currentY = 0.5;
    this.lastTime = performance.now();
    this.rafId = null;
    this._lastRequestedFrame = -1;
    this._lastDrawnFrame = -1;
    this._lastTelemetryMs = 0;
    this._lastGazeName = '';
    this._frameCount = 0;
    this._lastFpsMs = performance.now();
    this._fpsValue = 0;
    this._pointerTime = 0;
    this.pointerToRafMs = 0;
    this._hasNewPointer = false;
    this._lastGazeCostMs = 0;
    this._lastDrawCostMs = 0;
    this._drawWaitMs = 0;
    this._targetRequestedAt = 0;
    this.debugEnabled = new URLSearchParams((window.location && window.location.search) || '').has('heroDebug');

    this.telemetryDirection = options.telemetryDirection || null;
    this.telemetryFps = options.telemetryFps || null;
    this.telemetryFrame = options.telemetryFrame || null;
    this.cacheManager = new FrameCacheManager({
      totalFrames: this.totalFrames,
      basePath: options.frameBasePath || 'assets/character_frames/',
      maxCacheSize: options.maxCacheSize || 16,
      maxConcurrentDecodes: options.maxConcurrentDecodes || 2
    });

    this.anchors = [
      { name: 'UP', time: 1.00 },
      { name: 'TOP-RIGHT', time: 2.10 },
      { name: 'RIGHT', time: 3.00 },
      { name: 'BOTTOM-RIGHT', time: 4.40 },
      { name: 'DOWN', time: 5.80 },
      { name: 'BOTTOM-LEFT', time: 6.80 },
      { name: 'LEFT', time: 7.70 },
      { name: 'TOP-LEFT', time: 9.10 }
    ];
    this.subtleTimes = [0.40, 1.60, 2.60, 3.80, 5.20, 6.40, 7.30, 8.80];

    this._onPointerMove = this._handlePointerMove.bind(this);
    this._onPointerLeave = this._handlePointerLeave.bind(this);
    this._onResize = this._handleResize.bind(this);
    this._loop = this._animationLoop.bind(this);
    window.addEventListener('pointermove', this._onPointerMove, { passive: true });
    document.addEventListener('mouseleave', this._onPointerLeave, { passive: true });
    window.addEventListener('resize', this._onResize, { passive: true });

    this._targetRequestedAt = performance.now();
    this.cacheManager.requestTarget(0, (frame, image) => this._drawFrame(frame, image));
    this._scheduleFrame();
  }

  resolveGaze(x, y) {
    const dx = x - 0.5;
    const dy = y - 0.5;
    const dist = Math.hypot(dx, dy);
    if (dist < this.deadZoneRadius) return { targetTime: 0, directionName: 'CENTER', frame: 0 };

    const angle = Math.atan2(dy, dx);
    let phi = angle + 0.5 * Math.PI;
    if (phi < 0) phi += 2 * Math.PI;
    if (phi >= 2 * Math.PI) phi -= 2 * Math.PI;
    const sector = phi / (0.25 * Math.PI);
    const idx = Math.floor(sector) % 8;
    const frac = sector - Math.floor(sector);
    let perimeterTime;
    if (idx === 7) perimeterTime = (9.10 + frac * (11 - 9.10)) % 10;
    else perimeterTime = this.anchors[idx].time + frac * (this.anchors[(idx + 1) % 8].time - this.anchors[idx].time);

    const mag = Math.min(1, (dist - this.deadZoneRadius) / (this.maxRadius - this.deadZoneRadius));
    const smoothMag = mag * mag * (3 - 2 * mag);
    let targetTime;
    let directionName;
    if (smoothMag < 0.22) {
      targetTime = 0;
      directionName = 'CENTER';
    } else {
      directionName = this.anchors[Math.round(sector) % 8].name;
      if (smoothMag < 0.60) {
        const subtleFrac = (smoothMag - 0.22) / 0.38;
        const subtleTime = this.subtleTimes[idx] + frac * (this.subtleTimes[(idx + 1) % 8] - this.subtleTimes[idx]);
        targetTime = subtleTime + subtleFrac * (perimeterTime - subtleTime);
      } else targetTime = perimeterTime;
    }
    return { targetTime, directionName, frame: Math.round(targetTime * this.totalFrames / this.duration) % this.totalFrames };
  }

  _handlePointerMove(event) {
    this._pointerTime = performance.now();
    this._hasNewPointer = true;
    this._rawX = Math.max(0, Math.min(1, event.clientX / this._vpW));
    this._rawY = Math.max(0, Math.min(1, event.clientY / this._vpH));
  }

  _handlePointerLeave() {
    this._rawX = 0.5;
    this._rawY = 0.5;
  }

  _handleResize() {
    this._vpW = window.innerWidth || 1;
    this._vpH = window.innerHeight || 1;
  }

  _drawFrame(frame, image) {
    const startedAt = performance.now();
    this.ctx.drawImage(image, 0, 0, 1920, 1080);
    this._lastDrawCostMs = performance.now() - startedAt;
    this._drawWaitMs = Math.max(0, performance.now() - this._targetRequestedAt);
    this._lastDrawnFrame = frame;
    this.cacheManager.displayedFrame = frame;
    if (this.container && !this.container.classList.contains('is-ready')) this.container.classList.add('is-ready');
  }

  _scheduleFrame() {
    this.rafId = requestAnimationFrame(this._loop);
  }

  _animationLoop(now) {
    const dt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;
    this._frameCount++;
    if (this._hasNewPointer) {
      this.pointerToRafMs = Math.max(0, now - this._pointerTime);
      this._hasNewPointer = false;
    }

    const alpha = 1 - Math.exp(-this.responseSpeed * dt);
    this.currentX += (this._rawX - this.currentX) * alpha;
    this.currentY += (this._rawY - this.currentY) * alpha;
    const gazeStartedAt = performance.now();
    const gaze = this.resolveGaze(this.currentX, this.currentY);
    this._lastGazeCostMs = performance.now() - gazeStartedAt;

    if (gaze.frame !== this._lastRequestedFrame) {
      this._lastRequestedFrame = gaze.frame;
      this._targetRequestedAt = performance.now();
      this.cacheManager.requestTarget(gaze.frame, (frame, image) => this._drawFrame(frame, image));
    }

    if (now - this._lastTelemetryMs >= InteractiveCharacterHero.TELEMETRY_INTERVAL_MS) {
      this._lastTelemetryMs = now;
      if (this.telemetryDirection && gaze.directionName !== this._lastGazeName) {
        this._lastGazeName = gaze.directionName;
        this.telemetryDirection.textContent = gaze.directionName;
      }
      if (this.telemetryFrame) this.telemetryFrame.textContent = `#${String(gaze.frame).padStart(4, '0')} / 2400`;
      const elapsed = now - this._lastFpsMs;
      if (elapsed >= 500) {
        this._fpsValue = Math.round(this._frameCount * 1000 / elapsed);
        this._frameCount = 0;
        this._lastFpsMs = now;
        if (this.telemetryFps) this.telemetryFps.textContent = `${this._fpsValue} FPS`;
      }
    }

    if (this.debugEnabled) {
      const directFrameDelta = Math.abs(gaze.frame - this._lastDrawnFrame);
      window.__HERO_DEBUG__ = {
        pointerToRafMs: this.pointerToRafMs,
        gazeCalculationMs: this._lastGazeCostMs,
        fps: this._fpsValue,
        targetFrame: gaze.frame,
        displayedFrame: this._lastDrawnFrame,
        frameDelta: Math.min(directFrameDelta, this.totalFrames - directFrameDelta),
        cacheSize: this.cacheManager.cache.size,
        inFlight: this.cacheManager.activeDecodes,
        requests: this.cacheManager.fetchCount,
        decodeMs: this.cacheManager.lastDecodeMs,
        frameWaitMs: this._drawWaitMs,
        drawMs: this._lastDrawCostMs
      };
    }
    this._scheduleFrame();
  }

  destroy() {
    if (this.rafId) cancelAnimationFrame(this.rafId);
    window.removeEventListener('pointermove', this._onPointerMove);
    document.removeEventListener('mouseleave', this._onPointerLeave);
    window.removeEventListener('resize', this._onResize);
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { InteractiveCharacterHero, FrameCacheManager };
} else {
  window.InteractiveCharacterHero = InteractiveCharacterHero;
  window.FrameCacheManager = FrameCacheManager;
}
