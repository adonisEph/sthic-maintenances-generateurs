import { ensureAdminUser } from '../_utils/db.js';
import { json, requireAuth, readJson, isSuperAdmin, userZone, isoNow, newId } from '../_utils/http.js';
import { touchLastUpdatedAt } from '../_utils/meta.js';
import { NH_MAX_REGIME } from '../_utils/nhCoherence.js';

// « Mettre à jour UPCN » — CRUD des données NH pour les sites sans fiche
// (zone UPCN absente de `sites`, sites vus seulement via pm_items) ou dont la
// baseline vidange est incomplète. Le client envoie pour chaque site les 4
// valeurs métier : nh1_dv, date_dv (baseline) + nh2_a, date_a (relevé courant).
//
// - site absent → INSERT sites (zone, tech/nom issus du roster PM)
// - site présent → UPDATE des champs NH (complète la baseline)
// Audit : une ligne nh_readings is_reset=1 (baseline) par site écrit.
// diff_nhs / nh_estimated / regime recalculés — seuil par défaut 250.

const MANAGER_ROLES = ['admin', 'manager', 'manager_bzv_pool'];
const DEFAULT_SEUIL = 250;
const NH_SOURCE_BASELINE = 'baseline';

const normZone = (z) =>
  String(z || '')
    .trim()
    .toUpperCase()
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, ' ');

const normCode = (v) =>
  String(v || '')
    .replace(/[​-‍﻿]/g, '')
    .replace(/\u00A0/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '');

const normYmd = (v) => {
  const s = String(v || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
};

const daysBetween = (a, b) => {
  const d1 = normYmd(a);
  const d2 = normYmd(b);
  if (!d1 || !d2) return NaN;
  return Math.floor((Date.parse(`${d2}T00:00:00Z`) - Date.parse(`${d1}T00:00:00Z`)) / 86400000);
};

async function auditBaseline(env, siteId, item, prev, now, user) {
  try {
    await env.DB.prepare(
      `INSERT INTO nh_readings
       (id, site_id, reading_date, nh_value, prev_nh2_a, prev_date_a, prev_nh1_dv, prev_date_dv,
        prev_nh_offset, new_nh_offset, is_reset, source, quarantine_id,
        created_by_user_id, created_by_email, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        newId(), siteId, item.dateA, item.nh2A,
        prev?.nh2A ?? null, prev?.dateA ?? null, prev?.nh1DV ?? null, prev?.dateDV ?? null,
        prev?.nhOffset ?? null, 0, 1, NH_SOURCE_BASELINE, null,
        user?.id ? String(user.id) : null, user?.email ? String(user.email) : null, now, now
      )
      .run();
  } catch { /* audit best-effort */ }
}

export async function onRequestPost({ request, env, data }) {
  try {
    await ensureAdminUser(env);
    if (!requireAuth(data)) return json({ error: 'Non authentifié.' }, { status: 401 });
    const role = String(data?.user?.role || '').trim();
    if (!MANAGER_ROLES.includes(role)) return json({ error: 'Réservé aux managers/admin.' }, { status: 403 });

    const body = await readJson(request);
    const items = Array.isArray(body?.items) ? body.items : [];
    if (!items.length || items.length > 200) return json({ error: 'Fournis 1 à 200 sites.' }, { status: 400 });

    const scopeZones = (() => {
      if (isSuperAdmin(data) || role === 'manager_bzv_pool') return null;
      return [normZone(userZone(data) || 'BZV/POOL')];
    })();

    const now = isoNow();
    const rows = [];
    let written = 0;

    // Pré-charge les sites existants pour le match zone+code normalisé.
    const existing = await env.DB.prepare(
      'SELECT id, id_site, zone, technician, nh1_dv, date_dv, nh2_a, date_a, nh_offset FROM sites'
    ).all();
    const byKey = new Map();
    for (const s of existing?.results || []) {
      byKey.set(`${normZone(s.zone)}|${normCode(s.id_site)}`, s);
    }

    for (const raw of items.slice(0, 200)) {
      const zone = normZone(raw?.zone);
      const siteCode = normCode(raw?.siteCode);
      const fail = (reason) => rows.push({ siteCode, zone, ok: false, reason });
      if (!zone || !siteCode) { fail('zone/code manquant'); continue; }
      if (Array.isArray(scopeZones) && !scopeZones.includes(zone)) { fail('hors zone'); continue; }

      const nh1 = Number(raw?.nh1Dv);
      const nh2 = Number(raw?.nh2A);
      const dateDv = normYmd(raw?.dateDv);
      const dateA = normYmd(raw?.dateA);
      if (!Number.isFinite(nh1) || nh1 < 0 || !dateDv) { fail('baseline invalide (NH1 DV / Date DV)'); continue; }
      if (!Number.isFinite(nh2) || nh2 < 0 || !dateA) { fail('relevé invalide (NH2 A / Date A)'); continue; }
      if (nh2 < nh1) { fail('NH2 A < NH1 DV'); continue; }
      if (dateA < dateDv) { fail('Date A < Date DV'); continue; }

      const days = daysBetween(dateDv, dateA);
      const implied = Number.isFinite(days) && days > 0 ? Math.round((nh2 - nh1) / days) : 0;
      const regime = implied >= 1 && implied <= NH_MAX_REGIME ? implied : 0;
      const diff = nh2 - nh1;

      const key = `${zone}|${siteCode}`;
      const found = byKey.get(key);

      try {
        if (found?.id) {
          await env.DB.prepare(
            `UPDATE sites SET nh1_dv = ?, date_dv = ?, nh2_a = ?, date_a = ?, nh_offset = 0,
             regime = ?, nh_estimated = ?, diff_nhs = ?, diff_estimated = ?, updated_at = ? WHERE id = ?`
          ).bind(nh1, dateDv, nh2, dateA, regime, nh2, diff, diff, now, String(found.id)).run();
          await auditBaseline(env, String(found.id), { nh2A: nh2, dateA }, {
            nh2A: found.nh2_a, dateA: found.date_a, nh1DV: found.nh1_dv, dateDV: found.date_dv, nhOffset: found.nh_offset
          }, now, data?.user);
          rows.push({ siteCode, zone, ok: true, action: 'updated', siteId: String(found.id) });
        } else {
          const id = newId();
          await env.DB.prepare(
            `INSERT INTO sites
             (id, name_site, id_site, technician, generateur, capacite, kit_vidange,
              nh1_dv, date_dv, nh2_a, date_a, regime, nh_estimated, diff_nhs, diff_estimated,
              seuil, retired, created_at, updated_at, nh_offset, zone)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?)`
          ).bind(
            id,
            String(raw?.siteName || '').trim() || siteCode,
            siteCode,
            String(raw?.technician || '').trim(),
            String(raw?.generateur || '').trim(),
            String(raw?.capacite || '').trim(),
            String(raw?.kitVidange || '').trim(),
            nh1, dateDv, nh2, dateA, regime, nh2, diff, diff,
            DEFAULT_SEUIL, now, now, zone
          ).run();
          await auditBaseline(env, id, { nh2A: nh2, dateA }, null, now, data?.user);
          byKey.set(key, { id });
          rows.push({ siteCode, zone, ok: true, action: 'inserted', siteId: id });
        }
        written++;
      } catch (e) {
        fail(e?.message || 'écriture impossible');
      }
    }

    if (written) await touchLastUpdatedAt(env);
    return json({ ok: true, written, count: rows.filter((r) => r.ok).length, items: rows }, { status: 200 });
  } catch (e) {
    return json({ error: e?.message || 'Erreur serveur.' }, { status: 500 });
  }
}
