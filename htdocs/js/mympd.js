"use strict";
/* myMPD
   (c) 2018-2019 Juergen Mang <mail@jcgames.de>
   This project's homepage is: https://github.com/jcorporation/mympd
   
   myMPD ist fork of:

   ympd
   (c) 2013-2014 Andrew Karpow <andy@ndyk.de>
   This project's homepage is: https://www.ympd.org
   
   This program is free software; you can redistribute it and/or modify
   it under the terms of the GNU General Public License as published by
   the Free Software Foundation; version 2 of the License.

   This program is distributed in the hope that it will be useful,
   but WITHOUT ANY WARRANTY; without even the implied warranty of
   MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
   GNU General Public License for more details.

   You should have received a copy of the GNU General Public License along
   with this program; if not, write to the Free Software Foundation, Inc.,
   Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA.
*/
/* Disable eslint warnings */
/* global Modal, Dropdown, Collapse, Popover */
/* global keymap, phrases, locales */

var socket = null;
var lastSong = '';
var lastSongObj = {};
var lastState;
var currentSong = new Object();
var playstate = '';
var settingsLock = false;
var settingsParsed = 'false';
var settingsNew = {};
var settings = {};
settings.loglevel = 2;
var alertTimeout = null;
var progressTimer = null;
var deferredPrompt;
var dragEl;
var playlistEl;
var websocketConnected = false;
var websocketTimer = null;
var appInited = false;
var subdir = '';
var uiEnabled = true;
var locale = navigator.language || navigator.userLanguage;

var app = {};
app.apps = { "Playback":   { "state": "0/-/-/", "scrollPos": 0 },
             "Queue":	   {
                  "active": "Current",
                  "tabs": { "Current": { "state": "0/any/-/", "scrollPos": 0 },
                            "LastPlayed": { "state": "0/any/-/", "scrollPos": 0 }
                          }
                  },
             "Browse":     { 
                  "active": "Database", 
                  "tabs":  { "Filesystem": { "state": "0/-/-/", "scrollPos": 0 },
                             "Playlists":  { 
                                    "active": "All",
                                    "views": { "All":    { "state": "0/-/-/", "scrollPos": 0 },
                                               "Detail": { "state": "0/-/-/", "scrollPos": 0 }
                                    }
                             },
                             "Database":   { 
                                    "active": "AlbumArtist",
                                    "views": { 
                                     }
                             }
                  }
             },
             "Search": { "state": "0/any/-/", "scrollPos": 0 }
           };

app.current = { "app": "Playback", "tab": undefined, "view": undefined, "page": 0, "filter": "", "search": "", "sort": "", "scrollPos": 0 };
app.last = { "app": undefined, "tab": undefined, "view": undefined, "filter": "", "search": "", "sort": "", "scrollPos": 0 };

var domCache = {};
domCache.navbarBottomBtns = document.getElementById('navbar-bottom').getElementsByTagName('div');
domCache.navbarBottomBtnsLen = domCache.navbarBottomBtns.length;
domCache.cardHeaderBrowse = document.getElementById('cardHeaderBrowse').getElementsByTagName('a');
domCache.cardHeaderBrowseLen = domCache.cardHeaderBrowse.length;
domCache.cardHeaderQueue = document.getElementById('cardHeaderQueue').getElementsByTagName('a');
domCache.cardHeaderQueueLen = domCache.cardHeaderQueue.length;
domCache.counter = document.getElementById('counter');
domCache.volumePrct = document.getElementById('volumePrct');
domCache.volumeControl = document.getElementById('volumeControl');
domCache.volumeMenu = document.getElementById('volumeMenu');
domCache.btnsPlay = document.getElementsByClassName('btnPlay');
domCache.btnsPlayLen = domCache.btnsPlay.length;
domCache.btnPrev = document.getElementById('btnPrev');
domCache.btnNext = document.getElementById('btnNext');
domCache.progressBar = document.getElementById('progressBar');
domCache.volumeBar = document.getElementById('volumeBar');
domCache.outputs = document.getElementById('outputs');
domCache.btnAdd = document.getElementById('nav-add2homescreen');
domCache.currentCover = document.getElementById('currentCover');
domCache.currentTitle = document.getElementById('currentTitle');
domCache.btnVoteUp = document.getElementById('btnVoteUp');
domCache.btnVoteDown = document.getElementById('btnVoteDown');
domCache.badgeQueueItems = document.getElementById('badgeQueueItems');
domCache.searchstr = document.getElementById('searchstr');
domCache.searchCrumb = document.getElementById('searchCrumb');

/* eslint-disable no-unused-vars */
var modalConnection = new Modal(document.getElementById('modalConnection'));
var modalSettings = new Modal(document.getElementById('modalSettings'));
var modalAbout = new Modal(document.getElementById('modalAbout')); 
var modalSaveQueue = new Modal(document.getElementById('modalSaveQueue'));
var modalAddToQueue = new Modal(document.getElementById('modalAddToQueue'));
var modalSongDetails = new Modal(document.getElementById('modalSongDetails'));
var modalAddToPlaylist = new Modal(document.getElementById('modalAddToPlaylist'));
var modalRenamePlaylist = new Modal(document.getElementById('modalRenamePlaylist'));
var modalUpdateDB = new Modal(document.getElementById('modalUpdateDB'));
var modalSaveSmartPlaylist = new Modal(document.getElementById('modalSaveSmartPlaylist'));
var modalDeletePlaylist = new Modal(document.getElementById('modalDeletePlaylist'));
var modalSaveBookmark = new Modal(document.getElementById('modalSaveBookmark'));

var dropdownMainMenu; 
var dropdownVolumeMenu = new Dropdown(document.getElementById('volumeMenu'));
var dropdownBookmarks = new Dropdown(document.getElementById('BrowseFilesystemBookmark'));
var dropdownLocalPlayer = new Dropdown(document.getElementById('localPlaybackMenu'));

var collapseDBupdate = new Collapse(document.getElementById('navDBupdate'));
var collapseSyscmds = new Collapse(document.getElementById('navSyscmds'));
/* eslint-enable no-unused-vars */

function appPrepare(scrollPos) {
    if (app.current.app != app.last.app || app.current.tab != app.last.tab || app.current.view != app.last.view) {
        //Hide all cards + nav
        for (let i = 0; i < domCache.navbarBottomBtnsLen; i++) {
            domCache.navbarBottomBtns[i].classList.remove('active');
        }
        document.getElementById('cardPlayback').classList.add('hide');
        document.getElementById('cardQueue').classList.add('hide');
        document.getElementById('cardBrowse').classList.add('hide');
        document.getElementById('cardSearch').classList.add('hide');
        for (let i = 0; i < domCache.cardHeaderBrowseLen; i++) {
            domCache.cardHeaderBrowse[i].classList.remove('active');
        }
        for (let i = 0; i < domCache.cardHeaderQueueLen; i++) {
            domCache.cardHeaderQueue[i].classList.remove('active');
        }
        document.getElementById('cardQueueCurrent').classList.add('hide');
        document.getElementById('cardQueueLastPlayed').classList.add('hide');
        document.getElementById('cardBrowsePlaylists').classList.add('hide');
        document.getElementById('cardBrowseDatabase').classList.add('hide');
        document.getElementById('cardBrowseFilesystem').classList.add('hide');        
        //show active card + nav
        document.getElementById('card' + app.current.app).classList.remove('hide');
        if (document.getElementById('nav' + app.current.app)) {
            document.getElementById('nav' + app.current.app).classList.add('active');
        }
        if (app.current.tab != undefined) {
            document.getElementById('card' + app.current.app + app.current.tab).classList.remove('hide');
            document.getElementById('card' + app.current.app + 'Nav' + app.current.tab).classList.add('active');    
        }
        scrollToPosY(scrollPos);
    }
    let list = document.getElementById(app.current.app + 
        (app.current.tab == undefined ? '' : app.current.tab) + 
        (app.current.view == undefined ? '' : app.current.view) + 'List');
    if (list) {
        list.classList.add('opacity05');
    }
}

function appGoto(a,t,v,s) {
    let scrollPos = 0;
    if (document.body.scrollTop) {
        scrollPos = document.body.scrollTop
    }
    else {
        scrollPos = document.documentElement.scrollTop;
    }
        
    if (app.apps[app.current.app].scrollPos != undefined)
        app.apps[app.current.app].scrollPos = scrollPos
    else if (app.apps[app.current.app].tabs[app.current.tab].scrollPos != undefined)
        app.apps[app.current.app].tabs[app.current.tab].scrollPos = scrollPos
    else if (app.apps[app.current.app].tabs[app.current.tab].views[app.current.view].scrollPos != undefined)
        app.apps[app.current.app].tabs[app.current.tab].views[app.current.view].scrollPos = scrollPos;

    let hash = '';
    if (app.apps[a].tabs) {
        if (t == undefined) 
            t = app.apps[a].active;
        if (app.apps[a].tabs[t].views) {
            if (v == undefined) 
                v = app.apps[a].tabs[t].active;
            hash = '/' + a + '/' + t +'/'+v + '!' + (s == undefined ? app.apps[a].tabs[t].views[v].state : s);
        } else {
            hash = '/'+a+'/'+t+'!'+ (s == undefined ? app.apps[a].tabs[t].state : s);
        }
    } else {
        hash = '/' + a + '!'+ (s == undefined ? app.apps[a].state : s);
    }
    location.hash = hash;
}

