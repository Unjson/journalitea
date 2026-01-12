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
}
	
];

export default createRouter({
  history: createWebHashHistory(),
  routes,
});
