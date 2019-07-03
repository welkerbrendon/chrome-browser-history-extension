var tab = null;
var startTime;
var date;

function handleNewTab(newTab) {
    canonicalizeUrl(newTab);
    if (tab == null) {
        setData(newTab);
    }
    else if (tab.url.includes("chrome://") && !newTab.url.includes("chrome://")) {
        setData(newTab);
    }
    else if (tab.canonicalizedUrl != newTab.canonicalizedUrl ) {
        console.log(`visted ${tab.canonicalizedUrl}.`);
        console.log(`visted these parts of the website: ${tab.extensions.toString()}`);
        getAuthToken(function(authToken) {
            var tempDate = new Date();
            data = {
                'token': authToken,
                'url': tab.canonicalizedUrl,
                'start_time': startTime,
                'end_time': tempDate.getHours() + ":" + tempDate.getMinutes() + ":" + tempDate.getSeconds(),
                'extensions': tab.extensions,
                'day': date
            };
            console.log(`Will send follwing data to db: ${JSON.stringify(data)}`);
            fetch("https://daily-habbit-tracker.herokuapp.com/main/activities/site/", {
                method: 'POST',
                body: JSON.stringify(data),
                headers:{
                    'Content-Type': 'application/json'
                }
            })
            .then(function (res) {
                console.log(`Status: ${res.statusText}`);
                setData(newTab);
            })
            .catch(function (error) {
                console.log(`Error: ${error}`)
                setData(newTab);
            });
        });
    }
    else if (tab.url != newTab.url) {
        tab.url = newTab.url;
        var splitUrl = tab.url.split(".");
        if (splitUrl.length >= 3) {
            var urlEnd = splitUrl[splitUrl.length - 1];
            var index = urlEnd.indexOf("/") + 1;
            var extension = index > 0 ? urlEnd.slice(index, urlEnd.length) : "";
            if (!tab.extensions.includes(extension) && extension.length > 0) {
                tab.extensions.push(extension);
            }
        }
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

function setData(newTab) {
    tab = newTab;
    var splitUrl = tab.url.split(".");
    if (splitUrl.length >= 3) {
        var urlEnd = splitUrl[splitUrl.length - 1];
        var index = urlEnd.indexOf("/") + 1;
        var extension = index > 0 ? urlEnd.slice(index, urlEnd.length) : "";
        tab.extensions = extension == "" ? [] : [extension];
    }
    var tempDate = new Date();
    startTime = tempDate.getHours() + ":" + tempDate.getMinutes() + ":" + tempDate.getSeconds();
    date = tempDate.getFullYear() + "-" + (tempDate.getMonth() + 1) + "-" + tempDate.getDate(); 
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