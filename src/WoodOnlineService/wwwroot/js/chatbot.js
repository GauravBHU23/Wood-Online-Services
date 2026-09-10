/*!
 * Wood Online Service — chat assistant
 *
 * Answers come from the site's own API, which reads the real catalogue and shop settings.
 * Anything it cannot answer is handed to WhatsApp so a person picks it up.
 */
(function (window, document) {
    'use strict';

    var WOS = window.WOS;
    var started = false;
    var busy = false;

    document.addEventListener('DOMContentLoaded', function () {
        var launcher = document.getElementById('chatLauncher');
        if (!launcher) return;

        var panel = document.getElementById('chatPanel');
        var closeBtn = document.getElementById('chatClose');
        var form = document.getElementById('chatForm');
        var input = document.getElementById('chatInput');

        launcher.addEventListener('click', function () { toggle(panel, launcher, input); });
        if (closeBtn) closeBtn.addEventListener('click', function () { close(panel, launcher); });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && panel.classList.contains('is-open')) close(panel, launcher);
        });

        if (form) {
            form.addEventListener('submit', function (e) {
                e.preventDefault();
                var text = input.value.trim();
                if (!text || busy) return;

                input.value = '';
                ask(text);
            });
        }
    });

    function toggle(panel, launcher, input) {
        if (panel.classList.contains('is-open')) {
            close(panel, launcher);
            return;
        }

        panel.classList.add('is-open');
        launcher.setAttribute('aria-expanded', 'true');

        if (!started) {
            started = true;
            start();
        }

        // Opening the keyboard on a phone as soon as the panel appears is jarring.
        if (window.innerWidth > 576 && input) setTimeout(function () { input.focus(); }, 250);
    }

    function close(panel, launcher) {
        panel.classList.remove('is-open');
        launcher.setAttribute('aria-expanded', 'false');
    }

    async function start() {
        var response = await WOS.api('/api/chat/start', { silent: true });

        if (response.ok && response.data && response.data.success) {
            addBot(response.data.message, response.data.suggestions);
        } else {
            addBot('Hello! Ask me about our furniture, prices, delivery or how to order.', []);
        }
    }

    async function ask(text) {
        addUser(text);
        busy = true;

        var typing = addTyping();

        var response = await WOS.api('/api/chat', {
            method: 'POST',
            body: { message: text },
            silent: true
        });

        typing.remove();
        busy = false;

        if (response.ok && response.data && response.data.success) {
            addBot(response.data.message, response.data.suggestions, response.data.products);
            return;
        }

        if (response.status === 429) {
            addBot('You are asking rather quickly. Give me a moment and try again.', []);
            return;
        }

        addBot('Sorry, something went wrong at my end. Please try again, or message us on WhatsApp.', []);
    }

    // ---------------------------------------------------------------- rendering
    function body() { return document.getElementById('chatBody'); }

    function scroll() {
        var b = body();
        if (b) b.scrollTop = b.scrollHeight;
    }

    function addUser(text) {
        var el = document.createElement('div');
        el.className = 'chat-msg chat-msg--user';
        el.textContent = text;
        body().appendChild(el);
        scroll();
    }

    function addBot(text, suggestions, products) {
        var el = document.createElement('div');
        el.className = 'chat-msg chat-msg--bot';
        // textContent keeps the reply as plain text; white-space:pre-line in CSS honours newlines.
        el.textContent = text;
        body().appendChild(el);

        if (products && products.length) addProducts(products);
        if (suggestions && suggestions.length) addSuggestions(suggestions);

        scroll();
    }

    function addProducts(products) {
        var wrap = document.createElement('div');
        wrap.className = 'chat-products';

        products.forEach(function (p) {
            var link = document.createElement('a');
            link.className = 'chat-product';
            link.href = '/Shop/Details/' + p.id;

            var price = p.isCustomOrder
                ? 'Price on request'
                : '₹' + Number(p.price).toLocaleString('en-IN');

            link.innerHTML =
                '<img src="' + WOS.escapeHtml(p.image || '/img/cat-custom.svg') + '" alt="" loading="lazy">' +
                '<span class="chat-product__text">' +
                '<span class="chat-product__name">' + WOS.escapeHtml(p.name) + '</span>' +
                '<span class="chat-product__meta">' +
                (p.woodType ? WOS.escapeHtml(p.woodType) + ' &middot; ' : '') + price +
                '</span></span>';

            wrap.appendChild(link);
        });

        body().appendChild(wrap);
    }

    function addSuggestions(suggestions) {
        var wrap = document.createElement('div');
        wrap.className = 'chat-suggestions';

        suggestions.forEach(function (s) {
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'chat-suggestion';
            button.textContent = s;

            button.addEventListener('click', function () {
                if (busy) return;
                // The chips belong to the answer above them; drop them once one is used.
                wrap.remove();
                ask(s);
            });

            wrap.appendChild(button);
        });

        body().appendChild(wrap);
    }

    function addTyping() {
        var el = document.createElement('div');
        el.className = 'chat-msg chat-msg--bot chat-typing';
        el.innerHTML = '<span></span><span></span><span></span>';
        body().appendChild(el);
        scroll();
        return el;
    }

})(window, document);
