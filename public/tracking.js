/* ============================================================================
 * tracking.js  —  Wright farm v2 lander dataLayer + event helper library
 * ----------------------------------------------------------------------------
 * Implements the R3 unified event taxonomy. Pure vanilla JS, NO build step —
 * works verbatim in a static Cloudflare Pages lander (<script src="tracking.js">)
 * or bundled into a Vite/Astro build.
 *
 * WIRING (Josh's HYBRID directive): every event fires BOTH
 *   1. posthog.capture(name, props)          — direct to PostHog (product analytics)
 *   2. window.dataLayer.push({event:name...}) — into GTM, which maps it to the
 *      GA4 / Facebook / TikTok tags (names configured inside the GTM container,
 *      NOT here — see events.md §3 mapping table).
 * The builder types the CANONICAL snake_case name once; GTM does the rest.
 *
 * GRACEFUL DEGRADATION CONTRACT:
 *   - If window.posthog is undefined (no PostHog key) -> the posthog.capture leg
 *     no-ops.
 *   - If GTM never loaded (no container id) -> the dataLayer.push still succeeds
 *     into the plain array; it simply routes nowhere. No error either way.
 *   - Absent GA4 / FB / TikTok ids are a GTM concern (those tags just don't fire).
 *   - Every public call is wrapped in try/catch so a tracking fault can NEVER
 *     break the page. Tracking is ADDITIVE, not a gate.
 *
 * CONFIG: reads an optional window.FARM_TRACKING object (see tracking.config.example.js):
 *   { brand, posthogKey, posthogHost, gtmId, ga4Id, fbPixelId, tiktokPixelId, debug }
 *   In the static-lander flow the head partials (tracking-head.html) already
 *   loaded PostHog + GTM via build-time @@ substitution; here FARM_TRACKING is
 *   used mainly for `brand` (stamped on every event) + preflight/debug. In a
 *   runtime-config flow (no head partials, e.g. an SPA that injects config at
 *   runtime) init() will ALSO bootstrap PostHog + GTM from FARM_TRACKING if they
 *   were not already loaded — so this file is reusable in both worlds.
 * ============================================================================ */
