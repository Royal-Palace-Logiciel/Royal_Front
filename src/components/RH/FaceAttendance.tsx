// Pointage par reconnaissance faciale (réservé à l'admin).
// - FaceKioskModal : borne de pointage plein écran (entrée puis sortie).
// - FaceEnrollModal : enregistrement du visage d'un employé, avec son accord.
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Camera, Check, Loader2, ScanFace, Trash2, X } from 'lucide-react';
import rhService, { RHEmployee, RHFacePunch } from '../../services/rh.service';
import { apiMessage } from '../../lib/api';
import { checkFaceQuality, descriptorDistance, detectFaces, FACE_ISSUE_MESSAGES, faceServerError, loadFaceModels, snapshot, startCamera, trackFaces } from '../../lib/face';

type Toast = (message: string, type: 'success' | 'error') => void;

// Visage trop petit = trop loin : signature peu fiable.
const MIN_FACE_WIDTH = 120;
// Au-delà de cette distance entre deux images, ce n'est plus la même personne devant la caméra.
const SAME_PERSON_DISTANCE = 0.45;
const CHALLENGE_TIMEOUT_MS = 10000;
// Geste de vérification (preuve qu'il ne s'agit pas d'une photo) : tête tournée puis de face,
// ou yeux fermés environ une seconde puis rouverts.
const YAW_TURNED = 0.2;
const YAW_FRONTAL = 0.1;
const EYES_CLOSED = 0.75; // en proportion de l'ouverture normale de l'œil
const EYES_OPEN = 0.9;
const RESULT_DISPLAY_MS = 3500;
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const LOADING_TIMEOUT_MS = 60000;

// Démarre la caméra et les modèles ; arrêt automatique à la fermeture de la fenêtre.
// status décrit l'étape en cours, pour que l'utilisateur sache ce qu'on attend.
const useCameraAndModels = (videoRef: React.RefObject<HTMLVideoElement>) => {
  const [cameraOn, setCameraOn] = useState(false);
  const [modelsOn, setModelsOn] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let stop: (() => void) | undefined; let cancelled = false; let cameraDone = false; let modelsDone = false;
    const timer = setTimeout(() => { if (!cancelled && !(cameraDone && modelsDone)) setError('Le chargement prend trop de temps : vérifiez la connexion, puis fermez et rouvrez cette fenêtre.'); }, LOADING_TIMEOUT_MS);
    startCamera(videoRef.current!)
      .then((stopCamera) => { cameraDone = true; if (cancelled) stopCamera(); else { stop = stopCamera; setCameraOn(true); } })
      .catch((err) => { if (!cancelled) setError(err?.message || 'Impossible de démarrer la caméra.'); });
    loadFaceModels()
      .then(() => { modelsDone = true; if (!cancelled) setModelsOn(true); })
      .catch(() => { if (!cancelled) setError('Chargement du module de reconnaissance impossible : vérifiez la connexion au serveur de l’application.'); });
    return () => { cancelled = true; clearTimeout(timer); stop?.(); };
  }, [videoRef]);
  const ready = cameraOn && modelsOn && !error;
  const status = error ? '' : !cameraOn ? 'Démarrage de la caméra… (autorisez la caméra si le navigateur le demande)' : !modelsOn ? 'Chargement du module de reconnaissance… (la première fois peut prendre une minute)' : '';
  return { ready, error, status };
};

const CameraFrame = ({ videoRef, tone, children }: { videoRef: React.RefObject<HTMLVideoElement>; tone: 'idle' | 'active' | 'success' | 'error'; children?: React.ReactNode }) => {
  const ring = { idle: 'ring-white/30', active: 'ring-amber-400', success: 'ring-emerald-400', error: 'ring-red-500' }[tone];
  return <div className={`relative mx-auto aspect-[4/3] w-full max-w-xl overflow-hidden rounded-2xl bg-black ring-4 ${ring} transition`}>
    {/* Miroir : plus naturel pour se placer face à la caméra. */}
    <video ref={videoRef} muted playsInline className="h-full w-full -scale-x-100 object-cover" />
    {children}
  </div>;
};

