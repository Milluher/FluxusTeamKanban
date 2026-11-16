import { redirect } from 'next/navigation';

/**
 * The changelog used to be a page of its own. It is a panel now, opened from
 * the header beside the personas, the initiatives and the dictionary, so "did
 * that already ship?" can be answered without leaving the board you were
 * looking at when you asked.
 *
 * The route is kept purely so an old bookmark or a link in somebody's notes
 * lands somewhere useful instead of on a 404.
 */
export default function ChangelogPage() {
  redirect('/dashboard');
}
