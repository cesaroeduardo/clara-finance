# Clara XTTS (clone de voz)

Sidecar local com **Coqui XTTS v2**. Clona a voz a partir de um WAV de referência e serve áudio para o modo voz do Clara.

## Áudio de referência

Fluxo usado no Clara:

1. Solte os originais em `docs/audio-refs/` (ex.: `.ogg` do WhatsApp)
2. Converta para mono 24 kHz WAV em `services/clara-xtts/voices/`:

```powershell
$src = "..\..\docs\audio-refs"
$dst = "voices"
$i = 1
Get-ChildItem $src -Include *.ogg,*.mp3,*.m4a,*.wav -File -Recurse | Sort-Object Name | ForEach-Object {
  ffmpeg -y -i $_.FullName -ac 1 -ar 24000 -sample_fmt s16 (Join-Path $dst ("clara-ref-{0:D2}.wav" -f $i))
  $i++
}
```

O sidecar escolhe **1–2 clips** (~6–14 s) e **cacheia** a voz na subida. Muitos WAVs longos deixam cada frase lenta no CPU.

Sugestões:

- Vários trechos de 6–20 s, fala limpa, uma pessoa
- Sem música / ruído de fundo
- Frases naturais em português

`docs/audio-refs/` e `voices/*.wav` ficam no `.gitignore`.

## Subir no Windows

```powershell
cd services/clara-xtts
.\start.ps1
```

Ou manualmente:

```powershell
cd services/clara-xtts
py -3.11 -m venv .venv
.\.venv\Scripts\Activate.ps1
$env:COQUI_TOS_AGREED = "1"
pip install torch --index-url https://download.pytorch.org/whl/cpu
# GPU NVIDIA (exemplo CUDA 12.4):
# pip install torch --index-url https://download.pytorch.org/whl/cu124
pip install -r requirements.txt
python server.py
```

Na primeira execução o modelo é baixado (~2 GB). GPU acelera bastante; CPU funciona, mas fica lento.

## Endpoints

- `GET http://127.0.0.1:8020/health`
- `POST http://127.0.0.1:8020/tts` — body `{ "text": "Oi, meu neto." }` → `audio/wav`

```powershell
curl -X POST http://127.0.0.1:8020/tts `
  -H "Content-Type: application/json" `
  -d "{\"text\":\"Oi, meu neto. Tá economizando?\"}" `
  --output clara-test.wav
```

## App Next.js

A voz sintética é **opt-in**. Por padrão (`NEXT_PUBLIC_CLARA_XTTS` ausente ou `false`) o modo voz só usa o TTS do navegador.

No `.env.local`:

```
NEXT_PUBLIC_CLARA_XTTS=true
CLARA_XTTS_URL=http://127.0.0.1:8020/tts
# true = npm run dev sobe Next + XTTS juntos
CLARA_XTTS_WITH_DEV=false
```

Com a flag ligada e o sidecar no ar:

```
npm run dev:voice
```

ou `CLARA_XTTS_WITH_DEV=true` + `npm run dev`.

O Next faz proxy em `/api/clara/tts` só quando a flag está `true`.

## Variáveis do sidecar

| Variável | Default | Descrição |
|----------|---------|-----------|
| `CLARA_VOICE_WAV` | `voices/clara-ref.wav` | Caminho do áudio de referência |
| `DEVICE` | auto (`cuda` / `cpu`) | Força device |
| `PORT` | `8020` | Porta HTTP |
| `CLARA_XTTS_SPEED` | `1.3` | Velocidade da fala (>1 = mais rápida) |
| `COQUI_TOS_AGREED` | `1` (no start) | Aceita termos CPML do XTTS |

## Licença

Pesos XTTS v2 usam **CPML** (restrições comerciais). Uso pessoal/demo local ok. Clone só com áudio que você tem direito de usar.
