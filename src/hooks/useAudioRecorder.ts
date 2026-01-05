import { useState, useRef, useCallback } from 'react';

export type RecordingState =
  | 'idle'
  | 'requesting'
  | 'recording'
  | 'stopping'
  | 'ready'
  | 'processing'
  | 'error';

export interface AudioRecorderResult {
  state: RecordingState;
  error: string | null;
  audioBlob: Blob | null;
  audioUrl: string | null;
  duration: number;
  volumeLevel: number;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  reset: () => void;
}

export const useAudioRecorder = (maxDuration = 60): AudioRecorderResult => {
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<number | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const getMimeType = useCallback((): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return 'audio/webm';
  }, []);

  const setupAnalyser = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();

    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const updateVolume = () => {
      if (!analyserRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      const avg = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setVolumeLevel(avg / 255);

      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };

    updateVolume();
  }, []);

  const startRecording = useCallback(async () => {
    try {
      setState('requesting');
      setError(null);
      setAudioBlob(null);
      setAudioUrl(null);
      chunksRef.current = [];

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      setupAnalyser(stream);

      const mimeType = getMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });

        if (blob.size === 0) {
          setError('Áudio vazio. Tente novamente.');
          setState('error');
          return;
        }

        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setState('ready'); // 🔥 ESTADO CLARO: PODE ENVIAR
      };

      recorder.start();
      startTimeRef.current = Date.now();
      setState('recording');

      durationIntervalRef.current = window.setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        if (elapsed >= maxDuration) {
          stopRecording();
        }
      }, 1000);
    } catch (err) {
      setError('Erro ao acessar o microfone');
      setState('error');
    }
  }, [getMimeType, maxDuration, setupAnalyser]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      setState('stopping');
      mediaRecorderRef.current.stop();
    }

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setVolumeLevel(0);
  }, []);

  const reset = useCallback(() => {
    stopRecording();

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
    }

    setState('idle');
    setError(null);
    setAudioBlob(null);
    setAudioUrl(null);
    setDuration(0);
    setVolumeLevel(0);
    chunksRef.current = [];
  }, [audioUrl, stopRecording]);

  return {
    state,
    error,
    audioBlob,
    audioUrl,
    duration,
    volumeLevel,
    startRecording,
    stopRecording,
    reset,
  };
};
