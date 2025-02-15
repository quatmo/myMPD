var CACHE = 'myMPD-cache-v5.6.2';
var subdir = self.location.pathname.replace('/sw.js', '').replace(/\/$/, '');
var urlsToCache = [
    subdir + '/',
    subdir + '/css/combined.css',
    subdir + '/js/combined.js',
    subdir + '/assets/appicon-192.png',
    subdir + '/assets/appicon-512.png',
    subdir + '/assets/coverimage-stream.svg',
    subdir + '/assets/coverimage-notavailable.svg',
    subdir + '/assets/coverimage-loading.svg',
    subdir + '/assets/favicon.ico',
    subdir + '/assets/MaterialIcons-Regular.woff2'
];

var ignoreRequests = new RegExp('(' + [
  subdir + '/api',
  subdir + '/ca.crt',
  subdir + '/ws',
  subdir + '/library/(.*)',
  subdir + '/albumart/(.*)',
  subdir + '/pics/(.*)'].join('(/?)|\\') + ')$')

self.addEventListener('install', function(event) {
    event.waitUntil(
        caches.open(CACHE).then(function(cache) {
            urlsToCache.map(function(url) {
                return cache.add(url).catch(function (reason) {
                    // eslint-disable-next-line no-console
                    return console.log('ServiceWorker: ' + String(reason) + ' ' + url);
                });
            });
        })
    );
});

self.addEventListener('fetch', function(event) {
    if (event.request.url.match('^http://')) {
        return false;
    }
    if (ignoreRequests.test(event.request.url)) {
        return false;
    }
    event.respondWith(
        caches.match(event.request).then(function(response) {
            if (response) {
                return response
            }
            else {
                return fetch(event.request);
            }
        })
    );    
});

self.addEventListener('activate', function(event) {
    event.waitUntil(
        caches.keys().then(function(cacheNames) {
            return Promise.all(
                cacheNames.map(function(cacheName) {
                    if (cacheName != CACHE) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
