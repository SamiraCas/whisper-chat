import React from 'react';
import { Mic, Square, RefreshCw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAudioRecorder } from '@/hooks/useAudioRecorder';

interface AudioRecorderProps {
  onRecordingComplete: (audioBlob: Blob) => void;
  isProcessing?: boolean;
  maxDuration?: number;
}

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs
    .toString()
    .padStart(2, '0')}`;
};

export const AudioRecorder: React.FC<AudioRecorderProps> = ({
  onRecordingComplete,
  isProcessing = false,
  maxDuration = 60,
}) => {
  const {
    state,
    error,
    audioBlob,
    duration,
    startRecording,
    stopRecording,
    reset,
    volumeLevel,
  } = useAudioRecorder(maxDuration);

  /**
   * 🔒 garante envio único
   */
  const hasSentRef = React.useRef(false);

  /**
   * ✅ DISPARO CORRETO
   * Quando o blob aparecer, acabou.
   */
  React.useEffect(() => {
    if (
      audioBlob &&
      audioBlob.size > 0 &&
      !hasSentRef.current
    ) {
      hasSentRef.current = true;

      console.log('[AudioRecorder] Blob pronto', {
        size: audioBlob.size,
        type: audioBlob.type,
      });

      onRecordingComplete(audioBlob);
    }
  }, [audioBlob, onRecordingComplete]);

  /**
   * Reset da flag ao reiniciar
   */
  React.useEffect(() => {
    if (state === 'idle') {
      hasSentRef.current = false;
    }
  }, [state]);

  const handleMainAction = () => {
    if (state === 'idle' || state === 'error') {
      startRecording();
    } else if (state === 'recording') {
      stopRecording();
    }
  };

  return (
    <div className="flex flex-col items-center gap-6">
      {/* ondas */}
      <div className="relative flex items-center justify-center gap-1 h-16">
        {state === 'recording'
          ? Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 rounded-full bg-recording transition-all"
                style={{ height: 20 + volumeLevel * 44 }}
              />
            ))
          : Array.from({ length: 9 }).map((_, i) => (
              <div
                key={i}
                className="w-1.5 h-4 rounded-full bg-muted opacity-40"
              />
            ))}

        {(state === 'processing' || isProcessing) && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        )}
      </div>

      {/* tempo */}
      <div className="font-mono text-2xl">
        <span
          className={
            state === 'recording'
              ? 'text-recording'
              : 'text-muted-foreground'
          }
        >
          {formatDuration(duration)}
        </span>
        <span className="ml-2 opacity-50">
          / {formatDuration(maxDuration)}
        </span>
      </div>

      {/* botão */}
      <Button
        size="xl"
        onClick={handleMainAction}
        disabled={isProcessing || state === 'processing'}
        className="min-w-[200px]"
      >
        {state === 'recording' ? (
          <Square className="w-5 h-5" />
        ) : isProcessing ? (
          <Loader2 className="w-5 h-5 animate-spin" />
        ) : (
          <Mic className="w-5 h-5" />
        )}
        {state === 'recording' ? 'Parar' : 'Gravar'}
      </Button>

      {error && (
        <div className="text-sm text-destructive text-center">
          {error}
        </div>
      )}
    </div>
  );
};
