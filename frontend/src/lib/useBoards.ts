'use client';
import { useEffect, useState } from 'react';
import api from '@/lib/api';

export interface BoardChoice {
  id: string;
  name: string;
}

/**
 * The boards the signed-in user can see, by id and name.
 *
 * Personas, the dictionary, initiatives and the changelog each belong to a
 * board now, so anything that *creates* one has to say which — and the places
 * that create them are not all inside a board. The header panels open on the
 * dashboard too, and `/initiatives` and `/changelog` are still workspace-level
 * pages. Those need a picker; inside a board there is nothing to pick.
 *
 * `GET /boards` is already scoped server-side — every board for a system admin,
 * your memberships otherwise — so this needs no filtering of its own.
 */
export function useBoards(enabled = true) {
  const [boards, setBoards] = useState<BoardChoice[]>([]);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let live = true;
    setLoading(true);
    api
      .get<BoardChoice[]>('/boards')
      .then(({ data }) => {
        if (!live) return;
        setBoards(
          data
            .map((b) => ({ id: b.id, name: b.name }))
            .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
        );
      })
      // A failed board list is not worth an error banner on a panel whose job is
      // something else: the picker simply stays empty and the form says so.
      .catch(() => { if (live) setBoards([]); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [enabled]);

  return { boards, loading };
}