function appRoute() {
    if (settingsParsed == 'false') {
        appInitStart();
        return;
    }
    let hash = decodeURI(location.hash);
    let params = hash.match(/^#\/(\w+)\/?(\w+)?\/?(\w+)?!((\d+)\/([^/]+)\/([^/]+)\/(.*))$/);
    if (params) {
        app.current.app = params[1];
        app.current.tab = params[2];
        app.current.view = params[3];
        if (app.apps[app.current.app].state) {
            app.apps[app.current.app].state = params[4];
            app.current.scrollPos = app.apps[app.current.app].scrollPos;
        }
        else if (app.apps[app.current.app].tabs[app.current.tab].state) {
            app.apps[app.current.app].tabs[app.current.tab].state = params[4];
            app.apps[app.current.app].active = app.current.tab;
            app.current.scrollPos = app.apps[app.current.app].tabs[app.current.tab].scrollPos;
        }
        else if (app.apps[app.current.app].tabs[app.current.tab].views[app.current.view].state) {
            app.apps[app.current.app].tabs[app.current.tab].views[app.current.view].state = params[4];
            app.apps[app.current.app].active = app.current.tab;
            app.apps[app.current.app].tabs[app.current.tab].active = app.current.view;
            app.current.scrollPos = app.apps[app.current.app].tabs[app.current.tab].views[app.current.view].scrollPos;
        }
        app.current.page = parseInt(params[5]);
        app.current.filter = params[6];
        app.current.sort = params[7];
        app.current.search = params[8];
    }
    else {
        appGoto('Playback');
        return;
    }

    appPrepare(app.current.scrollPos);

    if (app.current.app == 'Playback') {
        sendAPI({"cmd": "MPD_API_PLAYER_CURRENT_SONG"}, songChange);
    }    
    else if (app.current.app == 'Queue' && app.current.tab == 'Current' ) {
        selectTag('searchqueuetags', 'searchqueuetagsdesc', app.current.filter);
        getQueue();
    }
    else if (app.current.app == 'Queue' && app.current.tab == 'LastPlayed') {
        sendAPI({"cmd": "MPD_API_QUEUE_LAST_PLAYED", "data": {"offset": app.current.page, "cols": settings.colsQueueLastPlayed}}, parseLastPlayed);
    }
    else if (app.current.app == 'Browse' && app.current.tab == 'Playlists' && app.current.view == 'All') {
        sendAPI({"cmd": "MPD_API_PLAYLIST_LIST", "data": {"offset": app.current.page, "filter": app.current.filter}}, parsePlaylists);
        doSetFilterLetter('BrowsePlaylistsFilter');
    }
    else if (app.current.app == 'Browse' && app.current.tab == 'Playlists' && app.current.view == 'Detail') {
        sendAPI({"cmd": "MPD_API_PLAYLIST_CONTENT_LIST", "data": {"offset": app.current.page, "filter": app.current.filter, "uri": app.current.search, "cols": settings.colsBrowsePlaylistsDetail}}, parsePlaylists);
        doSetFilterLetter('BrowsePlaylistsFilter');
    }    
    else if (app.current.app == 'Browse' && app.current.tab == 'Database') {
        if (app.current.search != '') {
            sendAPI({"cmd": "MPD_API_DATABASE_TAG_ALBUM_LIST", "data": {"offset": app.current.page, "filter": app.current.filter, "search": app.current.search, "tag": app.current.view}}, parseListDBtags);
            doSetFilterLetter('BrowseDatabaseFilter');
        }
        else {
            sendAPI({"cmd": "MPD_API_DATABASE_TAG_LIST","data": {"offset": app.current.page, "filter": app.current.filter, "tag": app.current.view}}, parseListDBtags);
            doSetFilterLetter('BrowseDatabaseFilter');
            selectTag('BrowseDatabaseByTagDropdown', 'btnBrowseDatabaseByTag', app.current.view);
        }
    }    
    else if (app.current.app == 'Browse' && app.current.tab == 'Filesystem') {
        sendAPI({"cmd": "MPD_API_DATABASE_FILESYSTEM_LIST", "data": {"offset": app.current.page, "path": (app.current.search ? app.current.search : "/"), "filter": app.current.filter, "cols": settings.colsBrowseFilesystem}}, parseFilesystem);
        // Don't add all songs from root
        if (app.current.search) {
            document.getElementById('BrowseFilesystemAddAllSongs').removeAttribute('disabled');
            document.getElementById('BrowseFilesystemAddAllSongsBtn').removeAttribute('disabled');
        }
        else {
            document.getElementById('BrowseFilesystemAddAllSongs').setAttribute('disabled', 'disabled');
            document.getElementById('BrowseFilesystemAddAllSongsBtn').setAttribute('disabled', 'disabled');
        }
        // Create breadcrumb
        let breadcrumbs='<li class="breadcrumb-item"><a data-uri="" class="material-icons">home</a></li>';
        let pathArray = app.current.search.split('/');
        let pathArrayLen = pathArray.length;
        let fullPath = '';
        for (let i = 0; i < pathArrayLen; i++) {
            if (pathArrayLen - 1 == i) {
                breadcrumbs += '<li class="breadcrumb-item active">' + e(pathArray[i]) + '</li>';
                break;
            }
            fullPath += pathArray[i];
            breadcrumbs += '<li class="breadcrumb-item"><a class="text-body" href="#" data-uri="' + encodeURI(fullPath) + '">' + e(pathArray[i]) + '</a></li>';
            fullPath += '/';
        }
        document.getElementById('BrowseBreadcrumb').innerHTML = breadcrumbs;
        doSetFilterLetter('BrowseFilesystemFilter');
    }
    else if (app.current.app == 'Search') {
        domCache.searchstr.focus();
        if (settings.featAdvsearch) {
            let crumbs = '';
            let elements = app.current.search.substring(1, app.current.search.length - 1).split(' AND ');
            for (let i = 0; i < elements.length - 1 ; i++) {
                let value = elements[i].substring(1, elements[i].length - 1);
                crumbs += '<button data-filter="' + encodeURI(value) + '" class="btn btn-light mr-2">' + e(value) + '<span class="ml-2 badge badge-secondary">&times</span></button>';
            }
            domCache.searchCrumb.innerHTML = crumbs;
            if (domCache.searchstr.value == '' && elements.length >= 1) {
                let lastEl = elements[elements.length - 1].substring(1,  elements[elements.length - 1].length - 1);
                let lastElValue = lastEl.substring(lastEl.indexOf('\'') + 1, lastEl.length - 1);
                if (domCache.searchstr.value != lastElValue) {
                    domCache.searchCrumb.innerHTML += '<button data-filter="' + encodeURI(lastEl) +'" class="btn btn-light mr-2">' + e(lastEl) + '<span href="#" class="ml-2 badge badge-secondary">&times;</span></button>';
                }
                let match = lastEl.substring(lastEl.indexOf(' ') + 1);
                match = match.substring(0, match.indexOf(' '));
                if (match == '')
                    match = 'contains';
                document.getElementById('searchMatch').value = match;
            }
        }
        else {
            if (domCache.searchstr.value == '' && app.current.search != '')
                domCache.searchstr.value = app.current.search;
        }
        if (app.last.app != app.current.app) {
            if (app.current.search != '') {
                let colspan = settings['cols' + app.current.app].length;
                colspan--;
                document.getElementById('SearchList').getElementsByTagName('tbody')[0].innerHTML=
                    '<tr><td><span class="material-icons">search</span></td>' +
                    '<td colspan="' + colspan + '">' + t('Searching...') + '</td></tr>';
            }
        }

        if (domCache.searchstr.value.length >= 2 || domCache.searchCrumb.children.length > 0) {
            if (settings.featAdvsearch) {
                let sort = app.current.sort;
                let sortdesc = false;
                if (sort == '-') {
                    if (settings.tags.includes('Title'))
                        sort = 'Title';
                    else
                        sort = '-';
                    document.getElementById('SearchList').setAttribute('data-sort', sort);
                }
                else {
                    if (sort.indexOf('-') == 0) {
                        sortdesc = true;
                        sort = sort.substring(1);
                    }
                }
                sendAPI({"cmd": "MPD_API_DATABASE_SEARCH_ADV", "data": { "plist": "", "offset": app.current.page, "sort": sort, "sortdesc": sortdesc, "expression": app.current.search, "cols": settings.colsSearch}}, parseSearch);
            }
            else {
                sendAPI({"cmd": "MPD_API_DATABASE_SEARCH", "data": { "plist": "", "offset": app.current.page, "filter": app.current.filter, "searchstr": app.current.search, "cols": settings.colsSearch}}, parseSearch);
            }
        } else {
            document.getElementById('SearchList').getElementsByTagName('tbody')[0].innerHTML = '';
            document.getElementById('searchAddAllSongs').setAttribute('disabled', 'disabled');
            document.getElementById('searchAddAllSongsBtn').setAttribute('disabled', 'disabled');
            document.getElementById('panel-heading-search').innerText = '';
            document.getElementById('cardFooterSearch').innerText = '';
            document.getElementById('SearchList').classList.remove('opacity05');
            setPagination(0, 0);
        }
        selectTag('searchtags', 'searchtagsdesc', app.current.filter);
    }
    else {
        appGoto("Playback");
    }

    app.last.app = app.current.app;
    app.last.tab = app.current.tab;
    app.last.view = app.current.view;
}

function showAppInitAlert(text) {
    document.getElementById('splashScreenAlert').innerHTML = '<a id="appReloadBtn" class="btn btn-danger text-light clickable">Reload</a><p class="text-danger">' + t(text) + '</p>';
    document.getElementById('appReloadBtn').addEventListener('click', function() {
        location.reload();
    }, false);
}

function appInitStart() {
    subdir = window.location.pathname.replace('/index.html', '').replace(/\/$/, '');
    let localeList = '<option value="default" data-phrase="Browser default"></option>';
    for (let i = 0; i < locales.length; i++) {
        localeList += '<option value="' + e(locales[i].code) + '">' + e(locales[i].desc) + ' (' + e(locales[i].code) + ')</option>';
    }
    document.getElementById('selectLocale').innerHTML = localeList;
    
    i18nHtml(document.getElementById('splashScreenAlert'));
    
    //register serviceworker
    let script = document.getElementsByTagName("script")[0].src.replace(/^.*[/]/, '');
    if ('serviceWorker' in navigator && document.URL.substring(0, 5) == 'https' 
        && window.location.hostname != 'localhost' && script == 'combined.js')
    {
        window.addEventListener('load', function() {
            navigator.serviceWorker.register('/sw.js', {scope: '/'}).then(function(registration) {
                // Registration was successful
                logInfo('ServiceWorker registration successful.');
                registration.update();
            }, function(err) {
                // Registration failed
                logError('ServiceWorker registration failed: ' + err);
            });
        });
    }

    appInited = false;
    document.getElementById('splashScreen').classList.remove('hide');
    document.getElementsByTagName('body')[0].classList.add('overflow-hidden');
    document.getElementById('splashScreenAlert').innerText = t('Fetch myMPD settings');
    getSettings(true);
    appInitWait();
}

function appInitWait() {
    setTimeout(function() {
        if (settingsParsed == 'true' && websocketConnected == true) {
            //app initialized
            document.getElementById('splashScreenAlert').innerText = t('Applying settings');
            document.getElementById('splashScreen').classList.add('hide-fade');
            setTimeout(function() {
                document.getElementById('splashScreen').classList.add('hide');
                document.getElementById('splashScreen').classList.remove('hide-fade');
                document.getElementsByTagName('body')[0].classList.remove('overflow-hidden');
            }, 500);
            appInit();
            appInited = true;
            return;
        }
        
        if (settingsParsed == 'true') {
            //parsed settings, now its save to connect to websocket
            document.getElementById('splashScreenAlert').innerText = t('Connect to websocket');
            webSocketConnect();
        }
        else if (settingsParsed == 'error') {
            return;
        }
        appInitWait();
    }, 500);
}

function appInit() {
    document.getElementById('btnChVolumeDown').addEventListener('click', function(event) {
        event.stopPropagation();
    }, false);
    document.getElementById('btnChVolumeUp').addEventListener('click', function(event) {
        event.stopPropagation();
    }, false);

    domCache.volumeBar.addEventListener('click', function(event) {
        event.stopPropagation();
    }, false);
    domCache.volumeBar.addEventListener('change', function() {
        sendAPI({"cmd": "MPD_API_PLAYER_VOLUME_SET", "data": {"volume": domCache.volumeBar.value}});
    }, false);

    domCache.progressBar.value = 0;
    domCache.progressBar.addEventListener('change', function() {
        if (currentSong && currentSong.currentSongId >= 0) {
            let seekVal = Math.ceil(currentSong.totalTime * (domCache.progressBar.value / 1000));
            sendAPI({"cmd": "MPD_API_PLAYER_SEEK", "data": {"songid": currentSong.currentSongId, "seek": seekVal}});
        }
    }, false);


    let collapseArrows = document.querySelectorAll('.subMenu');
    let collapseArrowsLen = collapseArrows.length;
    for (let i = 0; i < collapseArrowsLen; i++) {
        collapseArrows[i].addEventListener('click', function(event) {
            event.stopPropagation();
            event.preventDefault();
            let icon = this.getElementsByTagName('span')[0];
            icon.innerText = icon.innerText == 'keyboard_arrow_right' ? 'keyboard_arrow_down' : 'keyboard_arrow_right';
        }, false);
    }    
    
    document.getElementById('volumeMenu').parentNode.addEventListener('show.bs.dropdown', function () {
        sendAPI({"cmd": "MPD_API_PLAYER_OUTPUT_LIST"}, parseOutputs);
    });
    
    document.getElementById('BrowseFilesystemBookmark').parentNode.addEventListener('show.bs.dropdown', function () {
        sendAPI({"cmd": "MYMPD_API_BOOKMARK_LIST", "data": {"offset": 0}}, parseBookmarks);
    });
    
    document.getElementById('modalAbout').addEventListener('shown.bs.modal', function () {
        sendAPI({"cmd": "MPD_API_DATABASE_STATS"}, parseStats);
        let trs = '';
        for (let key in keymap) {
            if (keymap[key].req == undefined || settings[keymap[key].req] == true) {
                trs += '<tr><td><div class="key' + (keymap[key].key && keymap[key].key.length > 1 ? ' material-icons material-icons-small' : '') + 
                       '">' + (keymap[key].key != undefined ? keymap[key].key : key ) + '</div></td><td>' + t(keymap[key].desc) + '</td></tr>';
            }
        }
        document.getElementById('tbodyShortcuts').innerHTML = trs;
    });
    
    document.getElementById('modalAddToPlaylist').addEventListener('shown.bs.modal', function () {
        if (!document.getElementById('addStreamFrm').classList.contains('hide')) {
            document.getElementById('streamUrl').focus();
            document.getElementById('streamUrl').value = '';
        }
        else {
            document.getElementById('addToPlaylistPlaylist').focus();
        }
    });
    
    document.getElementById('modalAddToQueue').addEventListener('shown.bs.modal', function () {
        document.getElementById('inputAddToQueueQuantity').classList.remove('is-invalid');
        if (settings.featPlaylists) {
            playlistEl = 'selectAddToQueuePlaylist';
            sendAPI({"cmd": "MPD_API_PLAYLIST_LIST","data": {"offset": 0, "filter": "-"}}, getAllPlaylists);
        }
    });

    document.getElementById('modalUpdateDB').addEventListener('hidden.bs.modal', function () {
        document.getElementById('updateDBprogress').classList.remove('updateDBprogressAnimate');
    });
    
    document.getElementById('modalSaveQueue').addEventListener('shown.bs.modal', function () {
        let plName = document.getElementById('saveQueueName');
        plName.focus();
        plName.value = '';
        plName.classList.remove('is-invalid');
    });
        
    document.getElementById('modalSettings').addEventListener('shown.bs.modal', function () {
        getSettings();
        document.getElementById('inputCrossfade').classList.remove('is-invalid');
        document.getElementById('inputMixrampdb').classList.remove('is-invalid');
        document.getElementById('inputMixrampdelay').classList.remove('is-invalid');
    });

    document.getElementById('modalConnection').addEventListener('shown.bs.modal', function () {
        getSettings();
        document.getElementById('inputMpdHost').classList.remove('is-invalid');
        document.getElementById('inputMpdPort').classList.remove('is-invalid');
        document.getElementById('inputMpdPass').classList.remove('is-invalid');
    });

    document.getElementById('selectJukeboxMode').addEventListener('change', function () {
        let value = this.options[this.selectedIndex].value;
        if (value == 0) {
            document.getElementById('inputJukeboxQueueLength').setAttribute('disabled', 'disabled');
            document.getElementById('selectJukeboxPlaylist').setAttribute('disabled', 'disabled');
        }
        else if (value == 2) {
            document.getElementById('inputJukeboxQueueLength').setAttribute('disabled', 'disabled');
            document.getElementById('selectJukeboxPlaylist').setAttribute('disabled', 'disabled');
            document.getElementById('selectJukeboxPlaylist').value = 'Database';
        }
        else if (value == 1) {
            document.getElementById('inputJukeboxQueueLength').removeAttribute('disabled');
            document.getElementById('selectJukeboxPlaylist').removeAttribute('disabled');
        }
    });
    
    document.getElementById('selectAddToQueueMode').addEventListener('change', function () {
        let value = this.options[this.selectedIndex].value;
        if (value == 2) {
            document.getElementById('inputAddToQueueQuantity').setAttribute('disabled', 'disabled');
            document.getElementById('selectAddToQueuePlaylist').setAttribute('disabled', 'disabled');
            document.getElementById('selectAddToQueuePlaylist').value = 'Database';
        }
        else if (value == 1) {
            document.getElementById('inputAddToQueueQuantity').removeAttribute('disabled');
            document.getElementById('selectAddToQueuePlaylist').removeAttribute('disabled');
        }
    });

    document.getElementById('addToPlaylistPlaylist').addEventListener('change', function () {
        if (this.options[this.selectedIndex].value == 'new') {
            document.getElementById('addToPlaylistNewPlaylistDiv').classList.remove('hide');
            document.getElementById('addToPlaylistNewPlaylist').focus();
        }
        else {
            document.getElementById('addToPlaylistNewPlaylistDiv').classList.add('hide');
        }
    }, false);
    
    document.getElementById('selectMusicDirectory').addEventListener('change', function () {
        if (this.options[this.selectedIndex].value == 'auto') {
            document.getElementById('inputMusicDirectory').value = settings.musicDirectoryValue;
            document.getElementById('inputMusicDirectory').setAttribute('readonly', 'readonly');
        }
        else if (this.options[this.selectedIndex].value == 'none') {
            document.getElementById('inputMusicDirectory').value = '';
            document.getElementById('inputMusicDirectory').setAttribute('readonly', 'readonly');
        }
        else {
            document.getElementById('inputMusicDirectory').value = '';
            document.getElementById('inputMusicDirectory').removeAttribute('readonly');
        }
    }, false);
    
    addFilterLetter('BrowseFilesystemFilterLetters');
    addFilterLetter('BrowseDatabaseFilterLetters');
    addFilterLetter('BrowsePlaylistsFilterLetters');

    document.getElementById('syscmds').addEventListener('click', function(event) {
        if (event.target.nodeName == 'A') {
            parseCmd(event, event.target.getAttribute('data-href'));
        }
    }, false);

    let hrefs = document.querySelectorAll('[data-href]');
    let hrefsLen = hrefs.length;
    for (let i = 0; i < hrefsLen; i++) {
        hrefs[i].classList.add('clickable');
        let parentInit = hrefs[i].parentNode.classList.contains('noInitChilds') ? true : false;
        if (parentInit == true) {
            //handler on parentnode
            continue;
        }
        hrefs[i].addEventListener('click', function(event) {
            parseCmd(event, this.getAttribute('data-href'));
        }, false);
    }

    let pd = document.getElementsByClassName('pages');
    let pdLen = pd.length;
    for (let i = 0; i < pdLen; i++) {
        pd[i].addEventListener('click', function(event) {
            if (event.target.nodeName == 'BUTTON') {
                gotoPage(event.target.getAttribute('data-page'));
            }
        }, false);
    }

    document.getElementById('cardPlaybackTags').addEventListener('click', function(event) {
        if (event.target.nodeName == 'H4') 
            gotoBrowse(event.target);
    }, false);

    document.getElementById('BrowseBreadcrumb').addEventListener('click', function(event) {
        if (event.target.nodeName == 'A') {
            event.preventDefault();
            appGoto('Browse', 'Filesystem', undefined, '0/' + app.current.filter + '/' + app.current.sort + '/' + decodeURI(event.target.getAttribute('data-uri')));
        }
    }, false);
    
    document.getElementById('modalSongDetails').getElementsByTagName('tbody')[0].addEventListener('click', function(event) {
        if (event.target.nodeName == 'A') {
            if (event.target.id == 'calcFingerprint') {
                sendAPI({"cmd": "MPD_API_DATABASE_FINGERPRINT", "data": {"uri": decodeURI(event.target.getAttribute('data-uri'))}}, parseFingerprint);
                event.preventDefault();
                let parent = event.target.parentNode;
                let spinner = document.createElement('div');
                spinner.classList.add('spinner-border', 'spinner-border-sm');
                event.target.classList.add('hide');
                parent.appendChild(spinner);
            }
            else if (event.target.parentNode.getAttribute('data-tag') != undefined) {
                modalSongDetails.hide();
                event.preventDefault();
                gotoBrowse(event.target);
            } 
        }
        else if (event.target.nodeName == 'BUTTON') { 
            if (event.target.getAttribute('data-href')) {
                parseCmd(event, event.target.getAttribute('data-href'));
            }
        }
    }, false);

    document.getElementById('outputs').addEventListener('click', function(event) {
        if (event.target.nodeName == 'BUTTON') {
            event.stopPropagation();
            sendAPI({"cmd": "MPD_API_PLAYER_TOGGLE_OUTPUT", "data": {"output": event.target.getAttribute('data-output-id'), "state": (event.target.classList.contains('active') ? 0 : 1)}});
            toggleBtn(event.target.id);
        }
    }, false);
    
    document.getElementById('QueueCurrentList').addEventListener('click', function(event) {
        if (event.target.nodeName == 'TD') {
            sendAPI({"cmd": "MPD_API_PLAYER_PLAY_TRACK","data": {"track": event.target.parentNode.getAttribute('data-trackid')}});
        }
        else if (event.target.nodeName == 'A') {
            showMenu(event.target, event);
        }
    }, false);
    
    document.getElementById('QueueLastPlayedList').addEventListener('click', function(event) {
        if (event.target.nodeName == 'A') {
            showMenu(event.target, event);
        }
    }, false);    

    document.getElementById('BrowseFilesystemList').addEventListener('click', function(event) {
        if (event.target.nodeName == 'TD') {
            switch(event.target.parentNode.getAttribute('data-type')) {
                case 'parentDir':
                case 'dir':
                    appGoto('Browse', 'Filesystem', undefined, '0/' + app.current.filter + '/' + app.current.sort + '/' + decodeURI(event.target.parentNode.getAttribute("data-uri")));
                    break;
                case 'song':
                    appendQueue('song', decodeURI(event.target.parentNode.getAttribute("data-uri")), event.target.parentNode.getAttribute("data-name"));
                    break;
                case 'plist':
                    appendQueue('plist', decodeURI(event.target.parentNode.getAttribute("data-uri")), event.target.parentNode.getAttribute("data-name"));
                    break;
            }
        }
        else if (event.target.nodeName == 'A') {
            showMenu(event.target, event);
        }
    }, false);

    document.getElementById('BrowseFilesystemBookmarks').addEventListener('click', function(event) {
        if (event.target.nodeName == 'A') {
            let id = event.target.parentNode.parentNode.getAttribute('data-id');
            let type = event.target.parentNode.parentNode.getAttribute('data-type');
            let uri = decodeURI(event.target.parentNode.parentNode.getAttribute('data-uri'));
            let name = event.target.parentNode.parentNode.firstChild.innerText;
            let href = event.target.getAttribute('data-href');
            
            if (href == 'delete') {
                sendAPI({"cmd": "MYMPD_API_BOOKMARK_RM", "data": {"id": id}}, function() {
                    sendAPI({"cmd": "MYMPD_API_BOOKMARK_LIST", "data": {"offset": 0}}, parseBookmarks);
                });
                event.preventDefault();
                event.stopPropagation();
            }
            else if (href == 'edit') {
                showBookmarkSave(id, name, uri, type);
            }
            else if (href == 'goto') {
                appGoto('Browse', 'Filesystem', null, '0/-/-/' + uri );
            }
        }
    }, false);

    document.getElementById('BrowsePlaylistsAllList').addEventListener('click', function(event) {
        if (event.target.nodeName == 'TD') {
            appendQueue('plist', decodeURI(event.target.parentNode.getAttribute("data-uri")), event.target.parentNode.getAttribute("data-name"));
        }
        else if (event.target.nodeName == 'A') {
            showMenu(event.target, event);
        }
    }, false);

    document.getElementById('BrowsePlaylistsDetailList').addEventListener('click', function(event) {
        if (event.target.nodeName == 'TD') {
            appendQueue('plist', decodeURI(event.target.parentNode.getAttribute("data-uri")), event.target.parentNode.getAttribute("data-name"));
        }
        else if (event.target.nodeName == 'A') {
            showMenu(event.target, event);
        }
    }, false);    
    
    document.getElementById('BrowseDatabaseTagList').addEventListener('click', function(event) {
        if (event.target.nodeName == 'TD') {
            appGoto('Browse', 'Database', app.current.view, '0/-/-/' + event.target.parentNode.getAttribute('data-uri'));
        }
    }, false);
    
    document.getElementById('SearchList').addEventListener('click', function(event) {
        if (event.target.nodeName == 'TD') {
            appendQueue('song', decodeURI(event.target.parentNode.getAttribute("data-uri")), event.target.parentNode.getAttribute("data-name"));
        }
        else if (event.target.nodeName == 'A') {
            showMenu(event.target, event);
        }
    }, false);

    document.getElementById('BrowseFilesystemAddAllSongsDropdown').addEventListener('click', function(event) {
        if (event.target.nodeName == 'BUTTON') {
            if (event.target.getAttribute('data-phrase') == 'Add all to queue') {
                addAllFromBrowseFilesystem();
            }
            else if (event.target.getAttribute('data-phrase') == 'Add all to playlist') {
                showAddToPlaylist(app.current.search);                
            }
        }
    }, false);

    document.getElementById('searchAddAllSongsDropdown').addEventListener('click', function(event) {
        if (event.target.nodeName == 'BUTTON') {
            if (event.target.getAttribute('data-phrase') == 'Add all to queue') {
                addAllFromSearchPlist('queue');
            }
            else if (event.target.getAttribute('data-phrase') == 'Add all to playlist') {
                showAddToPlaylist('SEARCH');                
            }
            else if (event.target.getAttribute('data-phrase') == 'Save as smart playlist') {
                saveSearchAsSmartPlaylist();
            }
        }
    }, false);
    
    document.getElementById('BrowseDatabaseAddAllSongsDropdown').addEventListener('click', function(event) {
        if (event.target.nodeName == 'BUTTON') {
            if (event.target.getAttribute('data-phrase') == 'Add all to queue') {
                addAllFromBrowseDatabasePlist('queue');
            }
            else if (event.target.getAttribute('data-phrase') == 'Add all to playlist') {
                showAddToPlaylist('DATABASE');
            }
        }
    }, false);

    document.getElementById('searchtags').addEventListener('click', function(event) {
        if (event.target.nodeName == 'BUTTON') {
            app.current.filter = event.target.getAttribute('data-tag');
            search(domCache.searchstr.value);
        }
    }, false);

    document.getElementById('searchqueuestr').addEventListener('keyup', function(event) {
        if (event.key == 'Escape')
            this.blur();
        else
            appGoto(app.current.app, app.current.tab, app.current.view, '0/' + app.current.filter + '/' + app.current.sort + '/' + this.value);
    }, false);

    document.getElementById('searchqueuetags').addEventListener('click', function(event) {
        if (event.target.nodeName == 'BUTTON')
            appGoto(app.current.app, app.current.tab, app.current.view, app.current.page + '/' + event.target.getAttribute('data-tag') + '/' + app.current.sort  + '/' + app.current.search);
    }, false);

    let dropdowns = ['QueueCurrentColsDropdown', 'BrowseFilesystemColsDropdown', 'SearchColsDropdown', 'BrowsePlaylistsDetailColsDropdown', 
        'BrowseDatabaseColsDropdown', 'PlaybackColsDropdown', 'QueueLastPlayedColsDropdown'];
    for (let i = 0; i < dropdowns.length; i++) {
        document.getElementById(dropdowns[i]).addEventListener('click', function(event) {
            if (event.target.nodeName == 'INPUT')
                event.stopPropagation();
        }, false);
    }
    
    document.getElementById('search').addEventListener('submit', function() {
        return false;
    }, false);

    document.getElementById('searchqueue').addEventListener('submit', function() {
        return false;
    }, false);

    domCache.searchstr.addEventListener('keyup', function(event) {
        if (event.key == 'Escape')
            this.blur();
        else if (event.key == 'Enter' && settings.featAdvsearch) {
            if (this.value != '') {
                let match = document.getElementById('searchMatch');
                let li = document.createElement('button');
                li.classList.add('btn', 'btn-light', 'mr-2');
                li.setAttribute('data-filter', encodeURI(app.current.filter + ' ' + match.options[match.selectedIndex].value +' \'' + this.value + '\''));
                li.innerHTML = app.current.filter + ' ' + match.options[match.selectedIndex].value + ' \'' + e(this.value) + '\'<span class="ml-2 badge badge-secondary">&times;</span>';
                this.value = '';
                domCache.searchCrumb.appendChild(li);
            }
            else
                search(this.value);
        }
        else
            search(this.value);
    }, false);

    domCache.searchCrumb.addEventListener('click', function(event) {
        event.preventDefault();
        event.stopPropagation();
        if (event.target.nodeName == 'SPAN') {
            event.target.parentNode.remove();
            search('');
        }
        else if (event.target.nodeName == 'BUTTON') {
            let value = decodeURI(event.target.getAttribute('data-filter'));
            domCache.searchstr.value = value.substring(value.indexOf('\'') + 1, value.length - 1);
            let filter = value.substring(0, value.indexOf(' '));
            selectTag('searchtags', 'searchtagsdesc', filter);
            let match = value.substring(value.indexOf(' ') + 1);
            match = match.substring(0, match.indexOf(' '));
            document.getElementById('searchMatch').value = match;
            event.target.remove();
            search(domCache.searchstr.value);
        }
    }, false);

    document.getElementById('searchMatch').addEventListener('change', function() {
        search(domCache.searchstr.value);
    }, false);
    
    document.getElementById('SearchList').getElementsByTagName('tr')[0].addEventListener('click', function(event) {
        if (settings.featAdvsearch) {
            if (event.target.nodeName == 'TH') {
                let col = event.target.getAttribute('data-col');
                if (col == 'Duration') {
                    return;
                }
                let sortcol = app.current.sort;
                let sortdesc = true;
                
                if (sortcol == col || sortcol == '-' + col) {
                    if (sortcol.indexOf('-') == 0) {
                        sortdesc = true;
                        col = sortcol.substring(1);
                    }
                    else {
                        sortdesc = false;
                    }
                }
                if (sortdesc == false) {
                    sortcol = '-' + col;
                    sortdesc = true;
                }
                else {
                    sortdesc = false;
                    sortcol = col;
                }
                
                let s = document.getElementById('SearchList').getElementsByClassName('sort-dir');
                for (let i = 0; i < s.length; i++) {
                    s[i].remove();
                }
                app.current.sort = sortcol;
                event.target.innerHTML = col + '<span class="sort-dir material-icons pull-right">' + (sortdesc == true ? 'arrow_drop_up' : 'arrow_drop_down') + '</span>';
                appGoto(app.current.app, app.current.tab, app.current.view, app.current.page + '/' + app.current.filter + '/' + app.current.sort + '/' + app.current.search);
            }
        }
    }, false);

    document.getElementById('BrowseDatabaseByTagDropdown').addEventListener('click', function(event) {
        if (event.target.nodeName == 'BUTTON') {
            appGoto(app.current.app, app.current.tab, event.target.getAttribute('data-tag') , '0/' + app.current.filter + '/' + app.current.sort + '/' + app.current.search);
        }
    }, false);

    document.getElementsByTagName('body')[0].addEventListener('click', function() {
        hideMenu();
    }, false);

    dragAndDropTable('QueueCurrentList');
    dragAndDropTable('BrowsePlaylistsDetailList');
    dragAndDropTableHeader('QueueCurrent');
    dragAndDropTableHeader('QueueLastPlayed');
    dragAndDropTableHeader('Search');
    dragAndDropTableHeader('BrowseFilesystem');
    dragAndDropTableHeader('BrowsePlaylistsDetail');

    window.addEventListener('hashchange', appRoute, false);

    window.addEventListener('focus', function() {
        sendAPI({"cmd": "MPD_API_PLAYER_STATE"}, parseState);
    }, false);


    document.addEventListener('keydown', function(event) {
        if (event.target.tagName == 'INPUT' || event.target.tagName == 'SELECT' ||
            event.ctrlKey || event.altKey)
            return;
        let cmd = keymap[event.key];
        if (cmd && typeof window[cmd.cmd] === 'function') {
            if (keymap[event.key].req == undefined || settings[keymap[event.key].req] == true)
                parseCmd(event, cmd);
        }        
        
    }, false);
    

    let tables = document.getElementsByTagName('table');
    for (let i = 0; i < tables.length; i++) {
        tables[i].setAttribute('tabindex', 0);
        tables[i].addEventListener('keydown', function(event) {
            navigateTable(this, event.key);
        }, false);
    }
    
    window.addEventListener('beforeinstallprompt', function(event) {
        // Prevent Chrome 67 and earlier from automatically showing the prompt
        event.preventDefault();
        // Stash the event so it can be triggered later.
        deferredPrompt = event;
    });
    
    window.addEventListener('beforeinstallprompt', function(event) {
        event.preventDefault();
        deferredPrompt = event;
        // Update UI notify the user they can add to home screen
        domCache.btnAdd.classList.remove('hide');
    });
    
    domCache.btnAdd.addEventListener('click', function() {
        // Hide our user interface that shows our A2HS button
        domCache.btnAdd.classList.add('hide');
        // Show the prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                logVerbose('User accepted the A2HS prompt');
            }
            else {
                logVerbose('User dismissed the A2HS prompt');
            }
            deferredPrompt = null;
        });
    });
    
    window.addEventListener('appinstalled', function() {
        logInfo('myMPD installed as app');
        showNotification(t('myMPD installed as app'), '', '', 'success');
    });

    window.addEventListener('beforeunload', function() {
        if (websocketTimer != null) {
            clearTimeout(websocketTimer);
            websocketTimer = null;
        }
        socket.onclose = function () {}; // disable onclose handler first
        if (socket != null) {
            socket.close();
            socket = null;
        }
        websocketConnected = false;
    });
    
    document.getElementById('localPlayer').addEventListener('canplay', function() {
        document.getElementById('alertLocalPlayback').classList.add('hide');
        if (settings.featLocalplayer == true && settings.localplayerAutoplay == true) {
            localplayerPlay();
        }
    });
}

async function localplayerPlay() {
    let localPlayer = document.getElementById('localPlayer');
    if (localPlayer.paused) {
        try {
            await localPlayer.play();
        } 
        catch(err) {
            showNotification(t('Local playback'), t('Can not start playing'), '', 'error');
        }
    }
}

function focusTable(rownr, table) {
    if (table == null) {
        table = document.getElementById(app.current.app + (app.current.tab != null ? app.current.tab : '') + (app.current.view != null ? app.current.view : '') + 'List');
        //support for BrowseDatabaseAlbum list
        if (table == null) {
            table = document.getElementById(app.current.app + app.current.tab + 'TagList');
        }
        //support for BrowseDatabaseAlbum cards
        if (app.current.app == 'Browse' && app.current.tab == 'Database' && 
            !document.getElementById('BrowseDatabaseAlbumList').classList.contains('hide'))
        {
            table = document.getElementById('BrowseDatabaseAlbumList').getElementsByTagName('table')[0];
        }
    }

    if (table != null) {
        let sel = table.getElementsByClassName('selected');
        if (rownr == undefined) {
            if (sel.length == 0) {
                let row = table.getElementsByTagName('tbody')[0].rows[0];
                row.focus();
                row.classList.add('selected');
            }
            else {
                sel[0].focus();
            }
        }
        else {
            if (sel && sel.length > 0) {
                sel[0].classList.remove('selected');
            }
            let rows = table.getElementsByTagName('tbody')[0].rows;
            let rowsLen = rows.length;
            if (rowsLen < rownr) {
                rownr = 0;
            }
            if (rowsLen > rownr) {
                rows[rownr].focus();
                rows[rownr].classList.add('selected');
            }
        }
        //insert goto parent row
        if (table.id == 'BrowseFilesystemList') {
            let tbody = table.getElementsByTagName('tbody')[0];
            if (tbody.rows[0].getAttribute('data-type') != 'parentDir' && app.current.search != '') {
                let nrCells = table.getElementsByTagName('thead')[0].rows[0].cells.length;
                let uri = app.current.search.replace(/\/?([^/]+)$/,'');
                let row = tbody.insertRow(0);
                row.setAttribute('data-type', 'parentDir');
                row.setAttribute('tabindex', 0);
                row.setAttribute('data-uri', encodeURI(uri));
                row.innerHTML = '<td colspan="' + nrCells + '">..</td>';
            }
        }
        scrollFocusIntoView();
    }
}

