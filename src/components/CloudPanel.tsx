import { useCallback, useEffect, useState, type FormEvent } from 'react';
import type { Session } from '@supabase/supabase-js';
import { FolderOpen, LogOut, Mail, Save, Trash2, X } from 'lucide-react';
import type { DesignInput } from '../core/calculationEngine';
import { isDesignInput, supabase, type DesignRow } from '../lib/supabase';
import { useT } from '../i18n';

export interface CurrentDesign {
  id: string;
  name: string;
}

export default function CloudPanel({ input, current, onLoad, onSaved, onClose }: {
  input: DesignInput;
  current: CurrentDesign | null;
  onLoad: (input: DesignInput, design: CurrentDesign) => void;
  onSaved: (design: CurrentDesign) => void;
  onClose: () => void;
}) {
  const t = useT();
  const sb = supabase!;
  const [session, setSession] = useState<Session | null>(null);
  const [rows, setRows] = useState<DesignRow[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState(current?.name ?? t('untitled'));
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = sb.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, [sb]);

  const refresh = useCallback(async () => {
    const { data, error: e } = await sb.from('designs').select('id, name, input, updated_at').order('updated_at', { ascending: false });
    if (e) setError(e.message);
    else setRows(data as DesignRow[]);
  }, [sb]);
  useEffect(() => {
    if (session) refresh();
  }, [session, refresh]);

  const run = async (fn: () => Promise<string | null | undefined>) => {
    setBusy(true);
    setError('');
    const message = await fn();
    if (message) setError(message);
    setBusy(false);
  };

  const sendLink = (e: FormEvent) => {
    e.preventDefault();
    run(async () => {
      const { error: err } = await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
      if (!err) setSent(true);
      return err?.message;
    });
  };

  const save = (asNew: boolean) =>
    run(async () => {
      const trimmed = name.trim() || t('untitled');
      const { data, error: err } = !asNew && current
        ? await sb.from('designs').update({ name: trimmed, input, updated_at: new Date().toISOString() }).eq('id', current.id).select('id, name').single()
        : await sb.from('designs').insert({ name: trimmed, input }).select('id, name').single();
      if (err) return err.message;
      onSaved(data);
      await refresh();
    });

  const open = (row: DesignRow) => {
    if (!isDesignInput(row.input)) return setError(t('badDesign'));
    onLoad(row.input, { id: row.id, name: row.name });
    onClose();
  };

  const remove = (row: DesignRow) => {
    if (!window.confirm(`${t('confirmDelete')} "${row.name}"`)) return;
    run(async () => {
      const { error: err } = await sb.from('designs').delete().eq('id', row.id);
      if (err) return err.message;
      await refresh();
    });
  };

  return (
    <div className="no-print fixed inset-0 z-40 flex items-start justify-center bg-ink/30 p-4 pt-[10vh]" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-labelledby="cloud-title" className="card w-full max-w-md bg-panel shadow-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line p-3">
          <h2 id="cloud-title" className="text-base">{t('cloud')}</h2>
          <button className="btn" onClick={onClose} aria-label={t('close')}><X size={14} /></button>
        </div>

        {!session ? (
          <form className="flex flex-col gap-2 p-3" onSubmit={sendLink}>
            <p className="text-xs text-muted">{t('signInHint')}</p>
            {sent ? (
              <p className="text-sm text-ok">{t('linkSent')}</p>
            ) : (
              <>
                <label className="field">
                  {t('email')}
                  <input className="input font-sans" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </label>
                <button className="btn btn-primary py-2" disabled={busy}><Mail size={14} /> {t('sendLink')}</button>
              </>
            )}
          </form>
        ) : (
          <div className="flex flex-col gap-3 p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted">
              <span className="truncate">{session.user.email}</span>
              <button className="btn" onClick={() => sb.auth.signOut()}><LogOut size={14} /> {t('signOut')}</button>
            </div>
            <label className="field">
              {t('designName')}
              <input className="input font-sans" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <div className="flex gap-2">
              <button className="btn btn-primary flex-1 py-2" disabled={busy} onClick={() => save(false)}><Save size={14} /> {t('save')}</button>
              {current && <button className="btn flex-1 py-2" disabled={busy} onClick={() => save(true)}>{t('saveAsNew')}</button>}
            </div>
            <ul className="flex max-h-72 flex-col overflow-y-auto border-t border-line">
              {rows.length === 0 && <li className="py-3 text-xs text-muted">{t('noDesigns')}</li>}
              {rows.map((row) => (
                <li key={row.id} className={`flex items-center gap-2 border-b border-line py-2 ${current?.id === row.id ? 'font-medium' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm">{row.name}</span>
                    <span className="font-mono text-[11px] text-muted">{new Date(row.updated_at).toLocaleString()}</span>
                  </span>
                  <button className="btn" onClick={() => open(row)}><FolderOpen size={14} /> {t('open')}</button>
                  <button className="btn" onClick={() => remove(row)} aria-label={`${t('delete')} ${row.name}`}><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {error && <p className="px-3 pb-3 text-xs text-bad">{error}</p>}
      </div>
    </div>
  );
}