// ─────────────────────────────────────────────
// Borne de pointage
// ─────────────────────────────────────────────
type KioskResult = { tone: 'success' | 'error' | 'idle'; title: string; detail?: string };

const punchMessage = (r: RHFacePunch): KioskResult => {
  const name = r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : '';
  const a = r.attendance;
  switch (r.action) {
    case 'CHECK_IN': return { tone: 'success', title: `Bonjour ${name}`, detail: `Entrée enregistrée à ${a?.check_in?.slice(0, 5)}${a?.status === 'RETARD' ? ' · en retard' : ''}` };
    case 'CHECK_OUT': return { tone: 'success', title: `Au revoir ${name}`, detail: `Sortie enregistrée à ${a?.check_out?.slice(0, 5)}` };
    case 'TOO_SOON': return { tone: 'idle', title: name, detail: `Entrée déjà enregistrée à ${a?.check_in?.slice(0, 5)}. Repassez pour la sortie.` };
    case 'ALREADY_DONE': return { tone: 'idle', title: name, detail: `Journée déjà terminée (sortie à ${a?.check_out?.slice(0, 5)}).` };
    case 'AMBIGUOUS': return { tone: 'error', title: 'Reconnaissance incertaine', detail: 'Retirez lunettes ou casquette et recommencez, ou utilisez le pointage manuel.' };
    default: return { tone: 'error', title: 'Visage non reconnu', detail: 'Cet employé n’a pas de visage enregistré : utilisez le pointage manuel.' };
  }
};