function scrollFocusIntoView() {
    let el = document.activeElement;
    let posY = el.getBoundingClientRect().top;
    let height = el.offsetHeight;
    
    if (posY < 74) {
        window.scrollBy(0, - 74);
    }
    else if (posY + height > window.innerHeight - 74) {
        window.scrollBy(0, 74);
    }
}

function navigateTable(table, keyCode) {
    let cur = document.activeElement;
    if (cur) {
        let next = null;
        let handled = false;
        if (keyCode == 'ArrowDown') {
            next = cur.nextElementSibling;
            handled = true;
        }
        else if (keyCode == 'ArrowUp') {
            next = cur.previousElementSibling;
            handled = true;
        }
        else if (keyCode == ' ') {
            let popupBtn = cur.lastChild.firstChild;
            if (popupBtn.nodeName == 'A') {
                popupBtn.click();
            }
            handled = true;
        }
        else if (keyCode == 'Enter') {
            cur.firstChild.click();
            handled = true;
        }
        else if (keyCode == 'Escape') {
            cur.blur();
            cur.classList.remove('selected');
            handled = true;
        }
        //only for BrowseDatabaseAlbum cards
        else if (app.current.app == 'Browse' && app.current.tab == 'Database' && 
                 !document.getElementById('BrowseDatabaseAlbumList').classList.contains('hide') &&
                 (keyCode == 'n' || keyCode == 'p')) {
            let tablesHtml = document.getElementById('BrowseDatabaseAlbumList').getElementsByTagName('table');
            let tables = Array.prototype.slice.call(tablesHtml);
            let idx = document.activeElement.nodeName == 'TR' ? tables.indexOf(document.activeElement.parentNode.parentNode)
                                                              : tables.indexOf(document.activeElement);
            idx = event.key == 'p' ? (idx > 1 ? idx - 1 : 0)
                                   : event.key == 'n' ? ( idx < tables.length - 1 ? ( document.activeElement.nodeName == 'TR' ? idx + 1 : idx )
                                                                                  : idx)
                                                      : idx;
            
            if (tables[idx].getElementsByTagName('tbody')[0].rows.length > 0) {
                next = tables[idx].getElementsByTagName('tbody')[0].rows[0];
            }
            else {
                //Titlelist not loaded yet, scroll table into view
                tables[idx].focus();
                scrollFocusIntoView();
            }
            handled = true;
        }
        if (handled == true) {
            event.preventDefault();
            event.stopPropagation();
        }
        if (next) {
            cur.classList.remove('selected');
            next.classList.add('selected');
            next.focus();
            scrollFocusIntoView();
        }
    }
}

function parseCmd(event, href) {
    event.preventDefault();
    let cmd = href;
    if (typeof(href) == 'string') {
        cmd = JSON.parse(href);
    }
        
    if (typeof window[cmd.cmd] === 'function') {
        switch(cmd.cmd) {
            case 'sendAPI':
                sendAPI(... cmd.options); 
                break;
            default:
                window[cmd.cmd](... cmd.options);                    
        }
    }
}

function search(x) {
    if (settings.featAdvsearch) {
        let expression = '(';
        let crumbs = domCache.searchCrumb.children;
        for (let i = 0; i < crumbs.length; i++) {
            expression += '(' + decodeURI(crumbs[i].getAttribute('data-filter')) + ')';
            if (x != '') expression += ' AND ';
        }
        if (x != '') {
            let match = document.getElementById('searchMatch');
            expression += '(' + app.current.filter + ' ' + match.options[match.selectedIndex].value + ' \'' + x +'\'))';
        }
        else
            expression += ')';
        if (expression.length <= 2)
            expression = '';
        appGoto('Search', undefined, undefined, '0/' + app.current.filter + '/' + app.current.sort + '/' + encodeURI(expression));
    }
    else
        appGoto('Search', undefined, undefined, '0/' + app.current.filter + '/' + app.current.sort + '/' + x);
}

function dragAndDropTable(table) {
    let tableBody=document.getElementById(table).getElementsByTagName('tbody')[0];
    tableBody.addEventListener('dragstart', function(event) {
        if (event.target.nodeName == 'TR') {
            event.target.classList.add('opacity05');
            event.dataTransfer.setDragImage(event.target, 0, 0);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('Text', event.target.getAttribute('id'));
            dragEl = event.target.cloneNode(true);
        }
    }, false);
    tableBody.addEventListener('dragleave', function(event) {
        event.preventDefault();
        if (dragEl.nodeName != 'TR')
            return;
        let target = event.target;
        if (event.target.nodeName == 'TD')
            target = event.target.parentNode;
        if (target.nodeName == 'TR')
            target.classList.remove('dragover');
    }, false);
    tableBody.addEventListener('dragover', function(event) {
        event.preventDefault();
        if (dragEl.nodeName != 'TR')
            return;
        let tr = tableBody.getElementsByClassName('dragover');
        let trLen = tr.length;
        for (let i = 0; i < trLen; i++) {
            tr[i].classList.remove('dragover');
        }
        let target = event.target;
        if (event.target.nodeName == 'TD')
            target = event.target.parentNode;
        if (target.nodeName == 'TR')
            target.classList.add('dragover');
        event.dataTransfer.dropEffect = 'move';
    }, false);
    tableBody.addEventListener('dragend', function(event) {
        event.preventDefault();
        if (dragEl.nodeName != 'TR')
            return;
        let tr = tableBody.getElementsByClassName('dragover');
        let trLen = tr.length;
        for (let i = 0; i < trLen; i++) {
            tr[i].classList.remove('dragover');
        }
        if (document.getElementById(event.dataTransfer.getData('Text')))
            document.getElementById(event.dataTransfer.getData('Text')).classList.remove('opacity05');
    }, false);
    tableBody.addEventListener('drop', function(event) {
        event.stopPropagation();
        event.preventDefault();
        if (dragEl.nodeName != 'TR')
            return;
        let target = event.target;
        if (event.target.nodeName == 'TD')
            target = event.target.parentNode;
        let oldSongpos = document.getElementById(event.dataTransfer.getData('Text')).getAttribute('data-songpos');
        let newSongpos = target.getAttribute('data-songpos');
        document.getElementById(event.dataTransfer.getData('Text')).remove();
        dragEl.classList.remove('opacity05');
        tableBody.insertBefore(dragEl, target);
        let tr = tableBody.getElementsByClassName('dragover');
        let trLen = tr.length;
        for (let i = 0; i < trLen; i++) {
            tr[i].classList.remove('dragover');
        }
        document.getElementById(table).classList.add('opacity05');
        if (app.current.app == 'Queue' && app.current.tab == 'Current') {
            sendAPI({"cmd": "MPD_API_QUEUE_MOVE_TRACK","data": {"from": oldSongpos, "to": newSongpos}});
        }
        else if (app.current.app == 'Browse' && app.current.tab == 'Playlists' && app.current.view == 'Detail') {
            playlistMoveTrack(oldSongpos, newSongpos);
        }
    }, false);
}

function dragAndDropTableHeader(table) {
    let tableHeader;
    if (document.getElementById(table + 'List')) {
        tableHeader = document.getElementById(table + 'List').getElementsByTagName('tr')[0];
    }
    else {
        tableHeader = table.getElementsByTagName('tr')[0];
        table = 'BrowseDatabase';
    }

    tableHeader.addEventListener('dragstart', function(event) {
        if (event.target.nodeName == 'TH') {
            event.target.classList.add('opacity05');
            event.dataTransfer.setDragImage(event.target, 0, 0);
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('Text', event.target.getAttribute('data-col'));
            dragEl = event.target.cloneNode(true);
        }
    }, false);
    tableHeader.addEventListener('dragleave', function(event) {
        event.preventDefault();
        if (dragEl.nodeName != 'TH')
            return;
        if (event.target.nodeName == 'TH')
            event.target.classList.remove('dragover-th');
    }, false);
    tableHeader.addEventListener('dragover', function(event) {
        event.preventDefault();
        if (dragEl.nodeName != 'TH') {
            return;
        }
        let th = tableHeader.getElementsByClassName('dragover-th');
        let thLen = th.length;
        for (let i = 0; i < thLen; i++) {
            th[i].classList.remove('dragover-th');
        }
        if (event.target.nodeName == 'TH')
            event.target.classList.add('dragover-th');
        event.dataTransfer.dropEffect = 'move';
    }, false);
    tableHeader.addEventListener('dragend', function(event) {
        event.preventDefault();
        if (dragEl.nodeName != 'TH') {
            return;
        }
        let th = tableHeader.getElementsByClassName('dragover-th');
        let thLen = th.length;
        for (let i = 0; i < thLen; i++) {
            th[i].classList.remove('dragover-th');
        }
        if (this.querySelector('[data-col=' + event.dataTransfer.getData('Text') + ']'))
            this.querySelector('[data-col=' + event.dataTransfer.getData('Text') + ']').classList.remove('opacity05');
    }, false);
    tableHeader.addEventListener('drop', function(event) {
        event.stopPropagation();
        event.preventDefault();
        if (dragEl.nodeName != 'TH')
            return;
        this.querySelector('[data-col=' + event.dataTransfer.getData('Text') + ']').remove();
        dragEl.classList.remove('opacity05');
        tableHeader.insertBefore(dragEl, event.target);
        let th = tableHeader.getElementsByClassName('dragover-th');
        let thLen = th.length;
        for (let i = 0; i < thLen; i++) {
            th[i].classList.remove('dragover-th');
        }
        if (document.getElementById(table + 'List')) {
            document.getElementById(table + 'List').classList.add('opacity05');
            saveCols(table);
        }
        else {
            saveCols(table, this.parentNode.parentNode);
        }
    }, false);
}

function playlistMoveTrack(from, to) {
    sendAPI({"cmd": "MPD_API_PLAYLIST_MOVE_TRACK","data": { "plist": app.current.search, "from": from, "to": to}});
}

function setElsState(tag, state) {
    let els = document.getElementsByTagName(tag);
    let elsLen = els.length;
    for (let i = 0; i< elsLen; i++) {
        if (state == 'disabled') {
            if (!els[i].classList.contains('alwaysEnabled')) {
                if (els[i].getAttribute('disabled')) {
                    els[i].setAttribute('disabled', 'disabled');
                    els[i].classList.add('disabled');
                }
            }
        }
        else {
            if (els[i].classList.contains('disabled')) {
                els[i].removeAttribute('disabled');
                els[i].classList.remove('disabled');
            }
        }
    }
}

function toggleUI() {
    let state = 'disabled';
    if (websocketConnected == true && settings.mpdConnected == true) {
        state = 'enabled';
    }
    let enabled = state == 'disabled' ? false : true;
    if (enabled != uiEnabled) {
        setElsState('a', state);
        setElsState('input', state);
        setElsState('button', state);
        uiEnabled = enabled;
    }
    if (settings.mpdConnected == true) {
        toggleAlert('alertMpdState', false, '');
    }
    else {
        toggleAlert('alertMpdState', true, t('MPD disconnected'));
    }
    if (websocketConnected == true) {
        toggleAlert('alertMympdState', false, '');
    }
    else {
        toggleAlert('alertMympdState', true, t('Websocket connection failed'));
    }
}

function webSocketConnect() {
    if (socket != null) {
        logInfo("Socket already connected");
        return;
    }
    let wsUrl = getWsUrl();
    socket = new WebSocket(wsUrl);
    logInfo('Connecting to ' + wsUrl);

    try {
        socket.onopen = function() {
            logInfo('Websocket is connected');
            websocketConnected = true;
            if (websocketTimer != null) {
                clearTimeout(websocketTimer);
                websocketTimer = null;
            }
        }

        socket.onmessage = function got_packet(msg) {
            try {
                var obj = JSON.parse(msg.data);
                logDebug('Websocket notification: ' + obj.type);
            } catch(e) {
                logError('Invalid JSON data received: ' + msg.data);
            }

            switch (obj.type) {
                case 'welcome':
                    websocketConnected = true;
                    showNotification(t('Connected to myMPD') + ': ' + wsUrl, '', '', 'success');
                    appRoute();
                    sendAPI({"cmd": "MPD_API_PLAYER_STATE"}, parseState, true);
                    break;
                case 'update_state':
                    parseState(obj);
                    break;
                case 'mpd_disconnected':
                    if (progressTimer) {
                        clearTimeout(progressTimer);
                    }
                    getSettings(true);
                    break;
                case 'mpd_connected':
                    showNotification(t('Connected to MPD'), '', '', 'success');
                    sendAPI({"cmd": "MPD_API_PLAYER_STATE"}, parseState);
                    getSettings(true);
                    break;
                case 'update_queue':
                    if (app.current.app === 'Queue') {
                        getQueue();
                    }
                    parseUpdateQueue(obj);
                    break;
                case 'update_options':
                    getSettings();
                    break;
                case 'update_outputs':
                    sendAPI({"cmd": "MPD_API_PLAYER_OUTPUT_LIST"}, parseOutputs);
                    break;
                case 'update_started':
                    updateDBstarted(false);
                    break;
                case 'update_database':
                case 'update_finished':
                    updateDBfinished(obj.type);
                    break;
                case 'update_volume':
                    parseVolume(obj);
                    break;
                case 'update_stored_playlist':
                    if (app.current.app == 'Browse' && app.current.tab == 'Playlists' && app.current.view == 'All') {
                        sendAPI({"cmd": "MPD_API_PLAYLIST_LIST","data": {"offset": app.current.page, "filter": app.current.filter}}, parsePlaylists);
                    }
                    else if (app.current.app == 'Browse' && app.current.tab == 'Playlists' && app.current.view == 'Detail') {
                        sendAPI({"cmd": "MPD_API_PLAYLIST_CONTENT_LIST", "data": {"offset": app.current.page, "filter": app.current.filter, "uri": app.current.search, "cols": settings.colsBrowsePlaylistsDetail}}, parsePlaylists);
                    }
                    break;
                case 'update_lastplayed':
                    if (app.current.app == 'Queue' && app.current.tab == 'LastPlayed') {
                        sendAPI({"cmd": "MPD_API_QUEUE_LAST_PLAYED", "data": {"offset": app.current.page, "cols": settings.colsQueueLastPlayed}}, parseLastPlayed);
                    }
                    break;
                case 'error':
                    if (document.getElementById('alertMpdState').classList.contains('hide')) {
                        showNotification(t(obj.data), '', '', 'danger');
                    }
                    break;
                default:
                    break;
            }
        }

        socket.onclose = function(){
            logError('Websocket is disconnected');
            websocketConnected = false;
            if (appInited == true) {
                toggleUI();
                if (progressTimer) {
                    clearTimeout(progressTimer);
                }
            }
            else {
                showAppInitAlert(t('Websocket connection failed'));
                logError('Websocket connection failed.');
            }
            if (websocketTimer != null) {
                clearTimeout(websocketTimer);
                websocketTimer = null;
            }
            websocketTimer = setTimeout(function() {
                logInfo('Reconnecting websocket');
                toggleAlert('alertMympdState', true, t('Websocket connection failed, trying to reconnect') + '&nbsp;&nbsp;<div class="spinner-border spinner-border-sm"></div>');
                webSocketConnect();
            }, 3000);
            socket = null;
        }

    } catch(exception) {
        logError(exception);
    }
}

function getWsUrl() {
    let hostname = window.location.hostname;
    let protocol = window.location.protocol;
    let port = window.location.port;
    
    if (protocol == 'https:') {
        protocol = 'wss://';
    }
    else {
        protocol = 'ws://';
    }

    let wsUrl = protocol + hostname + (port != '' ? ':' + port : '') + subdir + '/ws/';
    return wsUrl;
}

function parseStats(obj) {
    document.getElementById('mpdstats_artists').innerText =  obj.data.artists;
    document.getElementById('mpdstats_albums').innerText = obj.data.albums;
    document.getElementById('mpdstats_songs').innerText = obj.data.songs;
    document.getElementById('mpdstats_dbPlaytime').innerText = beautifyDuration(obj.data.dbPlaytime);
    document.getElementById('mpdstats_playtime').innerText = beautifyDuration(obj.data.playtime);
    document.getElementById('mpdstats_uptime').innerText = beautifyDuration(obj.data.uptime);
    document.getElementById('mpdstats_dbUpdated').innerText = localeDate(obj.data.dbUpdated);
    document.getElementById('mympdVersion').innerText = obj.data.mympdVersion;
    document.getElementById('mpdInfo_version').innerText = obj.data.mpdVersion;
    document.getElementById('mpdInfo_libmpdclientVersion').innerText = obj.data.libmpdclientVersion;
}

function toggleBtn(btn, state) {
    let b = document.getElementById(btn);
    if (!b) {
        return;
    }
    if (state == undefined) {
        //toggle state
        state = b.classList.contains('active') ? false : true;
    }
    else if (state == 0 || state == 1) {
        //1 = true, 0 = false
        state = state == 1 ? true : false;
    }

    if (state == true) {
        b.classList.add('active');
    }
    else {
        b.classList.remove('active');
    }
}

function toggleBtnChk(btn, state) {
    let b = document.getElementById(btn);
    if (!b) {
        return;
    }
    if (state == undefined) {
        //toggle state
        state = b.classList.contains('active') ? false : true;
    }
    else if (state == 0 || state == 1) {
        //1 = true, 0 = false
        state = state == 1 ? true : false;
    }

    if (state == true) {
        b.classList.add('active');
        b.innerText = 'check';
    }
    else {
        b.classList.remove('active');
        b.innerText = 'radio_button_unchecked';
    }
}

function filterCols(x) {
    let tags = settings.tags.slice();
    if (settings.featTags == false) {
        tags.push('Title');
    }
    tags.push('Duration');
    if (x == 'colsQueueCurrent' || x == 'colsBrowsePlaylistsDetail' || x == 'colsQueueLastPlayed') {
        tags.push('Pos');
    }
    else if (x == 'colsBrowseFilesystem') {
        tags.push('Type');
    }
    if (x == 'colsQueueLastPlayed') {
        tags.push('LastPlayed');
    }
        
    let cols = [];
    for (let i = 0; i < settings[x].length; i++) {
        if (tags.includes(settings[x][i])) {
            cols.push(settings[x][i]);
        }
    }
    settings[x] = cols;
}

function smartCount(number) {
    if (number == 0) { return 1; }
    else if (number == 1) { return 0; }
    else { return 1; }
}

function t(phrase, number, data) {
    let result = undefined;
    if (isNaN(number)) {
        data = number;
    }
    
    if (phrases[phrase]) {
        result = phrases[phrase][locale];
        if (result == undefined) {
            if (locale != 'en-US') {
                logDebug('Phrase "' + phrase + '" for locale ' + locale + ' not found');
            }
            result = phrases[phrase]['en-US'];
        }
    }
    if (result == undefined) {
        result = phrase;
    }

    if (isNaN(number) == false) {
        let p = result.split(' |||| ');
        if (p.length > 1) {
            result = p[smartCount(number)];
        }
        result = result.replace('%{smart_count}', number);
    }
    
    if (data != null) {
        result = result.replace(/%\{(\w+)\}/g, function(m0, m1) {
            return data[m1];
        });
    }
    
    return result;
}

function i18nHtml(root) {
    let attributes = [['data-phrase', 'innerText'], ['data-title-phrase', 'title'], ['data-placeholder-phrase', 'placeholder']];
    for (let i = 0; i < attributes.length; i++) {
        let els = root.querySelectorAll('[' + attributes[i][0] + ']');
        let elsLen = els.length;
        for (let j = 0; j < elsLen; j++) {
            els[j][attributes[i][1]] = t(els[j].getAttribute(attributes[i][0]));
        }
    }
}

