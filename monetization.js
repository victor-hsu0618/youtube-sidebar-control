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

        // Initial UI display sync
        updateAccountDisplay();

        const fetchIdentity = () => {
            if (chrome.identity && chrome.identity.getProfileUserInfo) {
                chrome.identity.getProfileUserInfo({ accountStatus: 'ANY' }, (userInfo) => {
                    if (chrome.runtime.lastError) {
                        console.warn('[YT Study] Identity Error:', chrome.runtime.lastError.message);
                        if (!userStatus.email) userStatus.email = null;
                        updateAccountDisplay();
                        checkLocalStatus();
                        return;
                    }

                    userStatus.email = userInfo.email || null;
                    if (!userStatus.email && userInfo.id) {
                        userStatus.email = "User-" + userInfo.id.substring(0, 8);
                    }

                    console.log('[YT Study] Account identified:', userStatus.email || 'Guest');
                    updateAccountDisplay();

                    checkLocalStatus().then(() => {
                        if (!userStatus.paid && userStatus.email && !userStatus.email.startsWith('User-')) {
                            verifyWithCloud('', false);
                        }
                    });
                });
            } else {
                userStatus.email = null;
                updateAccountDisplay();
                checkLocalStatus();
            }
        };

        // 1. Immediate call
        fetchIdentity();

        // 2. Retry after 2s
        setTimeout(fetchIdentity, 2000);

        // 3. HARD TIMEOUT: If still "Detecting" after 5s, force a fail-safe display
        setTimeout(() => {
            const display = document.getElementById('user-account-display');
            if (display && display.textContent.includes('Detecting')) {
                console.log('[YT Study] Identity hard timeout reached.');
                userStatus.email = null;
                updateAccountDisplay();
                checkLocalStatus(); // Still load PRO status even without identity
            }
        }, 5000);

        // 4. Attach Click Event for Manual Retry
        const display = document.getElementById('user-account-display');
        if (display) {
            display.style.cursor = 'pointer';
            display.title = 'Click to manually refresh account identity';
            display.onclick = () => {
                display.textContent = 'Account: Refreshing...';
                fetchIdentity();
            };
        }

    } catch (err) {
        console.error('[YT Study] Monetization init error:', err);
        userStatus.email = null;
        updateAccountDisplay();
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
async function verifyWithCloud(code = '', showFeedback = true) {
    if (!userStatus.email) {
        if (showFeedback) alert('Please sign in to Chrome browser first.');
        console.warn('[YT Study] Cannot verify without email');
        return;
    }

    userStatus.isVerifying = true;
    if (typeof updateSubscriptionUI === 'function') updateSubscriptionUI();

    try {
        console.log('[YT Study] Cloud: Verifying...', userStatus.email, code ? '(with code)' : '(check only)');
        const url = `${CLOUD_API_URL}?email=${encodeURIComponent(userStatus.email)}&code=${encodeURIComponent(code)}`;

        // Use a timeout for the fetch
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        const response = await fetch(url, { signal: controller.signal, redirect: 'follow' });
        clearTimeout(timeoutId);

        const text = await response.text();
        console.log('[YT Study] Cloud: Raw response length:', text.length);

        try {
            const data = JSON.parse(text);
            if (data.status === 'PRO') {
                console.log('[YT Study] Cloud Verification SUCCESS');
                await chrome.storage.sync.set({ 'pro_activated': true });
                userStatus.paid = true;
                if (code && showFeedback) alert('Success! Pro features activated for ' + userStatus.email);
                else if (showFeedback && !code) alert('Your Pro status has been verified!');
            } else {
                console.log('[YT Study] Cloud Verification: User is FREE.');
                await chrome.storage.sync.remove(['pro_activated']);
                userStatus.paid = false;
                if (code && showFeedback) alert('Activation code is invalid or has expired.');
                else if (showFeedback && !code) alert('No active Pro subscription found for this account.');
            }
        } catch (jsonErr) {
            console.error('[YT Study] Cloud: Parse Error.', jsonErr);
            if (showFeedback) alert('Server communication error. Please try again later.');
        }
    } catch (err) {
        console.error('[YT Study] Cloud verification failed:', err);
        if (showFeedback) {
            if (err.name === 'AbortError') alert('Verification timeout. Please check your internet connection.');
            else alert('Cloud connection failed. Error: ' + err.message);
        }
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

    const choice = confirm('Do you have an activation code?\n\nOK: Enter code\nCancel: Just re-verify current account');
    if (choice) {
        const code = prompt('Enter your Activation Code (provided by author):');
        if (code) verifyWithCloud(code, true);
    } else {
        verifyWithCloud('', true);
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