export const FaceKioskModal = ({ close, onPunch }: { close: () => void; onPunch: () => void }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ready, error, status } = useCameraAndModels(videoRef);
  const [hint, setHint] = useState('');
  const [tone, setTone] = useState<'idle' | 'active' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<KioskResult | null>(null);
  const [history, setHistory] = useState<Array<{ key: number; time: string; text: string; ok: boolean }>>([]);

  useEffect(() => {
    if (!ready) return;
    let running = true;
    const video = videoRef.current!;
    // Boucle : attendre un visage → geste de vérification (tête tournée puis de face, ou
    // yeux fermés 1 s) → une seule signature, de face → envoi au serveur → résultat.
    (async () => {
      while (running) {
        setResult(null); setTone('idle');
        const faces = await trackFaces(video);
        if (!running) break;
        if (faces.length === 0) { setHint('Placez votre visage devant la caméra'); await wait(100); continue; }
        if (faces.length > 1) { setHint('Une seule personne à la fois'); await wait(300); continue; }
        if (faces[0].width < MIN_FACE_WIDTH) { setHint('Approchez-vous de la caméra'); await wait(100); continue; }

        let previous = faces[0]; let openRatio = faces[0].eyeRatio;
        let turned = false; let closedSeen = false; let live = false; let misses = 0;
        const deadline = Date.now() + CHALLENGE_TIMEOUT_MS;
        setTone('active'); setHint('Tournez la tête à gauche ou à droite, puis revenez de face');
        while (running && Date.now() < deadline) {
          const [face, ...others] = await trackFaces(video);
          // Yeux fermés ou tête très tournée : le détecteur peut rater quelques images.
          if (!face) { if (++misses > 25) break; continue; }
          misses = 0;
          // Une autre personne entre dans le champ : on recommence.
          if (others.length || Math.hypot(face.cx - previous.cx, face.cy - previous.cy) > face.width * 0.6) break;
          previous = face;
          if (!closedSeen) openRatio = Math.max(openRatio, face.eyeRatio);
          if (face.eyeRatio < openRatio * EYES_CLOSED) closedSeen = true;
          if (Math.abs(face.yaw) > YAW_TURNED && !turned) { turned = true; setHint('Revenez de face'); }
          if ((turned && Math.abs(face.yaw) < YAW_FRONTAL) || (closedSeen && face.eyeRatio > openRatio * EYES_OPEN)) { live = true; break; }
        }
        if (!running) break;
        if (!live) { setTone('error'); setHint('Mouvement non détecté : tournez nettement la tête d’un côté, puis revenez de face'); await wait(2500); continue; }

        // Signature calculée une seule fois, sur une image de face.
        setHint('Vérification…');
        let accepted: Awaited<ReturnType<typeof detectFaces>>[number] | null = null;
        let lastIssue: keyof typeof FACE_ISSUE_MESSAGES | null = null;
        for (let attempt = 0; attempt < 5 && running && !accepted; attempt += 1) {
          const found = await detectFaces(video);
          // Même contrôle qu'à l'enregistrement : une image floue ou sombre donne une
          // signature peu fiable, mieux vaut le dire que de risquer « non reconnu ».
          lastIssue = checkFaceQuality(video, found, { minWidth: MIN_FACE_WIDTH, maxYaw: 0.2 });
          if (!lastIssue) accepted = found[0];
        }
        if (!running) break;
        if (!accepted) { setTone('error'); setHint(lastIssue ? FACE_ISSUE_MESSAGES[lastIssue] : 'Visage perdu : restez face à la caméra et recommencez.'); await wait(2500); continue; }
        let shown: KioskResult;
        try {
          const response = await rhService.facePunch(accepted.descriptor, snapshot(video));
          shown = punchMessage(response);
          if (response.action === 'CHECK_IN' || response.action === 'CHECK_OUT') onPunch();
        } catch (err: any) {
          const problem = faceServerError(err, 'Pointage impossible.');
          shown = { tone: 'error', title: problem.title, detail: problem.detail };
        }
        if (!running) break;
        setResult(shown); setTone(shown.tone === 'idle' ? 'active' : shown.tone);
        setHistory((h) => [{ key: Date.now(), time: new Date().toTimeString().slice(0, 5), text: `${shown.title}${shown.detail ? ` — ${shown.detail}` : ''}`, ok: shown.tone === 'success' }, ...h].slice(0, 8));
        await wait(RESULT_DISPLAY_MS);
      }
    })().catch(() => { if (running) { setTone('error'); setHint('La reconnaissance s’est arrêtée : fermez et rouvrez la borne.'); } });
    return () => { running = false; };
  }, [ready]);

  return <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-slate-950 p-4 text-white">
    <div className="mx-auto flex max-w-5xl flex-col gap-4">
      <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-bold"><ScanFace /> Pointage par reconnaissance faciale</h2><button type="button" onClick={close} className="rounded-xl border border-white/30 px-3 py-2 text-sm"><X size={16} className="inline" /> Fermer</button></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div>
          <CameraFrame videoRef={videoRef} tone={tone}>
            {!ready && !error && <div className="absolute inset-0 flex items-center justify-center bg-black/60"><Loader2 className="animate-spin" size={36} /></div>}
            {result && <div className={`absolute inset-x-0 bottom-0 p-4 ${result.tone === 'success' ? 'bg-emerald-600/90' : result.tone === 'error' ? 'bg-red-600/90' : 'bg-slate-800/90'}`}><p className="text-2xl font-bold">{result.title}</p>{result.detail && <p className="mt-1">{result.detail}</p>}</div>}
          </CameraFrame>
          <p className={`mt-4 text-center text-2xl font-semibold ${error ? 'text-red-400' : ''}`}>{error || status || (result ? '' : hint)}</p>
          <ol className="mx-auto mt-4 grid max-w-xl gap-2 text-sm text-white/70 sm:grid-cols-3">
            <li className="rounded-xl bg-white/5 p-3"><strong className="block text-white">1. Face à la caméra</strong>À environ 50 cm, visage bien éclairé.</li>
            <li className="rounded-xl bg-white/5 p-3"><strong className="block text-white">2. Tournez la tête</strong>Nettement à gauche ou à droite…</li>
            <li className="rounded-xl bg-white/5 p-3"><strong className="block text-white">3. Revenez de face</strong>Le pointage s’enregistre.</li>
          </ol>
        </div>
        <aside className="rounded-2xl bg-white/5 p-4"><h3 className="text-sm font-semibold text-white/70">Derniers passages</h3><ul className="mt-3 space-y-2 text-sm">{history.map((h) => <li key={h.key} className={h.ok ? 'text-emerald-300' : 'text-white/70'}><span className="text-white/50">{h.time}</span> {h.text}</li>)}{!history.length && <li className="text-white/50">Aucun passage pour l’instant.</li>}</ul></aside>
      </div>
    </div>
  </div>;
};

