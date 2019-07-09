var tab = null;
var startTime;
var date;

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

chrome.idle.onStateChanged.addListener(function (state) {
    if (state == "locked") {
        saveDataLocally();
    }
    else if (tab == null && state == "active") {
        chrome.tabs.query({active: true, currentWindow: true}, function (result) {
            sendSavedData();
            handleNewTab([result[0]]);
        });
    }
});

setInterval(checkCurrentTab, 10 * 60 * 1000);

function handleNewTab(newTab) {
    if (newTab != null) {
        canonicalizeUrl(newTab);
        if (tab == null) {
            setData(newTab);
        }
        else if (tab.url.includes("chrome://") && !newTab.url.includes("chrome://")) {
            setData(newTab);
        }
        else if (tab.canonicalizedUrl != newTab.canonicalizedUrl ) {
            console.log(`visted ${tab.canonicalizedUrl}.`);
            console.log(`visted these parts of the website: ${tab.extensions}`);
            submitData(newTab);
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
}

function submitData(newTab) {
    if (tab != null) {
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
    else {
        setData(newTab);
    }
}

function canonicalizeUrl(newTab) {
    var indexToStopAt = newTab.url.indexOf("/", 10);
    newTab.canonicalizedUrl = indexToStopAt == -1 ? newTab.url : newTab.url.substring(0, indexToStopAt + 1);
}

function getAuthToken(callback) {
    chrome.storage.local.get(['token'], function (result) {
        if (!result.token) {
            chrome.identity.launchWebAuthFlow(
                {'url': 'https://daily-habbit-tracker.herokuapp.com/accounts/extension-authentication/?id=' + chrome.runtime.id, 'interactive': true},
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
                        {'url': 'https://daily-habbit-tracker.herokuapp.com/accounts/extension-authentication/?id=' + chrome.runtime.id, 'interactive': true},
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
                    {'url': 'https://daily-habbit-tracker.herokuapp.com/accounts/extension-authentication/?id=' + chrome.runtime.id, 'interactive': true},
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
    if (tab != null) {
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
}

function findNewTab(i) {
    chrome.windows.query({active: true}, function (results) {
        chrome.windows.get(results[i].windowId, function (window) {
            if (window.state != "minimized") {
                setData(results[i]);
            }
            else {
                i++;
                if (i < results.length) {
                    findNewTab(i);
                }
            }
        });
    });
}

function checkCurrentTab() {
    if (tab != null) {
        chrome.windows.get(tab.windowId, function (window) {
            if (window.state == "minimized") {
                submitData(findNewTab(0));
            }
        });
    }
}

function saveDataLocally() {
    const tempDate = new Date();
    const endTime = tempDate.getHours() + ":" + tempDate.getMinutes() + ":" + tempDate.getSeconds();
    chrome.storage.local.set({
        tab: tab,
        startTime: startTime,
        endTime: endTime,
        date: date
    }, function () {
        console.log(`Computer locking. Saving following data to local storage:
                    tab: ${tab}, startTime: ${startTime}, endTime: ${endTime}, date: ${date}.`);
        tab = null;
    });
}

function sendSavedData() {
    chrome.storage.local.get(["tab", "startTime", "endTime", "date"], function (result) {
        getAuthToken(function(authToken) {
            data = {
                'token': authToken,
                'url': result.tab.canonicalizedUrl,
                'start_time': result.startTime,
                'end_time': result.endTime,
                'extensions': result.tab.extensions,
                'day': result.date
            };
            console.log(`Will send follwing data to db: ${JSON.stringify(data)}`);
            fetch("https://daily-habbit-tracker.herokuapp.com/main/activities/", {
                method: 'POST',
                body: JSON.stringify(data),
                headers:{
                    'Content-Type': 'application/json'
                }
            })
            .then(function (res) {
                console.log(`Status: ${res.statusText}`);
                setData(null);
            })
            .catch(function (error) {
                console.log(`Error: ${error}`)
                setData(null);
            });
        });
    });
}