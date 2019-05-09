var tab;
var startTime;
var currentWindowId;

function handleNewTab(newTab) {
    canonicalizeUrl(newTab);
    if (tab == null) {
        tab = newTab;
        tab.urlList = [tab.url];

        startTime = new Date().getTime();
        currentWindowId = tab.windowId;
    }
    else if (tab.canonicalizedUrl != newTab.canonicalizedUrl) {
        var endTime = new Date().getTime();
        console.log(`visted ${tab.canonicalizedUrl} for ${endTime - startTime} milliseconds.`);
        console.log(`visted these parts of the website: ${tab.urlList.toString()}`);

        tab = newTab;
        tab.urlList = [tab.url];

        startTime = endTime;
        currentWindowId = tab.windowId;
    }
    else if (tab.url != newTab.url) {
        if (!tab.urlList.includes(newTab.url)) {
            tab.urlList.push(tab.url);
        }
        tab.url = newTab.url;
    }
}

function canonicalizeUrl(newTab) {
    var indexToStopAt = newTab.url.indexOf("/", 10);
    newTab.canonicalizedUrl = indexToStopAt == -1 ? newTab.url : newTab.url.substring(0, indexToStopAt + 1);
}

chrome.windows.getAll(function (windowList) {
    var i = 0;
    while(i < windowList.length && !windowList[i].focused) {
        i++;
    }
    chrome.tabs.query({active: true, windowId: windowList[i].id}, function(results) {
        if (results.length == 1) {
            handleNewTab(results[0]);
        }
    });
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(newTab) {
        handleNewTab(newTab);
    });
});

chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, tab) {
    handleNewTab(tab);
})

chrome.windows.onFocusChanged.addListener(function (windowId) {
    chrome.tabs.query({active: true, windowId: windowId}, function(results) {
        if (results.length == 1) {
            handleNewTab(results[0]);
        }
    });
})