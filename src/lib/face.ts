// Reconnaissance faciale dans le navigateur (@vladmandic/face-api).
// Le navigateur ne fait que calculer la signature du visage (128 nombres) ; la
// comparaison avec les employés enregistrés se fait sur le serveur.
// La bibliothèque (~1,3 Mo, TensorFlow.js inclus) n'est chargée qu'à l'ouverture de la
// caméra, pas au chargement de l'application.
type FaceApi = typeof import('@vladmandic/face-api');
let faceapi: FaceApi;

// Modèles copiés dans public/models/face (servis par l'application, pas de CDN).
const MODELS_URL = `${import.meta.env.BASE_URL}models/face`;
let modelsLoading: Promise<void> | null = null;

export const loadFaceModels = () => {
  if (!modelsLoading) {
    modelsLoading = (async () => {
      faceapi = await import('@vladmandic/face-api');
      // Moteur de calcul : carte graphique (webgl) si possible, sinon processeur.
      const tf = faceapi.tf as any;
      try { await tf.setBackend('webgl'); } catch { await tf.setBackend('cpu'); }
      await tf.ready();
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODELS_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODELS_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODELS_URL),
      ]);
    })().catch((err) => { modelsLoading = null; throw err; });
  }
  return modelsLoading;
};

export interface FaceBox { x: number; y: number; width: number; height: number; }
export interface DetectedFace { descriptor: number[]; eyeRatio: number; yaw: number; width: number; score: number; box: FaceBox; }

type Point = { x: number; y: number };
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
// Ouverture de l'œil (Eye Aspect Ratio) : chute nettement quand l'œil se ferme.
const eyeAspectRatio = (eye: Point[]) => (dist(eye[1], eye[5]) + dist(eye[2], eye[4])) / (2 * dist(eye[0], eye[3]));

export interface TrackedFace { eyeRatio: number; yaw: number; width: number; cx: number; cy: number; score: number; }
const center = (points: Point[]) => ({ x: points.reduce((s, p) => s + p.x, 0) / points.length, y: points.reduce((s, p) => s + p.y, 0) / points.length });

// Détection rapide sans signature (3 à 4 fois plus rapide) : sert à suivre le geste
// de vérification. yaw = décalage du bout du nez par rapport au milieu des yeux,
// rapporté à l'écart entre les yeux : ~0 de face, nettement ± quand la tête tourne.
// Sur une photo qu'on incline, tout se comprime ensemble et yaw reste proche de 0.
export const trackFaces = async (video: HTMLVideoElement): Promise<TrackedFace[]> => {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const results = await faceapi.detectAllFaces(video, options).withFaceLandmarks();
  return results.map((r) => {
    const leftEye = r.landmarks.getLeftEye(); const rightEye = r.landmarks.getRightEye();
    const l = center(leftEye); const rc = center(rightEye);
    const noseTip = r.landmarks.getNose()[3]; // point 30 du modèle 68 points
    const box = r.detection.box;
    return {
      eyeRatio: (eyeAspectRatio(leftEye) + eyeAspectRatio(rightEye)) / 2,
      yaw: (noseTip.x - (l.x + rc.x) / 2) / (dist(l, rc) || 1),
      width: box.width, cx: box.x + box.width / 2, cy: box.y + box.height / 2, score: r.detection.score,
    };
  });
};

// Tous les visages visibles sur l'image (la borne refuse s'il y en a plusieurs).
// À appeler après loadFaceModels().
export const detectFaces = async (video: HTMLVideoElement): Promise<DetectedFace[]> => {
  const options = new faceapi.TinyFaceDetectorOptions({ inputSize: 320, scoreThreshold: 0.5 });
  const results = await faceapi.detectAllFaces(video, options).withFaceLandmarks().withFaceDescriptors();
  return results.map((r) => {
    const l = center(r.landmarks.getLeftEye()); const rc = center(r.landmarks.getRightEye());
    const { x, y, width, height } = r.detection.box;
    return {
      descriptor: Array.from(r.descriptor),
      eyeRatio: (eyeAspectRatio(r.landmarks.getLeftEye()) + eyeAspectRatio(r.landmarks.getRightEye())) / 2,
      yaw: (r.landmarks.getNose()[3].x - (l.x + rc.x) / 2) / (dist(l, rc) || 1),
      width, score: r.detection.score, box: { x, y, width, height },
    };
  });
};

// --- Qualité de l'image : messages clairs plutôt qu'un échec silencieux ------------

export type FaceIssue = 'NO_FACE' | 'MULTIPLE' | 'TOO_FAR' | 'TOO_CLOSE' | 'NOT_FRONTAL' | 'LOW_CONFIDENCE' | 'TOO_DARK' | 'BACKLIT' | 'TOO_BRIGHT' | 'BLURRY';

export const FACE_ISSUE_MESSAGES: Record<FaceIssue, string> = {
  NO_FACE: 'Aucun visage détecté : placez-vous face à la caméra.',
  MULTIPLE: 'Plusieurs visages détectés : une seule personne devant la caméra.',
  TOO_FAR: 'Visage trop loin : approchez-vous de la caméra.',
  TOO_CLOSE: 'Visage trop près : reculez un peu.',
  NOT_FRONTAL: 'Visage de profil : regardez la caméra bien de face.',
  LOW_CONFIDENCE: 'Visage mal visible : retirez lunettes de soleil, casquette ou masque.',
  TOO_DARK: 'Image trop sombre : allumez la lumière ou éclairez le visage.',
  BACKLIT: 'Contre-jour : évitez une fenêtre ou une lampe derrière la personne.',
  TOO_BRIGHT: 'Image trop claire : lumière trop forte sur le visage.',
  BLURRY: 'Image floue : restez immobile et vérifiez que l’objectif de la caméra est propre.',
};