(function (window, document) {
  "use strict";

  // ---- config + tiny helpers ------------------------------------------------
  var cfg = window.FARM_TRACKING || {};
  var DEBUG = !!cfg.debug;

  // An id is "usable" only if it's a non-empty string that is NOT an
  // unsubstituted @@placeholder@@ (leading "@").
  function usable(v) {
    return typeof v === "string" && v.length > 0 && v.charAt(0) !== "@";
  }
  function log() {
    if (DEBUG && window.console) {
      try { console.log.apply(console, ["[farm-tracking]"].concat([].slice.call(arguments))); } catch (e) {}
    }
  }

  // Ensure the dataLayer always exists so pushes queue harmlessly with no GTM.
  window.dataLayer = window.dataLayer || [];

  // ---- optional runtime bootstrap (SPA / no head-partial flow) --------------
  // Only acts if the loader has NOT already run (static landers load via
  // tracking-head.html, so these are no-ops there — we never double-init).

  function bootstrapPostHog() {
    if (!usable(cfg.posthogKey)) return;      // no key -> skip, no error
    if (window.posthog && window.posthog.__SV) return; // head partial already loaded it
    var host = usable(cfg.posthogHost) ? cfg.posthogHost : "https://us.i.posthog.com";
    /* eslint-disable */
    !(function (t, e) { var o, n, p, r; e.__SV || ((window.posthog = e), (e._i = []), (e.init = function (i, s, a) { function g(t, e) { var o = e.split("."); (2 == o.length && ((t = t[o[0]]), (e = o[1])), (t[e] = function () { t.push([e].concat(Array.prototype.slice.call(arguments, 0))); })); } (((p = t.createElement("script")).type = "text/javascript"), (p.crossOrigin = "anonymous"), (p.async = !0), (p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js"), (r = t.getElementsByTagName("script")[0]).parentNode.insertBefore(p, r)); var u = e; for (void 0 !== a ? (u = e[a] = []) : (a = "posthog"), u.people = u.people || [], u.toString = function (t) { var e = "posthog"; return ("posthog" !== a && (e += "." + a), t || (e += " (stub)"), e); }, u.people.toString = function () { return u.toString(1) + ".people (stub)"; }, o = "init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug getPageViewId captureTraceFeedback captureTraceMetric".split(" "), n = 0; n < o.length; n++) g(u, o[n]); e._i.push([i, s, a]); }), (e.__SV = 1)); })(document, window.posthog || []);
    /* eslint-enable */
    window.posthog.init(cfg.posthogKey, {
      api_host: host,
      defaults: "2026-05-30",
      person_profiles: "identified_only"
    });
    log("PostHog bootstrapped from FARM_TRACKING");
  }

  function gtmAlreadyStarted() {
    // Detect a prior GTM loader SYNCHRONOUSLY. window.google_tag_manager is set
    // only AFTER gtm.js downloads+executes (async), so on a cold cache it is still
    // undefined at DOMContentLoaded even though tracking-head.html already pushed
    // gtm.start — checking it alone re-injects a 2nd gtm.js and double-fires every
    // tag. So we (a) honour the synchronous marker the head partial sets, and
    // (b) scan the existing dataLayer for a gtm.start entry. Either => already started.
    if (window.__FARM_GTM_LOADED__) return true;
    if (window.google_tag_manager) return true;
    var dl = window.dataLayer;
    if (dl && dl.length) {
      for (var k = 0; k < dl.length; k++) {
        if (dl[k] && (dl[k]["gtm.start"] || dl[k].event === "gtm.js")) return true;
      }
    }
    return false;
  }

  function bootstrapGTM() {
    if (!usable(cfg.gtmId)) return;                         // no container -> skip
    if (gtmAlreadyStarted()) return;                        // head partial already loaded it (sync-safe)
    window.__FARM_GTM_LOADED__ = true;                      // claim the marker before the async insert
    (function (w, d, s, l, i) {
      w[l] = w[l] || [];
      w[l].push({ "gtm.start": new Date().getTime(), event: "gtm.js" });
      var f = d.getElementsByTagName(s)[0], j = d.createElement(s), dl = l != "dataLayer" ? "&l=" + l : "";
      j.async = true;
      j.src = "https://www.googletagmanager.com/gtm.js?id=" + i + dl;
      f.parentNode.insertBefore(j, f);
    })(window, document, "script", "dataLayer", cfg.gtmId);
    log("GTM bootstrapped from FARM_TRACKING");
  }

  // ---- the core dual-fire primitive ----------------------------------------
  // brand + page_path are stamped on every event so PostHog + GA4/FB/TikTok all
  // carry the same base context. See events.md §2 (standard property set).
  var brand = cfg.brand || window.__BRAND__ || "";

  function baseProps() {
    return { brand: brand, page_path: (window.location && window.location.pathname) || "" };
  }

  /**
   * track(name, props) — the ONLY primitive. Fires PostHog + dataLayer.
   * Canonical snake_case name (see events.md §1). Safe when either sink is absent.
   */
  function track(name, props) {
    var payload = baseProps();
    if (props) { for (var k in props) { if (Object.prototype.hasOwnProperty.call(props, k)) payload[k] = props[k]; } }
    // 1) PostHog (direct) — no-op if the snippet never loaded (key absent).
    try { if (window.posthog && window.posthog.capture) window.posthog.capture(name, payload); } catch (e) { log("posthog error", e); }
    // 2) GTM dataLayer — GTM maps {event:name} to GA4/FB/TikTok. Harmless if GTM absent.
    try { window.dataLayer.push(mergeEvent(name, payload)); } catch (e) { log("dataLayer error", e); }
    log("track", name, payload);
    return payload;
  }
  function mergeEvent(name, payload) {
    var o = { event: name };
    for (var k in payload) { if (Object.prototype.hasOwnProperty.call(payload, k)) o[k] = payload[k]; }
    return o;
  }

  // ---- R3 canonical event helpers ------------------------------------------
  // Names + property shapes per events.md §3 mapping table. GA4/FB/TikTok event
  // names are set INSIDE GTM, keyed off the `event` value pushed here.

  /**
   * pageView(extra) — SPA-safe page_view.
   * PostHog autocaptures its native $pageview on full page loads, so we do NOT
   * also posthog.capture('page_view') (avoids double-counting — events.md §8).
   * We DO push page_view to the dataLayer so GTM fires GA4/FB/TikTok PageView.
   * For an SPA (capture_pageview:false in PostHog init) call posthog.capture(
   * '$pageview') on route change AND this pageView() for the GTM side.
   */
  function pageView(extra) {
    var payload = baseProps();
    payload.page_title = (document && document.title) || "";
    if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) payload[k] = extra[k]; } }
    try { window.dataLayer.push(mergeEvent("page_view", payload)); } catch (e) { log("dataLayer error", e); }
    // SPA virtual navigation: fire PostHog's native pageview (only meaningful if
    // capture_pageview was disabled; a duplicate on the first load is avoided by
    // PostHog's own dedup, but keep this call SPA-guarded via cfg.spa if desired).
    try {
      if (cfg.spa && window.posthog && window.posthog.capture) window.posthog.capture("$pageview", payload);
    } catch (e) { log("posthog error", e); }
    log("page_view", payload);
    return payload;
  }

  /** cta_click — primary CTA clicked. events.md: PH cta_click / GA4 select_content / FB omitted / TikTok custom (verify "ClickButton" is still a standard event in the brand's Events Manager on provision — see analytics-and-tracking.md; map to a TikTok custom event if not). */
  function trackCtaClick(ctaId, ctaText, extra) {
    return track("cta_click", assign({ cta_id: ctaId || "", cta_text: ctaText || "" }, extra));
  }

  /** signup_start — user opened/focused the signup form. GA4 form_start / FB+TikTok InitiateCheckout(proxy). */
  function trackSignupStart(formId, method, extra) {
    return track("signup_start", assign({ form_id: formId || "", method: method || "email" }, extra));
  }

  /** signup_submit — form submitted (intent, may fail validation). GA4 generate_lead / FB Lead / TikTok SubmitForm. */
  function trackSignupSubmit(formId, method, extra) {
    return track("signup_submit", assign({ form_id: formId || "", method: method || "email" }, extra));
  }

  /**
   * signup_success — PRIMARY CONVERSION (confirmed signup). GA4 sign_up (Key Event) /
   * FB CompleteRegistration / TikTok CompleteRegistration. Carry value+currency
   * (default 0 / USD) and lead_id (reused as FB eventID / TikTok event_id for CAPI dedup).
   */
  function trackSignupSuccess(opts) {
    opts = opts || {};
    return track("signup_success", {
      form_id: opts.formId || "",
      method: opts.method || "email",
      value: typeof opts.value === "number" ? opts.value : 0,
      currency: opts.currency || "USD",
      lead_id: opts.leadId || ""
    });
  }

  // ---- optional engagement helpers (events.md §1 optional tier) -------------
  function trackScrollDepth(percent, extra) { return track("scroll_depth", assign({ percent: percent }, extra)); }
  function trackOutboundClick(url, extra) { return track("outbound_click", assign({ outbound_url: url || "" }, extra)); }

  // ---- identity passthroughs (thin, guarded) --------------------------------
  function identify(distinctId, setProps, setOnceProps) {
    try { if (window.posthog && window.posthog.identify) window.posthog.identify(distinctId, setProps || {}, setOnceProps || {}); } catch (e) { log("identify error", e); }
  }
  function reset() {
    try { if (window.posthog && window.posthog.reset) window.posthog.reset(); } catch (e) { log("reset error", e); }
  }

  // ---- small util -----------------------------------------------------------
  function assign(target, extra) {
    if (extra) { for (var k in extra) { if (Object.prototype.hasOwnProperty.call(extra, k)) target[k] = extra[k]; } }
    return target;
  }

  // ---- init -----------------------------------------------------------------
  function init(overrides) {
    if (overrides) { cfg = assign(cfg, overrides); window.FARM_TRACKING = cfg; DEBUG = !!cfg.debug; brand = cfg.brand || brand; }
    // Bootstrap only if head partials did not already load the SDKs (idempotent).
    try { bootstrapPostHog(); } catch (e) { log("ph bootstrap error", e); }
    try { bootstrapGTM(); } catch (e) { log("gtm bootstrap error", e); }
    // Preflight WARN for absent ids (visible only with debug on — never fatal).
    if (!usable(cfg.posthogKey) && !(window.posthog && window.posthog.__SV)) log("WARN: no PostHog key — product analytics disabled");
    if (!usable(cfg.gtmId) && !window.google_tag_manager) log("WARN: no GTM container — GA4/FB/TikTok disabled");
    log("init complete", { brand: brand });
    return api;
  }

  // ---- public API -----------------------------------------------------------
  var api = {
    init: init,
    track: track,
    pageView: pageView,
    trackCtaClick: trackCtaClick,
    trackSignupStart: trackSignupStart,
    trackSignupSubmit: trackSignupSubmit,
    trackSignupSuccess: trackSignupSuccess,
    trackScrollDepth: trackScrollDepth,
    trackOutboundClick: trackOutboundClick,
    identify: identify,
    reset: reset,
    _config: function () { return cfg; }
  };

  window.farmTracking = api;

  // Auto-init on load unless the host page opted out (FARM_TRACKING.manualInit).
  if (!cfg.manualInit) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", function () { init(); });
    } else {
      init();
    }
  }
})(window, document);
