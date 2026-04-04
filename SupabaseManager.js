/**
 * SupabaseManager.js
 * Handles cloud synchronization for YouTube Study Companion (Pro Features).
 */

const SUPABASE_CONFIG = {
    URL: 'https://yoanyvabeyhusuqoxbjx.supabase.co',
    ANON_KEY: 'sb_publishable_byHxYyUkPlqM-VUnK1tTXw_WTwskLBX',
    TABLES: {
        SNAPSHOTS: 'study_snapshots'
    }
};

class SupabaseManager {
    constructor() {
        this.client = null;
        this.isInitialized = false;
        this.init(); // Auto-init on load
    }

    /**
     * Initialize Supabase Client
     */
    init() {
        if (typeof supabase === 'undefined') {
            console.error('[Supabase] SDK not found! Make sure lib/supabase.js is loaded.');
            return false;
        }

        try {
            // Check if config is still placeholder
            if (SUPABASE_CONFIG.URL.includes('your-project-url')) {
                console.warn('[Supabase] Using default placeholder config. Cloud sync will be disabled.');
                return false;
            }

            this.client = supabase.createClient(SUPABASE_CONFIG.URL, SUPABASE_CONFIG.ANON_KEY);
            this.isInitialized = true;
            console.log('[Supabase] initialized successfully.');
            return true;
        } catch (err) {
            console.error('[Supabase] Initialization failed:', err);
            return false;
        }
    }

    /**
     * Simple Google Login via Supabase OAuth
     */
    async login() {
        if (!this.isInitialized) this.init();
        if (!this.isInitialized) return null;

        try {
            console.log('[Supabase] Initiating login flow...');
            const redirectURL = chrome.identity.getRedirectURL();
            
            // s4.0.0 Refinement: Use SDK to generate the URL to ensure it's valid
            const { data, error } = await this.client.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: redirectURL,
                    skipBrowserRedirect: true 
                }
            });

            if (error) {
                console.error('[Supabase] OAuth generation error:', error.message);
                return null;
            }

            const authUrl = data.url;
            console.log('[Supabase] Generated Auth URL:', authUrl);

            return new Promise((resolve, reject) => {
                chrome.identity.launchWebAuthFlow({
                    url: authUrl,
                    interactive: true
                }, (responseUrl) => {
                    if (chrome.runtime.lastError || !responseUrl) {
                        console.error('[Supabase] Login error:', chrome.runtime.lastError?.message);
                        return resolve(null);
                    }

                    // Parse tokens from URL (Fragment)
                    const url = new URL(responseUrl.replace('#', '?'));
                    const accessToken = url.searchParams.get('access_token');
                    const refreshToken = url.searchParams.get('refresh_token');

                    if (accessToken) {
                        this.client.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken
                        }).then(({ data, error }) => {
                            if (error) throw error;
                            console.log('[Supabase] Authenticated as:', data.user.email);
                            resolve(data.user);
                        });
                    } else {
                        resolve(null);
                    }
                });
            });
        } catch (err) {
            console.error('[Supabase] Login trace error:', err);
            return null;
        }
    }

    /**
     * Send a 6-digit OTP code to the user's email
     */
    async sendOtp(email) {
        if (!this.isInitialized) this.init();
        try {
            console.log('[Supabase] Calling signInWithOtp for:', email);
            const { data, error } = await this.client.auth.signInWithOtp({
                email,
                options: {
                    shouldCreateUser: true
                }
            });
            if (error) throw error;
            console.log('[Supabase] OTP Send response:', data);
            return true;
        } catch (err) {
            console.error('[Supabase] Send OTP error:', err.message);
            throw err;
        }
    }

    /**
     * Verify the 6-digit OTP code
     */
    async verifyOtp(email, token) {
        if (!this.isInitialized) this.init();
        try {
            console.log('[Supabase] Verifying OTP for:', email);
            const { data, error } = await this.client.auth.verifyOtp({
                email,
                token,
                type: 'email'
            });
            if (error) throw error;
            console.log('[Supabase] OTP Verified. User:', data.user?.email);
            return data.user;
        } catch (err) {
            console.error('[Supabase] Verify OTP error:', err.message);
            throw err;
        }
    }

    /**
     * Sign up with email and password
     */
    async signUp(email, password) {
        if (!this.isInitialized) this.init();
        try {
            const { data, error } = await this.client.auth.signUp({ email, password });
            if (error) throw error;
            return data.user;
        } catch (err) {
            console.error('[Supabase] Sign up error:', err.message);
            throw err;
        }
    }

    /**
     * Login with email and password
     */
    async loginWithEmail(email, password) {
        if (!this.isInitialized) this.init();
        try {
            const { data, error } = await this.client.auth.signInWithPassword({ email, password });
            if (error) throw error;
            return data.user;
        } catch (err) {
            console.error('[Supabase] Email login error:', err.message);
            throw err;
        }
    }

    /**
     * Upsert a full data snapshot for the current user
     */
    async upsertSnapshot(dataJson, profileName = 'Default') {
        if (!this.isInitialized) return;

        try {
            const { data: { user } } = await this.client.auth.getUser();
            if (!user) {
                console.warn('[Supabase] Cannot sync: No user session found.');
                return;
            }

            console.log('[Supabase] Syncing snapshot to cloud...');
            const { error } = await this.client
                .from(SUPABASE_CONFIG.TABLES.SNAPSHOTS)
                .upsert({
                    user_id: user.id,
                    profile_name: profileName,
                    data_json: dataJson,
                    source: 'chrome_extension',
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id,profile_name' });

            if (error) throw error;
            console.log('[Supabase] Snapshot synced successfully.');
        } catch (err) {
            console.error('[Supabase] Snapshot sync error:', err.message);
        }
    }

    /**
     * Fetch the latest snapshot
     */
    async fetchLatestSnapshot(profileName = 'Default') {
        if (!this.isInitialized) return null;

        try {
            const { data: { user } } = await this.client.auth.getUser();
            if (!user) return null;

            const { data, error } = await this.client
                .from(SUPABASE_CONFIG.TABLES.SNAPSHOTS)
                .select('data_json')
                .eq('user_id', user.id)
                .eq('profile_name', profileName)
                .maybeSingle();

            if (error) throw error;
            return data ? data.data_json : null;
        } catch (err) {
            console.error('[Supabase] Fetch snapshot error:', err.message);
            return null;
        }
    }
}

// Export singleton instance
const supabaseManager = new SupabaseManager();
if (typeof window !== 'undefined') {
    window.supabaseManager = supabaseManager;
}
