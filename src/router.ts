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

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
