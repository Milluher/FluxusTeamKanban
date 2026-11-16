import { redirect } from 'next/navigation';

/**
 * Initiatives used to be a page of their own. They are a panel now, opened from
 * the header beside the personas and the dictionary, so an initiative can be
 * read without leaving the board whose tickets it explains.
 *
 * The route is kept purely so an old bookmark or a link in somebody's notes
 * lands somewhere useful instead of on a 404.
 */
export default function InitiativesPage() {
  redirect('/dashboard');
}
