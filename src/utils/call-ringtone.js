import { Platform } from 'react-native';
const RINGTONE_URL = '/sounds/call-ringtone.mp3';
let audioContext = null;
let ringTimer = null;
let activeNodes = [];
let activeMode = null;
let ringtoneEl = null;
function canRing() {
    return Platform.OS === 'web' && typeof window !== 'undefined';
}
function getContext() {
    if (!canRing()) {
        return null;
    }
    const Ctx = window.AudioContext ||
        window.webkitAudioContext;
    if (!Ctx) {
        return null;
    }
    if (!audioContext) {
        audioContext = new Ctx();
    }
    return audioContext;
}
function stopNodes() {
    for (const node of activeNodes) {
        try {
            if ('stop' in node && typeof node.stop === 'function') {
                node.stop();
            }
            node.disconnect();
        }
        catch {
            // already stopped
        }
    }
    activeNodes = [];
}
/** Incoming: short dual-tone bursts (phone ring). */
function playIncomingBurst(context) {
    const now = context.currentTime;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.18, now + 0.04);
    master.gain.setValueAtTime(0.18, now + 0.35);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    master.connect(context.destination);
    activeNodes.push(master);
    for (const [offset, freq] of [
        [0, 740],
        [0.18, 880],
    ]) {
        const osc = context.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + offset);
        osc.connect(master);
        osc.start(now + offset);
        osc.stop(now + offset + 0.16);
        activeNodes.push(osc);
    }
}
/**
 * Outgoing гудки (ringback): RU/EU cadence ~425 Hz, 1 s on / 4 s off.
 * Soft saw + sine mix so it reads as a phone tone, not a beep.
 */
function playRingbackBurst(context) {
    const now = context.currentTime;
    const duration = 1.05;
    const master = context.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
    master.gain.setValueAtTime(0.12, now + duration - 0.08);
    master.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    master.connect(context.destination);
    activeNodes.push(master);
    const sine = context.createOscillator();
    sine.type = 'sine';
    sine.frequency.setValueAtTime(425, now);
    sine.connect(master);
    sine.start(now);
    sine.stop(now + duration);
    activeNodes.push(sine);
    const soft = context.createOscillator();
    soft.type = 'triangle';
    soft.frequency.setValueAtTime(425, now);
    const softGain = context.createGain();
    softGain.gain.value = 0.35;
    soft.connect(softGain);
    softGain.connect(master);
    soft.start(now);
    soft.stop(now + duration);
    activeNodes.push(soft, softGain);
}
function stopMediaRingtone() {
    if (!ringtoneEl) {
        return;
    }
    const el = ringtoneEl;
    ringtoneEl = null;
    try {
        el.pause();
        el.currentTime = 0;
        el.removeAttribute('src');
        el.load();
    }
    catch {
        // already released
    }
}
function startLoop(mode, intervalMs, play) {
    if (!canRing()) {
        return;
    }
    stopCallRingtone();
    const context = getContext();
    if (!context) {
        return;
    }
    activeMode = mode;
    const kick = () => {
        void context.resume().then(() => {
            if (activeMode !== mode) {
                return;
            }
            stopNodes();
            play(context);
        });
    };
    kick();
    ringTimer = setInterval(kick, intervalMs);
}
function startFileRingtone() {
    if (!canRing() || typeof Audio === 'undefined') {
        return false;
    }
    stopMediaRingtone();
    const el = new Audio(RINGTONE_URL);
    el.loop = true;
    el.preload = 'auto';
    el.volume = 0.8;
    ringtoneEl = el;
    activeMode = 'incoming';
    void el.play().catch(() => {
        if (ringtoneEl !== el) {
            return;
        }
        stopMediaRingtone();
        startLoop('incoming', 2200, playIncomingBurst);
    });
    return true;
}
/** Incoming ringtone. Needs a prior user gesture to unlock playback. */
export function startCallRingtone() {
    stopCallRingtone();
    if (startFileRingtone()) {
        return;
    }
    startLoop('incoming', 2200, playIncomingBurst);
}
/** Гудки for the caller while waiting for answer. */
export function startCallRingback() {
    // 1 s tone + ~3.2 s silence ≈ classic ringback cadence
    startLoop('ringback', 4200, playRingbackBurst);
}
export function stopCallRingtone() {
    activeMode = null;
    stopMediaRingtone();
    if (ringTimer) {
        clearInterval(ringTimer);
        ringTimer = null;
    }
    stopNodes();
}
/**
 * Soft UI chirp when muting / unmuting the mic in a call.
 * Does not interrupt ringtone/ringback loops.
 */
