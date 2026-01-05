import { useState, useRef, useCallback } from 'react';

/**
 * HOOK: useAudioRecorder
 * 
 * ============================================
 * DECISÕES ARQUITETURAIS
 * ============================================
 * 
 * 1. POR QUE USAR MediaRecorder API?
 *    - API nativa do navegador, sem dependências externas
 *    - Suporta múltiplos formatos (webm, ogg, mp4)
 *    - Permite gravação em chunks para streaming
 *    - Melhor performance que soluções baseadas em Web Audio API
 * 
 * 2. ESTADOS DEFINIDOS:
 *    - idle: Aguardando interação do usuário
 *    - requesting: Solicitando permissão do microfone
 *    - recording: Gravando áudio ativamente
 *    - processing: Processando áudio após gravação
 *    - error: Erro ocorreu (permissão negada, etc)
 * 
 * 3. FORMATO DE SAÍDA:
 *    - Preferência por audio/webm (melhor suporte)
 *    - Fallback para audio/ogg e audio/mp4
 *    - Exportamos como Blob para envio via FormData
 * 
 * 4. TRATAMENTO DE ERROS:
 *    - Permissão negada pelo usuário
 *    - Microfone não disponível
 *    - Erros durante gravação
 *    - Timeout de gravação
 * 
 * COMO FUNCIONA O MEDIARECORDER:
 * 1. getUserMedia() solicita acesso ao microfone
 * 2. MediaRecorder captura o stream de áudio
 * 3. ondataavailable é chamado com chunks de áudio
 * 4. onstop combina chunks em um único Blob
 */

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'processing' | 'error';

export interface AudioRecorderResult {
  /** Estado atual da gravação */
  state: RecordingState;
  
  /** Mensagem de erro, se houver */
  error: string | null;
  
  /** Blob de áudio gravado */
  audioBlob: Blob | null;
  
  /** URL do áudio para preview */
  audioUrl: string | null;
  
  /** Duração da gravação em segundos */
  duration: number;
  
  /** Inicia a gravação */
  startRecording: () => Promise<void>;
  
  /** Para a gravação */
  stopRecording: () => void;
  
  /** Reseta o estado */
  reset: () => void;
  
  /** Nível de volume atual (0-1) para visualização */
  volumeLevel: number;
}

