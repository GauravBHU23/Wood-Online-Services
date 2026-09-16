/*!
 * Wood Online Service — notification layer
 * Toasts, confirm/alert modals, page loader, and a fetch wrapper that turns every
 * failure into a visible message instead of a silent console error.
 */
(function (window, document) {
    'use strict';

    // ---------------------------------------------------------------- toasts
    var TOAST_HOST_ID = 'wosToastHost';
    var ICONS = {
        success: '&#10003;',
        error: '&#10007;',
        warning: '&#33;',
        info: '&#8505;'
    };

    function host() {
        var el = document.getElementById(TOAST_HOST_ID);
        if (!el) {
            el = document.createElement('div');
            el.id = TOAST_HOST_ID;
            el.className = 'wos-toast-host';
            el.setAttribute('role', 'region');
            el.setAttribute('aria-label', 'Notifications');
            document.body.appendChild(el);
        }
        return el;
    }

    /**
     * @param {string} message
     * @param {'success'|'error'|'warning'|'info'} type
     * @param {{title?:string, duration?:number, dismissible?:boolean}} [options]
     */
    function toast(message, type, options) {
        if (!message) return;

        type = type || 'info';
        options = options || {};

        // Errors stay put long enough to be read; everything else auto-dismisses.
        var duration = options.duration != null
            ? options.duration
            : (type === 'error' ? 8000 : 4500);

        var el = document.createElement('div');
        el.className = 'wos-toast wos-toast--' + type;
        el.setAttribute('role', type === 'error' ? 'alert' : 'status');
        el.setAttribute('aria-live', type === 'error' ? 'assertive' : 'polite');

        var titleHtml = options.title
            ? '<div class="wos-toast__title">' + escapeHtml(options.title) + '</div>'
            : '';

        el.innerHTML =
            '<span class="wos-toast__icon" aria-hidden="true">' + (ICONS[type] || ICONS.info) + '</span>' +
            '<div class="wos-toast__body">' + titleHtml +
            '<div class="wos-toast__message">' + escapeHtml(message) + '</div></div>' +
            '<button type="button" class="wos-toast__close" aria-label="Dismiss">&times;</button>';

        if (duration > 0) el.style.setProperty('--wos-toast-duration', duration + 'ms');
        else el.classList.add('wos-toast--persistent'); // no drain bar when the toast won't auto-dismiss

        el.querySelector('.wos-toast__close').addEventListener('click', function () {
            dismiss(el);
        });

        host().appendChild(el);
        requestAnimationFrame(function () { el.classList.add('is-visible'); });

        if (duration > 0) {
            var timer = setTimeout(function () { dismiss(el); }, duration);
            // Pause the countdown (and visually freeze the drain bar) while the pointer rests
            // on the toast, so a message worth reading doesn't vanish mid-read.
            el.addEventListener('mouseenter', function () {
                clearTimeout(timer);
                el.setAttribute('data-paused', 'true');
            });
            el.addEventListener('mouseleave', function () {
                el.removeAttribute('data-paused');
                timer = setTimeout(function () { dismiss(el); }, 2000);
            });
        }

        return el;
    }

    function dismiss(el) {
        if (!el || el.dataset.dismissing) return;
        el.dataset.dismissing = '1';
        el.classList.remove('is-visible');
        setTimeout(function () { el.remove(); }, 260);
    }

    // ---------------------------------------------------------------- modals
    function modal(options) {
        options = options || {};

        return new Promise(function (resolve) {
            var overlay = document.createElement('div');
            overlay.className = 'wos-modal-overlay';
            overlay.setAttribute('role', 'dialog');
            overlay.setAttribute('aria-modal', 'true');

            var confirmLabel = options.confirmLabel || 'OK';
            var cancelLabel = options.cancelLabel || 'Cancel';
            var tone = options.tone || 'default';

            overlay.innerHTML =
                '<div class="wos-modal wos-modal--' + tone + '">' +
                (options.icon ? '<div class="wos-modal__icon">' + options.icon + '</div>' : '') +
                '<h2 class="wos-modal__title">' + escapeHtml(options.title || 'Confirm') + '</h2>' +
                '<p class="wos-modal__message">' + escapeHtml(options.message || '') + '</p>' +
                '<div class="wos-modal__actions">' +
                (options.showCancel === false ? '' :
                    '<button type="button" class="btn btn-outline-wood" data-action="cancel">' +
                    escapeHtml(cancelLabel) + '</button>') +
                '<button type="button" class="btn ' +
                (tone === 'danger' ? 'btn-danger' : 'btn-wood') +
                '" data-action="confirm">' + escapeHtml(confirmLabel) + '</button>' +
                '</div></div>';

            function close(result) {
                overlay.classList.remove('is-visible');
                document.removeEventListener('keydown', onKey);
                setTimeout(function () {
                    overlay.remove();
                    document.body.style.overflow = '';
                    resolve(result);
                }, 200);
            }

            function onKey(e) {
                if (e.key === 'Escape') close(false);
                if (e.key === 'Enter') close(true);
            }

            overlay.querySelector('[data-action="confirm"]').addEventListener('click', function () { close(true); });

            var cancelBtn = overlay.querySelector('[data-action="cancel"]');
            if (cancelBtn) cancelBtn.addEventListener('click', function () { close(false); });

            overlay.addEventListener('click', function (e) {
                if (e.target === overlay) close(false);
            });

            document.addEventListener('keydown', onKey);
            document.body.appendChild(overlay);
            document.body.style.overflow = 'hidden';

            requestAnimationFrame(function () {
                overlay.classList.add('is-visible');
                var focusTarget = overlay.querySelector('[data-action="confirm"]');
                if (focusTarget) focusTarget.focus();
            });
        });
    }

    function confirmDialog(message, title, options) {
        return modal(Object.assign({
            title: title || 'Please confirm',
            message: message,
            confirmLabel: 'Yes',
            cancelLabel: 'No'
        }, options || {}));
    }

    function alertDialog(message, title, options) {
        return modal(Object.assign({
            title: title || 'Notice',
            message: message,
            confirmLabel: 'OK',
            showCancel: false
        }, options || {}));
    }

    // ---------------------------------------------------------------- loader
    var loaderCount = 0;

    function showLoader(text) {
        loaderCount++;

        var el = document.getElementById('wosLoader');
        if (!el) {
            el = document.createElement('div');
            el.id = 'wosLoader';
            el.className = 'wos-loader-overlay';
            el.innerHTML =
                '<div class="wos-loader">' +
                '<div class="wos-loader__spinner" aria-hidden="true"></div>' +
                '<div class="wos-loader__text" role="status" aria-live="polite"></div>' +
                '</div>';
            document.body.appendChild(el);
        }

        el.querySelector('.wos-loader__text').textContent = text || 'Please wait...';
        requestAnimationFrame(function () { el.classList.add('is-visible'); });
    }

    function hideLoader() {
        loaderCount = Math.max(0, loaderCount - 1);
        if (loaderCount > 0) return;

        var el = document.getElementById('wosLoader');
        if (!el) return;

        el.classList.remove('is-visible');
        setTimeout(function () { if (loaderCount === 0 && el) el.remove(); }, 220);
    }

    /** Puts a single button into a busy state and returns a restore function. */
    function buttonBusy(button, busyText) {
        if (!button) return function () { };

        var originalHtml = button.innerHTML;
        var originalDisabled = button.disabled;

        button.disabled = true;
        button.classList.add('is-busy');
        button.innerHTML =
            '<span class="wos-btn-spinner" aria-hidden="true"></span>' +
            '<span>' + escapeHtml(busyText || 'Working...') + '</span>';

        return function restore() {
            button.disabled = originalDisabled;
            button.classList.remove('is-busy');
            button.innerHTML = originalHtml;
        };
    }

    // ---------------------------------------------------------------- fetch
    function antiForgeryToken() {
        var input = document.querySelector('input[name="__RequestVerificationToken"]');
        return input ? input.value : '';
    }

    /**
     * JSON fetch that always resolves to { ok, status, data }.
     * Network errors, HTTP errors and rate limits all surface as a toast.
     */
    async function api(url, options) {
        options = options || {};

        var headers = Object.assign({
            'X-Requested-With': 'XMLHttpRequest',
            'Accept': 'application/json'
        }, options.headers || {});

        if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
            headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(options.body);
        }

        var method = (options.method || 'GET').toUpperCase();
        if (method !== 'GET' && method !== 'HEAD') {
            headers['RequestVerificationToken'] = antiForgeryToken();
        }

        var silent = options.silent === true;

        try {
            var response = await fetch(url, {
                method: method,
                headers: headers,
                body: options.body,
                credentials: 'same-origin',
                signal: options.signal
            });

            var data = null;
            var contentType = response.headers.get('content-type') || '';
            if (contentType.indexOf('application/json') !== -1) {
                data = await response.json().catch(function () { return null; });
            }

            if (!response.ok && !silent) {
                if (response.status === 401) {
                    toast('Your session has expired. Please sign in again.', 'warning');
                    setTimeout(function () {
                        window.location.href = '/Account/Login?returnUrl=' +
                            encodeURIComponent(window.location.pathname);
                    }, 1600);
                } else if (response.status === 403) {
                    toast('You do not have permission to do that.', 'error');
                } else if (response.status === 429) {
                    toast('Too many requests. Please wait a moment and try again.', 'warning');
                } else {
                    toast((data && data.message) || 'Something went wrong. Please try again.', 'error');
                }
            }

            return { ok: response.ok, status: response.status, data: data };
        } catch (err) {
            if (err.name === 'AbortError') {
                return { ok: false, status: 0, data: null, aborted: true };
            }

            if (!silent) {
                toast(navigator.onLine
                    ? 'We could not reach the server. Please try again.'
                    : 'You appear to be offline. Check your connection.', 'error');
            }

            return { ok: false, status: 0, data: null };
        }
    }

    // ---------------------------------------------------------------- helpers
    function escapeHtml(value) {
        if (value == null) return '';
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    // ---------------------------------------------------------------- exports
    window.WOS = {
        toast: toast,
        success: function (m, o) { return toast(m, 'success', o); },
        error: function (m, o) { return toast(m, 'error', o); },
        warning: function (m, o) { return toast(m, 'warning', o); },
        info: function (m, o) { return toast(m, 'info', o); },
        confirm: confirmDialog,
        alert: alertDialog,
        modal: modal,
        showLoader: showLoader,
        hideLoader: hideLoader,
        buttonBusy: buttonBusy,
        api: api,
        escapeHtml: escapeHtml
    };

    // A connection drop is worth telling the customer about mid-checkout.
    window.addEventListener('offline', function () {
        toast('You are offline. Some actions will not work until the connection returns.',
            'warning', { duration: 0 });
    });

    window.addEventListener('online', function () {
        toast('Back online.', 'success');
    });

})(window, document);
