import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: () => import('./views/Home.vue'),
  },
  {
    path: '/about',
    name: 'about',
    component: () => import('./views/About.vue'),
  },
  {
    path: '/records-list',
    name: 'records-list',
    component: () => import('./views/RecordsList.vue'),
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
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
