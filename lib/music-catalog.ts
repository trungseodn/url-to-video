import fs from "fs";
import path from "path";

export interface ZTTeamMusicTrack {
  id: string;
  title: string;
  category: "Tin Nóng" | "Hồi Hộp" | "Đếm Ngược" | "Điều Tra" | "Hành Động" | "Cảm Xúc" | "Công Nghệ" | "Tắt Nhạc";
  description: string;
  duration: string;
  url: string;
  isCustom?: boolean;
}

export const ZTTEAM_PRESET_MUSIC: ZTTeamMusicTrack[] = [
  {
    id: "news-breaking-alert",
    title: "Breaking News Urgent Alert",
    category: "Tin Nóng",
    description: "Nhạc intro bản tin nóng, chuông báo động dồn dập, sub-bass trầm hùng chuẩn Facebook News",
    duration: "12s",
    url: "/music/news-breaking-alert.wav",
  },
  {
    id: "tension-suspense",
    title: "Deep Mystery & Suspense",
    category: "Hồi Hộp",
    description: "Không khí bí ẩn nghẹt thở, tiếng tim đập hồi hộp, kích thích người xem tò mò",
    duration: "12s",
    url: "/music/tension-suspense.wav",
  },
  {
    id: "countdown-pulse",
    title: "Dramatic News Countdown",
    category: "Đếm Ngược",
    description: "Tiếng kim đồng hồ tích tắc dồn dập kèm cú đánh bass kịch tính đến nghẹt thở",
    duration: "12s",
    url: "/music/countdown-pulse.wav",
  },
  {
    id: "urgent-investigation",
    title: "Dark Crime & Investigation",
    category: "Điều Tra",
    description: "Nhịp bass dồn dập u tối, không khí gay cấn phá án, drama kịch tính",
    duration: "12s",
    url: "/music/urgent-investigation.wav",
  },
  {
    id: "action-pulse",
    title: "Viral Fast Action Beat",
    category: "Hành Động",
    description: "Nhịp điệu 128 BPM hiện đại, cuốn hút người xem lướt Reels và Video",
    duration: "12s",
    url: "/music/action-pulse.wav",
  },
  {
    id: "emotional-piano",
    title: "Serious & Emotional Strings",
    category: "Cảm Xúc",
    description: "Giai điệu piano & đàn dây sâu lắng, trang nghiêm, phù hợp tin xúc động hoặc bi kịch",
    duration: "12s",
    url: "/music/emotional-piano.wav",
  },
  {
    id: "tech-cyber-alert",
    title: "Cyber & Tech Warning",
    category: "Công Nghệ",
    description: "Âm hưởng điện tử công nghệ cao, cảnh báo lừa đảo, tin tức tài chính số",
    duration: "12s",
    url: "/music/tech-cyber-alert.wav",
  },
  {
    id: "none",
    title: "Không dùng nhạc (Tắt âm / Im lặng)",
    category: "Tắt Nhạc",
    description: "Video không kèm nhạc nền, thuận tiện chèn âm thanh trực tiếp trên Facebook Studio",
    duration: "--",
    url: "",
  },
];

/** Tạo RIFF WAV Header */
function createWavHeader(dataLength: number, sampleRate = 44100, numChannels = 2, bitsPerSample = 16): Buffer {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const buffer = Buffer.alloc(44);

  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataLength, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataLength, 40);

  return buffer;
}

