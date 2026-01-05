# 🎙️ Whisper Chat — DataCrazy Front-End de Mensageria

Este repositório contém a **solução do Desafio n.º 1 – Front-end de Mensageria** do DataCrazy Challenge.

O objetivo é construir uma **aplicação web que transforma voz em texto e envia para uma IA gerar respostas inteligentes**, utilizando:

- OpenAI Whisper para **transcrição de áudio**
- OpenAI Chat para **respostas de texto**
- Supabase Edge Function como backend intermediário
- React + Vite no front-end

---

## 📋 Overview

🧠 **Funcionalidades principais**
- Gravação de áudio via navegador
- Visualização de nível de volume
- Envio de áudio para transcrição Whisper
- Geração de resposta inteligente
- Exibição de transcrição e resposta em UI amigável

📍 **Requisitos**
- Node.js
- NPM / Yarn
- Docker (para desenvolvimento local com Supabase)
- Conta Supabase (para deploy)
- Chave OpenAI válida

---

## 🚀 Tecnologias Utilizadas

| Camada | Tecnologia |
|--------|-----------|
| Front-end | React + TypeScript + Vite |
| UI | Tailwind CSS + UI Components |
| Backend | Supabase Edge Function (Deno) |
| Transcrição | OpenAI Whisper (`whisper-1`) |
| Conversa IA | OpenAI Chat Completions |
| Rede / HTTP | Fetch / FormData |

---

## 🔧 Instalação e Setup

### 1️⃣ Clone o repositório

```bash
git clone https://github.com/davibaldin/desafio-datacrazy
cd desafio-datacrazy
