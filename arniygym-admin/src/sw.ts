/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
declare const self: ServiceWorkerGlobalScope;
precacheAndRoute(self.__WB_MANIFEST);
self.addEventListener('push',(event)=>{const data=event.data?.json?.()||{};event.waitUntil(self.registration.showNotification(data.title||'ArniyGym', {body:data.body||'Bugungi rejangizni davom ettiring.',icon:new URL('icon.svg',self.registration.scope).href,badge:new URL('icon.svg',self.registration.scope).href,data:{url:data.url||self.registration.scope}}))});
self.addEventListener('notificationclick',(event)=>{event.notification.close();event.waitUntil(self.clients.openWindow(event.notification.data?.url||self.registration.scope))});
