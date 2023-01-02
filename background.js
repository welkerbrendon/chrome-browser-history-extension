var tab = null;
var startTime;
var date;
var previousStatus = null;
var token = null;

getAuthToken(function (result) {
    if (result) {
        token = result;
    }
    else {
        setTimeout(getAuthToken, 10 * 1000);
    }
});

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

chrome.webNavigation.onCommitted.addListener(function (result) {
    try {
        chrome.tabs.get(result.tabId, function(newTab) {
            if (newTab && newTab.active) {
                handleNewTab(newTab);
            }
        });
    }
    catch (err) {
        console.log(err);
    }
});

chrome.tabs.onActivated.addListener(function (activeInfo) {
    chrome.tabs.get(activeInfo.tabId, function(newTab) {
        handleNewTab(newTab);
    });
});

chrome.idle.setDetectionInterval(10 * 60);

chrome.idle.onStateChanged.addListener(function (state) {
    if (state == "locked" && tab != null) {
        saveDataLocally();
    }
    else if (state == "active") {
        if (tab == null) {
            chrome.tabs.query({active: true, currentWindow: true}, function (result) {
                if (result.length > 0) {
                    if (previousStatus == "locked") {
                        sendSavedData(result[0]);
                    }
                    else {
                        setData(result[0])
                    }
                }
                else {
                    if (previousStatus == "locked") {
                        sendSavedData(null);
                    }
                }
            });
        }
    }
    else {
        submitData(null);
    }
    
    previousStatus = status;
});

function handleNewTab(newTab) {
    if (newTab != null && newTab.url) {
        if (tab == null) {
            setData(newTab);
        }
        else if (!newTab.url.includes(tab.canonicalizedUrl)) {
            console.log(`visted ${tab.canonicalizedUrl}.`);
            console.log(`visted these parts of the website: ${tab.extensions}`);
            if (tab.canonicalizedUrl.includes("chrome:")){
                setData(newTab);
            }
            else {
                submitData(newTab);
            }
        }
        else if (tab.url != newTab.url) {
            tab.url = newTab.url;
            var splitUrl = tab.url.split(".");
            if (splitUrl.length >= 3) {
                var urlEnd = splitUrl[splitUrl.length - 1];
                var index = urlEnd.indexOf("/") + 1;
                var extension = index > 0 ? urlEnd.slice(index, urlEnd.length) : "";
                if (tab.extensions) {
                    if (!tab.extensions.includes(extension) && extension.length > 0) {
                        tab.extensions.push(extension);
                    }
                }
            }
        }
    }
}

function submitData(newTab, endTime = null) {
    var tempDate = new Date();
    data = {
        'token': token,
        'url': tab.canonicalizedUrl,
        'start_time': startTime,
        'end_time': endTime ? endTime : tempDate.getHours() + ":" + tempDate.getMinutes() + ":" + tempDate.getSeconds(),
        'extensions': tab.extensions,
        'day': date
    };
    console.log(`Will send follwing data to db: ${JSON.stringify(data)}`);
    fetch("https://welker-habit-tracker.herokuapp.com/main/activities/site/", {
        method: 'POST',
        body: JSON.stringify(data),
        headers:{
            'Content-Type': 'application/json'
        }
    })
    .then(function (res) {
        console.log(`Status: ${res.statusText}`);
        if (res.statusText != "Created") {
            submitData(newTab, attempt + 1);
        }
        else {
            setData(newTab);
        }
    })
    .catch(function (error) {
        console.log(`Error: ${error}`)
        setData(newTab);
    });
}

function canonicalizeUrl(newTab) {
    if (newTab != null && newTab.url) {
        var indexToStopAt = newTab.url.indexOf("/", 10);
        newTab.canonicalizedUrl = indexToStopAt == -1 ? newTab.url : newTab.url.substring(0, indexToStopAt + 1);
    }
}

function getAuthToken(callback) {
    chrome.storage.local.get(['token'], function (result) {
        if (!result.token) {
            console.log("result.token=" + result.token);
            chrome.identity.launchWebAuthFlow(
                {'url': 'https://welker-habit-tracker.herokuapp.com/accounts/extension-authentication/?id=' + chrome.runtime.id, 'interactive': true},
                function(redirect_url) { 
                    console.log("redirect_url=" + redirect_url);
                    const receivedToken = redirect_url.split('=')[1];
                    chrome.storage.local.set({'token': receivedToken}, function() {
                        console.log(`Token is set to: ${receivedToken} and saved to chrome storage.`);
                        callback(receivedToken);
                    }); 
                });
        }
        else {
            data = {"token": result.token};
            fetch("https://welker-habit-tracker.herokuapp.com/accounts/token-authentication/", {
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
                        {'url': 'https://welker-habit-tracker.herokuapp.com/accounts/extension-authentication/?id=' + chrome.runtime.id, 'interactive': true},
                        function(redirect_url) {
                            if (redirect_url.includes("=")) { 
                                const newToken = redirect_url.split('=')[1]
                                chrome.storage.local.set({'token': newToken}, function() {
                                    console.log(`Token is set to: ${newToken} and saved to chrome storage.`);
                                    callback(newToken);
                                }); 
                            }
                            else {
                                console.log("ERROR: failed to get authentication token.");
                            }
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
                    {'url': 'https://welker-habit-tracker.herokuapp.com/accounts/extension-authentication/?id=' + chrome.runtime.id, 'interactive': true},
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
    canonicalizeUrl(tab);
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
        console.log(`new tab = ${JSON.stringify(tab)}, startTime = ${startTime}, and date = ${date}`);
    }
}

function findNewTab(i) {
    chrome.tabs.query({active: true}, function (results) {
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

function sendSavedData(newTab) {
    chrome.storage.local.get(["tab", "startTime", "endTime", "date"], function (result) {
        if (result && result.tab && result.startTime && result.endTime && result.date) {
            tab = result.tab;
            startTime = result.startTime;
            date = result.date;
            submitData(newTab, date);
        }
    });
}