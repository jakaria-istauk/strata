import { useParams } from 'react-router-dom';
import { Table2 } from 'lucide-react';

export default function Welcome() {
  const { db } = useParams<{ db: string }>();
  return (
    <div className="flex h-full flex-col items-center justify-center gap-sm text-center text-on-surface-variant">
      <Table2 size={36} className="opacity-40" />
      <p className="text-sm">
        {db ? (
          <>
            Connected to <span className="font-medium text-on-surface">{db}</span>. Pick a
            table from the sidebar.
          </>
        ) : (
          'Select a database, then a table, to browse rows.'
        )}
      </p>
    </div>
  );
}
