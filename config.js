// Per-environment settings. Copy to config.dev.js for a staging project and swap in the HTML.
window.MICHAT_CONFIG = { env: "production", url: "", key: "", paymentUrl: "",
  // Add a TURN server for reliable calls on strict/mobile networks (Metered, Twilio, Cloudflare, or self-hosted coturn):
  // iceServers: [{urls:"stun:stun.l.google.com:19302"},{urls:"turn:YOUR_HOST:443?transport=tcp",username:"USER",credential:"PASS"}]
}; // blank = use built-in defaults
// Extra optional settings (add inside MICHAT_CONFIG): vapidPublicKey:"…", privateCalls:true (after supabase-v3.sql), analyticsDomain:"yourdomain.com" (Plausible, cookie-free)
// More optional keys: giphyKey:"…" (GIF search). iceServers (TURN) strongly recommended for calls on mobile networks.
