// Display-name lookup for users referenced by id only (e.g. Bundle.approvedById).
// Mirrors the seed data — kept on the client so screens don't need to fan out
// extra /api/users lookups for the limited demo userset.

const USER_NAMES: Record<string, string> = {
  user_maya: 'มายา จ.',
  user_niran: 'นิรันดร์ ก.',
  user_kpol: 'ก. พล',
  user_som: 'สม พ.',
  user_mai: 'ใหม่ ท.',
};

export function userNameById(id: string | null | undefined): string {
  if (!id) return '';
  return USER_NAMES[id] ?? id;
}
