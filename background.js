// chrome.storage.local.get(['token'], function (result) {
//     if (!result.token) {
//         chrome.identity.launchWebAuthFlow(
//             {'url': 'http://localhost:8000/accounts/extension-authentication/', 'interactive': true},
//             function(redirect_url) { 
//                 const token = redirect_url.split('=')[1]
//                 chrome.storage.local.set({'token': token}, function() {
//                     console.log(`Token is set to: ${token} and saved to chrome storage.`);
//                 }); 
//             });
//     }
//     else {
//         console.log(`Token already in storage: ${result.token}`);
//     }
// });

chrome.identity.launchWebAuthFlow(
    {'url': 'http://localhost:8000/accounts/extension-authentication/', 'interactive': true},
    function(redirect_url) { 
        const token = redirect_url.split('=')[1]
        chrome.storage.local.set({'token': token}, function() {
            console.log(`Token is set to: ${token} and saved to chrome storage.`);
        }); 
    });


var tab = null;
var startTime;

function handleNewTab(newTab) {
    canonicalizeUrl(newTab);
    if (tab == null) {
        tab = newTab;
        tab.urlList = [tab.url];
        sendableStartTime = new Date().toJSON().substring(10,19).replace('T','');
        startTime = new Date().getTime();
    }
    else if (tab.canonicalizedUrl != newTab.canonicalizedUrl) {
        var endTime = new Date().getTime();
        console.log(`visted ${tab.canonicalizedUrl} for ${endTime - startTime} milliseconds.`);
        console.log(`visted these parts of the website: ${tab.urlList.toString()}`);
        chrome.storage.local.get(['token'], function(result) {
            console.log(`Will send following informatoin to website: 
                    site url: ${tab.canonicalizedUrl}, start time: ${sendableStartTime}, 
                    extensions list: ${tab.urlList.toString()}, and user token: ${result.token}`);
            data = {
                'token': result.token,
                'url': tab.canonicalizedUrl,
                'start_time': sendableStartTime
            };
            console.log(`Data: ${JSON.stringify(data)}`);
            fetch("http://localhost:8000/main/activities/site/", {
                method: 'POST',
                body: JSON.stringify(data),
                headers:{
                    'Content-Type': 'application/json'
                }
            })
            .then(function(res){
                console.log(`Status: ${res.statusText}`);

                tab = newTab;
                tab.urlList = [tab.url];
                startTime = endTime;
            })
            .catch(function(error) {
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