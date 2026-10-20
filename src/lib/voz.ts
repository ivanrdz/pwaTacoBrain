// Voz: escuchar preguntas (reconocimiento) y responder hablando (síntesis).
// Se usa solo en reportes; la operación diaria es con botones por el ruido de la taquería.

interface ResultadoReconocimiento {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
}

interface Reconocedor {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: ResultadoReconocimiento) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  abort(): void;
}

type ConstructorReconocedor = new () => Reconocedor;

function constructorReconocedor(): ConstructorReconocedor | null {
  const w = window as unknown as { SpeechRecognition?: ConstructorReconocedor; webkitSpeechRecognition?: ConstructorReconocedor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function puedeEscuchar(): boolean {
  return typeof window !== 'undefined' && constructorReconocedor() !== null;
}

export interface Escucha {
  resultado: Promise<string>;
  cancelar(): void;
}

export function escuchar(): Escucha {
  const C = constructorReconocedor();
  if (!C) return { resultado: Promise.reject(new Error('sin-voz')), cancelar() {} };
  const rec = new C();
  rec.lang = 'es-MX';
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  let texto = '';
  const resultado = new Promise<string>((resolve, reject) => {
    rec.onresult = (e) => {
      texto = e.results[0]?.[0]?.transcript ?? '';
    };
    rec.onerror = (e) => reject(new Error(e.error));
    rec.onend = () => (texto ? resolve(texto) : reject(new Error('no-speech')));
  });
  rec.start();
  return { resultado, cancelar: () => rec.abort() };
}

function vozEspanol(): SpeechSynthesisVoice | undefined {
  const voces = window.speechSynthesis.getVoices();
  return voces.find((v) => v.lang === 'es-MX') ?? voces.find((v) => v.lang.startsWith('es-US')) ?? voces.find((v) => v.lang.startsWith('es'));
}

export function hablar(texto: string): void {
  if (!('speechSynthesis' in window)) return;
  const u = new SpeechSynthesisUtterance(texto);
  u.lang = 'es-MX';
  u.rate = 0.95;
  const voz = vozEspanol();
  if (voz) u.voice = voz;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export function callar(): void {
  if ('speechSynthesis' in window) window.speechSynthesis.cancel();
}

// Algunas plataformas cargan las voces después; pedirlas temprano ayuda.
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.getVoices();
}
