export type Route =
  | { name: 'home' }
  | { name: 'upload' }
  | { name: 'record'; id: string }
  | { name: 'bundle-new' }
  | { name: 'bundle-submitted'; id: string }
  | { name: 'bundle'; id: string }
  | { name: 'approver-home' }
  | { name: 'approver-review'; id: string }
  | { name: 'approver-pay'; id: string }
  | { name: 'login' }
  | { name: 'auth-callback' }
  | { name: 'link-account' }
  | { name: 'admin-employees' }
  | { name: 'my-requests' };

export type RouteName = Route['name'];

export type Nav = (route: Route) => void;
