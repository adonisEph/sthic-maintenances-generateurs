// Bus global de toasts / opérations — sans dépendance React.
// N'importe quel module (handler App, modal, utilitaire) peut émettre
// une notification ; App.jsx s'abonne via subscribeToasts et rend <ToastStack/>.

let counter = 0;
const listeners = new Set();
const dismissTimers = new Map();

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function emit(evt) {
  listeners.forEach((fn) => {
    try {
      fn(evt);
    } catch {
      // ignore listener errors
    }
  });
}

const DEFAULT_DURATION = {
  success: 5000,
  info: 6000,
  warning: 8000,
  error: 9000
};

function scheduleAutoDismiss(id, ms) {
  const prev = dismissTimers.get(id);
  if (prev) clearTimeout(prev);
  dismissTimers.set(
    id,
    setTimeout(() => {
      dismissTimers.delete(id);
      emit({ type: 'dismiss', id });
    }, ms)
  );
}

function cancelAutoDismiss(id) {
  const prev = dismissTimers.get(id);
  if (prev) clearTimeout(prev);
  dismissTimers.delete(id);
}

export const toast = {
  show(t) {
    const id = `toast-${++counter}`;
    const kind = t?.kind || 'info';
    emit({
      type: 'add',
      toast: {
        id,
        kind,
        title: String(t?.title || ''),
        detail: t?.detail != null ? String(t.detail) : '',
        progress: typeof t?.progress === 'number' ? t.progress : null
      }
    });
    if (kind !== 'running') scheduleAutoDismiss(id, t?.duration ?? DEFAULT_DURATION[kind] ?? 6000);
    return id;
  },
  update(id, patch) {
    emit({ type: 'update', id, patch });
    if (patch && patch.kind && patch.kind !== 'running') {
      scheduleAutoDismiss(id, patch.duration ?? DEFAULT_DURATION[patch.kind] ?? 6000);
    }
  },
  dismiss(id) {
    cancelAutoDismiss(id);
    emit({ type: 'dismiss', id });
  },
  success(title, detail) {
    return this.show({ kind: 'success', title, detail });
  },
  info(title, detail) {
    return this.show({ kind: 'info', title, detail });
  },
  warning(title, detail) {
    return this.show({ kind: 'warning', title, detail });
  },
  error(title, detail) {
    return this.show({ kind: 'error', title, detail });
  },
  running(title, detail) {
    return this.show({ kind: 'running', title, detail });
  }
};

// Remplacement non-bloquant de window.alert : classe le toast selon le préfixe
// du message (✅ succès, ⚠️ avertissement, ❌/Erreur erreur, sinon info).
export function toastAlert(message) {
  const raw = String(message ?? '');
  const trimmed = raw.trim();
  let kind = 'info';
  if (/^[✅✔]/u.test(trimmed)) kind = 'success';
  else if (/^[⚠️⚠]/u.test(trimmed)) kind = 'warning';
  else if (/^[❌⛔🚫]/u.test(trimmed) || /^erreur\b/i.test(trimmed)) kind = 'error';
  else if (/^(vidange|intervention|planning|import|export)\b.*\b(effectuée?|envoyée?|généré|supprimé|terminé)/i.test(trimmed)) {
    kind = 'success';
  }
  const title = trimmed.replace(/^[✅✔⚠️⚠❌⛔🚫ℹ️]+\s*/u, '') || trimmed;
  return toast.show({ kind, title });
}

// Opération longue : toast "running" (spinner indéterminée ou % si fourni).
// L'appelant choisit done()/fail() pour transformer le toast en résultat,
// ou dismiss() si le résultat est déjà notifié par ailleurs (ex. toastAlert).
export function startOperation(title, detail) {
  const id = toast.show({ kind: 'running', title, detail });
  return {
    id,
    update(patch) {
      toast.update(id, patch);
    },
    progress(p, nextDetail) {
      toast.update(id, {
        progress: Math.max(0, Math.min(100, Number(p) || 0)),
        ...(nextDetail != null ? { detail: String(nextDetail) } : {})
      });
    },
    done(nextDetail) {
      toast.update(id, { kind: 'success', detail: nextDetail ?? 'Terminé.', progress: 100 });
    },
    fail(nextDetail) {
      toast.update(id, { kind: 'error', detail: nextDetail ?? 'Échec de l\'opération.', progress: null });
    },
    dismiss() {
      toast.dismiss(id);
    }
  };
}
