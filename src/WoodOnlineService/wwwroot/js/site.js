/*!
 * Wood Online Service — page behaviour
 * Requires notify.js (window.WOS).
 */
(function (window, document) {
    'use strict';

    var WOS = window.WOS;

    document.addEventListener('DOMContentLoaded', function () {
        initFlashMessages();
        initNavHighlight();
        initFormGuards();
        initValidation();
        initCharCounters();
        initSearch();
        initAddToCart();
        initReviews();
        initConfirmActions();
        initVisitorBadge();
        initPwa();
        initPasswordToggles();
        initLazyEnhancements();
    });

    // ---------------------------------------------------------------- flash
    /** Server-set TempData is rendered into a hidden node and replayed as a toast. */
    function initFlashMessages() {
        document.querySelectorAll('[data-flash]').forEach(function (node) {
            var type = node.getAttribute('data-flash') || 'info';
            var message = node.textContent.trim();
            if (message) WOS.toast(message, type);
            node.remove();
        });
    }

    // ---------------------------------------------------------------- nav
    function initNavHighlight() {
        var path = window.location.pathname.toLowerCase();

        document.querySelectorAll('.navbar-wood .nav-link').forEach(function (link) {
            var href = (link.getAttribute('href') || '').toLowerCase();
            if (!href) return;

            if (href === '/' ? path === '/' : path.indexOf(href) === 0) {
                link.classList.add('active');
            }
        });
    }

    // ---------------------------------------------------------------- forms
    /**
     * Stops double submits and shows a spinner in the button that was clicked.
     *
     * The guard must not fire when the submit is going to be cancelled, otherwise the
     * button spins forever on a page the user never left. Three things can cancel it:
     * native HTML5 constraints, our own data-validate rules, and jQuery unobtrusive
     * validation (used by the Identity forms). All three are checked before locking.
     *
     * Forms with their own AJAX handler opt out via data-no-guard.
     */
    function initFormGuards() {
        document.querySelectorAll('form:not([data-no-guard])').forEach(function (form) {
            form.addEventListener('submit', function (e) {
                // Already in flight: swallow the repeat click.
                if (form.dataset.submitting === '1') {
                    e.preventDefault();
                    return;
                }

                var problem = firstBlockingProblem(form);

                if (problem) {
                    // Nothing is going to be sent, so the button must not enter a busy state.
                    e.preventDefault();

                    if (problem.field) {
                        problem.field.focus();
                        problem.field.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }

                    if (problem.notify !== false) {
                        WOS.error('Please correct the highlighted fields.');
                    }
                    return;
                }

                var button = form.querySelector('button[type="submit"]:not([data-no-busy])');
                if (!button) return;

                form.dataset.submitting = '1';
                var restore = WOS.buttonBusy(button, button.dataset.busyText || 'Please wait...');

                // Safety net: if navigation never happens, hand the form back to the user.
                var timer = setTimeout(function () {
                    form.dataset.submitting = '';
                    restore();
                }, 15000);

                // Returning via the back/forward cache restores this DOM; unlock on the way in.
                window.addEventListener('pageshow', function onShow() {
                    clearTimeout(timer);
                    form.dataset.submitting = '';
                    restore();
                    window.removeEventListener('pageshow', onShow);
                });
            });
        });
    }

    /**
     * Returns the first thing that will stop this submit, or null when it will go through.
     * Every field is checked so all errors light up at once, not one per attempt.
     */
    function firstBlockingProblem(form) {
        var firstBad = null;

        // Our own declarative rules.
        var fields = form.querySelectorAll('[data-validate]');
        for (var i = 0; i < fields.length; i++) {
            if (!validateField(fields[i]) && !firstBad) firstBad = fields[i];
        }
        if (firstBad) return { field: firstBad };

        // Native constraint validation, unless the form opted out with novalidate.
        if (!form.noValidate && typeof form.checkValidity === 'function' && !form.checkValidity()) {
            // The browser shows its own bubble, so a toast would be redundant.
            return { field: null, notify: false };
        }

        // jQuery unobtrusive validation, used by the Identity forms.
        if (window.jQuery && jQuery.fn && jQuery.fn.valid) {
            var $form = jQuery(form);
            // A validator is only attached once the plugin has parsed the form.
            if ($form.data('validator') && !$form.valid()) {
                return { field: null, notify: false };
            }
        }

        return null;
    }

    /** Inline validation on blur so errors surface before the customer hits submit. */
    function initValidation() {
        // Razor forms also carry jQuery unobtrusive validation. Where a field has our own
        // data-validate rules, hand it to us alone: otherwise both systems write a message
        // into the same place and the customer sees every error twice.
        releaseFieldsFromJQueryValidation();

        document.querySelectorAll('form [data-validate]').forEach(function (field) {
            field.addEventListener('blur', function () { validateField(field); });
            field.addEventListener('input', function () {
                if (field.classList.contains('is-invalid')) validateField(field);
            });
        });

        // Submit-time checking lives in initFormGuards so validation and the busy state
        // are decided together; a form marked data-validate-on-submit needs nothing extra here.
    }

    /**
     * jQuery unobtrusive reads data-val="true" plus data-val-* attributes, and it parses every
     * form as soon as it loads — which is before this file runs. So two things are needed:
     * strip the attributes (stops a re-parse re-claiming the field) and tell any validator that
     * already attached to ignore these fields.
     */
    function releaseFieldsFromJQueryValidation() {
        var claimed = document.querySelectorAll('[data-validate][data-val="true"]');
        if (!claimed.length) return;

        var names = [];

        claimed.forEach(function (field) {
            var name = field.getAttribute('name');
            if (name) names.push(name);

            Array.prototype.slice.call(field.attributes)
                .filter(function (a) { return a.name.indexOf('data-val') === 0; })
                .forEach(function (a) { field.removeAttribute(a.name); });
        });

        if (!window.jQuery || !names.length) return;

        // Drop the rules the plugin already registered for these fields.
        document.querySelectorAll('form').forEach(function (form) {
            var validator = jQuery(form).data('validator');
            if (!validator) return;

            names.forEach(function (name) {
                var field = form.querySelector('[name="' + name + '"]');
                if (!field) return;

                try {
                    jQuery(field).rules('remove');
                } catch (e) {
                    // The field may not have had rules; nothing to undo.
                }

                delete validator.submitted[name];
            });
        });
    }

    function validateField(field) {
        var rules = (field.dataset.validate || '').split('|').filter(Boolean);
        var value = (field.value || '').trim();
        var error = null;

        for (var i = 0; i < rules.length && !error; i++) {
            var parts = rules[i].split(':');
            var rule = parts[0];
            var arg = parts[1];

            switch (rule) {
                case 'required':
                    if (!value) error = (field.dataset.label || 'This field') + ' is required.';
                    break;
                case 'email':
                    if (value && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value))
                        error = 'Please enter a valid email address.';
                    break;
                case 'phone':
                    if (value && !/^[0-9+\-\s()]{7,20}$/.test(value))
                        error = 'Please enter a valid phone number.';
                    break;
                case 'pincode':
                    if (value && !/^\d{6}$/.test(value)) error = 'Please enter a 6-digit PIN code.';
                    break;
                case 'min':
                    if (value && value.length < parseInt(arg, 10))
                        error = 'Please enter at least ' + arg + ' characters.';
                    break;
                case 'max':
                    if (value && value.length > parseInt(arg, 10))
                        error = 'Please keep this under ' + arg + ' characters.';
                    break;
                case 'number':
                    if (value && isNaN(Number(value))) error = 'Please enter a number.';
                    break;
                case 'match':
                    var other = document.getElementById(arg);
                    if (other && value !== other.value) {
                        error = (field.dataset.mismatch || 'The two values do not match.');
                    }
                    break;
            }
        }

        showFieldError(field, error);
        return !error;
    }

    /**
     * Writes the message into the span the server already rendered for this field, rather than
     * appending a second one. Razor emits <span asp-validation-for="X"> and jQuery unobtrusive
     * fills the same element, so reusing it is what keeps one field from showing two errors.
     */
    function messageHolderFor(field) {
        var holder = field.parentElement;
        if (!holder) return null;

        var name = field.getAttribute('name');

        // The span Razor rendered for this field.
        if (name) {
            var forField = holder.querySelector('[data-valmsg-for="' + name + '"]');
            if (forField) return forField;
        }

        var existing = holder.querySelector('.field-validation-error, .field-error');
        if (existing) return existing;

        var created = document.createElement('span');
        created.className = 'field-error';
        created.dataset.client = '1';
        holder.appendChild(created);
        return created;
    }

    function showFieldError(field, error) {
        var holder = messageHolderFor(field);

        if (error) {
            field.classList.add('is-invalid');
            field.classList.remove('is-valid');
            field.setAttribute('aria-invalid', 'true');

            if (holder) {
                holder.textContent = error;
                holder.classList.add('field-error');
                holder.classList.remove('field-validation-valid');
            }
        } else {
            field.classList.remove('is-invalid');
            field.removeAttribute('aria-invalid');
            if (field.value.trim()) field.classList.add('is-valid');

            if (holder) {
                holder.textContent = '';
                // A span we created ourselves can go; one Razor rendered must stay in the DOM.
                if (holder.dataset.client === '1') holder.remove();
            }
        }
    }

    function initCharCounters() {
        document.querySelectorAll('[data-counter]').forEach(function (field) {
            var counter = document.getElementById(field.dataset.counter);
            if (!counter) return;

            var max = parseInt(field.getAttribute('maxlength'), 10) || 0;

            function update() {
                var length = field.value.length;
                counter.textContent = length + ' / ' + max;
                counter.classList.toggle('is-near', max > 0 && length > max * 0.85);
                counter.classList.toggle('is-over', max > 0 && length >= max);
            }

            field.addEventListener('input', update);
            update();
        });
    }

    // ---------------------------------------------------------------- search
    function initSearch() {
        var input = document.getElementById('siteSearch');
        var results = document.getElementById('searchResults');
        if (!input || !results) return;

        var timer = null;
        var controller = null;
        var activeIndex = -1;

        input.addEventListener('input', function () {
            var term = input.value.trim();
            clearTimeout(timer);
            activeIndex = -1;

            if (term.length < 2) {
                results.classList.remove('is-open');
                return;
            }

            // Debounced so a fast typist fires one request, not ten.
            timer = setTimeout(function () { runSearch(term); }, 250);
        });

        async function runSearch(term) {
            if (controller) controller.abort();
            controller = new AbortController();

            results.innerHTML =
                '<div class="p-3">' +
                '<div class="skeleton skeleton-text"></div>' +
                '<div class="skeleton skeleton-text"></div>' +
                '</div>';
            results.classList.add('is-open');

            var response = await WOS.api('/api/search/suggest?q=' + encodeURIComponent(term), {
                silent: true,
                signal: controller.signal
            });

            if (response.aborted) return;

            if (!response.ok || !response.data || !response.data.success) {
                results.innerHTML = '<div class="search-empty">Search is unavailable right now.</div>';
                return;
            }

            render(response.data.results || [], term);
        }

        function render(items, term) {
            if (!items.length) {
                results.innerHTML =
                    '<div class="search-empty">No products matched &ldquo;' +
                    WOS.escapeHtml(term) + '&rdquo;.<br>' +
                    '<a href="/Home/Contact" class="small">Ask us about it</a></div>';
                return;
            }

            results.innerHTML = items.map(function (item) {
                var price = item.isCustomOrder
                    ? 'On request'
                    : '&#8377;' + Number(item.price).toLocaleString('en-IN');

                var meta = [item.category, item.woodType].filter(Boolean).join(' &middot; ');

                return '<a class="search-result" href="/Shop/Details/' + item.id + '">' +
                    '<img src="' + WOS.escapeHtml(item.image || '/img/cat-custom.svg') +
                    '" alt="" loading="lazy">' +
                    '<span class="flex-grow-1" style="min-width:0">' +
                    '<span class="search-result__name d-block text-truncate">' +
                    WOS.escapeHtml(item.name) + '</span>' +
                    '<span class="search-result__meta">' + meta + '</span></span>' +
                    '<span class="search-result__price">' + price + '</span></a>';
            }).join('');
        }

        // Keyboard navigation through the suggestion list.
        input.addEventListener('keydown', function (e) {
            var options = results.querySelectorAll('.search-result');
            if (!results.classList.contains('is-open') || !options.length) return;

            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                activeIndex += (e.key === 'ArrowDown' ? 1 : -1);
                if (activeIndex < 0) activeIndex = options.length - 1;
                if (activeIndex >= options.length) activeIndex = 0;

                options.forEach(function (o, i) { o.classList.toggle('is-active', i === activeIndex); });
                options[activeIndex].scrollIntoView({ block: 'nearest' });
            } else if (e.key === 'Enter' && activeIndex >= 0) {
                e.preventDefault();
                options[activeIndex].click();
            } else if (e.key === 'Escape') {
                results.classList.remove('is-open');
                input.blur();
            }
        });

        document.addEventListener('click', function (e) {
            if (!input.contains(e.target) && !results.contains(e.target)) {
                results.classList.remove('is-open');
            }
        });

        input.addEventListener('focus', function () {
            if (input.value.trim().length >= 2 && results.innerHTML) {
                results.classList.add('is-open');
            }
        });
    }

    // ---------------------------------------------------------------- cart
    /** Adds to cart without a page reload so the customer keeps their place in the list. */
    function initAddToCart() {
        document.querySelectorAll('form.js-add-to-cart').forEach(function (form) {
            form.addEventListener('submit', async function (e) {
                e.preventDefault();

                var button = form.querySelector('button[type="submit"]');
                var restore = WOS.buttonBusy(button, 'Adding...');

                var body = new FormData(form);

                var response = await WOS.api('/Cart/AddAjax', {
                    method: 'POST',
                    body: body,
                    headers: { 'RequestVerificationToken': body.get('__RequestVerificationToken') || '' }
                });

                restore();
                form.dataset.submitting = '';

                if (response.ok && response.data && response.data.success) {
                    WOS.success(response.data.message || 'Added to your cart.');
                    updateCartBadge(response.data.cartCount);
                } else if (response.data && response.data.message) {
                    WOS.error(response.data.message);
                }
            });
        });
    }

    function updateCartBadge(count) {
        var link = document.querySelector('.js-cart-link');
        if (!link) return;

        var badge = link.querySelector('.cart-badge');

        if (count > 0) {
            if (!badge) {
                badge = document.createElement('span');
                badge.className = 'cart-badge';
                link.appendChild(badge);
            }
            badge.textContent = count;
            badge.animate(
                [{ transform: 'scale(1)' }, { transform: 'scale(1.4)' }, { transform: 'scale(1)' }],
                { duration: 320 });
        } else if (badge) {
            badge.remove();
        }
    }

    // ---------------------------------------------------------------- reviews
    function initReviews() {
        initStarPicker();
        initReviewForm();
        initHelpfulButtons();
    }

    function initStarPicker() {
        var picker = document.getElementById('starPicker');
        var hidden = document.getElementById('reviewRating');
        if (!picker || !hidden) return;

        var buttons = Array.prototype.slice.call(picker.querySelectorAll('button'));

        function paint(upTo) {
            buttons.forEach(function (b, i) { b.classList.toggle('is-active', i < upTo); });
        }

        buttons.forEach(function (button, index) {
            button.addEventListener('mouseenter', function () { paint(index + 1); });

            button.addEventListener('click', function () {
                hidden.value = index + 1;
                paint(index + 1);
                buttons.forEach(function (b, i) {
                    b.setAttribute('aria-checked', i === index ? 'true' : 'false');
                });

                var error = document.getElementById('ratingError');
                if (error) error.classList.add('d-none');
            });
        });

        picker.addEventListener('mouseleave', function () {
            paint(parseInt(hidden.value, 10) || 0);
        });

        paint(parseInt(hidden.value, 10) || 0);
    }

    function initReviewForm() {
        var form = document.getElementById('reviewForm');
        if (!form) return;

        form.addEventListener('submit', async function (e) {
            e.preventDefault();

            var rating = parseInt(document.getElementById('reviewRating').value, 10) || 0;
            var comment = document.getElementById('reviewComment').value.trim();
            var title = document.getElementById('reviewTitle').value.trim();

            var ratingError = document.getElementById('ratingError');
            var commentError = document.getElementById('commentError');
            var valid = true;

            if (rating < 1) {
                ratingError.classList.remove('d-none');
                valid = false;
            } else {
                ratingError.classList.add('d-none');
            }

            if (comment.length < 10) {
                commentError.classList.remove('d-none');
                valid = false;
            } else {
                commentError.classList.add('d-none');
            }

            if (!valid) {
                WOS.error('Please complete your review before submitting.');
                return;
            }

            var button = form.querySelector('button[type="submit"]');
            var restore = WOS.buttonBusy(button, 'Submitting...');

            var response = await WOS.api('/api/reviews', {
                method: 'POST',
                body: {
                    productId: parseInt(document.getElementById('reviewProductId').value, 10),
                    rating: rating,
                    title: title || null,
                    comment: comment
                }
            });

            restore();

            if (response.ok && response.data && response.data.success) {
                await WOS.alert(response.data.message, 'Thank you!', { icon: '&#10003;' });
                window.location.reload();
            }
        });
    }

    function initHelpfulButtons() {
        document.querySelectorAll('.js-helpful').forEach(function (button) {
            button.addEventListener('click', async function () {
                var id = button.dataset.reviewId;
                button.disabled = true;

                var response = await WOS.api('/api/reviews/' + id + '/helpful', { method: 'POST' });

                button.disabled = false;
                if (!response.ok) return;

                var countEl = button.querySelector('.js-helpful-count');
                var current = parseInt((countEl.textContent || '').replace(/\D/g, ''), 10) || 0;
                var wasVoted = button.classList.contains('is-voted');

                button.classList.toggle('is-voted', !wasVoted);
                countEl.textContent = '(' + Math.max(0, current + (wasVoted ? -1 : 1)) + ')';
            });
        });
    }

    // ---------------------------------------------------------------- confirms
    /** Replaces window.confirm on destructive actions with a themed modal. */
    function initConfirmActions() {
        document.querySelectorAll('form[data-confirm]').forEach(function (form) {
            form.addEventListener('submit', async function (e) {
                if (form.dataset.confirmed === '1') return;

                e.preventDefault();
                e.stopImmediatePropagation();

                var ok = await WOS.confirm(
                    form.dataset.confirm,
                    form.dataset.confirmTitle || 'Please confirm',
                    {
                        tone: form.dataset.confirmTone || 'danger',
                        confirmLabel: form.dataset.confirmLabel || 'Yes, continue',
                        cancelLabel: 'Cancel'
                    });

                if (ok) {
                    form.dataset.confirmed = '1';
                    form.submit();
                }
            }, true);
        });
    }

    // ---------------------------------------------------------------- visitor
    function initVisitorBadge() {
        var badge = document.getElementById('visitorBadge');
        if (!badge) return;

        WOS.api('/api/visitor/info', { silent: true }).then(function (response) {
            if (!response.ok || !response.data || !response.data.success) {
                badge.style.display = 'none';
                return;
            }

            var data = response.data;

            var ipEl = badge.querySelector('.js-visitor-ip');
            var locEl = badge.querySelector('.js-visitor-location');
            var countEl = badge.querySelector('.js-visitor-count');

            if (ipEl) ipEl.textContent = data.ipAddress || '-';
            if (locEl) locEl.textContent = data.location || 'Unknown location';
            if (countEl) countEl.textContent = Number(data.totalVisits || 0).toLocaleString('en-IN');

            badge.classList.remove('d-none');
        });
    }

    // ---------------------------------------------------------------- PWA
    function initPwa() {
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', function () {
                navigator.serviceWorker.register('/sw.js').catch(function () {
                    // Offline support is a bonus; a failed registration is not worth a message.
                });
            });
        }

        var deferredPrompt = null;
        var prompt = document.getElementById('pwaPrompt');

        window.addEventListener('beforeinstallprompt', function (e) {
            e.preventDefault();
            deferredPrompt = e;

            if (!prompt || localStorage.getItem('pwa-dismissed') === '1') return;
            setTimeout(function () { prompt.classList.add('is-visible'); }, 12000);
        });

        if (prompt) {
            var install = prompt.querySelector('.js-pwa-install');
            var dismiss = prompt.querySelector('.js-pwa-dismiss');

            if (install) {
                install.addEventListener('click', async function () {
                    prompt.classList.remove('is-visible');
                    if (!deferredPrompt) return;

                    deferredPrompt.prompt();
                    var choice = await deferredPrompt.userChoice;
                    if (choice.outcome === 'accepted') WOS.success('App installed.');
                    deferredPrompt = null;
                });
            }

            if (dismiss) {
                dismiss.addEventListener('click', function () {
                    prompt.classList.remove('is-visible');
                    localStorage.setItem('pwa-dismissed', '1');
                });
            }
        }

        var banner = document.getElementById('offlineBanner');
        if (banner) {
            function sync() { banner.classList.toggle('is-visible', !navigator.onLine); }
            window.addEventListener('online', sync);
            window.addEventListener('offline', sync);
            sync();
        }
    }

    // ---------------------------------------------------------------- password
    /**
     * Adds a show/hide control to every password field. Typing a password blind is the usual
     * reason people mistype one, so this is worth having on sign-in as much as on sign-up.
     */
    function initPasswordToggles() {
        document.querySelectorAll('input[type="password"]').forEach(function (field) {
            if (field.dataset.toggleReady === '1') return;
            field.dataset.toggleReady = '1';

            var holder = field.parentElement;
            if (!holder) return;

            // The button is positioned against this wrapper.
            var wrap = document.createElement('div');
            wrap.className = 'password-wrap';
            holder.insertBefore(wrap, field);
            wrap.appendChild(field);

            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'password-toggle';
            button.setAttribute('aria-label', 'Show password');
            button.setAttribute('tabindex', '-1');   // keep it out of the tab order
            button.innerHTML = eyeIcon(false);

            button.addEventListener('click', function () {
                var showing = field.type === 'text';
                field.type = showing ? 'password' : 'text';
                button.innerHTML = eyeIcon(!showing);
                button.setAttribute('aria-label', showing ? 'Show password' : 'Hide password');

                // Keep the caret where the customer left it.
                field.focus();
                var end = field.value.length;
                try { field.setSelectionRange(end, end); } catch (e) { }
            });

            wrap.appendChild(button);
        });
    }

    function eyeIcon(visible) {
        return visible
            ? '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
              '<path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.43-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46C3.08 8.3 1.78 10.02 1 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2z"/></svg>'
            : '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
              '<path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/></svg>';
    }

    // ---------------------------------------------------------------- misc
    function initLazyEnhancements() {
        // Quantity steppers on the cart and product pages.
        document.querySelectorAll('[data-qty-step]').forEach(function (button) {
            button.addEventListener('click', function () {
                var input = document.getElementById(button.dataset.qtyTarget);
                if (!input) return;

                var delta = parseInt(button.dataset.qtyStep, 10) || 0;
                var min = parseInt(input.min, 10) || 1;
                var max = parseInt(input.max, 10) || 99;
                var next = (parseInt(input.value, 10) || min) + delta;

                input.value = Math.min(Math.max(next, min), max);
                input.dispatchEvent(new Event('change', { bubbles: true }));
            });
        });

        // Product gallery thumbnails.
        var mainImage = document.getElementById('mainImage');
        if (mainImage) {
            document.querySelectorAll('.gallery-thumb').forEach(function (thumb) {
                thumb.addEventListener('click', function () {
                    mainImage.src = thumb.src;
                    document.querySelectorAll('.gallery-thumb').forEach(function (t) {
                        t.classList.remove('active');
                    });
                    thumb.classList.add('active');
                });
            });
        }

        // Payment method cards.
        document.querySelectorAll('.pay-option').forEach(function (option) {
            var radio = option.querySelector('input[type="radio"]');
            if (!radio || radio.disabled) return;

            option.addEventListener('click', function () {
                document.querySelectorAll('.pay-option').forEach(function (o) {
                    o.classList.remove('is-selected');
                });
                option.classList.add('is-selected');
                radio.checked = true;
            });

            if (radio.checked) option.classList.add('is-selected');
        });
    }

})(window, document);