// Seuils (luminosité sur 0-255, netteté = variance du laplacien sur le visage en 96×96).
// À ajuster si la caméra ou l'éclairage de l'entrée donnent trop de refus.
const QUALITY = { minBrightness: 55, maxBrightness: 205, backlightGap: 50, minSharpness: 30, minScore: 0.7 };

let statsCanvas: HTMLCanvasElement | null = null;
const grayPixels = (video: HTMLVideoElement, sx: number, sy: number, sw: number, sh: number, w: number, h: number) => {
  statsCanvas ??= document.createElement('canvas');
  statsCanvas.width = w; statsCanvas.height = h;
  const ctx = statsCanvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(video, sx, sy, sw, sh, 0, 0, w, h);
  const { data } = ctx.getImageData(0, 0, w, h);
  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i += 1) gray[i] = 0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
  return gray;
};
const mean = (values: Float32Array) => values.reduce((s, v) => s + v, 0) / (values.length || 1);

// Luminosité du visage, de toute l'image, et netteté du visage.
const imageStats = (video: HTMLVideoElement, box: FaceBox) => {
  const x = Math.max(0, box.x); const y = Math.max(0, box.y);
  const w = Math.min(video.videoWidth - x, box.width); const h = Math.min(video.videoHeight - y, box.height);
  const S = 96;
  const face = grayPixels(video, x, y, w, h, S, S);
  let sum = 0; let sumSq = 0; let n = 0;
  for (let row = 1; row < S - 1; row += 1) {
    for (let col = 1; col < S - 1; col += 1) {
      const i = row * S + col;
      const lap = face[i - 1] + face[i + 1] + face[i - S] + face[i + S] - 4 * face[i];
      sum += lap; sumSq += lap * lap; n += 1;
    }
  }
  const frame = grayPixels(video, 0, 0, video.videoWidth, video.videoHeight, 64, 48);
  return { faceBrightness: mean(face), frameBrightness: mean(frame), sharpness: sumSq / n - (sum / n) ** 2 };
};

// Premier problème bloquant de l'image, ou null si elle est exploitable.
export const checkFaceQuality = (video: HTMLVideoElement, faces: DetectedFace[], { minWidth = 140, maxYaw = 0.25 } = {}): FaceIssue | null => {
  if (!faces.length) return 'NO_FACE';
  if (faces.length > 1) return 'MULTIPLE';
  const [face] = faces;
  if (face.width < minWidth) return 'TOO_FAR';
  if (face.width > video.videoWidth * 0.8) return 'TOO_CLOSE';
  if (Math.abs(face.yaw) > maxYaw) return 'NOT_FRONTAL';
  const stats = imageStats(video, face.box);
  if (stats.faceBrightness < QUALITY.minBrightness) return stats.frameBrightness - stats.faceBrightness > QUALITY.backlightGap ? 'BACKLIT' : 'TOO_DARK';
  if (stats.faceBrightness > QUALITY.maxBrightness) return 'TOO_BRIGHT';
  if (stats.sharpness < QUALITY.minSharpness) return 'BLURRY';
  if (face.score < QUALITY.minScore) return 'LOW_CONFIDENCE';
  return null;
};

// Message lisible pour une erreur du serveur lors d'un enregistrement ou d'un pointage.
export const faceServerError = (err: any, fallback: string): { title: string; detail: string } => {
  const message = err?.response?.data?.error?.message || err?.response?.data?.message;
  if (!err?.response) return { title: 'Serveur injoignable', detail: 'Vérifiez que le serveur de l’application est démarré et la connexion réseau.' };
  switch (err.response.status) {
    case 409: return { title: message?.startsWith('Ce visage') ? 'Visage déjà enregistré' : 'Conflit', detail: message || fallback };
    case 403: return { title: 'Accès refusé', detail: message || 'Seul un administrateur peut gérer les présences.' };
    case 413: return { title: 'Image trop lourde', detail: 'La photo envoyée est trop volumineuse.' };
    case 400: return { title: 'Données refusées', detail: message || fallback };
    default: return { title: 'Erreur', detail: message || fallback };
  }
};

export const descriptorDistance = (a: number[], b: number[]) => Math.sqrt(a.reduce((sum, v, i) => sum + (v - b[i]) ** 2, 0));

// Photo JPEG du pointage (preuve consultable par l'admin).
export const snapshot = (video: HTMLVideoElement, width = 480) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = Math.round((video.videoHeight / video.videoWidth) * width) || Math.round(width * 0.75);
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.7);
};

// Caméra frontale. La caméra n'est autorisée par le navigateur qu'en HTTPS ou sur localhost.
export const startCamera = async (video: HTMLVideoElement) => {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw new Error('La caméra nécessite une connexion sécurisée (HTTPS) ou localhost.');
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
    video.srcObject = stream;
    await video.play();
    return () => stream.getTracks().forEach((track) => track.stop());
  } catch (err: any) {
    if (err?.name === 'NotAllowedError') throw new Error('Accès à la caméra refusé : autorisez la caméra pour ce site dans le navigateur.');
    if (err?.name === 'NotFoundError') throw new Error('Aucune caméra détectée sur cet appareil.');
    throw new Error('Impossible de démarrer la caméra.');
  }
};