// ─────────────────────────────────────────────
// Enregistrement du visage d'un employé
// ─────────────────────────────────────────────
const ENROLL_SAMPLES = 5;

// Deux modes :
// - employé existant (employee.id) : « Enregistrer » envoie directement au serveur ;
// - nouvel employé (onCaptured) : la fiche n'existe pas encore, les captures sont rendues
//   au formulaire, qui les enregistre juste après avoir créé l'employé.
type EnrollTarget = Pick<RHEmployee, 'first_name' | 'last_name'> & { id?: number; face_samples?: number };
export const FaceEnrollModal = ({ employee, close, saved, onCaptured, toast }: { employee: EnrollTarget; close: () => void; saved?: (faceSamples: number) => void; onCaptured?: (descriptors: number[][]) => void; toast: Toast }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const { ready, error, status } = useCameraAndModels(videoRef);
  const [consent, setConsent] = useState(false);
  const [consentMissing, setConsentMissing] = useState(false);
  const [samples, setSamples] = useState<number[][]>([]);
  const [capturing, setCapturing] = useState(false);
  const [hint, setHint] = useState('');
  // Problème de qualité en cours (encadré orange) et erreur du serveur (encadré rouge).
  const [issue, setIssue] = useState('');
  const [saveError, setSaveError] = useState<{ title: string; detail: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const enrolled = Number(employee.face_samples || 0) > 0;
  const stopRef = useRef(false);
  useEffect(() => () => { stopRef.current = true; }, []);

  // Capture plusieurs images espacées pour couvrir de légers changements d'angle.
  const capture = async () => {
    // Le bouton reste cliquable pour pouvoir expliquer ce qui manque.
    if (!consent) { setConsentMissing(true); setHint('Cochez d’abord la case d’accord de l’employé ci-dessous.'); return; }
    if (error) { setHint(error); return; }
    if (!ready) { setHint(status || 'Patientez, chargement en cours…'); return; }
    const video = videoRef.current!;
    const collected: number[][] = [];
    setSamples([]); setSaveError(null); setIssue(''); setCapturing(true); stopRef.current = false;
    const deadline = Date.now() + 45000;
    try {
      while (collected.length < ENROLL_SAMPLES && !stopRef.current) {
        if (Date.now() > deadline) { setHint('Capture interrompue : corrigez le problème indiqué puis cliquez sur « Recommencer ».'); break; }
        const faces = await detectFaces(video);
        // Chaque image est contrôlée : flou, éclairage, distance, angle, nombre de visages.
        const problem = checkFaceQuality(video, faces);
        if (problem) { setIssue(FACE_ISSUE_MESSAGES[problem]); await wait(250); continue; }
        const [face] = faces;
        if (collected.length && descriptorDistance(face.descriptor, collected[0]) > SAME_PERSON_DISTANCE) { setIssue('Personne différente détectée pendant la capture : la capture recommence.'); collected.length = 0; setSamples([]); await wait(1200); continue; }
        setIssue('');
        collected.push(face.descriptor); setSamples([...collected]);
        setHint(collected.length < ENROLL_SAMPLES ? 'Bien. Tournez très légèrement la tête…' : 'Capture terminée : cliquez sur « Enregistrer ».');
        await wait(600);
      }
    } finally { setCapturing(false); }
  };

  const save = async () => {
    if (onCaptured || !employee.id) { onCaptured?.(samples); close(); return; }
    setSaving(true); setSaveError(null);
    try { const r = await rhService.enrollFace(employee.id, samples); toast('Visage enregistré.', 'success'); saved?.(r.face_samples); close(); }
    catch (err: any) {
      const problem = faceServerError(err, 'Enregistrement du visage impossible.');
      setSaveError(problem); toast(`${problem.title} : ${problem.detail}`, 'error');
    }
    finally { setSaving(false); }
  };
  const remove = async () => {
    if (!employee.id || !window.confirm(`Supprimer le visage enregistré de ${employee.first_name} ${employee.last_name} ?`)) return;
    try { await rhService.deleteFace(employee.id); toast('Visage supprimé.', 'success'); saved?.(0); close(); }
    catch (err: any) { toast(apiMessage(err) || 'Suppression impossible.', 'error'); }
  };

  return <div className="fixed inset-0 z-[80] overflow-y-auto overscroll-contain bg-black/50 p-4"><div className="mx-auto my-8 max-w-xl rounded-2xl bg-surface p-6">
    <div className="flex items-center justify-between"><h2 className="flex items-center gap-2 text-xl font-bold text-primary"><ScanFace /> Visage de {`${employee.first_name} ${employee.last_name}`.trim() || 'l’employé'}</h2><button type="button" onClick={close}><X /></button></div>
    {enrolled && <p className="mt-2 text-sm text-secondary">Un visage est déjà enregistré. Une nouvelle capture le remplacera.</p>}
    <div className="mt-4"><CameraFrame videoRef={videoRef} tone={samples.length === ENROLL_SAMPLES ? 'success' : capturing ? 'active' : 'idle'}>{!ready && !error && <div className="absolute inset-0 flex items-center justify-center bg-black/60 text-white"><Loader2 className="animate-spin" size={32} /></div>}</CameraFrame></div>
    {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    {status && <p className="mt-3 flex items-center gap-2 text-sm text-secondary"><Loader2 size={14} className="animate-spin" /> {status}</p>}
    <div className="mt-3 flex items-center gap-2">{Array.from({ length: ENROLL_SAMPLES }, (_, i) => <span key={i} className={`h-2 flex-1 rounded ${i < samples.length ? 'bg-[#2b7a78]' : 'bg-surface-2'}`} />)}</div>
    {issue && <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"><AlertTriangle size={16} className="mt-0.5 shrink-0" />{issue}</p>}
    {hint && !issue && <p className="mt-2 text-center text-sm font-medium text-primary">{hint}</p>}
    {saveError && <div className="mt-3 rounded-xl border border-red-300 bg-red-50 p-3 text-sm text-red-800"><strong className="block">{saveError.title}</strong>{saveError.detail}{saveError.title === 'Visage déjà enregistré' && <span className="mt-1 block text-xs">Si c’est une erreur de personne, faites poser le bon employé. Sinon, supprimez d’abord le visage de l’autre employé (Employés → Voir → Gérer).</span>}</div>}
    <label className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-sm ${consentMissing && !consent ? 'border-red-500 bg-red-50 text-red-800' : 'border-base'}`}><input type="checkbox" checked={consent} onChange={(e) => { setConsent(e.target.checked); if (e.target.checked) { setConsentMissing(false); setHint(''); } }} className="mt-1 h-4 w-4" /><span>L’employé a été informé et <strong>donne son accord</strong> pour l’utilisation de son visage pour le pointage. Seule une signature numérique est conservée, pas les photos d’enregistrement. Il peut demander sa suppression à tout moment.</span></label>
    <div className="mt-5 flex flex-wrap justify-between gap-2">
      <div>{enrolled && <button type="button" onClick={remove} className="flex items-center gap-1 rounded border border-red-600 px-3 py-2 text-sm text-red-600"><Trash2 size={15} /> Supprimer le visage</button>}</div>
      <div className="flex gap-2">
        <button type="button" disabled={capturing} onClick={capture} className={`flex items-center gap-1 rounded border px-3 py-2 text-sm disabled:opacity-40 ${ready && consent ? 'border-[#2b7a78] text-[#2b7a78]' : 'border-base text-secondary'}`}>{capturing ? <Loader2 size={15} className="animate-spin" /> : <Camera size={15} />} {capturing ? 'Capture…' : samples.length ? 'Recommencer' : 'Capturer'}</button>
        <button type="button" disabled={samples.length !== ENROLL_SAMPLES || !consent || saving} onClick={save} className="flex items-center gap-1 rounded bg-[#2b7a78] px-4 py-2 text-sm text-white disabled:opacity-40"><Check size={15} /> {saving ? 'Enregistrement…' : onCaptured ? 'Valider' : 'Enregistrer'}</button>
      </div>
    </div>
  </div></div>;
};
