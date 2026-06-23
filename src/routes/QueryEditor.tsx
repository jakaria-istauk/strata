// SQL editor — run arbitrary SQL against the active db. Shows a result grid for
// SELECT-like statements or an affected-rows message for writes, plus timing and
// a localStorage-backed history. Route: /db/:db/query.

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Play, Loader2, History, Trash2, Clock, CheckCircle2 } from 'lucide-react';
import { api, ApiError } from '../api';
import { getHistory, pushHistory, clearHistory, type HistoryEntry } from '../lib/history';
import { useToast } from '../components/Toast';
import type { QueryResult } from '../types';

export default function QueryEditor() {
  const { db } = useParams<{ db: string }>();
  const toast = useToast();
  const taRef = useRef<HTMLTextAreaElement>(null);

  const [sql, setSql] = useState('');
  const [result, setResult] = useState<QueryResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => setHistory(getHistory()), []);

  const run = useMutation({
    mutationFn: (q: string) => api<QueryResult>('query', { db, sql: q }, { db }),
    onSuccess: (res, q) => {
      setResult(res);
      setHistory(pushHistory(q));
    },
    onError: (e) => {
      setResult(null);
      toast.error(e instanceof ApiError ? e.message : String(e));
    },
  });

  function submit() {
    const q = sql.trim();
    if (!q || run.isPending) return;
    run.mutate(q);
  }

  // Ctrl/Cmd+Enter runs the query from inside the editor.
  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      submit();
    }
  }

  const error = run.error as Error | null;

  return (
    <div className="flex h-full min-h-0 flex-col gap-md p-md">
      <div className="flex shrink-0 items-center gap-md">
        <h1 className="font-display text-base font-semibold text-on-surface">SQL · {db}</h1>
        <div className="ml-auto flex items-center gap-sm">
          <button
            onClick={() => setShowHistory((s) => !s)}
            className={`flex items-center gap-sm rounded-lg border px-md py-sm text-sm ${
              showHistory
                ? 'border-primary bg-secondary-container text-on-secondary-container'
                : 'border-outline-variant text-on-surface hover:bg-surface-container-high'
            }`}
          >
            <History size={14} /> History
          </button>
          <button
            onClick={submit}
            disabled={!sql.trim() || run.isPending}
            className="flex items-center gap-sm rounded-lg bg-primary px-lg py-sm text-sm font-medium text-on-primary hover:opacity-90 disabled:opacity-40"
            title="Run (⌘/Ctrl + Enter)"
          >
            {run.isPending ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 gap-md">
        <div className="flex min-w-0 flex-1 flex-col gap-md">
          <textarea
            ref={taRef}
            value={sql}
            onChange={(e) => setSql(e.target.value)}
            onKeyDown={onKeyDown}
            spellCheck={false}
            placeholder="SELECT * FROM …    (⌘/Ctrl + Enter to run)"
            className="h-40 w-full shrink-0 resize-y rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm font-mono text-sm text-on-surface outline-none focus:border-primary"
          />

          <div className="min-h-0 flex-1 overflow-hidden">
            {error ? (
              <div className="rounded-lg bg-error/10 px-md py-sm font-mono text-sm text-error">
                {error.message}
              </div>
            ) : !result ? (
              <div className="flex h-full items-center justify-center text-sm text-on-surface-variant">
                Run a query to see results.
              </div>
            ) : result.type === 'exec' ? (
              <div className="flex items-center gap-sm rounded-lg bg-surface-container-low px-md py-md text-sm text-on-surface">
                <CheckCircle2 size={16} className="text-primary" />
                {result.affected} row{result.affected === 1 ? '' : 's'} affected.
                <span className="ml-auto flex items-center gap-xs text-xs text-on-surface-variant">
                  <Clock size={12} /> {result.ms} ms
                </span>
              </div>
            ) : (
              <ResultGrid result={result} />
            )}
          </div>
        </div>

        {showHistory && (
          <HistoryPanel
            history={history}
            onPick={(q) => {
              setSql(q);
              taRef.current?.focus();
            }}
            onClear={() => {
              clearHistory();
              setHistory([]);
            }}
          />
        )}
      </div>
    </div>
  );
}

function ResultGrid({ result }: { result: Extract<QueryResult, { type: 'result' }> }) {
  return (
    <div className="flex h-full flex-col gap-sm">
      <div className="flex shrink-0 items-center gap-sm text-xs text-on-surface-variant">
        <span>{result.rowCount} row{result.rowCount === 1 ? '' : 's'}</span>
        <span className="flex items-center gap-xs">
          <Clock size={12} /> {result.ms} ms
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-outline-variant">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-surface-container">
            <tr>
              {result.columns.map((c, i) => (
                <th
                  key={`${c.name}-${i}`}
                  className="whitespace-nowrap border-b border-outline-variant px-md py-sm text-left font-medium text-on-surface-variant"
                >
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr>
                <td
                  colSpan={Math.max(1, result.columns.length)}
                  className="px-md py-xl text-center text-sm text-on-surface-variant"
                >
                  No rows returned.
                </td>
              </tr>
            ) : (
              result.rows.map((row, ri) => (
                <tr key={ri} className="even:bg-surface-container-low hover:bg-surface-container-high">
                  {result.columns.map((c, ci) => {
                    const v = row[c.name];
                    return (
                      <td
                        key={ci}
                        className="max-w-xs truncate whitespace-nowrap border-b border-outline-variant px-md py-sm font-mono text-xs text-on-surface"
                        title={v ?? 'NULL'}
                      >
                        {v === null ? (
                          <span className="italic text-on-surface-variant/60">NULL</span>
                        ) : (
                          v
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function HistoryPanel({
  history,
  onPick,
  onClear,
}: {
  history: HistoryEntry[];
  onPick: (sql: string) => void;
  onClear: () => void;
}) {
  return (
    <aside className="flex w-72 shrink-0 flex-col rounded-lg border border-outline-variant bg-surface-container-low">
      <div className="flex items-center justify-between border-b border-outline-variant px-md py-sm">
        <span className="text-xs font-medium text-on-surface-variant">Recent queries</span>
        {history.length > 0 && (
          <button
            onClick={onClear}
            className="flex items-center gap-xs rounded p-xs text-xs text-on-surface-variant hover:bg-surface-container-high"
            title="Clear history"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-xs">
        {history.length === 0 ? (
          <li className="px-sm py-md text-xs text-on-surface-variant">No history yet.</li>
        ) : (
          history.map((e) => (
            <li key={e.at}>
              <button
                onClick={() => onPick(e.sql)}
                className="block w-full truncate rounded px-sm py-sm text-left font-mono text-xs text-on-surface hover:bg-surface-container-high"
                title={e.sql}
              >
                {e.sql}
              </button>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
