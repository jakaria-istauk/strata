import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Props {
  page: number;
  pages: number;
  total: number;
  perPage: number;
  perPageOptions: number[];
  onPage: (page: number) => void;
  onPerPage: (perPage: number) => void;
}

export default function Pagination({
  page,
  pages,
  total,
  perPage,
  perPageOptions,
  onPage,
  onPerPage,
}: Props) {
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const btn =
    'rounded-lg border border-outline-variant p-sm text-on-surface-variant hover:bg-surface-container-high disabled:opacity-40 disabled:hover:bg-transparent';

  return (
    <div className="flex items-center justify-between gap-md py-sm text-sm text-on-surface-variant">
      <div className="flex items-center gap-md">
        <span>
          {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
        </span>
        <label className="flex items-center gap-xs">
          <span>Rows</span>
          <select
            value={perPage}
            onChange={(e) => onPerPage(Number(e.target.value))}
            className="rounded-lg border border-outline-variant bg-surface-container-low px-sm py-xs text-on-surface outline-none focus:border-primary"
          >
            {perPageOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-xs">
        <button className={btn} disabled={page <= 1} onClick={() => onPage(1)} aria-label="First">
          <ChevronsLeft size={16} />
        </button>
        <button
          className={btn}
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          aria-label="Previous"
        >
          <ChevronLeft size={16} />
        </button>
        <span className="px-sm">
          Page {page} / {Math.max(1, pages)}
        </span>
        <button
          className={btn}
          disabled={page >= pages}
          onClick={() => onPage(page + 1)}
          aria-label="Next"
        >
          <ChevronRight size={16} />
        </button>
        <button
          className={btn}
          disabled={page >= pages}
          onClick={() => onPage(pages)}
          aria-label="Last"
        >
          <ChevronsRight size={16} />
        </button>
      </div>
    </div>
  );
}