function parseSettings() {
    if (settings.locale == 'default') {
        locale = navigator.language || navigator.userLanguage;
    }
    else {
        locale = settings.locale;
    }

    if (settings.mpdConnected == true) {
        parseMPDSettings();
    }
    
    if (settings.mpdHost.indexOf('/') != 0) {
        document.getElementById('mpdInfo_host').innerText = settings.mpdHost + ':' + settings.mpdPort;
    }
    else {
        document.getElementById('mpdInfo_host').innerText = settings.mpdHost;
    }
    
    document.getElementById('inputMpdHost').value = settings.mpdHost;
    document.getElementById('inputMpdPort').value = settings.mpdPort;
    document.getElementById('inputMpdPass').value = settings.mpdPass;

    let btnNotifyWeb = document.getElementById('btnNotifyWeb');
    if (notificationsSupported()) {
        if (settings.notificationWeb) {
            toggleBtnChk('btnNotifyWeb', settings.notificationWeb);
            Notification.requestPermission(function (permission) {
                if (!('permission' in Notification)) {
                    Notification.permission = permission;
                }
                if (permission === 'granted') {
                    toggleBtnChk('btnNotifyWeb', true);
                } 
                else {
                    toggleBtnChk('btnNotifyWeb', false);
                    settings.notificationWeb = true;
                }
            });         
        }
        else {
            toggleBtnChk('btnNotifyWeb', false);
        }
    }
    else {
        btnNotifyWeb.setAttribute('disabled', 'disabled');
        toggleBtnChk('btnNotifyWeb', false);
    }
    
    toggleBtnChk('btnNotifyPage', settings.notificationPage);
    toggleBtnChk('btnBgCover', settings.bgCover);
    document.getElementById('inputBgColor').value = settings.bgColor;
    document.getElementById('inputBgCssFilter').value = settings.bgCssFilter;
    toggleBtnChk('btnFeatLocalplayer', settings.featLocalplayer);
    toggleBtnChk('btnLocalplayerAutoplay', settings.localplayerAutoplay);
    if (settings.streamUrl == '') {
        document.getElementById('selectStreamMode').value = 'port';
        document.getElementById('inputStreamUrl').value = settings.streamPort;
    }
    else {
        document.getElementById('selectStreamMode').value = 'url';
        document.getElementById('inputStreamUrl').value = settings.streamUrl;
    }
    
    toggleBtnChk('btnCoverimage', settings.coverimage);
    document.getElementById('inputCoverimageName').value = settings.coverimageName;
    document.getElementById('inputCoverimageSize').value = settings.coverimageSize;
    document.getElementById('selectLocale').value = settings.locale;

    document.documentElement.style.setProperty('--mympd-coverimagesize', settings.coverimageSize + "px");
    document.documentElement.style.setProperty('--mympd-backgroundcolor', settings.bgColor);
    document.documentElement.style.setProperty('--mympd-backgroundfilter', settings.bgCssFilter);

    toggleBtnChk('btnLoveEnable', settings.love);
    document.getElementById('inputLoveChannel').value = settings.loveChannel;
    document.getElementById('inputLoveMessage').value = settings.loveMessage;
    
    document.getElementById('inputMaxElementsPerPage').value = settings.maxElementsPerPage;
    toggleBtnChk('btnStickers', settings.stickers);
    document.getElementById('inputLastPlayedCount').value = settings.lastPlayedCount;
    toggleBtnChk('btnSmartpls', settings.smartpls);
    
    
    let features = ["featLocalplayer", "featSyscmds", "featMixramp", "featCacert"];
    for (let j = 0; j < features.length; j++) {
        let Els = document.getElementsByClassName(features[j]);
        let ElsLen = Els.length;
        let displayEl = settings[features[j]] == true ? '' : 'none';
        for (let i = 0; i < ElsLen; i++) {
            Els[i].style.display = displayEl;
        }
    }

    if (settings.featSyscmds) {
        let syscmdsMaxListLen = 4;
        let syscmdsList = '';
        let syscmdsListLen = settings.syscmdList.length;
        if (syscmdsListLen > 0) {
            syscmdsList = syscmdsListLen > syscmdsMaxListLen ? '' : '<div class="dropdown-divider"></div>';
            for (let i = 0; i < syscmdsListLen; i++) {
                if (settings.syscmdList[i] == 'HR') {
                    syscmdsList += '<div class="dropdown-divider"></div>';
                }
                else {
                    syscmdsList += '<a class="dropdown-item text-light bg-dark alwaysEnabled" href="#" data-href=\'{"cmd": "execSyscmd", "options": ["' + 
                        e(settings.syscmdList[i]) + '"]}\'>' + e(settings.syscmdList[i]) + '</a>';
                }
            }
        }
        document.getElementById('syscmds').innerHTML = syscmdsList;
        if (syscmdsListLen > syscmdsMaxListLen) {
            document.getElementById('navSyscmds').classList.remove('hide');
            document.getElementById('syscmds').classList.add('collapse', 'menu-indent');
        }
        else {
            document.getElementById('navSyscmds').classList.add('hide');
            document.getElementById('syscmds').classList.remove('collapse', 'menu-indent');
        }
    }
    else {
        document.getElementById('syscmds').innerHTML = '';
    }

    dropdownMainMenu = new Dropdown(document.getElementById('mainMenu'));
    
    document.getElementById('selectJukeboxMode').value = settings.jukeboxMode;
    document.getElementById('inputJukeboxQueueLength').value = settings.jukeboxQueueLength;
    
    if (settings.jukeboxMode == 0) {
        document.getElementById('inputJukeboxQueueLength').setAttribute('disabled', 'disabled');
        document.getElementById('selectJukeboxPlaylist').setAttribute('disabled', 'disabled');
    }
    else if (settings.jukeboxMode == 2) {
        document.getElementById('inputJukeboxQueueLength').setAttribute('disabled', 'disabled');
        document.getElementById('selectJukeboxPlaylist').setAttribute('disabled', 'disabled');
        document.getElementById('selectJukeboxPlaylist').value = 'Database';
    }
    else if (settings.jukeboxMode == 1) {
        document.getElementById('inputJukeboxQueueLength').removeAttribute('disabled');
        document.getElementById('selectJukeboxPlaylist').removeAttribute('disabled');
    }

    if (settings.featLocalplayer == true) {
        if (settings.streamUrl == '') {
            settings.mpdstream = 'http://';
            if (settings.mpdHost.match(/^127\./) != null || settings.mpdHost == 'localhost' || settings.mpdHost.match(/^\//) != null) {
                settings.mpdstream += window.location.hostname;
            }
            else {
                settings.mpdstream += settings.mpdHost;
            }
            settings.mpdstream += ':' + settings.streamPort + '/';
        } 
        else {
            settings.mpdstream = settings.streamUrl;
        }
        let localPlayer = document.getElementById('localPlayer');
        if (localPlayer.src != settings.mpdstream) {
            localPlayer.pause();
            document.getElementById('alertLocalPlayback').classList.remove('hide');
            localPlayer.src = settings.mpdstream;
            localPlayer.load();
        }
    }
    
    
    if (settings.musicDirectory == 'auto') {
        document.getElementById('selectMusicDirectory').value = settings.musicDirectory;
        document.getElementById('inputMusicDirectory').value = settings.musicDirectoryValue;
        document.getElementById('inputMusicDirectory').setAttribute('readonly', 'readonly');
    }
    else if (settings.musicDirectory == 'none') {
        document.getElementById('selectMusicDirectory').value = settings.musicDirectory;
        document.getElementById('inputMusicDirectory').value = '';
        document.getElementById('inputMusicDirectory').setAttribute('readonly', 'readonly');
    }
    else {
        document.getElementById('selectMusicDirectory').value = 'custom';
        document.getElementById('inputMusicDirectory').value = settings.musicDirectoryValue;
        document.getElementById('inputMusicDirectory').removeAttribute('readonly');
    }

    if (app.current.app == 'Queue' && app.current.tab == 'Current') {
        getQueue();
    }
    else if (app.current.app == 'Queue' && app.current.tab == 'LastPlayed') {
        appRoute();
    }
    else if (app.current.app == 'Search') {
        appRoute();
    }
    else if (app.current.app == 'Browse' && app.current.tab == 'Filesystem') {
        appRoute();
    }
    else if (app.current.app == 'Browse' && app.current.tab == 'Playlists' && app.current.view == 'Detail') {
        appRoute();
    }
    else if (app.current.app == 'Browse' && app.current.tab == 'Database' && app.current.search != '') {
        appRoute();
    }

    i18nHtml(document.getElementsByTagName('body')[0]);

    settingsParsed = 'true';
}

function parseMPDSettings() {
    toggleBtnChk('btnRandom', settings.random);
    toggleBtnChk('btnConsume', settings.consume);
    toggleBtnChk('btnSingle', settings.single);
    toggleBtnChk('btnRepeat', settings.repeat);
    toggleBtnChk('btnAutoPlay', settings.autoPlay);
    
    if (settings.crossfade != undefined) {
        document.getElementById('inputCrossfade').removeAttribute('disabled');
        document.getElementById('inputCrossfade').value = settings.crossfade;
    }
    else {
        document.getElementById('inputCrossfade').setAttribute('disabled', 'disabled');
    }
    if (settings.mixrampdb != undefined) {
        document.getElementById('inputMixrampdb').removeAttribute('disabled');
        document.getElementById('inputMixrampdb').value = settings.mixrampdb;
    }
    else {
        document.getElementById('inputMixrampdb').setAttribute('disabled', 'disabled');
    }
    if (settings.mixrampdelay != undefined) {
        document.getElementById('inputMixrampdelay').removeAttribute('disabled');
        document.getElementById('inputMixrampdelay').value = settings.mixrampdelay;
    }
    else {
        document.getElementById('inputMixrampdelay').setAttribute('disabled', 'disabled');
    }

    document.getElementById('selectReplaygain').value = settings.replaygain;

    let features = ["featStickers", "featSmartpls", "featPlaylists", "featTags", "featCoverimage", "featAdvsearch",
        "featLove"];
    for (let j = 0; j < features.length; j++) {
        let Els = document.getElementsByClassName(features[j]);
        let ElsLen = Els.length;
        let displayEl = settings[features[j]] == true ? '' : 'none';
        if (features[j] == 'featCoverimage' && settings.coverimage == false) {
            displayEl = 'none';
        }
        for (let i = 0; i < ElsLen; i++) {
            Els[i].style.display = displayEl;
        }
    }
    
    if (settings.featPlaylists == false && settings.smartpls == true) {
        document.getElementById('warnSmartpls').classList.remove('hide');
    }
    else {
        document.getElementById('warnSmartpls').classList.add('hide');
    }

    if (settings.featStickers == false && settings.stickers == true) {
        document.getElementById('warnStickers').classList.remove('hide');
    }
    else {
        document.getElementById('warnStickers').classList.add('hide');
    }
    
    if (settings.featLove == false && settings.love == true) {
        document.getElementById('warnScrobbler').classList.remove('hide');
    }
    else {
        document.getElementById('warnScrobbler').classList.add('hide');
    }
    
    if (settings.featLibrary == false && settings.coverimage == true) {
        document.getElementById('warnAlbumart').classList.remove('hide');
    }
    else {
        document.getElementById('warnAlbumart').classList.add('hide');
    }
    if (settings.musicDirectoryValue == '' && settings.musicDirectory != 'none') {
        document.getElementById('warnMusicDirectory').classList.remove('hide');
    }
    else {
        document.getElementById('warnMusicDirectory').classList.add('hide');
    }

    if (settings.bgCover == true && settings.featCoverimage == true && settings.coverimage == true) {
        if (lastSongObj.data && lastSongObj.data.cover.indexOf('coverimage-') > -1 ) {
            clearBackgroundImage();
        }
        else if (lastSongObj.data) {
             setBackgroundImage(lastSongObj.data.cover);
        }
        else {
            clearBackgroundImage();
        }
    }
    else {
        clearBackgroundImage();
    }
    
    if (settings.featTags == false) {
        app.apps.Browse.active = 'Filesystem';
        app.apps.Search.state = '0/filename/-/';
        app.apps.Queue.state = '0/filename/-/';
        settings.colsQueueCurrent = ["Pos", "Title", "Duration"];
        settings.colsQueueLastPlayed = ["Pos", "Title", "LastPlayed"];
        settings.colsSearch = ["Title", "Duration"];
        settings.colsBrowseFilesystem = ["Type", "Title", "Duration"];
        settings.colsBrowseDatabase = ["Track", "Title", "Duration"];
        settings.colsPlayback = [];
    }
    else {
        let pbtl = '';
        for (let i = 0; i < settings.colsPlayback.length; i++) {
            pbtl += '<div id="current' + settings.colsPlayback[i]  + '" data-tag="' + settings.colsPlayback[i] + '" '+
                    'data-name="' + encodeURI((lastSongObj.data ? lastSongObj.data[settings.colsPlayback[i]] : '')) + '">' +
                    '<small>' + t(settings.colsPlayback[i]) + '</small>' +
                    '<h4';
            if (settings.browsetags.includes(settings.colsPlayback[i])) {
                pbtl += ' class="clickable"';
            }
            pbtl += '>' + (lastSongObj.data ? e(lastSongObj.data[settings.colsPlayback[i]]) : '') + '</h4></div>';
        }
        document.getElementById('cardPlaybackTags').innerHTML = pbtl;
    }

    if (!settings.tags.includes('AlbumArtist') && settings.featTags) {
        if (settings.tags.includes('Artist')) {
            app.apps.Browse.tabs.Database.active = 'Artist';
        }
        else {
            app.apps.Browse.tabs.Database.active = settings.tags[0];
        }
    }
    if (settings.tags.includes('Title')) {
        app.apps.Search.state = '0/any/Title/';
    }
    
    if (settings.featPlaylists) {
        playlistEl = 'selectJukeboxPlaylist';
        sendAPI({"cmd": "MPD_API_PLAYLIST_LIST", "data": {"offset": 0, "filter": "-"}}, getAllPlaylists);
    }
    else {
        document.getElementById('selectJukeboxPlaylist').innerHTML = '<option value="Database">' + t('Database') + '</option>';
    }

    settings.tags.sort();
    settings.searchtags.sort();
    settings.browsetags.sort();
    filterCols('colsSearch');
    filterCols('colsQueueCurrent');
    filterCols('colsQueueLastPlayed');
    filterCols('colsBrowsePlaylistsDetail');
    filterCols('colsBrowseFilesystem');
    filterCols('colsBrowseDatabase');
    filterCols('colsPlayback');
    
    setCols('QueueCurrent');
    setCols('Search');
    setCols('QueueLastPlayed');
    setCols('BrowseFilesystem');
    setCols('BrowsePlaylistsDetail');
    setCols('BrowseDatabase', '.tblAlbumTitles');
    setCols('Playback');

    addTagList('BrowseDatabaseByTagDropdown', 'browsetags');
    addTagList('searchqueuetags', 'searchtags');
    addTagList('searchtags', 'searchtags');
    
    for (let i = 0; i < settings.tags.length; i++) {
        app.apps.Browse.tabs.Database.views[settings.tags[i]] = { "state": "0/-/-/", "scrollPos": 0 };
    }
    
    initTagMultiSelect('inputEnabledTags', 'listEnabledTags', settings.allmpdtags, settings.tags);
    initTagMultiSelect('inputSearchTags', 'listSearchTags', settings.tags, settings.searchtags);
    initTagMultiSelect('inputBrowseTags', 'listBrowseTags', settings.tags, settings.browsetags);
}

function initTagMultiSelect(inputId, listId, allTags, enabledTags) {
    let value = '';
    let list = '';
    for (let i = 0; i < allTags.length; i++) {
        if (enabledTags.includes(allTags[i])) {
            value += allTags[i] + ', ';
        }
        list += '<div class="form-check">' +
            '<input class="form-check-input" type="checkbox" value="1" name="' + allTags[i] + '" ' + 
            (enabledTags.includes(allTags[i]) ? 'checked="checked"' : '' )+ '>' +
            '<label class="form-check-label" for="' + allTags[i] + '">&nbsp;&nbsp;' + t(allTags[i]) + '</label>' +
            '</div>';
    }
    document.getElementById(listId).addEventListener('click', function(event) {
        event.stopPropagation();
        if (event.target.nodeName == 'INPUT') {
            let chkBoxes = event.target.parentNode.parentNode.getElementsByTagName('input');
            let value = '';
            for (let i = 0; i < chkBoxes.length; i++) {
                if (chkBoxes[i].checked == true) {
                    value += chkBoxes[i].name + ', ';
                }
            }
            event.target.parentNode.parentNode.parentNode.previousElementSibling.value = value.replace(/(,\s)$/, '');
        }
    });
    document.getElementById(inputId).value = value.replace(/(,\s)$/, '');
    document.getElementById(listId).innerHTML = list;
}

function setCols(table, className) {
    let tagChks = '';
    var tags = settings.tags.slice();
    if (settings.featTags == false) {
        tags.push('Title');
    }
    tags.push('Duration');
    if (table == 'QueueCurrent' || table == 'BrowsePlaylistsDetail' || table == 'QueueLastPlayed')
        tags.push('Pos');
    if (table == 'BrowseFilesystem')
        tags.push('Type');
    if (table == 'QueueLastPlayed')
        tags.push('LastPlayed');
    
    tags.sort();
    
    for (let i = 0; i < tags.length; i++) {
        if (table == 'Playback' && tags[i] == 'Title') {
            continue;
        }
        tagChks += '<div class="form-check">' +
            '<input class="form-check-input" type="checkbox" value="1" name="' + tags[i] + '"';
        if (settings['cols' + table].includes(tags[i])) {
            tagChks += 'checked';
        }
        tagChks += '>' +
            '<label class="form-check-label text-light" for="' + tags[i] + '">&nbsp;&nbsp;' + t(tags[i]) + '</label>' +
            '</div>';
    }
    document.getElementById(table + 'ColsDropdown').firstChild.innerHTML = tagChks;

    let sort = app.current.sort;
    
    if (table == 'Search') {
        if (app.apps.Search.state == '0/any/Title/') {
            if (settings.tags.includes('Title')) {
                sort = 'Title';
            }
            else if (settings.featTags == false) {
                sort = 'Filename';
            }
            else {
                sort = '-';
            }
        }
    }
    
    if (table != 'Playback') {
        let heading = '';
        for (let i = 0; i < settings['cols' + table].length; i++) {
            let h = settings['cols' + table][i];
            heading += '<th draggable="true" data-col="' + h  + '">';
            if (h == 'Track' || h == 'Pos') {
                h = '#';
            }
            heading += t(h);

            if (table == 'Search' && (h == sort || '-' + h == sort) ) {
                let sortdesc = false;
                if (app.current.sort.indexOf('-') == 0) {
                    sortdesc = true;
                }
                heading += '<span class="sort-dir material-icons pull-right">' + (sortdesc == true ? 'arrow_drop_up' : 'arrow_drop_down') + '</span>';
            }
            heading += '</th>';
        }
        heading += '<th></th>';
        
        if (className == undefined) {
            document.getElementById(table + 'List').getElementsByTagName('tr')[0].innerHTML = heading;
        }
        else {
            let tbls = document.querySelectorAll(className);
            for (let i = 0; i < tbls.length; i++) {
                tbls[i].getElementsByTagName('tr')[0].innerHTML = heading;
            }
        }
    }
}

function getSettings(onerror) {
    if (settingsLock == false) {
        settingsLock = true;
        sendAPI({"cmd": "MYMPD_API_SETTINGS_GET"}, getMpdSettings, onerror);
    }
}

function getMpdSettings(obj) {
    if (obj == '' || obj.type == 'error') {
        settingsParsed = 'error';
        if (appInited == false) {
            showAppInitAlert(obj == '' ? t('Can not parse settings') : obj.data);
        }
        return false;
    }
    settingsNew = obj.data;
    document.getElementById('splashScreenAlert').innerText = t('Fetch MPD settings');
    sendAPI({"cmd": "MPD_API_SETTINGS_GET"}, joinSettings, true);
}

function joinSettings(obj) {
    if (obj == '' || obj.type == 'error') {
        settingsParsed = 'error';
        if (appInited == false) {
            showAppInitAlert(obj == '' ? t('Can not parse settings') : obj.data);
        }
        settingsNew.mpdConnected = false;
    }
    else {
        for (let key in obj.data) {
            settingsNew[key] = obj.data[key];
        }
    }
    settings = Object.assign({}, settingsNew);
    settingsLock = false;
    parseSettings();
    toggleUI();
}

function saveCols(table, tableEl) {
    let colInputs = document.getElementById(table + 'ColsDropdown').firstChild.getElementsByTagName('input');
    var header;
    if (tableEl == undefined) {
         header = document.getElementById(table + 'List').getElementsByTagName('tr')[0];
    }
    else if (typeof(tableEl) == 'string') {
        header = document.querySelector(tableEl).getElementsByTagName('tr')[0];
    }
    else {
        header = tableEl.getElementsByTagName('tr')[0];
    }
    
    for (let i = 0; i < colInputs.length; i++) {
        let th = header.querySelector('[data-col=' + colInputs[i].name + ']');
        if (colInputs[i].checked == false) {
            if (th)
                th.remove();
        } 
        else if (!th) {
            th = document.createElement('th');
            th.innerText = colInputs[i].name;
            th.setAttribute('data-col', colInputs[i].name);
            header.appendChild(th);
        }
    }
    
    let cols = {"cmd": "MYMPD_API_COLS_SAVE", "data": {"table": "cols" + table, "cols": []}};
    let ths = header.getElementsByTagName('th');
    for (let i = 0; i < ths.length; i++) {
        let name = ths[i].getAttribute('data-col');
        if (name) {
            cols.data.cols.push(name);
        }
    }
    sendAPI(cols, getSettings);
}

//eslint-disable-next-line no-unused-vars
function saveColsPlayback(table) {
    let colInputs = document.getElementById(table + 'ColsDropdown').firstChild.getElementsByTagName('input');
    let header = document.getElementById('cardPlaybackTags');

    for (let i = 0; i < colInputs.length; i++) {
        let th = document.getElementById('current' + colInputs[i].name);
        if (colInputs[i].checked == false) {
            if (th)
                th.remove();
        } 
        else if (!th) {
            th = document.createElement('div');
            th.innerHTML = '<small>' + t(colInputs[i].name) + '</small><h4></h4>';
            th.setAttribute('id', 'current' + colInputs[i].name);
            th.setAttribute('data-tag', colInputs[i].name);
            header.appendChild(th);
        }
    }
    
    let cols = {"cmd": "MYMPD_API_COLS_SAVE", "data": {"table": "cols" + table, "cols": []}};
    let ths = header.getElementsByTagName('div');
    for (let i = 0; i < ths.length; i++) {
        let name = ths[i].getAttribute('data-tag');
        if (name) {
            cols.data.cols.push(name);
        }
    }
    sendAPI(cols, getSettings);
}

//eslint-disable-next-line no-unused-vars
function saveConnection() {
    let formOK = true;
    let mpdHostEl = document.getElementById('inputMpdHost');
    let mpdPortEl = document.getElementById('inputMpdPort');
    let mpdPassEl = document.getElementById('inputMpdPass');
    let musicDirectoryEl  = document.getElementById('selectMusicDirectory');
    let musicDirectory = musicDirectoryEl.options[musicDirectoryEl.selectedIndex].value;
    
    if (musicDirectory == 'custom') {
        let musicDirectoryValueEl  = document.getElementById('inputMusicDirectory');
        if (!validatePath(musicDirectoryValueEl)) {
            formOK = false;        
        }
        musicDirectory = musicDirectoryValueEl.value;
    }    
    
    if (mpdPortEl.value == '') {
        mpdPortEl.value = '6600';
    }
    if (mpdHostEl.value.indexOf('/') != 0) {
        if (!validateInt(mpdPortEl)) {
            formOK = false;        
        }
        if (!validateHost(mpdHostEl)) {
            formOK = false;        
        }
    }
    if (formOK == true) {
        sendAPI({"cmd": "MYMPD_API_CONNECTION_SAVE", "data": {"mpdHost": mpdHostEl.value, "mpdPort": mpdPortEl.value, "mpdPass": mpdPassEl.value, "musicDirectory": musicDirectory}}, getSettings);
        modalConnection.hide();    
    }
}

function parseOutputs(obj) {
    let btns = '';
    let outputsLen = obj.data.outputs.length;
    for (let i = 0; i < outputsLen; i++) {
        btns += '<button id="btnOutput' + obj.data.outputs[i].id +'" data-output-id="' + obj.data.outputs[i].id + '" class="btn btn-secondary btn-block';
        if (obj.data.outputs[i].state == 1)
            btns += ' active';
        btns += '"><span class="material-icons float-left">volume_up</span> ' + e(obj.data.outputs[i].name) + '</button>';
    }
    domCache.outputs.innerHTML = btns;
}

function setCounter(currentSongId, totalTime, elapsedTime) {
    currentSong.totalTime = totalTime;
    currentSong.elapsedTime = elapsedTime;
    currentSong.currentSongId = currentSongId;

    domCache.progressBar.value = Math.floor(1000 * elapsedTime / totalTime);

    let counterText = beautifySongDuration(elapsedTime) + "&nbsp;/&nbsp;" + beautifySongDuration(totalTime);
    domCache.counter.innerHTML = counterText;
    
    //Set playing track in queue view
    if (lastState) {
        if (lastState.data.currentSongId != currentSongId) {
            let tr = document.getElementById('queueTrackId' + lastState.data.currentSongId);
            if (tr) {
                let durationTd = tr.querySelector('[data-col=Duration]');
                if (durationTd)
                    durationTd.innerText = tr.getAttribute('data-duration');
                let posTd = tr.querySelector('[data-col=Pos]');
                if (posTd) {
                    posTd.classList.remove('material-icons');
                    posTd.innerText = tr.getAttribute('data-songpos');
                }
                tr.classList.remove('font-weight-bold');
            }
        }
    }
    let tr = document.getElementById('queueTrackId' + currentSongId);
    if (tr) {
        let durationTd = tr.querySelector('[data-col=Duration]');
        if (durationTd) {
            durationTd.innerHTML = counterText;
        }
        let posTd = tr.querySelector('[data-col=Pos]');
        if (posTd) {
            if (!posTd.classList.contains('material-icons')) {
                posTd.classList.add('material-icons');
                posTd.innerText = 'play_arrow';
            }
        }
        tr.classList.add('font-weight-bold');
    }
    
    if (progressTimer) {
        clearTimeout(progressTimer);
    }
    if (playstate == 'play') {
        progressTimer = setTimeout(function() {
            currentSong.elapsedTime ++;
            requestAnimationFrame(function() {
                setCounter(currentSong.currentSongId, currentSong.totalTime, currentSong.elapsedTime);
            });
        }, 1000);
    }
}

function parseState(obj) {
    if (JSON.stringify(obj) === JSON.stringify(lastState)) {
        toggleUI();
        return;
    }

    //Set play and queue state
    parseUpdateQueue(obj);
    
    //Set volume
    parseVolume(obj);

    //Set play counters
    setCounter(obj.data.currentSongId, obj.data.totalTime, obj.data.elapsedTime);
    
    //Get current song
    if (!lastState || lastState.data.currentSongId != obj.data.currentSongId ||
        lastState.data.queueVersion != obj.data.queueVersion)
    {
        sendAPI({"cmd": "MPD_API_PLAYER_CURRENT_SONG"}, songChange);
    }
    //clear playback card if not playing
    if (obj.data.songPos == '-1') {
        domCache.currentTitle.innerText = 'Not playing';
        document.title = 'myMPD';
        document.getElementById('headerTitle').innerText = '';
        document.getElementById('headerTitle').removeAttribute('title');
        clearCurrentCover();
        if (settings.bgCover == true) {
            clearBackgroundImage();
        }
        let pb = document.getElementById('cardPlaybackTags').getElementsByTagName('h4');
        for (let i = 0; i < pb.length; i++) {
            pb[i].innerText = '';
        }
    }


    lastState = obj;                    
    
    if (settings.mpdConnected == false || uiEnabled == false) {
        getSettings(true);
    }
}

function parseUpdateQueue(obj) {
    //Set playstate
    if (obj.data.state == 1) {
        for (let i = 0; i < domCache.btnsPlayLen; i++) {
            domCache.btnsPlay[i].innerText = 'play_arrow';
        }
        playstate = 'stop';
    }
    else if (obj.data.state == 2) {
        for (let i = 0; i < domCache.btnsPlayLen; i++) {
            domCache.btnsPlay[i].innerText = 'pause';
        }
        playstate = 'play';
    }
    else {
        for (let i = 0; i < domCache.btnsPlayLen; i++) {
            domCache.btnsPlay[i].innerText = 'play_arrow';
        }
	playstate = 'pause';
    }

    if (obj.data.queueLength == 0) {
        for (let i = 0; i < domCache.btnsPlayLen; i++) {
            domCache.btnsPlay[i].setAttribute('disabled', 'disabled');
        }
    }
    else {
        for (let i = 0; i < domCache.btnsPlayLen; i++) {
            domCache.btnsPlay[i].removeAttribute('disabled');
        }
    }

    domCache.badgeQueueItems.innerText = obj.data.queueLength;
    
    if (obj.data.nextSongPos == -1 && settings.jukeboxMode == false) {
        domCache.btnNext.setAttribute('disabled', 'disabled');
    }
    else {
        domCache.btnNext.removeAttribute('disabled');
    }
    
    if (obj.data.songPos <= 0) {
        domCache.btnPrev.setAttribute('disabled', 'disabled');
    }
    else {
        domCache.btnPrev.removeAttribute('disabled');
    }
}

function parseVolume(obj) {
    if (obj.data.volume == -1) {
        domCache.volumePrct.innerText = t('Volumecontrol disabled');
        domCache.volumeControl.classList.add('hide');
    } 
    else {
        domCache.volumeControl.classList.remove('hide');
        domCache.volumePrct.innerText = obj.data.volume + ' %';
        if (obj.data.volume == 0) {
            domCache.volumeMenu.innerText = 'volume_off';
        }
        else if (obj.data.volume < 50) {
            domCache.volumeMenu.innerText = 'volume_down';
        }
        else {
            domCache.volumeMenu.innerText = 'volume_up';
        }
    }
    domCache.volumeBar.value = obj.data.volume;
}

function getQueue() {
    if (app.current.search.length >= 2) {
        sendAPI({"cmd": "MPD_API_QUEUE_SEARCH", "data": {"filter": app.current.filter, "offset": app.current.page, "searchstr": app.current.search, "cols": settings.colsQueueCurrent}}, parseQueue);
    }
    else {
        sendAPI({"cmd": "MPD_API_QUEUE_LIST", "data": {"offset": app.current.page, "cols": settings.colsQueueCurrent}}, parseQueue);
    }
}

function replaceTblRow(row, el) {
    let menuEl = row.querySelector('[data-popover]');
    let result = false;
    if (menuEl) {
        hideMenu();
    }
    if (row.classList.contains('selected')) {
        el.classList.add('selected');
        el.focus();
        result = true;
    }
    row.replaceWith(el);
    return result;
}

function parseQueue(obj) {
    if (typeof(obj.totalTime) != 'undefined' && obj.totalTime > 0 && obj.totalEntities <= settings.maxElementsPerPage ) {
        document.getElementById('cardFooterQueue').innerText = t('Num songs', obj.totalEntities) + ' – ' + beautifyDuration(obj.totalTime);
    }
    else if (obj.totalEntities > 0) {
        document.getElementById('cardFooterQueue').innerText = t('Num songs', obj.totalEntities);
    }
    else {
        document.getElementById('cardFooterQueue').innerText = '';
    }

    let nrItems = obj.data.length;
    let table = document.getElementById('QueueCurrentList');
    let navigate = document.activeElement.parentNode.parentNode == table ? true : false;
    let activeRow = 0;
    table.setAttribute('data-version', obj.queueVersion);
    let tbody = table.getElementsByTagName('tbody')[0];
    let tr = tbody.getElementsByTagName('tr');
    for (let i = 0; i < nrItems; i++) {
        obj.data[i].Duration = beautifySongDuration(obj.data[i].Duration);
        obj.data[i].Pos++;
        let row = document.createElement('tr');
        row.setAttribute('draggable', 'true');
        row.setAttribute('data-trackid', obj.data[i].id);
        row.setAttribute('id','queueTrackId' + obj.data[i].id);
        row.setAttribute('data-songpos', obj.data[i].Pos);
        row.setAttribute('data-duration', obj.data[i].Duration);
        row.setAttribute('data-uri', obj.data[i].uri);
        row.setAttribute('tabindex', 0);
        let tds = '';
        for (let c = 0; c < settings.colsQueueCurrent.length; c++) {
            tds += '<td data-col="' + settings.colsQueueCurrent[c] + '">' + e(obj.data[i][settings.colsQueueCurrent[c]]) + '</td>';
        }
        tds += '<td data-col="Action"><a href="#" class="material-icons color-darkgrey">playlist_add</a></td>';
        row.innerHTML = tds;
        if (i < tr.length) {
            activeRow = replaceTblRow(tr[i], row) == true ? i : activeRow;
        }
        else {
            tbody.append(row);
        }
    }
    let trLen = tr.length - 1;
    for (let i = trLen; i >= nrItems; i --) {
        tr[i].remove();
    }

    let colspan = settings['colsQueueCurrent'].length;
    colspan--;

    if (obj.type == 'queuesearch' && nrItems == 0) {
        tbody.innerHTML = '<tr><td><span class="material-icons">error_outline</span></td>' +
                          '<td colspan="' + colspan + '">' + t('No results, please refine your search') + '</td></tr>';
    }
    else if (obj.type == 'queue' && nrItems == 0) {
        tbody.innerHTML = '<tr><td><span class="material-icons">error_outline</span></td>' +
                          '<td colspan="' + colspan + '">' + t('Empty queue') + '</td></tr>';
    }

    if (navigate == true) {
        focusTable(activeRow);
    }
    
    setPagination(obj.totalEntities, obj.returnedEntities);
    document.getElementById('QueueCurrentList').classList.remove('opacity05');
}

function parseLastPlayed(obj) {
    document.getElementById('cardFooterQueue').innerText = t('Num songs', obj.totalEntities);
    let nrItems = obj.data.length;
    let table = document.getElementById('QueueLastPlayedList');
    let navigate = document.activeElement.parentNode.parentNode == table ? true : false;
    let activeRow = 0;
    let tbody = table.getElementsByTagName('tbody')[0];
    let tr = tbody.getElementsByTagName('tr');
    for (let i = 0; i < nrItems; i++) {
        obj.data[i].Duration = beautifySongDuration(obj.data[i].Duration);
        obj.data[i].LastPlayed = localeDate(obj.data[i].LastPlayed);
        let row = document.createElement('tr');
        row.setAttribute('data-uri', obj.data[i].uri);
        row.setAttribute('data-name', obj.data[i].Title);
        row.setAttribute('data-type', 'song');
        row.setAttribute('tabindex', 0);
        let tds = '';
        for (let c = 0; c < settings.colsQueueLastPlayed.length; c++) {
            tds += '<td data-col="' + settings.colsQueueLastPlayed[c] + '">' + e(obj.data[i][settings.colsQueueLastPlayed[c]]) + '</td>';
        }
        tds += '<td data-col="Action">';
        if (obj.data[i].uri != '') {
            tds += '<a href="#" class="material-icons color-darkgrey">playlist_add</a>';
        }
        tds += '</td>';
        row.innerHTML = tds;
        if (i < tr.length) {
            activeRow = replaceTblRow(tr[i], row) == true ? i : activeRow;
        }
        else {
            tbody.append(row);
        }
    }
    let trLen = tr.length - 1;
    for (let i = trLen; i >= nrItems; i --) {
        tr[i].remove();
    }                    

    let colspan = settings['colsQueueLastPlayed'].length;
    colspan--;
    
    if (nrItems == 0) {
        tbody.innerHTML = '<tr><td><span class="material-icons">error_outline</span></td>' +
            '<td colspan="' + colspan + '">' + t('Empty list') + '</td></tr>';
    }

    if (navigate == true) {
        focusTable(activeRow);
    }

    setPagination(obj.totalEntities, obj.returnedEntities);
    document.getElementById('QueueLastPlayedList').classList.remove('opacity05');
}

function parseSearch(obj) {
    document.getElementById('panel-heading-search').innerText = gtPage('Num songs', obj.returnedEntities, obj.totalEntities);
    document.getElementById('cardFooterSearch').innerText = gtPage('Num songs', obj.returnedEntities, obj.totalEntities);
    
    if (obj.returnedEntities > 0) {
        document.getElementById('searchAddAllSongs').removeAttribute('disabled');
        document.getElementById('searchAddAllSongsBtn').removeAttribute('disabled');
    } 
    else {
        document.getElementById('searchAddAllSongs').setAttribute('disabled', 'disabled');
        document.getElementById('searchAddAllSongsBtn').setAttribute('disabled', 'disabled');
    }
    parseFilesystem(obj);
}

function parseFilesystem(obj) {
    let list = app.current.app + (app.current.tab == 'Filesystem' ? app.current.tab : '');
    let colspan = settings['cols' + list].length;
    colspan--;
    let nrItems = obj.data.length;
    let table = document.getElementById(app.current.app + (app.current.tab == undefined ? '' : app.current.tab) + 'List');
    let tbody = table.getElementsByTagName('tbody')[0];
    let tr = tbody.getElementsByTagName('tr');
    let navigate = document.activeElement.parentNode.parentNode == table ? true : false;
    let activeRow = 0;
    for (let i = 0; i < nrItems; i++) {
        let uri = encodeURI(obj.data[i].uri);
        let row = document.createElement('tr');
        let tds = '';
        row.setAttribute('data-type', obj.data[i].Type);
        row.setAttribute('data-uri', uri);
        row.setAttribute('tabindex', 0);
        if (obj.data[i].Type == 'song') {
            row.setAttribute('data-name', obj.data[i].Title);
        }
        else {
            row.setAttribute('data-name', obj.data[i].name);
        }
        
        switch(obj.data[i].Type) {
            case 'dir':
            case 'smartpls':
            case 'plist':
                for (let c = 0; c < settings['cols' + list].length; c++) {
                    tds += '<td data-col="' + settings['cols' + list][c] + '">';
                    if (settings['cols' + list][c] == 'Type') {
                        if (obj.data[i].Type == 'dir') {
                            tds += '<span class="material-icons">folder_open</span>';
                        }
                        else {
                            tds += '<span class="material-icons">' + (obj.data[i].Type == 'smartpls' ? 'queue_music' : 'list') + '</span>';
                        }
                    }
                    else if (settings['cols' + list][c] == 'Title') {
                        tds += e(obj.data[i].name);
                    }
                    tds += '</td>';
                }
                tds += '<td data-col="Action"><a href="#" class="material-icons color-darkgrey">playlist_add</a></td>';
                row.innerHTML = tds;
                break;
            case 'song':
                obj.data[i].Duration = beautifySongDuration(obj.data[i].Duration);
                for (let c = 0; c < settings['cols' + list].length; c++) {
                    tds += '<td data-col="' + settings['cols' + list][c] + '">';
                    if (settings['cols' + list][c] == 'Type') {
                        tds += '<span class="material-icons">music_note</span>';
                    }
                    else {
                        tds += e(obj.data[i][settings['cols' + list][c]]);
                    }
                    tds += '</td>';
                }
                tds += '<td data-col="Action"><a href="#" class="material-icons color-darkgrey">playlist_add</a></td>';
                row.innerHTML = tds;
                break;
        }
        if (i < tr.length) {
            activeRow = replaceTblRow(tr[i], row) == true ? i : activeRow;
        }
        else {
            tbody.append(row);
        }
    }
    let trLen = tr.length - 1;
    for (let i = trLen; i >= nrItems; i --) {
        tr[i].remove();
    }

    if (navigate == true) {
        focusTable(0);
    }

    setPagination(obj.totalEntities, obj.returnedEntities);
                    
    if (nrItems == 0)
        tbody.innerHTML = '<tr><td><span class="material-icons">error_outline</span></td>' +
                          '<td colspan="' + colspan + '">' + t('Empty list') + '</td></tr>';
    document.getElementById(app.current.app + (app.current.tab == undefined ? '' : app.current.tab) + 'List').classList.remove('opacity05');
    document.getElementById('cardFooterBrowse').innerText = t('Num entries', obj.totalEntities);
}

function parsePlaylists(obj) {
    if (app.current.view == 'All') {
        document.getElementById('BrowsePlaylistsAllList').classList.remove('hide');
        document.getElementById('BrowsePlaylistsDetailList').classList.add('hide');
        document.getElementById('btnBrowsePlaylistsAll').parentNode.classList.add('hide');
        document.getElementById('btnPlaylistClear').parentNode.classList.add('hide');
        document.getElementById('BrowsePlaylistsDetailColsBtn').parentNode.classList.add('hide');
    } else {
        if (obj.uri.indexOf('.') > -1 || obj.smartpls == true) {
            document.getElementById('BrowsePlaylistsDetailList').setAttribute('data-ro', 'true')
            document.getElementById('btnPlaylistClear').parentNode.classList.add('hide');
        }
        else {
            document.getElementById('BrowsePlaylistsDetailList').setAttribute('data-ro', 'false');
            document.getElementById('btnPlaylistClear').parentNode.classList.remove('hide');
        }
        document.getElementById('BrowsePlaylistsDetailList').setAttribute('data-uri', obj.uri);
        document.getElementById('BrowsePlaylistsDetailList').getElementsByTagName('caption')[0].innerHTML = 
            (obj.smartpls == true ? t('Smart playlist') : t('Playlist'))  + ': ' + obj.uri;
        document.getElementById('BrowsePlaylistsDetailList').classList.remove('hide');
        document.getElementById('BrowsePlaylistsAllList').classList.add('hide');
        document.getElementById('btnBrowsePlaylistsAll').parentNode.classList.remove('hide');
        if (settings.featTags) {
            document.getElementById('BrowsePlaylistsDetailColsBtn').parentNode.classList.remove('hide');
        }
    }
            
    let nrItems = obj.data.length;
    let table = document.getElementById(app.current.app + app.current.tab + app.current.view + 'List');
    let tbody = table.getElementsByTagName('tbody')[0];
    let tr = tbody.getElementsByTagName('tr');
    let navigate = document.activeElement.parentNode.parentNode == table ? true : false;
    let activeRow = 0;
    if (app.current.view == 'All') {
        for (let i = 0; i < nrItems; i++) {
            let uri = encodeURI(obj.data[i].uri);
            let row = document.createElement('tr');
            row.setAttribute('data-uri', uri);
            row.setAttribute('data-type', obj.data[i].Type);
            row.setAttribute('data-name', obj.data[i].name);
            row.setAttribute('tabindex', 0);
            row.innerHTML = '<td data-col="Type"><span class="material-icons">' + (obj.data[i].Type == 'smartpls' ? 'queue_music' : 'list') + '</span></td>' +
                            '<td>' + e(obj.data[i].name) + '</td>' +
                            '<td>'+ localeDate(obj.data[i].last_modified) + '</td>' +
                            '<td data-col="Action"><a href="#" class="material-icons color-darkgrey">playlist_add</a></td>';
            if (i < tr.length) {
                activeRow = replaceTblRow(tr[i], row) == true ? i : activeRow;
            }
            else {
                tbody.append(row);
            }
        }
        document.getElementById('cardFooterBrowse').innerText = gtPage('Num playlists', obj.returnedEntities, obj.totalEntities);
    }
    else if (app.current.view == 'Detail') {
        for (let i = 0; i < nrItems; i++) {
            let uri = encodeURI(obj.data[i].uri);
            let row = document.createElement('tr');
            if (obj.smartpls == false) {
                row.setAttribute('draggable','true');
            }
            row.setAttribute('id','playlistTrackId' + obj.data[i].Pos);
            row.setAttribute('data-type', obj.data[i].Type);
            row.setAttribute('data-uri', uri);
            row.setAttribute('data-name', obj.data[i].Title);
            row.setAttribute('data-songpos', obj.data[i].Pos);
            row.setAttribute('tabindex', 0);
            obj.data[i].Duration = beautifySongDuration(obj.data[i].Duration);
            let tds = '';
            for (let c = 0; c < settings.colsBrowsePlaylistsDetail.length; c++) {
                tds += '<td data-col="' + settings.colsBrowsePlaylistsDetail[c] + '">' + e(obj.data[i][settings.colsBrowsePlaylistsDetail[c]]) + '</td>';
            }
            tds += '<td data-col="Action"><a href="#" class="material-icons color-darkgrey">playlist_add</a></td>';
            row.innerHTML = tds;

            if (i < tr.length) {
                activeRow = replaceTblRow(tr[i], row) == true ? i : activeRow;
            }
            else {
                tbody.append(row);
            }
        }
        document.getElementById('cardFooterBrowse').innerText = gtPage('Num songs', obj.returnedEntities, obj.totalEntities);
    }
    let trLen = tr.length - 1;
    for (let i = trLen; i >= nrItems; i --) {
        tr[i].remove();
    }

    if (navigate == true) {
        focusTable(0);
    }

    setPagination(obj.totalEntities, obj.returnedEntities);
    
    if (nrItems == 0) {
        if (app.current.view == 'All') {
            tbody.innerHTML = '<tr><td><span class="material-icons">error_outline</span></td>' +
                              '<td colspan="3>' + t('No playlists found') + '</td></tr>';
        }
        else {
            tbody.innerHTML = '<tr><td><span class="material-icons">error_outline</span></td>' +
                              '<td colspan="' + (settings.colsBrowsePlaylistsDetail.length - 1) + '">' + t('Empty playlist') + '</td></tr>';
        }
    }
            
    document.getElementById(app.current.app + app.current.tab + app.current.view + 'List').classList.remove('opacity05');
}

function parseListDBtags(obj) {
    scrollToPosY(0);
    if (app.current.search != '') {
        document.getElementById('BrowseDatabaseAlbumList').classList.remove('hide');
        document.getElementById('BrowseDatabaseTagList').classList.add('hide');
        document.getElementById('btnBrowseDatabaseByTag').parentNode.classList.add('hide');
        document.getElementById('btnBrowseDatabaseTag').parentNode.classList.remove('hide');
        document.getElementById('BrowseDatabaseAddAllSongs').parentNode.parentNode.classList.remove('hide');
        document.getElementById('BrowseDatabaseColsBtn').parentNode.classList.remove('hide');
        document.getElementById('btnBrowseDatabaseTag').innerHTML = '&laquo; ' + t(app.current.view);
        document.getElementById('BrowseDatabaseAlbumListCaption').innerHTML = '<h2>' + t(obj.searchtagtype) + ': ' + e(obj.searchstr) + '</h2><hr/>';
        document.getElementById('cardFooterBrowse').innerText = t('Num entries', obj.totalEntities);
        let nrItems = obj.data.length;
        let cardContainer = document.getElementById('BrowseDatabaseAlbumList');
        let cards = cardContainer.getElementsByClassName('card');
        for (let i = 0; i < nrItems; i++) {
            let id = genId(obj.data[i].value);
            let card = document.createElement('div');
            card.classList.add('card', 'ml-4', 'mr-4', 'mb-4', 'w-100');
            card.setAttribute('id', 'card' + id);
            card.setAttribute('data-album', encodeURI(obj.data[i].value));
            let html = '<div class="card-header"><span id="albumartist' + id + '"></span> &ndash; ' + e(obj.data[i].value) + '</div>' +
                       '<div class="card-body"><div class="row">';
            if (settings.featCoverimage == true && settings.coverimage == true) {
                html += '<div class="col-md-auto"><a class="card-img-left"></a></div>';
            }
            html += '<div class="col"><table class="tblAlbumTitles table table-sm table-hover" tabindex="0" id="tbl' + id + '"><thead><tr></tr></thead><tbody></tbody>' +
                    '<tfoot class="bg-light border-bottom"></tfoot></table></div>' + 
                    '</div></div>' +
                    '</div><div class="card-footer"></div>';
            
            card.innerHTML = html;
            if (i < cards.length) {
                cards[i].replaceWith(card); 
            }
            else {
                cardContainer.append(card);
            }
            
            if ('IntersectionObserver' in window) {
                createListTitleObserver(document.getElementById('card' + id));
            }
            else {
                sendAPI({"cmd": "MPD_API_DATABASE_TAG_ALBUM_TITLE_LIST", "data": { "album": obj.data[i].value, "search": app.current.search, "tag": app.current.view, "cols": settings.colsBrowseDatabase}}, parseListTitles);
            }
        }
        let cardsLen = cards.length - 1;
        for (let i = cardsLen; i >= nrItems; i --) {
            cards[i].remove();
        }
        setPagination(obj.totalEntities, obj.returnedEntities);
        setCols('BrowseDatabase', '.tblAlbumTitles');
        let tbls = document.querySelectorAll('.tblAlbumTitles');
        for (let i = 0; i < tbls.length; i++) {
            dragAndDropTableHeader(tbls[i]);
        }
        document.getElementById('BrowseDatabaseAlbumList').classList.remove('opacity05');        
    }  
    else {
        document.getElementById('BrowseDatabaseAlbumList').classList.add('hide');
        document.getElementById('BrowseDatabaseTagList').classList.remove('hide');
        document.getElementById('btnBrowseDatabaseByTag').parentNode.classList.remove('hide');
        document.getElementById('BrowseDatabaseAddAllSongs').parentNode.parentNode.classList.add('hide');
        document.getElementById('BrowseDatabaseColsBtn').parentNode.classList.add('hide');
        document.getElementById('btnBrowseDatabaseTag').parentNode.classList.add('hide');
        document.getElementById('BrowseDatabaseTagListCaption').innerText = app.current.view;        
        document.getElementById('cardFooterBrowse').innerText = obj.totalEntities + ' Tags';
        let nrItems = obj.data.length;
        let table = document.getElementById(app.current.app + app.current.tab + 'TagList');
        let tbody = table.getElementsByTagName('tbody')[0];
        let navigate = document.activeElement.parentNode.parentNode == table ? true : false;
        let activeRow = 0;
        let tr = tbody.getElementsByTagName('tr');
        for (let i = 0; i < nrItems; i++) {
            let uri = encodeURI(obj.data[i].value);
            let row = document.createElement('tr');
            row.setAttribute('data-uri', uri);
            row.setAttribute('tabindex', 0);
            row.innerHTML='<td data-col="Type"><span class="material-icons">album</span></td>' +
                          '<td>' + e(obj.data[i].value) + '</td>';
            if (i < tr.length) {
                activeRow = replaceTblRow(tr[i], row) == true ? i : activeRow;
            }
            else {
                tbody.append(row);
            }
        }
        let trLen = tr.length - 1;
        for (let i = trLen; i >= nrItems; i --) {
            tr[i].remove();
        }
        
        if (navigate == true) {
            focusTable(0);
        }
        
        setPagination(obj.totalEntities, obj.returnedEntities);

        if (nrItems == 0) {
            tbody.innerHTML = '<tr><td><span class="material-icons">error_outline</span></td>' +
                              '<td>No entries found.</td></tr>';
        }
        document.getElementById('BrowseDatabaseTagList').classList.remove('opacity05');                              
    }
}

function createListTitleObserver(ele) {
  let options = {
    root: null,
    rootMargin: "0px",
  };

  let observer = new IntersectionObserver(getListTitles, options);
  observer.observe(ele);
}

function getListTitles(changes, observer) {
    changes.forEach(change => {
        if (change.intersectionRatio > 0) {
            observer.unobserve(change.target);
            let album = decodeURI(change.target.getAttribute('data-album'));
            sendAPI({"cmd": "MPD_API_DATABASE_TAG_ALBUM_TITLE_LIST", "data": { "album": album, "search": app.current.search, "tag": app.current.view, "cols": settings.colsBrowseDatabase}}, parseListTitles);
        }
    });
}

function parseListTitles(obj) {
    let id = genId(obj.Album);
    let card = document.getElementById('card' + id)
    let table = card.getElementsByTagName('table')[0];
    let tbody = card.getElementsByTagName('tbody')[0];
    let cardFooter = card.querySelector('.card-footer');
    let cardHeader = card.querySelector('.card-header');
    cardHeader.setAttribute('data-uri', encodeURI(obj.data[0].uri.replace(/\/[^/]+$/, '')));
    cardHeader.setAttribute('data-name', obj.Album);
    cardHeader.setAttribute('data-type', 'dir');
    cardHeader.addEventListener('click', function(event) {
        showMenu(this, event);
    }, false);
    cardHeader.classList.add('clickable');
    table.addEventListener('keydown', function(event) {
        navigateTable(this, event.key);
    }, false);
    let img = card.getElementsByTagName('a')[0];
    if (img) {
        img.style.backgroundImage = 'url("' + subdir + obj.cover + '"), url("' + subdir + '/assets/coverimage-loading.png")';
        img.setAttribute('data-uri', encodeURI(obj.data[0].uri.replace(/\/[^/]+$/, '')));
        img.setAttribute('data-name', obj.Album);
        img.setAttribute('data-type', 'dir');
        img.addEventListener('click', function(event) {
            showMenu(this, event);
        }, false);
    }
    
    document.getElementById('albumartist' + id).innerText = obj.AlbumArtist;
  
    let titleList = '';
    let nrItems = obj.data.length;
    for (let i = 0; i < nrItems; i++) {
        if (obj.data[i].Duration) {
            obj.data[i].Duration = beautifySongDuration(obj.data[i].Duration);
        }
        titleList += '<tr tabindex="0" data-type="song" data-name="' + obj.data[i].Title + '" data-uri="' + encodeURI(obj.data[i].uri) + '">';
        for (let c = 0; c < settings.colsBrowseDatabase.length; c++) {
            titleList += '<td data-col="' + settings.colsBrowseDatabase[c] + '">' + e(obj.data[i][settings.colsBrowseDatabase[c]]) + '</td>';
        }
        titleList += '<td data-col="Action"><a href="#" class="material-icons color-darkgrey">playlist_add</a></td></tr>';
    }
    tbody.innerHTML = titleList;
    cardFooter.innerHTML = t('Num songs', obj.totalEntities) + ' &ndash; ' + beautifyDuration(obj.totalTime);

    tbody.parentNode.addEventListener('click', function(event) {
        if (event.target.nodeName == 'TD') {
            appendQueue('song', decodeURI(event.target.parentNode.getAttribute('data-uri')), event.target.parentNode.getAttribute('data-name'));
        }
        else if (event.target.nodeName == 'A') {
            showMenu(event.target, event);
        }
    }, false);
}

function setPagination(total, returned) {
    let cat = app.current.app + (app.current.tab == undefined ? '': app.current.tab);
    let totalPages = Math.ceil(total / settings.maxElementsPerPage);
    if (totalPages == 0) 
        totalPages = 1;
    let p = ['PaginationTop', 'PaginationBottom'];
    for (let i = 0; i < 2; i++) {
        document.getElementById(cat + p[i] + 'Page').innerText = (app.current.page / settings.maxElementsPerPage + 1) + ' / ' + totalPages;
        if (totalPages > 1) {
            document.getElementById(cat + p[i] + 'Page').removeAttribute('disabled');
            let pl = '';
            for (let j = 0; j < totalPages; j++) {
                pl += '<button data-page="' + (j * settings.maxElementsPerPage) + '" type="button" class="mr-1 mb-1 btn-sm btn btn-secondary">' +
                    ( j + 1) + '</button>';
            }
            document.getElementById(cat + p[i] + 'Pages').innerHTML = pl;
            document.getElementById(cat + p[i] + 'Page').classList.remove('nodropdown');
        }
        else if (total == -1) {
            document.getElementById(cat + p[i] + 'Page').setAttribute('disabled', 'disabled');
            document.getElementById(cat + p[i] + 'Page').innerText = (app.current.page / settings.maxElementsPerPage + 1);
            document.getElementById(cat + p[i] + 'Page').classList.add('nodropdown');
        }
        else {
            document.getElementById(cat + p[i] + 'Page').setAttribute('disabled', 'disabled');
            document.getElementById(cat + p[i] + 'Page').classList.add('nodropdown');
        }
    
        if (total > app.current.page + settings.maxElementsPerPage || total == -1 && returned >= settings.maxElementsPerPage) {
            document.getElementById(cat + p[i] + 'Next').removeAttribute('disabled');
            document.getElementById(cat + p[i]).classList.remove('hide');
            document.getElementById(cat + 'ButtonsBottom').classList.remove('hide');
        }
        else {
            document.getElementById(cat + p[i] + 'Next').setAttribute('disabled', 'disabled');
            document.getElementById(cat + p[i]).classList.add('hide');
            document.getElementById(cat + 'ButtonsBottom').classList.add('hide');
        }
    
        if (app.current.page > 0) {
            document.getElementById(cat + p[i] + 'Prev').removeAttribute('disabled');
            document.getElementById(cat + p[i]).classList.remove('hide');
            document.getElementById(cat + 'ButtonsBottom').classList.remove('hide');
        } else {
            document.getElementById(cat + p[i] + 'Prev').setAttribute('disabled', 'disabled');
        }
    }
}

//eslint-disable-next-line no-unused-vars
function queueSelectedItem(append) {
    let item = document.activeElement;
    if (item) {
        if (item.parentNode.parentNode.id == 'QueueCurrentList') {
            return;
        }
        if (append == true) {
            appendQueue(item.getAttribute('data-type'), item.getAttribute('data-uri'), item.getAttribute('data-name'));
        }
        else {
            replaceQueue(item.getAttribute('data-type'), item.getAttribute('data-uri'), item.getAttribute('data-name'));
        }
    }
}

//eslint-disable-next-line no-unused-vars
function dequeueSelectedItem() {
    let item = document.activeElement;
    if (item) {
        if (item.parentNode.parentNode.id != 'QueueCurrentList') {
            return;
        }
        delQueueSong('single', item.getAttribute('data-trackid'));
    }
}

//eslint-disable-next-line no-unused-vars
function addSelectedItemToPlaylist() {
    let item = document.activeElement;
    if (item) {
        if (item.parentNode.parentNode.id == 'BrowsePlaylistsAllList') {
            return;
        }
        showAddToPlaylist(item.getAttribute('data-uri'));
    }
}

function appendQueue(type, uri, name) {
    switch(type) {
        case 'song':
        case 'dir':
            sendAPI({"cmd": "MPD_API_QUEUE_ADD_TRACK", "data": {"uri": uri}});
            showNotification(t('%{name} added to queue', {"name": name}), '', '', 'success');
            break;
        case 'plist':
            sendAPI({"cmd": "MPD_API_QUEUE_ADD_PLAYLIST", "data": {"plist": uri}});
            showNotification(t('%{name} added to queue', {"name": name}), '', '', 'success');
            break;
    }
}

//eslint-disable-next-line no-unused-vars
function appendAfterQueue(type, uri, to, name) {
    switch(type) {
        case 'song':
            sendAPI({"cmd": "MPD_API_QUEUE_ADD_TRACK_AFTER", "data": {"uri": uri, "to": to}});
            to++;
            showNotification(t('%{name} added to queue position %{to}', {"name": name, "to": to}), '', '', 'success');
            break;
    }
}

function replaceQueue(type, uri, name) {
    switch(type) {
        case 'song':
        case 'dir':
            sendAPI({"cmd": "MPD_API_QUEUE_REPLACE_TRACK", "data": {"uri": uri}});
            showNotification(t('Queue replaced with %{name}', {"name": name}), '', '', 'success');
            break;
        case 'plist':
            sendAPI({"cmd": "MPD_API_QUEUE_REPLACE_PLAYLIST", "data": {"plist": uri}});
            showNotification(t('Queue replaced with %{name}', {"name": name}), '', '', 'success');
            break;
    }
}

//eslint-disable-next-line no-unused-vars
function clickTitle() {
    let uri = decodeURI(domCache.currentTitle.getAttribute('data-uri'));
    if (uri != '') {
        songDetails(uri);
    }
}

function gotoBrowse(x) {
    let tag = x.parentNode.getAttribute('data-tag');
    let name = decodeURI(x.parentNode.getAttribute('data-name'));
    if (tag != '' && name != '' && name != '-' && settings.browsetags.includes(tag)) {
        appGoto('Browse', 'Database', tag, '0/-/-/' + name);
    }
}

function songDetails(uri) {
    sendAPI({"cmd": "MPD_API_DATABASE_SONGDETAILS", "data": {"uri": uri}}, parseSongDetails);
    modalSongDetails.show();
}

function parseFingerprint(obj) {
    let textarea = document.createElement('textarea');
    textarea.value = obj.data.fingerprint;
    textarea.classList.add('form-control', 'text-monospace', 'small');
    let fpTd = document.getElementById('fingerprint');
    fpTd.innerHTML = '';
    fpTd.appendChild(textarea);
}

function parseSongDetails(obj) {
    let modal = document.getElementById('modalSongDetails');
    modal.getElementsByClassName('album-cover')[0].style.backgroundImage = 'url("' + subdir + obj.data.cover + '"), url("' + subdir + '/assets/coverimage-loading.png")';
    modal.getElementsByTagName('h1')[0].innerText = obj.data.Title;
    
    let songDetails = '';
    for (let i = 0; i < settings.tags.length; i++) {
        if (settings.tags[i] == 'Title') {
            continue;
        }
        songDetails += '<tr><th>' + t(settings.tags[i]) + '</th><td data-tag="' + settings.tags[i] + '" data-name="' + encodeURI(obj.data[settings.tags[i]]) + '">';
        if (settings.browsetags.includes(settings.tags[i])) {
            songDetails += '<a class="text-success" href="#">' + e(obj.data[settings.tags[i]]) + '</a>';
        }
        else {
            songDetails += obj.data[settings.tags[i]];
        }
        songDetails += '</td></tr>';
    }
    songDetails += '<tr><th>' + t('Duration') + '</th><td>' + beautifyDuration(obj.data.Duration) + '</td></tr>';
    if (settings.featLibrary) {
        songDetails += '<tr><th>' + t('Filename') + '</th><td><a class="breakAll text-success" href="/library/' + 
            encodeURI(obj.data.uri) + '" download title="' + e(obj.data.uri) + '">' + 
            e(basename(obj.data.uri)) + '</a></td></tr>';
    }
    else {
        songDetails += '<tr><th>' + t('Filename') + '</th><td class="breakAll"><span title="' + e(obj.data.uri) + '">' + 
            e(basename(obj.data.uri)) + '</span></td></tr>';
    }
    if (settings.featFingerprint == true) {
        songDetails += '<tr><th>' + t('Fingerprint') + '</th><td class="breakAll" id="fingerprint"><a class="text-success" data-uri="' + 
            encodeURI(obj.data.uri) + '" id="calcFingerprint" href="#">' + t('Calculate') + '</a></td></tr>';
    }
    if (settings.featStickers == true) {
        songDetails += '<tr><th colspan="2" class="pt-3"><h5>' + t('Statistics') + '</h5></th></tr>' +
            '<tr><th>' + t('Play count') + '</th><td>' + obj.data.playCount + '</td></tr>' +
            '<tr><th>' + t('Skip count') + '</th><td>' + obj.data.skipCount + '</td></tr>' +
            '<tr><th>' + t('Last played') + '</th><td>' + (obj.data.lastPlayed == 0 ? t('never') : localeDate(obj.data.lastPlayed)) + '</td></tr>' +
            '<tr><th>' + t('Last skipped') + '</th><td>' + (obj.data.lastSkipped == 0 ? t('never') : localeDate(obj.data.lastSkipped)) + '</td></tr>' +
            '<tr><th>' + t('Like') + '</th><td>' +
              '<div class="btn-group btn-group-sm">' +
                '<button title="' + t('Dislike song') + '" id="btnVoteDown2" data-href=\'{"cmd": "voteSong", "options": [0]}\' class="btn btn-sm btn-light material-icons">thumb_down</button>' +
                '<button title="' + t('Like song') + '" id="btnVoteUp2" data-href=\'{"cmd": "voteSong", "options": [2]}\' class="btn btn-sm btn-light material-icons">thumb_up</button>' +
              '</div>' +
            '</td></tr>';
    }
    
    modal.getElementsByTagName('tbody')[0].innerHTML = songDetails;
    setVoteSongBtns(obj.data.like, obj.data.uri);
}

//eslint-disable-next-line no-unused-vars
function execSyscmd(cmd) {
    sendAPI({"cmd": "MYMPD_API_SYSCMD", "data": {"cmd": cmd}});
}

//eslint-disable-next-line no-unused-vars
function playlistDetails(uri) {
    document.getElementById('BrowsePlaylistsAllList').classList.add('opacity05');
    appGoto('Browse', 'Playlists', 'Detail', '0/-/-/' + uri);
}

//eslint-disable-next-line no-unused-vars
function removeFromPlaylist(uri, pos) {
    pos--;
    sendAPI({"cmd": "MPD_API_PLAYLIST_RM_TRACK", "data": {"uri": uri, "track": pos}});
    document.getElementById('BrowsePlaylistsDetailList').classList.add('opacity05');    
}

//eslint-disable-next-line no-unused-vars
function playlistClear() {
    let uri = document.getElementById('BrowsePlaylistsDetailList').getAttribute('data-uri');
    sendAPI({"cmd": "MPD_API_PLAYLIST_CLEAR", "data": {"uri": uri}});
    document.getElementById('BrowsePlaylistsDetailList').classList.add('opacity05');    
}

function getAllPlaylists(obj) {
    let nrItems = obj.data.length;
    let playlists = '';
    if (obj.offset == 0) {
        if (playlistEl == 'addToPlaylistPlaylist') {
            playlists = '<option value=""></option><option value="new">' + t('New playlist') + '</option>';
        }
        else if (playlistEl == 'selectJukeboxPlaylist' || playlistEl == 'selectAddToQueuePlaylist') {
            playlists = '<option value="Database">' + t('Database') + '</option>';
        }
    }
    for (let i = 0; i < nrItems; i++) {
        if (playlistEl == 'addToPlaylistPlaylist' && obj.data[i].Type == 'smartpls') {
            continue;
        }
        playlists += '<option value="' + e(obj.data[i].uri) + '"';
        if (playlistEl == 'selectJukeboxPlaylist' && obj.data[i].uri == settings.jukeboxPlaylist) {
            playlists += ' selected';
        }
        playlists += '>' + e(obj.data[i].uri) + '</option>';
    }
    if (obj.offset == 0) {
        document.getElementById(playlistEl).innerHTML = playlists;
    }
    else {
        document.getElementById(playlistEl).innerHTML += playlists;
    }
    if (obj.totalEntities > obj.returnedEntities) {
        obj.offset += settings.maxElementsPerPage;
        sendAPI({"cmd": "MPD_API_PLAYLIST_LIST", "data": {"offset": obj.offset, "filter": "-"}}, getAllPlaylists);
    }
}

//eslint-disable-next-line no-unused-vars
function updateSmartPlaylists() {
    sendAPI({"cmd": "MPD_API_SMARTPLS_UPDATE_ALL"});
}

//eslint-disable-next-line no-unused-vars
function loveSong() {
    sendAPI({"cmd": "MPD_API_LOVE", "data": {}});
}

//eslint-disable-next-line no-unused-vars
function voteSong(vote) {
    let uri = decodeURI(domCache.currentTitle.getAttribute('data-uri'));
    if (uri == '') {
        return;
    }
        
    if (vote == 2 && domCache.btnVoteUp.classList.contains('active-fg-green')) {
        vote = 1;
    }
    else if (vote == 0 && domCache.btnVoteDown.classList.contains('active-fg-red')) {
        vote = 1;
    }
    sendAPI({"cmd": "MPD_API_LIKE", "data": {"uri": uri, "like": vote}});
    setVoteSongBtns(vote, uri);
}

function setVoteSongBtns(vote, uri) {
    domCache.btnVoteUp2 = document.getElementById('btnVoteUp2');
    domCache.btnVoteDown2 = document.getElementById('btnVoteDown2');

    if (uri == '' || uri.indexOf('://') > -1) {
        domCache.btnVoteUp.setAttribute('disabled', 'disabled');
        domCache.btnVoteDown.setAttribute('disabled', 'disabled');
        if (domCache.btnVoteUp2) {
            domCache.btnVoteUp2.setAttribute('disabled', 'disabled');
            domCache.btnVoteDown2.setAttribute('disabled', 'disabled');
        }
    } else {
        domCache.btnVoteUp.removeAttribute('disabled');
        domCache.btnVoteDown.removeAttribute('disabled');
        if (domCache.btnVoteUp2) {
            domCache.btnVoteUp2.removeAttribute('disabled');
            domCache.btnVoteDown2.removeAttribute('disabled');
        }
    }
    
    if (vote == 0) {
        domCache.btnVoteUp.classList.remove('active-fg-green');
        domCache.btnVoteDown.classList.add('active-fg-red');
        if (domCache.btnVoteUp2) {
            domCache.btnVoteUp2.classList.remove('active-fg-green');
            domCache.btnVoteDown2.classList.add('active-fg-red');
        }
    } else if (vote == 1) {
        domCache.btnVoteUp.classList.remove('active-fg-green');
        domCache.btnVoteDown.classList.remove('active-fg-red');
        if (domCache.btnVoteUp2) {
            domCache.btnVoteUp2.classList.remove('active-fg-green');
            domCache.btnVoteDown2.classList.remove('active-fg-red');
        }
    } else if (vote == 2) {
        domCache.btnVoteUp.classList.add('active-fg-green');
        domCache.btnVoteDown.classList.remove('active-fg-red');
        if (domCache.btnVoteUp2) {
            domCache.btnVoteUp2.classList.add('active-fg-green');
            domCache.btnVoteDown2.classList.remove('active-fg-red');
        }
    }
}

//eslint-disable-next-line no-unused-vars
function toggleAddToPlaylistFrm() {
    let btn = document.getElementById('toggleAddToPlaylistBtn');
    toggleBtn('toggleAddToPlaylistBtn');
    if (btn.classList.contains('active')) {
        document.getElementById('addToPlaylistFrm').classList.remove('hide');
        document.getElementById('addStreamFooter').classList.add('hide');
        document.getElementById('addToPlaylistFooter').classList.remove('hide');
    }    
    else {
        document.getElementById('addToPlaylistFrm').classList.add('hide');
        document.getElementById('addStreamFooter').classList.remove('hide');
        document.getElementById('addToPlaylistFooter').classList.add('hide');
    }
}

function saveSearchAsSmartPlaylist() {
    parseSmartPlaylist({"type": "smartpls", "data": {"playlist": "", "type": "search", "tag": app.current.filter, "searchstr": app.current.search}});
}

function parseSmartPlaylist(obj) {
    let nameEl = document.getElementById('saveSmartPlaylistName');
    nameEl.value = obj.data.playlist;
    nameEl.classList.remove('is-invalid');
    document.getElementById('saveSmartPlaylistType').value = obj.data.type;
    document.getElementById('saveSmartPlaylistSearch').classList.add('hide');
    document.getElementById('saveSmartPlaylistSticker').classList.add('hide');
    document.getElementById('saveSmartPlaylistNewest').classList.add('hide');
    let tagList;
    if (settings.featTags)
        tagList = '<option value="any">' + t('Any Tag') + '</option>';
    tagList += '<option value="filename">' + t('Filename') + '</option>';
    for (let i = 0; i < settings.searchtags.length; i++) {
        tagList += '<option value="' + settings.searchtags[i] + '">' + t(settings.searchtags[i]) + '</option>';
    }
    document.getElementById('selectSaveSmartPlaylistTag').innerHTML = tagList;
    if (obj.data.type == 'search') {
        document.getElementById('saveSmartPlaylistSearch').classList.remove('hide');
        document.getElementById('selectSaveSmartPlaylistTag').value = obj.data.tag;
        document.getElementById('inputSaveSmartPlaylistSearchstr').value = obj.data.searchstr;
        if (settings.featAdvsearch) {
            document.getElementById('selectSaveSmartPlaylistTag').parentNode.classList.add('hide');
            document.getElementById('inputSaveSmartPlaylistSearchstr').parentNode.classList.replace('col-md-6','col-md-12');
        }
        else {
            document.getElementById('selectSaveSmartPlaylistTag').parentNode.classList.remove('hide');
            document.getElementById('inputSaveSmartPlaylistSearchstr').parentNode.classList.replace('col-md-12','col-md-6');
        }
    }
    else if (obj.data.type == 'sticker') {
        document.getElementById('saveSmartPlaylistSticker').classList.remove('hide');
        document.getElementById('selectSaveSmartPlaylistSticker').value = obj.data.sticker;
        document.getElementById('inputSaveSmartPlaylistStickerMaxentries').value = obj.data.maxentries;
    }
    else if (obj.data.type == 'newest') {
        document.getElementById('saveSmartPlaylistNewest').classList.remove('hide');
        let timerange = obj.data.timerange / 24 / 60 / 60;
        document.getElementById('inputSaveSmartPlaylistNewestTimerange').value = timerange;
    }
    modalSaveSmartPlaylist.show();
    nameEl.focus();
}

//eslint-disable-next-line no-unused-vars
function saveSmartPlaylist() {
    let name = document.getElementById('saveSmartPlaylistName').value;
    let type = document.getElementById('saveSmartPlaylistType').value;
    if (validatePlname(name) == true) {
        if (type == 'search') {
            let tagEl = document.getElementById('selectSaveSmartPlaylistTag');
            let tag = tagEl.options[tagEl.selectedIndex].value;
            if (settings.featAdvsearch) {
                tag = 'expression';
            }
            let searchstr = document.getElementById('inputSaveSmartPlaylistSearchstr').value;
            sendAPI({"cmd": "MPD_API_SMARTPLS_SAVE", "data": {"type": type, "playlist": name, "tag": tag, "searchstr": searchstr}});
        } else if (type == 'sticker') {
            let stickerEl = document.getElementById('selectSaveSmartPlaylistSticker');
            let sticker = stickerEl.options[stickerEl.selectedIndex].value;
            let maxentriesEl = document.getElementById('inputSaveSmartPlaylistStickerMaxentries');
            if (!validateInt(maxentriesEl)) {
                return;
            }
            let maxentries = maxentriesEl.value;
            sendAPI({"cmd": "MPD_API_SMARTPLS_SAVE", "data": {"type": type, "playlist": name, "sticker": sticker, "maxentries": maxentries}});
        } else if (type == 'newest') {
            let timerangeEl = document.getElementById('inputSaveSmartPlaylistNewestTimerange');
            if (!validateInt(timerangeEl)) {
                return;
            }
            let timerange = parseInt(timerangeEl.value) * 60 * 60 * 24;
            sendAPI({"cmd": "MPD_API_SMARTPLS_SAVE", "data": {"type": type, "playlist": name, "timerange": timerange}});
        }
        else {
            document.getElementById('saveSmartPlaylistType').classList.add('is-invalid');
            return;
        }
        modalSaveSmartPlaylist.hide();
        showNotification(t('Saved smart playlist %{name}', {"name": name}), '', '', 'success');
    }
    else {
        document.getElementById('saveSmartPlaylistName').classList.add('is-invalid');
    }
}

function showAddToPlaylist(uri) {
    document.getElementById('addToPlaylistUri').value = uri;
    document.getElementById('addToPlaylistPlaylist').innerHTML = '';
    document.getElementById('addToPlaylistNewPlaylist').value = '';
    document.getElementById('addToPlaylistNewPlaylistDiv').classList.add('hide');
    document.getElementById('addToPlaylistNewPlaylist').classList.remove('is-invalid');
    toggleBtn('toggleAddToPlaylistBtn',0);
    let streamUrl = document.getElementById('streamUrl')
    streamUrl.focus();
    streamUrl.value = '';
    streamUrl.classList.remove('is-invalid');
    if (uri != 'stream') {
        document.getElementById('addStreamFooter').classList.add('hide');
        document.getElementById('addStreamFrm').classList.add('hide');
        document.getElementById('addToPlaylistFooter').classList.remove('hide');
        document.getElementById('addToPlaylistFrm').classList.remove('hide');
        document.getElementById('addToPlaylistCaption').innerText = t('Add to playlist');
    } else {
        document.getElementById('addStreamFooter').classList.remove('hide');
        document.getElementById('addStreamFrm').classList.remove('hide');
        document.getElementById('addToPlaylistFooter').classList.add('hide');
        document.getElementById('addToPlaylistFrm').classList.add('hide');
        document.getElementById('addToPlaylistCaption').innerText = t('Add stream');
    }
    modalAddToPlaylist.show();
    if (settings.featPlaylists) {
        playlistEl = 'addToPlaylistPlaylist';
        sendAPI({"cmd": "MPD_API_PLAYLIST_LIST","data": {"offset": 0, "filter": "-"}}, getAllPlaylists);
    }
}

//eslint-disable-next-line no-unused-vars
function addToPlaylist() {
    let uri = document.getElementById('addToPlaylistUri').value;
    if (uri == 'stream') {
        uri = document.getElementById('streamUrl').value;
        if (uri == '' || uri.indexOf('http') == -1) {
            document.getElementById('streamUrl').classList.add('is-invalid');
            return;
        }
    }
    let plistEl = document.getElementById('addToPlaylistPlaylist');
    let plist = plistEl.options[plistEl.selectedIndex].value;
    if (plist == 'new') {
        let newPl = document.getElementById('addToPlaylistNewPlaylist').value;
        if (validatePlname(newPl) == true) {
            plist = newPl;
        } else {
            document.getElementById('addToPlaylistNewPlaylist').classList.add('is-invalid');
            return;
        }
    }
    if (plist != '') {
        if (uri == 'SEARCH') {
            addAllFromSearchPlist(plist);
        }
        else if (uri == 'DATABASE') {
            addAllFromBrowseDatabasePlist(plist);
        }
        else {
            sendAPI({"cmd": "MPD_API_PLAYLIST_ADD_TRACK", "data": {"uri": uri, "plist": plist}});
        }
        modalAddToPlaylist.hide();
    }
    else {
        document.getElementById('addToPlaylistPlaylist').classList.add('is-invalid');
    }
}

//eslint-disable-next-line no-unused-vars
function addToQueue() {
    let formOK = true;
    let inputAddToQueueQuantityEl = document.getElementById('inputAddToQueueQuantity');
    if (!validateInt(inputAddToQueueQuantityEl)) {
        formOK = false;
    }
    
    if (formOK == true) {
        let selectAddToQueueMode = document.getElementById('selectAddToQueueMode');
        let selectAddToQueuePlaylist = document.getElementById('selectAddToQueuePlaylist');
        sendAPI({"cmd": "MPD_API_QUEUE_ADD_RANDOM", "data": {
            "mode": selectAddToQueueMode.options[selectAddToQueueMode.selectedIndex].value,
            "playlist":  selectAddToQueuePlaylist.options[selectAddToQueuePlaylist.selectedIndex].value,
            "quantity":  document.getElementById('inputAddToQueueQuantity').value
        }});
        modalAddToQueue.hide();
    }
}

//eslint-disable-next-line no-unused-vars
function addStream() {
    let streamUriEl = document.getElementById('streamUrl');
    if (validateStream(streamUriEl) == true) {
        sendAPI({"cmd": "MPD_API_QUEUE_ADD_TRACK", "data": {"uri": streamUriEl.value}});
        modalAddToPlaylist.hide();
        showNotification(t('Added stream %{streamUri} to queue', {"streamUri": streamUriEl.value}), '', '', 'success');
    }
}

//eslint-disable-next-line no-unused-vars
function showRenamePlaylist(from) {
    document.getElementById('renamePlaylistTo').classList.remove('is-invalid');
    modalRenamePlaylist.show();
    document.getElementById('renamePlaylistFrom').value = from;
    document.getElementById('renamePlaylistTo').value = '';
}

//eslint-disable-next-line no-unused-vars
function renamePlaylist() {
    let from = document.getElementById('renamePlaylistFrom').value;
    let to = document.getElementById('renamePlaylistTo').value;
    if (to != from && validatePlname(to) == true && validatePlname(from) == true) {
        sendAPI({"cmd": "MPD_API_PLAYLIST_RENAME", "data": {"from": from, "to": to}});
        modalRenamePlaylist.hide();
    }
    else {
        document.getElementById('renamePlaylistTo').classList.add('is-invalid');
    }
}

//eslint-disable-next-line no-unused-vars
function showSmartPlaylist(playlist) {
    sendAPI({"cmd": "MPD_API_SMARTPLS_GET", "data": {"playlist": playlist}}, parseSmartPlaylist);
}

//eslint-disable-next-line no-unused-vars
function updateSmartPlaylist(playlist) {
    sendAPI({"cmd": "MPD_API_SMARTPLS_UPDATE", "data": {"playlist": playlist}}, parseSmartPlaylist);
}

function parseBookmarks(obj) {
    let list = '<table class="table table-sm table-dark table-borderless mb-0">';
    for (let i = 0; i < obj.data.length; i++) {
        list += '<tr data-id="' + obj.data[i].id + '" data-type="' + obj.data[i].type + '" ' +
                'data-uri="' + encodeURI(obj.data[i].uri) + '">' +
                '<td class="nowrap"><a class="text-light" href="#" data-href="goto">' + e(obj.data[i].name) + '</a></td>' +
                '<td><a class="text-light material-icons material-icons-small" href="#" data-href="edit">edit</a></td><td>' +
                '<a class="text-light material-icons material-icons-small" href="#" data-href="delete">delete</a></td></tr>';
    }
    if (obj.data.length == 0) {
        list += '<tr><td class="text-light nowrap">' +t('No bookmarks found') + '</td></tr>';
    }
    list += '</table>';
    document.getElementById('BrowseFilesystemBookmarks').innerHTML = list;
}

function showBookmarkSave(id, name, uri, type) {
    document.getElementById('saveBookmarkName').classList.remove('is-invalid');
    document.getElementById('saveBookmarkId').value = id;
    document.getElementById('saveBookmarkName').value = name;
    document.getElementById('saveBookmarkUri').value = uri;
    document.getElementById('saveBookmarkType').value = type;
    modalSaveBookmark.show();
}

//eslint-disable-next-line no-unused-vars
function saveBookmark() {
    let id = parseInt(document.getElementById('saveBookmarkId').value);
    let name = document.getElementById('saveBookmarkName').value;
    let uri = document.getElementById('saveBookmarkUri').value;
    let type = document.getElementById('saveBookmarkType').value;
    if (name != '') {
        sendAPI({"cmd": "MYMPD_API_BOOKMARK_SAVE", "data": {"id": id, "name": name, "uri": uri, "type": type}});
        modalSaveBookmark.hide();
    }
    else {
        document.getElementById('saveBookmarkName').classList.add('is-invalid');
    }
}

function dirname(uri) {
    return uri.replace(/\/[^/]*$/, '');
}

function basename(uri) {
   return uri.split('/').reverse()[0];
}

function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g,
        function toSolidBytes(match, p1) {
            return String.fromCharCode('0x' + p1);
    }));
}

