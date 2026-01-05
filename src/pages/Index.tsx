import React from 'react';
import { Mic, Database, Sparkles, Code2, Zap, Brain, ChevronDown } from 'lucide-react';
import { AudioRecorder } from '@/components/AudioRecorder';
import { TranscriptViewer } from '@/components/TranscriptViewer';
import { ChatResponse } from '@/components/ChatResponse';
import { PessoaManager } from '@/components/PessoaManager';
import { processVoiceChat } from '@/services/openai';
import { toast } from 'sonner';

/**
 * PÁGINA PRINCIPAL - DATACRAZY CHALLENGE
 * 
 * ============================================
 * ARQUITETURA DA APLICAÇÃO
 * ============================================
 * 
 * Esta página integra os dois desafios:
 * 
 * 1. FRONT-END MENSAGERIA:
 *    - Gravação de áudio com MediaRecorder
 *    - Transcrição via OpenAI Whisper
 *    - Resposta via Lovable AI (Gemini)
 *    - Estados bem definidos e UX clara
 * 
 * 2. BACKEND DAO + CACHE:
 *    - CRUD de Pessoa via Edge Function
 *    - Cache com SHA256 e TTL
 *    - SQL nativo para findByEmail/findByTelefone
 *    - Estratégia de invalidação
 * 
 * FLUXO DE DADOS:
 * ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
 * │  Microfone  │ ──▶ │   Base64    │ ──▶ │Edge Function│
 * └─────────────┘     └─────────────┘     └──────┬──────┘
 *                                                │
 *                     ┌─────────────┐            │
 *                     │   Whisper   │ ◀──────────┤
 *                     └──────┬──────┘            │
 *                            │                   │
 *                     ┌──────▼──────┐            │
 *                     │ Lovable AI  │ ◀──────────┘
 *                     └──────┬──────┘
 *                            │
 *                     ┌──────▼──────┐
 *                     │   Response  │
 *                     └─────────────┘
 */

type ActiveTab = 'voice' | 'dao';

