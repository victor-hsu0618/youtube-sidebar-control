// monetization.js
// Cloud-Verified Pro Activation (Google Sheets Backend)

const CLOUD_API_URL = 'https://script.google.com/macros/s/AKfycbze8C1A42KysMkfVLyz6ksQyo0_cZhf3Xfrhxien8MVBdpnsGIeWfNfKUM4aa3O5gnM/exec';

let userStatus = {
    paid: false,
    email: null,
    isVerifying: false
};

/**
 * Initialize Cloud Monetization with Account Identity
 */
async function initMonetization() {
    try {
        console.log('[YT Study] Monetization: Initializing Cloud Mode...');

        // 1. Get User Identity
        if (chrome.identity && chrome.identity.getProfileUserInfo) {
            chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
                if (chrome.runtime.lastError) {
                    console.warn('[YT Study] Identity Error:', chrome.runtime.lastError.message);
                    checkLocalStatus();
                    return;
                }

                userStatus.email = userInfo.email || null;
                if (!userStatus.email && userInfo.id) {
                    userStatus.email = "User-" + userInfo.id.substring(0, 8);
                }

                updateAccountDisplay();
                console.log('[YT Study] Account identified:', userStatus.email || 'Guest');

                // 2. Load Status from Sync Storage first (Performance)
                checkLocalStatus().then(() => {
                    // Force immediate UI sync
                    if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();

                    // 3. Optional: Background verify if still FREE but we have email
                    if (!userStatus.paid && userStatus.email) {
                        verifyWithCloud();
                    }
                });
            });
        } else {
            console.warn('[YT Study] chrome.identity not available');
            checkLocalStatus();
        }
    } catch (err) {
        console.error('[YT Study] Monetization init error:', err);
        checkLocalStatus();
    }
}

async function checkLocalStatus() {
    try {
        const res = await chrome.storage.sync.get(['pro_activated']);
        userStatus.paid = !!res.pro_activated;
        if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
    } catch (e) {
        console.error("Local status check failed", e);
    }
}

function updateAccountDisplay() {
    const display = document.getElementById('user-account-display');
    if (display) {
        display.textContent = userStatus.email ? `Account: ${userStatus.email}` : "Account: Not signed in";
        display.title = userStatus.email || "Please sign in to Chrome to bind Pro status";
    }
}

/**
 * Verify Status with Google Sheets
 */
async function verifyWithCloud(code = '') {
    if (!userStatus.email) {
        console.warn('[YT Study] Cannot verify without email');
        return;
    }

    userStatus.isVerifying = true;
    if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();

    try {
        const url = `${CLOUD_API_URL}?email=${encodeURIComponent(userStatus.email)}&code=${encodeURIComponent(code)}`;
        const response = await fetch(url);

        // Robust handling for GAS redirects and non-JSON responses
        const text = await response.text();
        console.log('[YT Study] Cloud: Raw response length:', text.length);

        try {
            const data = JSON.parse(text);
            if (data.status === 'PRO') {
                console.log('[YT Study] Cloud Verification SUCCESS');
                chrome.storage.sync.set({ 'pro_activated': true });
                userStatus.paid = true;
                if (code) alert('Success! Pro features activated for ' + userStatus.email);
            } else {
                console.log('[YT Study] Cloud Verification: User is FREE. Clearing local status.');
                chrome.storage.sync.remove(['pro_activated']);
                userStatus.paid = false;
                if (code) alert('Invalid code or account not authorized.');
            }
        } catch (jsonErr) {
            console.error('[YT Study] Cloud: Failed to parse JSON. Response was likely HTML.');
            console.log('[YT Study] Raw Response (first 200 chars):', text.substring(0, 200));

            if (text.includes('google-signin') || text.includes('Service Login')) {
                console.error('[YT Study] Error: Apps Script requires login. Please set "Who has access" to "Anyone" in GAS deployment.');
            }
            throw new Error("Invalid response format from server");
        }
    } catch (err) {
        console.error('[YT Study] Cloud verification failed:', err);
    } finally {
        userStatus.isVerifying = false;
        if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
    }
}

/**
 * Manual Activation (Triggered by UI)
 */
function upgradeToPro() {
    if (!userStatus.email) {
        alert('Please sign in to Chrome first to bind your Pro status.');
        return;
    }

    const code = prompt('Enter your Activation Code (provided by author):');
    if (code !== null) {
        verifyWithCloud(code);
    }
}

/**
 * Deactivate Pro Mode (For Testing/Cancellation)
 */
function deactivatePro() {
    if (confirm('Are you sure you want to deactivate Pro features on this account?')) {
        chrome.storage.sync.remove(['pro_activated'], () => {
            userStatus.paid = false;
            if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();
            console.log('[YT Study] Pro features deactivated.');
            alert('Pro features deactivated.');
        });
    }
}

function isPro() {
    return userStatus.paid;
}

// Export for use in sidebar.js
if (typeof window !== 'undefined') {
    window.initMonetization = initMonetization;
    window.upgradeToPro = upgradeToPro;
    window.verifyWithCloud = verifyWithCloud;
    window.deactivatePro = deactivatePro;
    window.isPro = isPro;
    window.userStatus = userStatus;
}