function b64DecodeUnicode(str) {
    return decodeURIComponent(atob(str).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
}

function addMenuItem(href, text) {
    return '<a class="dropdown-item" href="#" data-href=\'' + b64EncodeUnicode(JSON.stringify(href)) + '\'>' + text +'</a>';
}

function hideMenu() {
    let menuEl = document.querySelector('[data-popover]');
    if (menuEl) {
        new Popover(menuEl, {});
        menuEl.Popover.hide();
        menuEl.removeAttribute('data-popover');
        if (menuEl.parentNode.parentNode.classList.contains('selected')) {
            focusTable(undefined, menuEl.parentNode.parentNode.parentNode.parentNode);
        }
    }
}

function showMenu(el, event) {
    event.preventDefault();
    event.stopPropagation();
    hideMenu();
    if (el.getAttribute('data-init')) {
        return;
    }

    let type = el.getAttribute('data-type');
    let uri = decodeURI(el.getAttribute('data-uri'));
    let name = el.getAttribute('data-name');
    let nextsongpos = 0;
    if (type == null || uri == '') {
        type = el.parentNode.parentNode.getAttribute('data-type');
        uri = decodeURI(el.parentNode.parentNode.getAttribute('data-uri'));
        name = el.parentNode.parentNode.getAttribute('data-name');
    }
    
    if (lastState)
        nextsongpos = lastState.data.nextSongPos;

    let menu = '';
    if ((app.current.app == 'Browse' && app.current.tab == 'Filesystem') || app.current.app == 'Search' ||
        (app.current.app == 'Browse' && app.current.tab == 'Database')) {
        menu += addMenuItem({"cmd": "appendQueue", "options": [type, uri, name]}, t('Append to queue')) +
            (type == 'song' ? addMenuItem({"cmd": "appendAfterQueue", "options": [type, uri, nextsongpos, name]}, t('Add after current playing song')) : '') +
            addMenuItem({"cmd": "replaceQueue", "options": [type, uri, name]}, t('Replace queue')) +
            (type != 'plist' && type != 'smartpls' && settings.featPlaylists ? addMenuItem({"cmd": "showAddToPlaylist", "options": [uri]}, t('Add to playlist')) : '') +
            (type == 'song' ? addMenuItem({"cmd": "songDetails", "options": [uri]}, t('Song details')) : '') +
            (type == 'plist' || type == 'smartpls' ? addMenuItem({"cmd": "playlistDetails", "options": [uri]}, t('View playlist')) : '') +
            (type == 'dir' ? addMenuItem({"cmd": "showBookmarkSave", "options": [-1, name, uri, type]}, t('Add bookmark')) : '');
        
        if (app.current.app == 'Search') {
            let baseuri = dirname(uri);
            menu += '<div class="dropdown-divider"></div>' +
                '<a class="dropdown-item" id="advancedMenuLink" data-toggle="collapse" href="#advancedMenu"><span class="material-icons material-icons-small-left">keyboard_arrow_right</span>Album actions</a>' +
                '<div class="collapse" id="advancedMenu">' +
                    addMenuItem({"cmd": "appendQueue", "options": [type, baseuri, name]}, t('Append to queue')) +
                    addMenuItem({"cmd": "appendAfterQueue", "options": [type, baseuri, nextsongpos, name]}, t('Add after current playing song')) +
                    addMenuItem({"cmd": "replaceQueue", "options": [type, baseuri, name]}, t('Replace queue')) +
                    (settings.featPlaylists ? addMenuItem({"cmd": "showAddToPlaylist", "options": [baseuri]}, t('Add to playlist')) : '') +
                '</div>';
        }
    }
    else if (app.current.app == 'Browse' && app.current.tab == 'Playlists' && app.current.view == 'All') {
        menu += addMenuItem({"cmd": "appendQueue", "options": [type, uri, name]}, t('Append to queue')) +
            addMenuItem({"cmd": "replaceQueue", "options": [type, uri, name]}, t('Replace queue')) +
            (type == 'smartpls' ? addMenuItem({"cmd": "playlistDetails", "options": [uri]}, t('View playlist')) : addMenuItem({"cmd": "playlistDetails", "options": [uri]}, t('Edit playlist')))+
            (type == 'smartpls' ? addMenuItem({"cmd": "showSmartPlaylist", "options": [uri]}, t('Edit smart playlist')) : '') +
            (settings.smartpls == true && type == 'smartpls' ? addMenuItem({"cmd": "updateSmartPlaylist", "options": [uri]}, t('Update smart playlist')) : '') +
            addMenuItem({"cmd": "showRenamePlaylist", "options": [uri]}, t('Rename playlist')) + 
            addMenuItem({"cmd": "showDelPlaylist", "options": [uri]}, t('Delete playlist'));
    }
    else if (app.current.app == 'Browse' && app.current.tab == 'Playlists' && app.current.view == 'Detail') {
        let x = document.getElementById('BrowsePlaylistsDetailList');
        menu += addMenuItem({"cmd": "appendQueue", "options": [type, uri, name]}, t('Append to queue')) +
            addMenuItem({"cmd": "replaceQueue", "options": [type, uri, name]}, t('Replace queue')) +
            (x.getAttribute('data-ro') == 'false' ? addMenuItem({"cmd": "removeFromPlaylist", "options": [x.getAttribute('data-uri'), 
                    el.parentNode.parentNode.getAttribute('data-songpos')]}, t('Remove')) : '') +
            addMenuItem({"cmd": "showAddToPlaylist", "options": [uri]}, t('Add to playlist')) +
            (uri.indexOf('http') == -1 ? addMenuItem({"cmd": "songDetails", "options": [uri]}, t('Song details')) : '');
    }
    else if (app.current.app == 'Queue' && app.current.tab == 'Current') {
        menu += addMenuItem({"cmd": "delQueueSong", "options": ["single", el.parentNode.parentNode.getAttribute('data-trackid')]}, t('Remove')) +
            addMenuItem({"cmd": "delQueueSong", "options": ["range", 0, el.parentNode.parentNode.getAttribute('data-songpos')]}, t('Remove all upwards')) +
            addMenuItem({"cmd": "delQueueSong", "options": ["range", (parseInt(el.parentNode.parentNode.getAttribute('data-songpos'))-1), -1]}, t('Remove all downwards')) +
            (uri.indexOf('http') == -1 ? addMenuItem({"cmd": "songDetails", "options": [uri]}, t('Song details')) : '');
    }
    else if (app.current.app == 'Queue' && app.current.tab == 'LastPlayed') {
        menu += addMenuItem({"cmd": "appendQueue", "options": [type, uri, name]}, t('Append to queue')) +
            addMenuItem({"cmd": "replaceQueue", "options": [type, uri, name]}, t('Replace queue')) +
            addMenuItem({"cmd": "showAddToPlaylist", "options": [uri]}, t('Add to playlist')) +
            (uri.indexOf('http') == -1 ? addMenuItem({"cmd": "songDetails", "options": [uri]}, t('Song details')) : '');
    }

    new Popover(el, { trigger: 'click', delay: 0, dismissible: true, template: '<div class="popover" role="tooltip">' +
        '<div class="arrow"></div>' +
        '<div class="popover-content">' + menu + '</div>' +
        '</div>', content: ' '});
    let popoverInit = el.Popover;
    el.setAttribute('data-init', 'true');
    el.addEventListener('shown.bs.popover', function(event) {
        event.target.setAttribute('data-popover', 'true');
        document.getElementsByClassName('popover-content')[0].addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();
            if (event.target.nodeName == 'A') {
                let dh = event.target.getAttribute('data-href');
                if (dh) {
                    let cmd = JSON.parse(b64DecodeUnicode(dh));
                    parseCmd(event, cmd);
                    hideMenu();
                }
            }
        }, false);
        document.getElementsByClassName('popover-content')[0].addEventListener('keydown', function(event) {
            event.preventDefault();
            event.stopPropagation();
            if (event.key == 'ArrowDown' || event.key == 'ArrowUp') {
                let menuItemsHtml = this.getElementsByTagName('a');
                let menuItems = Array.prototype.slice.call(menuItemsHtml);
                let idx = menuItems.indexOf(document.activeElement);
                do {
                    idx = event.key == 'ArrowUp' ? (idx > 1 ? idx - 1 : 0)
                                                 : event.key == 'ArrowDown' ? ( idx < menuItems.length - 1 ? idx + 1 : idx)
                                                                            : idx;
                    if ( idx === 0 || idx === menuItems.length -1 ) {
                        break;
                    }
                } while ( !menuItems[idx].offsetHeight )
                menuItems[idx] && menuItems[idx].focus();
            }
            else if (event.key == 'Enter') {
                event.target.click();
            }
            else if (event.key == 'Escape') {
                hideMenu();
            }
        }, false);
        let collapseLink = document.getElementById('advancedMenuLink');
        if (collapseLink) {
            collapseLink.addEventListener('click', function() {
                let icon = this.getElementsByTagName('span')[0];
                if (icon.innerText == 'keyboard_arrow_right') {
                    icon.innerText = 'keyboard_arrow_down';
                }
                else {
                    icon.innerText = 'keyboard_arrow_right';
                }
            }, false);
            new Collapse(collapseLink);
        }
        document.getElementsByClassName('popover-content')[0].firstChild.focus();
    }, false);
    popoverInit.show();
}