/** Tổng hợp âm thanh WAV stereo 44.1kHz chất lượng cao theo từng phong cách */
function generateTrackPcm(id: string, durationSec = 12): Buffer {
  const sampleRate = 44100;
  const numSamples = sampleRate * durationSec;
  const numChannels = 2;
  const bytesPerSample = 2; // 16-bit
  const buffer = Buffer.alloc(numSamples * numChannels * bytesPerSample);

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let left = 0;
    let right = 0;

    switch (id) {
      case "news-breaking-alert": {
        // Sub-bass drone 65Hz
        const drone = Math.sin(2 * Math.PI * 65.4 * t) * 0.35;
        
        // News ticker ping (every 0.25s)
        const tickPeriod = 0.25;
        const tickPhase = t % tickPeriod;
        const tickEnv = Math.exp(-tickPhase * 35);
        const tickFreq = (Math.floor(t / tickPeriod) % 4 === 0) ? 880 : 587;
        const tick = Math.sin(2 * Math.PI * tickFreq * t) * tickEnv * 0.45;

        // Big broadcast chord swell every 3s
        const swellPeriod = 3.0;
        const swellPhase = t % swellPeriod;
        const swellEnv = Math.exp(-swellPhase * 1.5);
        const chord1 = Math.sin(2 * Math.PI * 196 * t);
        const chord2 = Math.sin(2 * Math.PI * 246.9 * t);
        const chord3 = Math.sin(2 * Math.PI * 293.6 * t);
        const chord = (chord1 + chord2 + chord3) * 0.15 * swellEnv;

        // Heavy kick pulse every 1s
        const kickPhase = t % 1.0;
        const kickEnv = Math.exp(-kickPhase * 14);
        const kickFreq = 120 * Math.exp(-kickPhase * 25) + 45;
        const kick = Math.sin(2 * Math.PI * kickFreq * kickPhase) * kickEnv * 0.55;

        left = drone + tick * 0.9 + chord + kick;
        right = drone + tick * 0.7 + chord + kick;
        break;
      }

      case "tension-suspense": {
        // Deep LFO modulated sub-bass 55Hz
        const lfo = 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.3 * t);
        const drone = (Math.sin(2 * Math.PI * 55 * t) + 0.3 * Math.sin(2 * Math.PI * 110 * t)) * 0.4 * lfo;

        // Eerie minor dyad (A2 + C3)
        const pad1 = Math.sin(2 * Math.PI * 110 * t + Math.sin(t * 2));
        const pad2 = Math.sin(2 * Math.PI * 130.8 * t);
        const pad = (pad1 + pad2) * 0.15;

        // Double heartbeat thud every 1.2s
        const hbPhase = t % 1.2;
        let hb = 0;
        if (hbPhase < 0.2) {
          hb = Math.sin(2 * Math.PI * 48 * hbPhase) * Math.exp(-hbPhase * 22) * 0.6;
        } else if (hbPhase >= 0.25 && hbPhase < 0.45) {
          const p2 = hbPhase - 0.25;
          hb = Math.sin(2 * Math.PI * 42 * p2) * Math.exp(-p2 * 24) * 0.45;
        }

        left = drone + pad * 0.8 + hb;
        right = drone + pad * 1.1 + hb;
        break;
      }

      case "countdown-pulse": {
        // Crisp clock tick every 0.25s
        const tickPhase = t % 0.25;
        const tickEnv = Math.exp(-tickPhase * 80);
        const tickNoise = (Math.random() * 2 - 1) * tickEnv * 0.25;
        const tickSine = Math.sin(2 * Math.PI * 2200 * t) * tickEnv * 0.3;

        // Impact drop every 2s
        const dropPhase = t % 2.0;
        const dropEnv = Math.exp(-dropPhase * 4);
        const dropFreq = 140 * Math.exp(-dropPhase * 10) + 40;
        const drop = Math.sin(2 * Math.PI * dropFreq * dropPhase) * dropEnv * 0.55;

        // Rising tension sweep
        const sweepFreq = 200 + (t % 4.0) * 150;
        const sweep = Math.sin(2 * Math.PI * sweepFreq * t) * 0.1;

        left = tickNoise + tickSine + drop + sweep;
        right = -tickNoise + tickSine + drop + sweep;
        break;
      }

      case "urgent-investigation": {
        // Fast 16th note ostinato bass (130 BPM)
        const noteDuration = 60 / (130 * 4); // 0.115s
        const noteIdx = Math.floor(t / noteDuration) % 8;
        const bassFreqs = [73.4, 73.4, 87.3, 73.4, 103.8, 87.3, 73.4, 65.4];
        const notePhase = t % noteDuration;
        const noteEnv = Math.exp(-notePhase * 18);
        const bass = Math.sin(2 * Math.PI * bassFreqs[noteIdx] * t) * noteEnv * 0.45;

        // Sustained Fifth pad
        const pad1 = Math.sin(2 * Math.PI * 293.6 * t);
        const pad2 = Math.sin(2 * Math.PI * 440 * t);
        const pad = (pad1 + pad2) * 0.12 * (0.8 + 0.2 * Math.sin(t * 3));

        left = bass + pad;
        right = bass + pad;
        break;
      }

      case "action-pulse": {
        // 128 BPM 4-on-the-floor beat (0.468s per beat)
        const beatPeriod = 60 / 128;
        const beatPhase = t % beatPeriod;
        
        // Kick
        const kickEnv = Math.exp(-beatPhase * 16);
        const kick = Math.sin(2 * Math.PI * (130 * Math.exp(-beatPhase * 30) + 45) * beatPhase) * kickEnv * 0.6;

        // Hi-hat on off-beat
        let hat = 0;
        if (beatPhase > beatPeriod * 0.45 && beatPhase < beatPeriod * 0.65) {
          const hatPhase = beatPhase - beatPeriod * 0.5;
          hat = (Math.random() * 2 - 1) * Math.exp(-hatPhase * 60) * 0.2;
        }

        // Rolling bass synth
        const synthPhase = (t * 8) % 1;
        const synthFreq = 110 + (Math.floor(t * 4) % 4) * 20;
        const synth = Math.sin(2 * Math.PI * synthFreq * t) * Math.exp(-synthPhase * 8) * 0.25;

        left = kick + hat + synth;
        right = kick - hat + synth;
        break;
      }

      case "emotional-piano": {
        // Slow arpeggios (A minor: 220, 261.6, 329.6, 440)
        const arpStep = 0.5;
        const arpIdx = Math.floor(t / arpStep) % 4;
        const arpFreqs = [220, 261.63, 329.63, 440];
        const stepPhase = t % arpStep;
        const pianoEnv = Math.exp(-stepPhase * 2.5);
        const pianoTone = (
          Math.sin(2 * Math.PI * arpFreqs[arpIdx] * t) +
          0.3 * Math.sin(2 * Math.PI * arpFreqs[arpIdx] * 2 * t)
        ) * pianoEnv * 0.35;

        // Warm cello bass
        const cello = Math.sin(2 * Math.PI * 110 * t) * 0.25;

        left = pianoTone + cello;
        right = pianoTone * 0.9 + cello;
        break;
      }

      case "tech-cyber-alert": {
        // Fast digital sequence
        const step = 0.125;
        const stepIdx = Math.floor(t / step) % 8;
        const freqs = [440, 554, 659, 880, 784, 659, 554, 440];
        const phase = t % step;
        const env = Math.exp(-phase * 15);
        const beep = Math.sin(2 * Math.PI * freqs[stepIdx] * t) * env * 0.3;

        // Sub cyber drone
        const cyberDrone = Math.sin(2 * Math.PI * 70 * t) * 0.25;

        left = beep + cyberDrone;
        right = beep * 0.85 + cyberDrone;
        break;
      }

      default:
        left = 0;
        right = 0;
    }

    // Soft limiter to prevent clipping
    const clamp = (v: number) => Math.max(-0.95, Math.min(0.95, v));
    const sampleL = Math.floor(clamp(left) * 32767);
    const sampleR = Math.floor(clamp(right) * 32767);

    const offset = i * 4;
    buffer.writeInt16LE(sampleL, offset);
    buffer.writeInt16LE(sampleR, offset + 2);
  }

  const header = createWavHeader(buffer.length, sampleRate, numChannels, 16);
  return Buffer.concat([header, buffer]);
}

/** Đảm bảo các file nhạc mặc định được tạo sẵn trên ổ đĩa */
export function ztteam_ensurePresetMusicFiles(): void {
  const musicDir = path.join(process.cwd(), "public", "music");
  fs.mkdirSync(musicDir, { recursive: true });

  for (const track of ZTTEAM_PRESET_MUSIC) {
    if (!track.url || track.id === "none") continue;
    const filename = path.basename(track.url);
    const filepath = path.join(musicDir, filename);

    if (!fs.existsSync(filepath) || fs.statSync(filepath).size < 1000) {
      try {
        const wavBuffer = generateTrackPcm(track.id, 12);
        fs.writeFileSync(filepath, wavBuffer);
      } catch (err) {
        console.warn(`Could not generate music file for ${track.id}:`, err);
      }
    }
  }
}
