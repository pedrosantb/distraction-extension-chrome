const POST_URL = "https://distraction-webapp.vercel.app/api/notes/"; 

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "saveNote") {
    // Perform fetch in the background script
    fetch(POST_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(message.newNote)
    })
      .then(response => {
        if (response.status !== 204) {
          return response.json();
        } else {
          return null;
        }
      })
      .then(data => {
        console.log("Note sent from background:", data);
        sendResponse({ result: "success", data });
      })
      .catch(err => {
        console.error("Error sending note from background:", err);
        sendResponse({ result: "error", error: err.message });
      });
    return true; // Keep the message channel open for async response.
  }
});

// Existing tab update listener to send "startTimer" message to content scripts
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    const blockedSites = [
      "youtube.com", 
      "instagram.com", 
      "facebook.com", 
      "vk.com", 
      "tiktok.com", 
      "pinterest.com", 
      "linkedin.com"
    ];
    if (blockedSites.some(site => tab.url.includes(site))) {
      chrome.tabs.sendMessage(tabId, { action: "startTimer" });
    }
  }
});