function sendAPI(request, callback, onerror) {
    let ajaxRequest=new XMLHttpRequest();
    ajaxRequest.open('POST', subdir + '/api', true);
    ajaxRequest.setRequestHeader('Content-type', 'application/json');
    ajaxRequest.onreadystatechange = function() {
        if (ajaxRequest.readyState == 4) {
            if (ajaxRequest.responseText != '') {
                let obj = JSON.parse(ajaxRequest.responseText);
                if (obj.type == 'error') {
                    if (obj.number != undefined) {
                        showNotification(t(obj.data, obj.number, obj.values), '', '', 'danger');
                    }
                    else {
                        showNotification(t(obj.data, obj.values), '', '', 'success');
                    }
                    logError(obj.data);
                    if (onerror == true) {
                        if (callback != undefined && typeof(callback) == 'function') {
                            logDebug('Got API response of type "' + obj.type + '" calling ' + callback.name);
                            callback(obj);
                        }
                    }
                }
                else if (obj.type == 'result' && obj.data != 'ok') {
                    logDebug('Got API response: ' + obj.data);
                    if (obj.number != undefined) {
                        showNotification(t(obj.data, obj.number, obj.values), '', '', 'success');
                    }
                    else {
                        showNotification(t(obj.data, obj.values), '', '', 'success');
                    }
                }
                else if (callback != undefined && typeof(callback) == 'function') {
                    logDebug('Got API response of type "' + obj.type + '" calling ' + callback.name);
                    callback(obj);
                }
            }
            else {
                logError('Empty response for request: ' + JSON.stringify(request));
                if (onerror == true) {
                    if (callback != undefined && typeof(callback) == 'function') {
                        logDebug('Got empty API response calling ' + callback.name);
                        callback('');
                    }
                }
            }
        }
    };
    ajaxRequest.send(JSON.stringify(request));
    logDebug('Send API request: ' + request.cmd);
}