export function playMicToggleSound(muted) {
    if (!canRing()) {
        return;
    }
    const context = getContext();
    if (!context) {
        return;
    }
    void context.resume().then(() => {
        const now = context.currentTime;
        const master = context.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.14, now + 0.012);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);
        master.connect(context.destination);
        const osc = context.createOscillator();
        osc.type = 'sine';
        if (muted) {
            // Mic off — short descending tone
            osc.frequency.setValueAtTime(720, now);
            osc.frequency.exponentialRampToValueAtTime(320, now + 0.12);
        }
        else {
            // Mic on — short ascending tone
            osc.frequency.setValueAtTime(360, now);
            osc.frequency.exponentialRampToValueAtTime(820, now + 0.12);
        }
        osc.connect(master);
        osc.start(now);
        osc.stop(now + 0.15);
    });
}
/**
 * Putting the handset down — short click, then a falling tone.
 * Does not touch ringtone/ringback loops (caller should stop those first).
 */
export function playHangupSound() {
    if (!canRing()) {
        return;
    }
    const context = getContext();
    if (!context) {
        return;
    }
    void context.resume().then(() => {
        const now = context.currentTime;
        const master = context.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
        master.gain.setValueAtTime(0.16, now + 0.08);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
        master.connect(context.destination);
        const click = context.createOscillator();
        click.type = 'square';
        click.frequency.setValueAtTime(190, now);
        const clickGain = context.createGain();
        clickGain.gain.setValueAtTime(0.0001, now);
        clickGain.gain.exponentialRampToValueAtTime(0.55, now + 0.008);
        clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
        click.connect(clickGain);
        clickGain.connect(master);
        click.start(now);
        click.stop(now + 0.05);
        const fall = context.createOscillator();
        fall.type = 'sine';
        fall.frequency.setValueAtTime(420, now + 0.04);
        fall.frequency.exponentialRampToValueAtTime(140, now + 0.28);
        const fallGain = context.createGain();
        fallGain.gain.setValueAtTime(0.0001, now + 0.04);
        fallGain.gain.exponentialRampToValueAtTime(0.9, now + 0.06);
        fallGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
        fall.connect(fallGain);
        fallGain.connect(master);
        fall.start(now + 0.04);
        fall.stop(now + 0.32);
    });
}
/**
 * Short urgent chime for «срочная заявка» in an active call.
 * Does not interrupt ringtone/ringback loops.
 */
export function playUrgentRequestAlert() {
    if (!canRing()) {
        return;
    }
    const context = getContext();
    if (!context) {
        return;
    }
    void context.resume().then(() => {
        const now = context.currentTime;
        const master = context.createGain();
        master.gain.setValueAtTime(0.0001, now);
        master.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
        master.gain.setValueAtTime(0.22, now + 0.55);
        master.gain.exponentialRampToValueAtTime(0.0001, now + 0.85);
        master.connect(context.destination);
        const tones = [
            [0, 660],
            [0.14, 880],
            [0.28, 1175],
        ];
        for (const [offset, freq] of tones) {
            const osc = context.createOscillator();
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(freq, now + offset);
            const gain = context.createGain();
            gain.gain.setValueAtTime(0.0001, now + offset);
            gain.gain.exponentialRampToValueAtTime(0.9, now + offset + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.0001, now + offset + 0.18);
            osc.connect(gain);
            gain.connect(master);
            osc.start(now + offset);
            osc.stop(now + offset + 0.2);
        }
    });
}
