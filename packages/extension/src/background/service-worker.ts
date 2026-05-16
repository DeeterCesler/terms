chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'SET_BADGE') {
    const score: number = msg.score;
    const color = score >= 8 ? '#22c55e' : score >= 5 ? '#f59e0b' : '#ef4444';
    chrome.action.setBadgeText({ text: String(score) });
    chrome.action.setBadgeBackgroundColor({ color });
  }
});

// Clear badge when navigating to a new page
chrome.tabs.onUpdated.addListener((_tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    chrome.action.setBadgeText({ text: '' });
  }
});