//eslint-disable-next-line no-unused-vars
function updateDB() {
    sendAPI({"cmd": "MPD_API_DATABASE_UPDATE"});
    updateDBstarted(true);
}

//eslint-disable-next-line no-unused-vars
function rescanDB() {
    sendAPI({"cmd": "MPD_API_DATABASE_RESCAN"});
    updateDBstarted(true);
}

function updateDBstarted(showModal) {
    if (showModal == true) {
        document.getElementById('updateDBfinished').innerText = '';
        document.getElementById('updateDBfooter').classList.add('hide');
        let updateDBprogress = document.getElementById('updateDBprogress');
        updateDBprogress.style.width = '20px';
        updateDBprogress.style.marginLeft = '-20px';
        modalUpdateDB.show();
        updateDBprogress.classList.add('updateDBprogressAnimate');
    }
    else {
        showNotification(t('Database update started'), '', '', 'success');
    }
}

function updateDBfinished(idleEvent) {
    if (document.getElementById('modalUpdateDB').classList.contains('show')) {
        if (idleEvent == 'update_database') {
            document.getElementById('updateDBfinished').innerText = t('Database successfully updated');
        }
        else if (idleEvent == 'update_finished') {
            document.getElementById('updateDBfinished').innerText = t('Database update finished');
        }
        let updateDBprogress = document.getElementById('updateDBprogress');
        updateDBprogress.classList.remove('updateDBprogressAnimate');
        updateDBprogress.style.width = '100%';
        updateDBprogress.style.marginLeft = '0px';
        document.getElementById('updateDBfooter').classList.remove('hide');
    }
    else {
        if (idleEvent == 'update_database') {
            showNotification(t('Database successfully updated'), '', '', 'success');
        }
        else if (idleEvent == 'update_finished') {
            showNotification(t('Database update finished'), '', '', 'success');
        }
    }
}

//eslint-disable-next-line no-unused-vars
function clickPlay() {
    if (playstate != 'play') {
        sendAPI({"cmd": "MPD_API_PLAYER_PLAY"});
    }
    else {
        sendAPI({"cmd": "MPD_API_PLAYER_PAUSE"});
    }
}

//eslint-disable-next-line no-unused-vars
function clickStop() {
    sendAPI({"cmd": "MPD_API_PLAYER_STOP"});
}

//eslint-disable-next-line no-unused-vars
function clickPrev() {
    sendAPI({"cmd": "MPD_API_PLAYER_PREV"});
}

//eslint-disable-next-line no-unused-vars
function clickNext() {
    sendAPI({"cmd": "MPD_API_PLAYER_NEXT"});
}

function delQueueSong(mode, start, end) {
    if (mode == 'range') {
        sendAPI({"cmd": "MPD_API_QUEUE_RM_RANGE", "data": {"start": start, "end": end}});
    }
    else if (mode == 'single') {
        sendAPI({"cmd": "MPD_API_QUEUE_RM_TRACK", "data": { "track": start}});
    }
}

//eslint-disable-next-line no-unused-vars
function showDelPlaylist(uri) {
    document.getElementById('deletePlaylist').value = uri;
    modalDeletePlaylist.show();
}

//eslint-disable-next-line no-unused-vars
function delPlaylist() {
    let uri = document.getElementById('deletePlaylist').value;
    sendAPI({"cmd": "MPD_API_PLAYLIST_RM", "data": {"uri": uri}});
    modalDeletePlaylist.hide();
}

