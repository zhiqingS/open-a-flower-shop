import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SAMPLE_RATE = 44_100;
const OUTPUT_DIR = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../assets/resources/audio",
);

const cues = {
  reveal: {
    duration: 0.72,
    notes: [
      { start: 0, duration: 0.34, frequency: 523.25, volume: 0.34 },
      { start: 0.14, duration: 0.38, frequency: 659.25, volume: 0.3 },
      { start: 0.29, duration: 0.42, frequency: 783.99, volume: 0.28 },
    ],
  },
  bloom: {
    duration: 0.95,
    notes: [
      { start: 0, duration: 0.28, frequency: 392, volume: 0.25 },
      { start: 0.14, duration: 0.3, frequency: 493.88, volume: 0.25 },
      { start: 0.28, duration: 0.32, frequency: 587.33, volume: 0.25 },
      { start: 0.42, duration: 0.45, frequency: 783.99, volume: 0.28 },
    ],
  },
  harvest: {
    duration: 0.68,
    notes: Array.from({ length: 6 }, (_, index) => ({
      start: index * 0.085,
      duration: 0.16,
      frequency: 620 + index * 95,
      volume: 0.25,
    })),
  },
  bouquet: {
    duration: 1.05,
    notes: [
      { start: 0, duration: 0.75, frequency: 523.25, volume: 0.22 },
      { start: 0.04, duration: 0.8, frequency: 659.25, volume: 0.2 },
      { start: 0.08, duration: 0.85, frequency: 783.99, volume: 0.2 },
      { start: 0.32, duration: 0.65, frequency: 1046.5, volume: 0.18 },
    ],
  },
};

const writeUint32LE = (buffer, offset, value) => buffer.writeUInt32LE(value, offset);
const writeUint16LE = (buffer, offset, value) => buffer.writeUInt16LE(value, offset);

const renderCue = ({ duration, notes }) => {
  const sampleCount = Math.ceil(duration * SAMPLE_RATE);
  const pcm = Buffer.alloc(sampleCount * 2);

  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const time = sampleIndex / SAMPLE_RATE;
    let value = 0;

    for (const note of notes) {
      const localTime = time - note.start;
      if (localTime < 0 || localTime > note.duration) {
        continue;
      }

      const attack = Math.min(1, localTime / 0.02);
      const decay = Math.pow(1 - localTime / note.duration, 1.8);
      const shimmer = Math.sin(Math.PI * 2 * note.frequency * 2.01 * localTime) * 0.14;
      value +=
        (Math.sin(Math.PI * 2 * note.frequency * localTime) + shimmer) *
        note.volume *
        attack *
        decay;
    }

    const clamped = Math.max(-1, Math.min(1, value));
    pcm.writeInt16LE(Math.round(clamped * 32_767), sampleIndex * 2);
  }

  const wav = Buffer.alloc(44 + pcm.length);
  wav.write("RIFF", 0);
  writeUint32LE(wav, 4, 36 + pcm.length);
  wav.write("WAVE", 8);
  wav.write("fmt ", 12);
  writeUint32LE(wav, 16, 16);
  writeUint16LE(wav, 20, 1);
  writeUint16LE(wav, 22, 1);
  writeUint32LE(wav, 24, SAMPLE_RATE);
  writeUint32LE(wav, 28, SAMPLE_RATE * 2);
  writeUint16LE(wav, 32, 2);
  writeUint16LE(wav, 34, 16);
  wav.write("data", 36);
  writeUint32LE(wav, 40, pcm.length);
  pcm.copy(wav, 44);
  return wav;
};

mkdirSync(OUTPUT_DIR, { recursive: true });
for (const [name, cue] of Object.entries(cues)) {
  writeFileSync(resolve(OUTPUT_DIR, `${name}.wav`), renderCue(cue));
}

console.log(`Generated ${Object.keys(cues).length} original SFX cues in ${OUTPUT_DIR}`);