export const useAudioRecorder = (maxDuration = 60): AudioRecorderResult => {
  // Estados principais
  const [state, setState] = useState<RecordingState>('idle');
  const [error, setError] = useState<string | null>(null);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [volumeLevel, setVolumeLevel] = useState(0);

  // Refs para objetos que precisam persistir
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  /**
   * Detecta o melhor formato de áudio suportado pelo navegador
   * 
   * JUSTIFICATIVA:
   * - audio/webm é preferido (Chrome, Firefox, Edge)
   * - audio/ogg como fallback (Firefox)
   * - audio/mp4 para Safari
   */
  const getMimeType = useCallback((): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ];
    
    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        console.log(`[AudioRecorder] Using MIME type: ${type}`);
        return type;
      }
    }
    
    console.warn('[AudioRecorder] No preferred MIME type supported, using default');
    return 'audio/webm';
  }, []);

  /**
   * Configura o analisador de áudio para visualização de volume
   */
  const setupAnalyser = useCallback((stream: MediaStream) => {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    // Função para atualizar nível de volume
    const updateVolume = () => {
      if (!analyserRef.current) return;
      
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);
      
      // Calcula média do volume
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      setVolumeLevel(average / 255); // Normaliza para 0-1
      
      animationFrameRef.current = requestAnimationFrame(updateVolume);
    };
    
    updateVolume();
  }, []);

  /**
   * Inicia a gravação de áudio
   * 
   * FLUXO:
   * 1. Solicita permissão do microfone via getUserMedia
   * 2. Cria MediaRecorder com o stream obtido
   * 3. Configura handlers para dados e erros
   * 4. Inicia gravação
   */
  const startRecording = useCallback(async () => {
    try {
      setState('requesting');
      setError(null);
      chunksRef.current = [];

      console.log('[AudioRecorder] Requesting microphone access...');

      // Solicita acesso ao microfone
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,    // Remove eco
          noiseSuppression: true,    // Remove ruído de fundo
          autoGainControl: true,     // Ajusta volume automaticamente
          sampleRate: 44100,         // Taxa de amostragem padrão
        },
      });

      console.log('[AudioRecorder] Microphone access granted');
      streamRef.current = stream;

      // Configura analisador para visualização
      setupAnalyser(stream);

      // Cria o MediaRecorder
      const mimeType = getMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      /**
       * Handler para chunks de áudio
       * 
       * POR QUE CHUNKS?
       * O MediaRecorder divide o áudio em pedaços (chunks) para:
       * - Evitar consumo excessivo de memória
       * - Permitir streaming em tempo real (se necessário)
       * - Garantir que dados não sejam perdidos em erros
       */
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          console.log(`[AudioRecorder] Chunk received: ${event.data.size} bytes`);
        }
      };

      /**
       * Handler para fim da gravação
       * 
       * Combina todos os chunks em um único Blob
       * e cria URL para preview
       */
      mediaRecorder.onstop = () => {
        console.log('[AudioRecorder] Recording stopped, processing...');
        
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        
        setAudioBlob(blob);
        setAudioUrl(url);
        setState('processing');
        
        console.log(`[AudioRecorder] Audio blob created: ${blob.size} bytes`);
      };

      /**
       * Handler de erro durante gravação
       */
      mediaRecorder.onerror = (event) => {
        console.error('[AudioRecorder] Recording error:', event);
        setError('Erro durante a gravação de áudio');
        setState('error');
      };

      // Inicia gravação
      mediaRecorder.start(1000); // Chunk a cada 1 segundo
      setState('recording');
      startTimeRef.current = Date.now();

      // Atualiza duração a cada segundo
      durationIntervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setDuration(elapsed);

        // Auto-stop se exceder duração máxima
        if (elapsed >= maxDuration) {
          console.log('[AudioRecorder] Max duration reached, stopping...');
          stopRecording();
        }
      }, 1000);

    } catch (err) {
      console.error('[AudioRecorder] Error starting recording:', err);
      
      // Tratamento específico de erros
      if (err instanceof DOMException) {
        switch (err.name) {
          case 'NotAllowedError':
            setError('Permissão de microfone negada. Por favor, permita o acesso ao microfone.');
            break;
          case 'NotFoundError':
            setError('Nenhum microfone encontrado. Conecte um microfone e tente novamente.');
            break;
          case 'NotReadableError':
            setError('Microfone está em uso por outro aplicativo.');
            break;
          default:
            setError(`Erro ao acessar microfone: ${err.message}`);
        }
      } else {
        setError('Erro desconhecido ao iniciar gravação');
      }
      
      setState('error');
    }
  }, [getMimeType, maxDuration, setupAnalyser]);

  /**
   * Para a gravação
   * 
   * - Para o MediaRecorder
   * - Libera o stream do microfone
   * - Limpa intervalos e animações
   */
  const stopRecording = useCallback(() => {
    console.log('[AudioRecorder] Stopping recording...');

    // Para o MediaRecorder
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }

    // Para todas as tracks do stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
        console.log(`[AudioRecorder] Track stopped: ${track.kind}`);
      });
      streamRef.current = null;
    }

    // Limpa intervalos
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }

    // Limpa animação de volume
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    setVolumeLevel(0);
  }, []);

  /**
   * Reseta todo o estado
   */
  const reset = useCallback(() => {
    stopRecording();
    
    // Revoga URL anterior para liberar memória
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
    startRecording,
    stopRecording,
    reset,
    volumeLevel,
  };
};
