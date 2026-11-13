// Envoi quotidien des notifications (appelé par le cron Vercel, voir vercel.json).
// Variables Vercel nécessaires : SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...), CRON_SECRET (facultatif).
const webpush = require('web-push');
const { createClient } = require('@supabase/supabase-js');

const day = (d) => d.toISOString().slice(0, 10);
const r2 = (n) => Math.round(n * 100) / 100;

module.exports = async (req, res) => {
  try {
    if (process.env.CRON_SECRET && req.headers.authorization !== 'Bearer ' + process.env.CRON_SECRET) return res.status(401).json({ error: 'non autorisé' });
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) return res.status(500).json({ error: 'variables manquantes' });
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:contact@exemple.fr', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    const get = async (col) => {
      const out = []; let from = 0;
      for (;;) {
        const { data, error } = await sb.from('docs').select('id,data').eq('col', col).range(from, from + 999);
        if (error) throw error;
        (data || []).forEach((r) => out.push({ id: r.id, ...r.data }));
        if (!data || data.length < 1000) break; from += 1000;
      }
      return out;
    };
    const [devis, factures, paiements, taches, leads, chantiers, settings] = await Promise.all(['devis', 'factures', 'paiements', 'taches', 'leads', 'chantiers', 'settings'].map(get));
    const cfg = (settings.find((s) => s.id === 'main')) || {};
    const t = new Date(Date.now() + 3600e3); // heure de Paris approximative
    const today = day(t), ago7 = day(new Date(t.getTime() - 7 * 86400e3));

    const paid = {}; paiements.forEach((p) => { paid[p.factureId] = (paid[p.factureId] || 0) + (+p.montant || 0); });
    const ttc = (ls) => r2((ls || []).reduce((s, l) => { const ht = (+l.q || 0) * (+l.pu || 0); return s + ht + (cfg.regimeTva === 'franchise' ? 0 : ht * (+l.tva || 0) / 100); }, 0));
    const lateInv = factures.filter((f) => f.statut !== 'Brouillon' && f.statut !== 'Annulée' && f.echeance && f.echeance < today && ttc(f.lignes) - (paid[f.id] || 0) > 0.004).length;
    const toChase = devis.filter((d) => (d.statut === 'Envoyé' || d.statut === 'En attente') && (!d.validite || d.validite >= today) && (d.dateEnvoi || d.date || today) <= ago7).length;
    const todo = taches.filter((x) => !x.fait && (x.echeance || today) <= today).length;
    const calls = leads.filter((l) => l.etape !== 'Gagné' && l.etape !== 'Perdu' && l.prochaine && l.prochaine <= today).length;
    const starts = chantiers.filter((c) => c.debut === today && c.statut !== 'Terminé').length;

    const parts = [];
    if (lateInv) parts.push(lateInv + ' facture' + (lateInv > 1 ? 's' : '') + ' en retard');
    if (toChase) parts.push(toChase + ' devis à relancer');
    if (calls) parts.push(calls + ' prospect' + (calls > 1 ? 's' : '') + ' à rappeler');
    if (starts) parts.push(starts + ' chantier' + (starts > 1 ? 's' : '') + ' qui démarre' + (starts > 1 ? 'nt' : ''));
    if (todo) parts.push(todo + ' tâche' + (todo > 1 ? 's' : ''));
    if (!parts.length) return res.status(200).json({ sent: 0, note: 'rien à signaler' });

    const payload = JSON.stringify({ title: 'La Cigale · Aujourd’hui', body: parts.join(' · '), url: '/' });
    const { data: subs } = await sb.from('push_subs').select('endpoint,sub');
    let sent = 0;
    for (const s of subs || []) {
      try { await webpush.sendNotification(s.sub, payload); sent++; }
      catch (e) { if (e.statusCode === 404 || e.statusCode === 410) await sb.from('push_subs').delete().eq('endpoint', s.endpoint); }
    }
    return res.status(200).json({ sent, parts });
  } catch (e) {
    return res.status(500).json({ error: String(e.message || e) });
  }
};
