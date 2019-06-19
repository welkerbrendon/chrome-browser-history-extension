var tab = null;
var startTime;

function handleNewTab(newTab) {
    canonicalizeUrl(newTab);
    if (tab == null) {
        tab = newTab;
        tab.urlList = [tab.url];
        date = new Date();
        sendableStartTime = date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds();
    }
    else if (tab.canonicalizedUrl != newTab.canonicalizedUrl) {
        var endTime = new Date().getTime();
        console.log(`visted ${tab.canonicalizedUrl} for ${endTime - startTime} milliseconds.`);
        console.log(`visted these parts of the website: ${tab.urlList.toString()}`);
        getAuthToken(function(authToken) {
            console.log(`Will send following informatoin to website: 
                    site url: ${tab.canonicalizedUrl}, start time: ${sendableStartTime}, 
                    extensions list: ${tab.urlList.toString()}, and user token: ${authToken}`);
            date = new Date()
            data = {
                'token': authToken,
                'url': tab.canonicalizedUrl,
                'start_time': sendableStartTime,
                'end_time': date.getHours() + ":" + date.getMinutes() + ":" + date.getSeconds(),
                'extensions': tab.urlList
            };
            console.log(`Data: ${JSON.stringify(data)}`);
            fetch("https://daily-habbit-tracker.herokuapp.com/main/activities/site/", {
                method: 'POST',
                body: JSON.stringify(data),
                headers:{
                    'Content-Type': 'application/json'
                }
            })
            .then(function (res) {
                console.log(`Status: ${res.statusText}`);

                tab = newTab;
                tab.urlList = [tab.url];
                startTime = endTime;
            })
            .catch(function (error) {
                console.log(`Error: ${error}`)

                tab = newTab;
                tab.urlList = [tab.url];
                startTime = endTime;
            });
        });
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

function getAuthToken(callback) {
    chrome.storage.local.get(['token'], function (result) {
        if (!result.token) {
            chrome.identity.launchWebAuthFlow(
                {'url': 'https://daily-habbit-tracker.herokuapp.com/accounts/extension-authentication/', 'interactive': true},
                function(redirect_url) { 
                    const receivedToken = redirect_url.split('=')[1]
                    chrome.storage.local.set({'token': receivedToken}, function() {
                        console.log(`Token is set to: ${receivedToken} and saved to chrome storage.`);
                        callback(receivedToken);
                    }); 
                });
        }
        else {
            data = {"token": result.token};
            fetch("https://daily-habbit-tracker.herokuapp.com/accounts/token-authentication/", {
                method: 'POST',
                body: JSON.stringify(data),
                headers:{
                    'Content-Type': 'application/json'
                }
            }).then(res => res.json())
            .then(function (response) {
                console.log(JSON.stringify(response));
                if (!response.valid) {
                    chrome.identity.launchWebAuthFlow(
                        {'url': 'https://daily-habbit-tracker.herokuapp.com/accounts/extension-authentication/', 'interactive': true},
                        function(redirect_url) { 
                            const newToken = redirect_url.split('=')[1]
                            chrome.storage.local.set({'token': newToken}, function() {
                                console.log(`Token is set to: ${newToken} and saved to chrome storage.`);
                                callback(newToken);
                            }); 
                        });
                }
                else {
                    console.log(`Token already saved and valid. Token=${result.token}`);
                    callback(result.token);
                }
            })
            .catch(function (error) {
                console.log(error);
                chrome.identity.launchWebAuthFlow(
                    {'url': 'https://daily-habbit-tracker.herokuapp.com/accounts/extension-authentication/', 'interactive': true},
                    function(redirect_url) { 
                        const newToken = redirect_url.split('=')[1]
                        chrome.storage.local.set({'token': newToken}, function() {
                            console.log(`Token is set to: ${newToken} and saved to chrome storage.`);
                            callback(newToken);
                        }); 
                    });
            })
        }
    });
}

/*chrome.tabs.onUpdated.addListener(function (tabId, changeInfo, newTab) {
    handleNewTab(newTab);
})*/

/*chrome.windows.onFocusChanged.addListener(function (windowId) {
    chrome.tabs.query({active: true, windowId: windowId}, function(results) {
        if (results.length == 1) {
            handleNewTab(results[0]);
        }
    });
})*/