//eslint-disable-next-line no-unused-vars
function saveSettings() {
    let formOK = true;

    let inputCrossfade = document.getElementById('inputCrossfade');
    if (!inputCrossfade.getAttribute('disabled')) {
        if (!validateInt(inputCrossfade)) {
            formOK = false;
        }
    }

    let inputJukeboxQueueLength = document.getElementById('inputJukeboxQueueLength');
    if (!validateInt(inputJukeboxQueueLength)) {
        formOK = false;
    }
    
    let selectStreamModeEl = document.getElementById('selectStreamMode');
    let streamUrl = '';
    let streamPort = '';
    let inputStreamUrl = document.getElementById('inputStreamUrl');
    if (selectStreamModeEl.options[selectStreamModeEl.selectedIndex].value == 'port') {
        streamPort = inputStreamUrl.value;
        if (!validateInt(inputStreamUrl)) {
            formOK = false;
        }
    }
    else {
        streamUrl = inputStreamUrl.value;
        if (!validateStream(inputStreamUrl)) {
            formOK = false;
        }
    }

    let inputCoverimageSize = document.getElementById('inputCoverimageSize');
    if (!validateInt(inputCoverimageSize)) {
        formOK = false;
    }
    
    let inputCoverimageName = document.getElementById('inputCoverimageName');
    if (!validateFilename(inputCoverimageName)) {
        formOK = false;
    }
    
    let inputMaxElementsPerPage = document.getElementById('inputMaxElementsPerPage');
    if (!validateInt(inputMaxElementsPerPage)) {
        formOK = false;
    }
    if (parseInt(inputMaxElementsPerPage.value) > 200) {
        formOK = false;
    }
    
    let inputLastPlayedCount = document.getElementById('inputLastPlayedCount');
    if (!validateInt(inputLastPlayedCount)) {
        formOK = false;
    }
    
    if (document.getElementById('btnLoveEnable').classList.contains('active')) {
        let inputLoveChannel = document.getElementById('inputLoveChannel');
        let inputLoveMessage = document.getElementById('inputLoveMessage');
        if (!validateNotBlank(inputLoveChannel) || !validateNotBlank(inputLoveMessage)) {
            formOK = false;
        }
    }

    if (settings.featMixramp == true) {
        let inputMixrampdb = document.getElementById('inputMixrampdb');
        if (!inputMixrampdb.getAttribute('disabled')) {
            if (!validateFloat(inputMixrampdb)) {
                formOK = false;
            } 
        }
        let inputMixrampdelay = document.getElementById('inputMixrampdelay');
        if (!inputMixrampdelay.getAttribute('disabled')) {
            if (inputMixrampdelay.value == 'nan') {
                inputMixrampdelay.value = '-1';
            }
            if (!validateFloat(inputMixrampdelay)) {
                formOK = false;
            }
        }
    }
    
    if (formOK == true) {
        let selectReplaygain = document.getElementById('selectReplaygain');
        let selectJukeboxPlaylist = document.getElementById('selectJukeboxPlaylist');
        let selectJukeboxMode = document.getElementById('selectJukeboxMode');
        let selectLocale = document.getElementById('selectLocale');
        sendAPI({"cmd": "MYMPD_API_SETTINGS_SET", "data": {
            "consume": (document.getElementById('btnConsume').classList.contains('active') ? 1 : 0),
            "random": (document.getElementById('btnRandom').classList.contains('active') ? 1 : 0),
            "single": (document.getElementById('btnSingle').classList.contains('active') ? 1 : 0),
            "repeat": (document.getElementById('btnRepeat').classList.contains('active') ? 1 : 0),
            "replaygain": selectReplaygain.options[selectReplaygain.selectedIndex].value,
            "crossfade": document.getElementById('inputCrossfade').value,
            "mixrampdb": (settings.featMixramp == true ? document.getElementById('inputMixrampdb').value : settings.mixrampdb),
            "mixrampdelay": (settings.featMixramp == true ? document.getElementById('inputMixrampdelay').value : settings.mixrampdelay),
            "notificationWeb": (document.getElementById('btnNotifyWeb').classList.contains('active') ? true : false),
            "notificationPage": (document.getElementById('btnNotifyPage').classList.contains('active') ? true : false),
            "jukeboxMode": selectJukeboxMode.options[selectJukeboxMode.selectedIndex].value,
            "jukeboxPlaylist": selectJukeboxPlaylist.options[selectJukeboxPlaylist.selectedIndex].value,
            "jukeboxQueueLength": document.getElementById('inputJukeboxQueueLength').value,
            "autoPlay": (document.getElementById('btnAutoPlay').classList.contains('active') ? true : false),
            "bgCover": (document.getElementById('btnBgCover').classList.contains('active') ? true : false),
            "bgColor": document.getElementById('inputBgColor').value,
            "bgCssFilter": document.getElementById('inputBgCssFilter').value,
            "featLocalplayer": (document.getElementById('btnFeatLocalplayer').classList.contains('active') ? true : false),
            "localplayerAutoplay": (document.getElementById('btnLocalplayerAutoplay').classList.contains('active') ? true : false),
            "streamUrl": streamUrl,
            "streamPort": streamPort,
            "coverimage": (document.getElementById('btnCoverimage').classList.contains('active') ? true : false),
            "coverimageName": document.getElementById('inputCoverimageName').value,
            "coverimageSize": document.getElementById('inputCoverimageSize').value,
            "locale": selectLocale.options[selectLocale.selectedIndex].value,
            "love": (document.getElementById('btnLoveEnable').classList.contains('active') ? true : false),
            "loveChannel": document.getElementById('inputLoveChannel').value,
            "loveMessage": document.getElementById('inputLoveMessage').value,
            "maxElementsPerPage": document.getElementById('inputMaxElementsPerPage').value,
            "stickers": (document.getElementById('btnStickers').classList.contains('active') ? true : false),
            "lastPlayedCount": document.getElementById('inputLastPlayedCount').value,
            "smartpls": (document.getElementById('btnSmartpls').classList.contains('active') ? true : false),
            "taglist": document.getElementById('inputEnabledTags').value.replace(/\s/g, ''),
            "searchtaglist": document.getElementById('inputSearchTags').value.replace(/\s/g, ''),
            "browsetaglist": document.getElementById('inputBrowseTags').value.replace(/\s/g, '')
        }}, getSettings);
        modalSettings.hide();
    }
}

//eslint-disable-next-line no-unused-vars
function resetSettings() {
    sendAPI({"cmd": "MYMPD_API_SETTINGS_RESET"}, getSettings);
}

function addAllFromBrowseFilesystem() {
    sendAPI({"cmd": "MPD_API_QUEUE_ADD_TRACK", "data": {"uri": app.current.search}});
    showNotification(t('Added all songs'), '', '', 'success');
}

function addAllFromSearchPlist(plist) {
    if (settings.featAdvsearch) {
        sendAPI({"cmd": "MPD_API_DATABASE_SEARCH_ADV", "data": {"plist": plist, "sort": "", "sortdesc": false, "expression": app.current.search, "offset": 0, "cols": settings.colsSearch}});
    }
    else {
        sendAPI({"cmd": "MPD_API_DATABASE_SEARCH", "data": {"plist": plist, "filter": app.current.filter, "searchstr": app.current.search, "offset": 0, "cols": settings.colsSearch}});
    }
    showNotification(t('Added all songs from search to %{playlist}', {"playlist": plist}), '', '', 'success');
}

function addAllFromBrowseDatabasePlist(plist) {
    if (app.current.search.length >= 2) {
        sendAPI({"cmd": "MPD_API_DATABASE_SEARCH", "data": {"plist": plist, "filter": app.current.view, "searchstr": app.current.search, "offset": 0, "cols": settings.colsSearch}});
        showNotification(t('Added all songs from database selection to %{playlist}', {"playlist": plist}), '', '', 'success');
    }
}

function scrollToPosY(pos) {
    document.body.scrollTop = pos; // For Safari
    document.documentElement.scrollTop = pos; // For Chrome, Firefox, IE and Opera
}

function gotoPage(x) {
    switch (x) {
        case 'next':
            app.current.page += settings.maxElementsPerPage;
            break;
        case 'prev':
            app.current.page -= settings.maxElementsPerPage;
            if (app.current.page < 0)
                app.current.page = 0;
            break;
        default:
            app.current.page = x;
    }
    appGoto(app.current.app, app.current.tab, app.current.view, app.current.page + '/' + app.current.filter + '/' + app.current.sort + '/' + app.current.search);
}

//eslint-disable-next-line no-unused-vars
function saveQueue() {
    let plName = document.getElementById('saveQueueName').value;
    if (validatePlname(plName) == true) {
        sendAPI({"cmd": "MPD_API_QUEUE_SAVE", "data": {"plist": plName}});
        modalSaveQueue.hide();
    }
    else {
        document.getElementById('saveQueueName').classList.add('is-invalid');
    }
}

function toggleAlert(alertBox, state, msg) {
    let mpdState = document.getElementById(alertBox);
    if (state == false) {
        mpdState.innerHTML = '';
        mpdState.classList.add('hide');
    }
    else {
        mpdState.innerHTML = msg;
        mpdState.classList.remove('hide');
    }
}

function showNotification(notificationTitle, notificationText, notificationHtml, notificationType) {
    if (settings.notificationWeb == true) {
        let notification = new Notification(notificationTitle, {icon: 'assets/favicon.ico', body: notificationText});
        setTimeout(function(notification) {
            notification.close();
        }, 3000, notification);    
    } 
    if (settings.notificationPage == true) {
        let alertBox;
        if (!document.getElementById('alertBox')) {
            alertBox = document.createElement('div');
            alertBox.setAttribute('id', 'alertBox');
            alertBox.addEventListener('click', function() {
                hideNotification();
            }, false);
        }
        else {
            alertBox = document.getElementById('alertBox');
        }
        alertBox.classList.remove('alert-success', 'alert-danger');
        alertBox.classList.add('alert','alert-' + notificationType);
        alertBox.innerHTML = '<div><strong>' + e(notificationTitle) + '</strong><br/>' + (notificationHtml == '' ? e(notificationText) : notificationHtml) + '</div>';
        document.getElementsByTagName('main')[0].append(alertBox);
        document.getElementById('alertBox').classList.add('alertBoxActive');
        if (alertTimeout) {
            clearTimeout(alertTimeout);
        }
        alertTimeout = setTimeout(function() {
            hideNotification();    
        }, 3000);
    }
}

function hideNotification() {
    if (document.getElementById('alertBox')) {
        document.getElementById('alertBox').classList.remove('alertBoxActive');
        setTimeout(function() {
            let alertBox = document.getElementById('alertBox');
            if (alertBox)
                alertBox.remove();
        }, 600);
    }
}

function notificationsSupported() {
    return "Notification" in window;
}

function setBackgroundImage(imageUrl) {
    let old = document.querySelectorAll('.albumartbg');
    for (let i = 0; i < old.length; i++) {
        if (old[i].style.zIndex == -10) {
            old[i].remove();        
        }
        else {
            old[i].style.zIndex = -10;
        }
    }
    let div = document.createElement('div');
    div.classList.add('albumartbg');
    div.style.backgroundImage = 'url("' + subdir + imageUrl + '")';
    div.style.opacity = 0;
    let body = document.getElementsByTagName('body')[0];
    body.insertBefore(div, body.firstChild);

    let img = new Image();
    img.onload = function() {
        document.querySelector('.albumartbg').style.opacity = 1;
    };
    img.src = imageUrl;
}

function clearBackgroundImage() {
    let old = document.querySelectorAll('.albumartbg');
    for (let i = 0; i < old.length; i++) {
        if (old[i].style.zIndex == -10) {
            old[i].remove();        
        }
        else {
            old[i].style.zIndex = -10;
            old[i].style.opacity = 0;
        }
    }
}

function setCurrentCover(imageUrl) {
    let old = domCache.currentCover.querySelectorAll('.coverbg');
    for (let i = 0; i < old.length; i++) {
        if (old[i].style.zIndex == 2) {
            old[i].remove();        
        }
        else {
            old[i].style.zIndex = 2;
        }
    }

    let div = document.createElement('div');
    div.classList.add('coverbg');
    div.style.backgroundImage = 'url("' + subdir + imageUrl + '")';
    div.style.opacity = 0;
    domCache.currentCover.insertBefore(div, domCache.currentCover.firstChild);

    let img = new Image();
    img.onload = function() {
        domCache.currentCover.querySelector('.coverbg').style.opacity = 1;
    };
    img.src = imageUrl;
}

function clearCurrentCover() {
    let old = domCache.currentCover.querySelectorAll('.coverbg');
    for (let i = 0; i < old.length; i++) {
        if (old[i].style.zIndex == 2) {
            old[i].remove();        
        }
        else {
            old[i].style.zIndex = 2;
            old[i].style.opacity = 0;
        }
    }
}

function songChange(obj) {
    if (obj.type != 'song_change') {
        return;
    }
    let curSong = obj.data.Title + obj.data.Artist + obj.data.Album + obj.data.uri + obj.data.currentSongId;
    if (lastSong == curSong) 
        return;
    let textNotification = '';
    let htmlNotification = '';
    let pageTitle = '';

    setCurrentCover(obj.data.cover);
    if (settings.bgCover == true && settings.featCoverimage == true) {
        if (obj.data.cover.indexOf('coverimage-') > -1 ) {
            clearBackgroundImage();
        }
        else {
            setBackgroundImage(obj.data.cover);
        }
    }

    if (typeof obj.data.Artist != 'undefined' && obj.data.Artist.length > 0 && obj.data.Artist != '-') {
        textNotification += obj.data.Artist;
        htmlNotification += obj.data.Artist;
        pageTitle += obj.data.Artist + ' - ';
    } 

    if (typeof obj.data.Album != 'undefined' && obj.data.Album.length > 0 && obj.data.Album != '-') {
        textNotification += ' - ' + obj.data.Album;
        htmlNotification += '<br/>' + obj.data.Album;
    }

    if (typeof obj.data.Title != 'undefined' && obj.data.Title.length > 0) {
        pageTitle += obj.data.Title;
        domCache.currentTitle.innerText = obj.data.Title;
        domCache.currentTitle.setAttribute('data-uri', encodeURI(obj.data.uri));
    }
    else {
        domCache.currentTitle.innerText = '';
        domCache.currentTitle.setAttribute('data-uri', '');
    }
    document.title = 'myMPD: ' + pageTitle;
    document.getElementById('headerTitle').innerText = pageTitle;
    document.getElementById('headerTitle').title = pageTitle;

    if (settings.featStickers == true) {
        setVoteSongBtns(obj.data.like, obj.data.uri);
    }

    for (let i = 0; i < settings.colsPlayback.length; i++) {
        let c = document.getElementById('current' + settings.colsPlayback[i]);
        if (c) {
            c.getElementsByTagName('h4')[0].innerText = obj.data[settings.colsPlayback[i]];
            c.setAttribute('data-name', encodeURI(obj.data[settings.colsPlayback[i]]));
        }
    }
    
    //Update Artist in queue view for http streams
    let playingTr = document.getElementById('queueTrackId' + obj.data.currentSongId);
    if (playingTr) {
        playingTr.getElementsByTagName('td')[1].innerText = obj.data.Title;
    }

    if (playstate == 'play') {
        showNotification(obj.data.Title, textNotification, htmlNotification, 'success');
    }
    lastSong = curSong;
    lastSongObj = obj;
}

function doSetFilterLetter(x) {
    let af = document.getElementById(x + 'Letters').getElementsByClassName('active')[0];
    if (af) {
        af.classList.remove('active');
    }
    let filter = app.current.filter;
    if (filter == '0') {
        filter = '#';
    }
    
    document.getElementById(x).innerHTML = '<span class="material-icons">filter_list</span>' + (filter != '-' ? ' ' + filter : '');
    
    if (filter != '-') {
        let btns = document.getElementById(x + 'Letters').getElementsByTagName('button');
        let btnsLen = btns.length;
        for (let i = 0; i < btnsLen; i++) {
            if (btns[i].innerText == filter) {
                btns[i].classList.add('active');
                break;
            }
        }
    }
}

function addFilterLetter(x) {
    let filter = '<button class="mr-1 mb-1 btn btn-sm btn-secondary material-icons material-icons-small">delete</button>' +
        '<button class="mr-1 mb-1 btn btn-sm btn-secondary">#</button>';
    for (let i = 65; i <= 90; i++) {
        filter += '<button class="mr-1 mb-1 btn-sm btn btn-secondary">' + String.fromCharCode(i) + '</button>';
    }

    let letters = document.getElementById(x);
    letters.innerHTML = filter;
    
    letters.addEventListener('click', function(event) {
        switch (event.target.innerText) {
            case 'delete':
                filter = '-';
                break;
            case '#':
                filter = '0';
                break;
            default:
                filter = event.target.innerText;
        }
        appGoto(app.current.app, app.current.tab, app.current.view, '0/' + filter + '/' + app.current.sort + '/' + app.current.search);
    }, false);
}

function selectTag(btnsEl, desc, setTo) {
    let btns = document.getElementById(btnsEl);
    let aBtn = btns.querySelector('.active')
    if (aBtn) {
        aBtn.classList.remove('active');
    }
    aBtn = btns.querySelector('[data-tag=' + setTo + ']');
    if (aBtn) {
        aBtn.classList.add('active');
        document.getElementById(desc).innerText = aBtn.innerText;
    }
}

function addTagList(el, list) {
    let tagList = '';
    if (list == 'searchtags') {
        if (settings.featTags == true)
            tagList += '<button type="button" class="btn btn-secondary btn-sm btn-block" data-tag="any">' + t('Any Tag') + '</button>';
        tagList += '<button type="button" class="btn btn-secondary btn-sm btn-block" data-tag="filename">' + t('Filename') + '</button>';
    }
    for (let i = 0; i < settings[list].length; i++)
        tagList += '<button type="button" class="btn btn-secondary btn-sm btn-block" data-tag="' + settings[list][i] + '">' + t(settings[list][i]) + '</button>';
    document.getElementById(el).innerHTML = tagList;
}

//eslint-disable-next-line no-unused-vars
function gotoTagList() {
    appGoto(app.current.app, app.current.tab, app.current.view, '0/-/-/');
}

//eslint-disable-next-line no-unused-vars
function openModal(modal) {
    window[modal].show();
}

//eslint-disable-next-line no-unused-vars
function openDropdown(dropdown) {
    window[dropdown].toggle();
}

//eslint-disable-next-line no-unused-vars
function focusSearch() {
    if (app.current.app == 'Queue') {
        document.getElementById('searchqueuestr').focus();
    }
    else if (app.current.app == 'Search') {
        domCache.searchstr.focus();
    }
    else {
        appGoto('Search');
    }
}

//eslint-disable-next-line no-unused-vars
function chVolume(increment) {
    let newValue = parseInt(domCache.volumeBar.value) + increment;
    if (newValue < 0)  {
        newValue = 0;
    }
    else if (newValue > 100) {
        newValue = 100;
    }
    domCache.volumeBar.value = newValue;
    sendAPI({"cmd": "MPD_API_PLAYER_VOLUME_SET", "data": {"volume": newValue}});
}

function gtPage(phrase, returnedEntities, totalEntities) {
    if (totalEntities > -1) {
        return t(phrase, totalEntities);
    }
    else if (returnedEntities + app.current.page < settings.maxElementsPerPage) {
        return t(phrase, returnedEntities);
    }
    else {
        return '> ' + t(phrase, settings.maxElementsPerPage);
    }
}

function beautifyDuration(x) {
    let days = Math.floor(x / 86400);
    let hours = Math.floor(x / 3600) - days * 24;
    let minutes = Math.floor(x / 60) - hours * 60 - days * 1440;
    let seconds = x - days * 86400 - hours * 3600 - minutes * 60;

    return (days > 0 ? days + '\u2009'+ t('Days') + ' ' : '') +
        (hours > 0 ? hours + '\u2009' + t('Hours') + ' ' + 
        (minutes < 10 ? '0' : '') : '') + minutes + '\u2009' + t('Minutes') + ' ' + 
        (seconds < 10 ? '0' : '') + seconds + '\u2009' + t('Seconds');
}

function beautifySongDuration(x) {
    let hours = Math.floor(x / 3600);
    let minutes = Math.floor(x / 60) - hours * 60;
    let seconds = x - hours * 3600 - minutes * 60;
    
    return (hours > 0 ? hours + ':' + (minutes < 10 ? '0' : '') : '') + 
        minutes + ':' + (seconds < 10 ? '0' : '') + seconds;
}

function genId(x) {
    return 'id' + x.replace(/[^\w-]/g, '');
}

function validateFilename(el) {
    if (el.value == '') {
        el.classList.add('is-invalid');
        return false;
    }
    else if (el.value.match(/^[\w-]+\.\w+$/) != null) {
        el.classList.remove('is-invalid');
        return true;
    }
    else {
        el.classList.add('is-invalid');
        return false;
    }
}

function validatePath(el) {
    if (el.value == '') {
        el.classList.add('is-invalid');
        return false;
    }
    else if (el.value.match(/^\/[/.\w-]+$/) != null) {
        el.classList.remove('is-invalid');
        return true;
    }
    else {
        el.classList.add('is-invalid');
        return false;
    }
}

function localeDate(secs) {
    let d = new Date(secs * 1000);
    return d.toLocaleString(locale);
}

function validatePlname(x) {
    if (x == '') {
        return false;
    }
    else if (x.match(/\/|\r|\n|"|'/) == null) {
        return true;
    }
    else {
        return false;
    }
}

function validateNotBlank(el) {
    let value = el.value.replace(/\s/g, '');
    if (value == '') {
        el.classList.add('is-invalid');
        return false;
    }
    else {
        el.classList.remove('is-invalid');
        return true;
    }
}

function validateInt(el) {
    let value = el.value.replace(/\d/g, '');
    if (value != '') {
        el.classList.add('is-invalid');
        return false;
    }
    else {
        el.classList.remove('is-invalid');
        return true;
    }
}

function validateFloat(el) {
    let value = el.value.replace(/[\d-.]/g, '');
    if (value != '') {
        el.classList.add('is-invalid');
        return false;
    }
    else {
        el.classList.remove('is-invalid');
        return true;
    }
}

function validateStream(el) {
    if (el.value.indexOf('://') > -1) {
        el.classList.remove('is-invalid');
        return true;
    }
    else {
        el.classList.add('is-invalid');
        return false;
    }
}

function validateHost(el) {
    if (el.value.match(/^([\w-.]+)$/) != null) {
        el.classList.remove('is-invalid');
        return true;
    }
    else {
        el.classList.add('is-invalid');
        return false;
    }
}

function logError(line) {
    logLog(0, 'ERROR: ' + line);
}

//eslint-disable-next-line no-unused-vars
function logWarn(line) {
    logLog(1, 'WARN: ' + line);
}

function logInfo(line) {
    logLog(2, 'INFO: ' + line);
}

function logVerbose(line) {
    logLog(3, 'VERBOSE: ' + line);
}

function logDebug(line) {
    logLog(4, 'DEBUG: ' + line);
}

function logLog(loglevel, line) {
    if (settings.loglevel >= loglevel) {
        if (loglevel == 0) {
            // eslint-disable-next-line no-console
            console.error(line);
        }
        else if (loglevel == 1) {
            // eslint-disable-next-line no-console
            console.warn(line);
        }
        else {
            // eslint-disable-next-line no-console
            console.log(line);
        }
    }
}

function e(x) {
    if (isNaN(x)) {
        return x.replace(/([<>])/g, function(m0, m1) {
            if (m1 == '<') return '&lt;';
            else if (m1 == '>') return '&gt;';
        });
    }
    else {
        return x;
    }
}

//Init app
appInitStart();
