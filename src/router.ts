import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'records-list',
    component: () => import('./views/RecordsList.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('./views/About.vue'),
  },
  {
    path: '/record/:id',
    name: 'record-detail',
    component: () => import('./views/RecordDetail.vue'),
  },
  {
    path: '/record/:id/edit',
    name: 'record-edit',
    component: () => import('./views/EditRecord.vue'),
  },
  {
    path: '/record/new',
    name: 'record-new',
    component: () => import('./views/EditRecord.vue'),
  },
  {
    path: '/settings',
    name: 'settings',
    component: () => import('./views/Settings.vue'),
  },
  {
    path: '/stats',
    name: 'stats',
    component: () => import('./views/Stats.vue'),
  },
  {
    path: '/timer',
    name: 'timer',
    component: () => import('./views/Timer.vue'),
  },
];

const mainRouteNames = new Set([
  'records-list',
  'timer',
  'stats',
  'settings',
  'about',
]);

const blockedBackRouteNames = new Set([
  'record-detail',
  'record-edit',
  'record-new',
]);

let lastHistoryPosition = window.history.state?.position ?? 0;
let lastWasBackNavigation = false;
let pendingMainReset = false;

export const markResetOnNextMainNav = () => {
  pendingMainReset = true;
};

export const resetHistoryStack = () => {
  const currentState = window.history.state ?? {};
  window.history.replaceState(
    {
      ...currentState,
      back: null,
      forward: null,
      position: 0,
    },
    '',
    window.location.href,
  );
  lastHistoryPosition = 0;
};

const router = createRouter({
  history: createWebHashHistory(),
  routes,
});

router.beforeEach((to, from, next) => {
  const currentPosition = window.history.state?.position ?? lastHistoryPosition;
  lastWasBackNavigation = currentPosition < lastHistoryPosition;

  if (lastWasBackNavigation && blockedBackRouteNames.has(String(to.name))) {
    next({ name: 'records-list', replace: true });
    return;
  }

  next();
});

router.afterEach((to) => {
  if ((pendingMainReset || lastWasBackNavigation) && mainRouteNames.has(String(to.name))) {
    resetHistoryStack();
    pendingMainReset = false;
    lastWasBackNavigation = false;
    return;
  }

  pendingMainReset = false;
  lastWasBackNavigation = false;
  lastHistoryPosition = window.history.state?.position ?? lastHistoryPosition;
});

export default router;