const Index: React.FC = () => {
  const [activeTab, setActiveTab] = React.useState<ActiveTab>('voice');
  const [isProcessing, setIsProcessing] = React.useState(false);
  const [transcript, setTranscript] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = React.useState(false);
  const [isGenerating, setIsGenerating] = React.useState(false);

  /**
   * Processa gravação de áudio
   * 
   * FLUXO:
   * 1. Recebe Blob de áudio do AudioRecorder
   * 2. Envia para edge function via serviço
   * 3. Atualiza estados com transcrição e resposta
   */
  const handleRecordingComplete = async (audioBlob: Blob) => {
    console.log('[Index] Recording complete, processing...', audioBlob.size);
    
    setIsProcessing(true);
    setIsTranscribing(true);
    setTranscript(null);
    setResponse(null);

    try {
      const result = await processVoiceChat(audioBlob);
      
      setTranscript(result.transcript);
      setIsTranscribing(false);
      setIsGenerating(true);
      
      // Pequeno delay para mostrar a transcrição antes da resposta
      await new Promise(resolve => setTimeout(resolve, 500));
      
      setResponse(result.response);
      setIsGenerating(false);
      
      toast.success('Áudio processado com sucesso!');
    } catch (err) {
      console.error('[Index] Error processing audio:', err);
      toast.error(err instanceof Error ? err.message : 'Erro ao processar áudio');
      setIsTranscribing(false);
      setIsGenerating(false);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30 backdrop-blur-xl sticky top-0 z-50">
        <div className="container max-w-5xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                  <Zap className="w-5 h-5 text-primary-foreground" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-br from-primary to-accent rounded-xl blur-md opacity-30" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gradient">DataCrazy Challenge</h1>
                <p className="text-xs text-muted-foreground">Front-end + Backend Demo</p>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="flex gap-1 p-1 rounded-xl bg-card/80 border border-border/50">
              <button
                onClick={() => setActiveTab('voice')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'voice'
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Mic className="w-4 h-4" />
                Voice Chat
              </button>
              <button
                onClick={() => setActiveTab('dao')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  activeTab === 'dao'
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary'
                }`}
              >
                <Database className="w-4 h-4" />
                DAO + Cache
              </button>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container max-w-5xl mx-auto px-4 py-8">
        {activeTab === 'voice' ? (
          <div className="space-y-8">
            {/* Hero Section */}
            <section className="text-center space-y-4 py-8">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/30 text-sm">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-primary">Powered by Lovable AI</span>
              </div>
              
              <h2 className="text-4xl font-bold">
                <span className="text-gradient">Voice to AI Chat</span>
              </h2>
              
              <p className="text-muted-foreground max-w-lg mx-auto">
                Grave sua voz, receba a transcrição e uma resposta inteligente da IA.
                Demonstração completa do desafio de front-end.
              </p>
            </section>

            {/* Audio Recorder */}
            <section className="py-8">
              <AudioRecorder
                onRecordingComplete={handleRecordingComplete}
                isProcessing={isProcessing}
                maxDuration={60}
              />
            </section>

            {/* Results */}
            <section className="grid gap-6">
              <TranscriptViewer
                transcript={transcript}
                isLoading={isTranscribing}
                title="Sua Transcrição"
              />

              <ChatResponse
                response={response}
                isLoading={isGenerating}
                streaming={true}
              />
            </section>

            {/* Technical Info */}
            <section className="mt-12 p-6 rounded-xl bg-card/50 border border-border/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-primary" />
                Detalhes Técnicos
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Tecnologias Utilizadas</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• React + TypeScript + Vite</li>
                    <li>• MediaRecorder API para captura</li>
                    <li>• Web Audio API para visualização</li>
                    <li>• Edge Functions (Deno)</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Fluxo de Processamento</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>1. Captura via getUserMedia()</li>
                    <li>2. Conversão para Blob/Base64</li>
                    <li>3. Transcrição via Whisper</li>
                    <li>4. Resposta via Gemini 2.5 Flash</li>
                  </ul>
                </div>
              </div>
            </section>
          </div>
        ) : (
          <div className="space-y-8">
            {/* DAO Section Header */}
            <section className="text-center space-y-4 py-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/30 text-sm">
                <Brain className="w-4 h-4 text-accent" />
                <span className="text-accent">Prisma + Cache SHA256</span>
              </div>
              
              <h2 className="text-3xl font-bold">
                <span className="text-gradient">Backend DAO + Cache</span>
              </h2>
              
              <p className="text-muted-foreground max-w-lg mx-auto">
                Demonstração da camada DAO com cache em memória, TTL e invalidação.
                Buscas por email/telefone usam SQL nativo.
              </p>
            </section>

            {/* Pessoa Manager */}
            <PessoaManager />

            {/* Technical Info */}
            <section className="mt-8 p-6 rounded-xl bg-card/50 border border-border/50">
              <h3 className="font-semibold mb-4 flex items-center gap-2">
                <Code2 className="w-5 h-5 text-accent" />
                Arquitetura do Cache
              </h3>
              
              <div className="grid md:grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Estratégia de Cache</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Map em memória (O(1))</li>
                    <li>• Chave: SHA256 da query SQL</li>
                    <li>• TTL: 60 segundos</li>
                    <li>• Eviction manual disponível</li>
                  </ul>
                </div>
                
                <div className="space-y-2">
                  <h4 className="font-medium text-foreground">Invalidação</h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• CREATE: invalida todo cache</li>
                    <li>• UPDATE: invalida todo cache</li>
                    <li>• DELETE: invalida todo cache</li>
                    <li>• TTL expirado: remoção automática</li>
                  </ul>
                </div>
              </div>
              
              <div className="mt-4 p-4 rounded-lg bg-background/50 font-mono text-xs text-muted-foreground">
                <p className="mb-2">// Exemplo de uso do cache:</p>
                <p>const cacheKey = await cache.generateKey(sql);</p>
                <p>const cached = cache.get(cacheKey);</p>
                <p>if (!cached) {"{"} cache.set(cacheKey, result); {"}"}</p>
              </div>
            </section>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border/50 bg-card/30 backdrop-blur py-6">
        <div className="container max-w-5xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>DataCrazy Technical Challenge • React + TypeScript + Lovable Cloud</p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
