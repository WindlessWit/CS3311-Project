// billing.js - Billing page client logic (quotes + sidebar list front-end)

document.addEventListener('DOMContentLoaded', () => {
    // ---------- 0. TAB SWITCHING (Quotes / Invoices) ----------
    const tabs = document.querySelectorAll('[data-billing-tab]');
    const panels = document.querySelectorAll('[data-billing-panel]');

    tabs.forEach((tab) => {
        tab.addEventListener('click', () => {
            const target = tab.getAttribute('data-billing-tab');

            tabs.forEach((t) => {
                t.classList.toggle('active', t === tab);
            });

            panels.forEach((panel) => {
                const name = panel.getAttribute('data-billing-panel');
                panel.hidden = name !== target;
            });
        });
    });

    // ---------- 1. ELEMENT REFERENCES ----------
    const clientSelect  = document.getElementById('billing-client-select');
    const clientError   = document.getElementById('billing-clients-error');
    const debugPre      = document.getElementById('billing-debug-clients');

    const itemsBody     = document.getElementById('billing-items-body');
    const itemsError    = document.getElementById('billing-items-error');
    const addItemBtn    = document.getElementById('billing-add-item');

    const subtotalSpan  = document.getElementById('billing-subtotal');
    const notesField    = document.getElementById('billing-notes');
    const titleField    = document.getElementById('billing-quote-title');

    const saveDraftBtn  = document.getElementById('billing-save-draft');
    const issueQuoteBtn = document.getElementById('billing-issue-quote');

    // NEW: quote list in the sidebar
    const quoteList      = document.getElementById('billing-quotes-list');
    const quoteListEmpty = document.getElementById('billing-quotes-empty');
    const quoteListError = document.getElementById('billing-quotes-error');

    // If we’re not actually on the billing page, quietly stop.
    if (!clientSelect || !itemsBody) return;

    // Cached items from the API
    let availableItems = [];

    // Small helper for safe HTML
    function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, (c) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;',
        }[c]));
    }

    // ---------- 2. INITIAL LOAD ----------
    loadClients();
    loadItems().then(() => {
        // Start with one empty row
        addItemRow();
    });
    loadQuoteList();

    // ---------- 3. LOAD CLIENTS FROM API ----------
    async function loadClients() {
        try {
            if (clientError) {
                clientError.hidden = true;
                clientError.textContent = '';
            }
            if (debugPre) {
                debugPre.textContent = 'Loading clients...';
            }

            const response = await fetch('api/billing_clients.php');
            if (!response.ok) {
                throw new Error('Network error: ' + response.status);
            }

            const data = await response.json();
            const clients = Array.isArray(data.results) ? data.results : [];

            clientSelect.innerHTML =
                '<option value="">Select a client...</option>';

            clients.forEach((c) => {
                const opt = document.createElement('option');
                opt.value = c.id;
                opt.textContent = c.name + (c.city ? ` (${c.city})` : '');
                opt.dataset.email = c.email || '';
                opt.dataset.phone = c.phone || '';
                opt.dataset.fullAddress = c.full_address || '';
                clientSelect.appendChild(opt);
            });

            if (debugPre) {
                debugPre.textContent = JSON.stringify(clients, null, 2);
            }
        } catch (err) {
            console.error(err);
            if (clientError) {
                clientError.hidden = false;
                clientError.textContent = 'Error loading clients.';
            }
            if (debugPre) {
                debugPre.textContent = '';
            }
        }
    }

    // ---------- 4. LOAD ITEMS FROM API ----------
    async function loadItems() {
        try {
            if (itemsError) {
                itemsError.hidden = true;
                itemsError.textContent = '';
            }

            const response = await fetch('api/billing_items.php');
            if (!response.ok) {
                throw new Error('Network error: ' + response.status);
            }

            const data = await response.json();
            availableItems = Array.isArray(data.results) ? data.results : [];
        } catch (err) {
            console.error(err);
            if (itemsError) {
                itemsError.hidden = false;
                itemsError.textContent = 'Error loading items.';
            }
        }
    }

    // ---------- 5. LOAD QUOTE LIST FROM API ----------
    async function loadQuoteList() {
        if (!quoteList) return;

        try {
            if (quoteListError) {
                quoteListError.hidden = true;
                quoteListError.textContent = '';
            }

            const response = await fetch('api/list_quotes.php');
            if (!response.ok) {
                throw new Error('Network error: ' + response.status);
            }

            const data = await response.json();
            const quotes = Array.isArray(data.results) ? data.results : [];

            quoteList.innerHTML = '';

            if (!quotes.length) {
                if (quoteListEmpty) quoteListEmpty.hidden = false;
                return;
            }

            if (quoteListEmpty) quoteListEmpty.hidden = true;

            quotes.forEach((q) => {
                const li = document.createElement('li');
                li.className = 'billing-quote-item';
                li.dataset.quoteId = q.id;

                const total =
                    typeof q.total === 'number'
                        ? q.total.toLocaleString('en-US', {
                              style: 'currency',
                              currency: 'USD',
                          })
                        : '';

                li.innerHTML = `
                    <div class="billing-quote-main">
                        <div class="billing-quote-title">
                            ${q.title ? escapeHtml(q.title) : 'Quote #' + q.id}
                        </div>
                        <div class="billing-quote-client">
                            ${
                                q.client_name
                                    ? escapeHtml(q.client_name)
                                    : 'Client #' + q.client_id
                            }
                        </div>
                    </div>
                    <div class="billing-quote-meta">
                        <span class="badge badge-status badge-${q.status}">
                            ${q.status}
                        </span>
                        ${
                            total
                                ? `<span class="billing-quote-total">${total}</span>`
                                : ''
                        }
                    </div>
                `;

                // Later we can add click handler here to open the quote details.
                quoteList.appendChild(li);
            });
        } catch (err) {
            console.error(err);
            if (quoteListError) {
                quoteListError.hidden = false;
                quoteListError.textContent = 'Error loading quotes list.';
            }
        }
    }

    // ---------- 6. ADD / REMOVE LINE ITEMS ----------
    if (addItemBtn) {
        addItemBtn.addEventListener('click', () => {
            addItemRow();
        });
    }

    function addItemRow() {
        const row = document.createElement('tr');
        row.classList.add('billing-item-row');

        const optionsHtml = availableItems
            .map((item) => {
                const rate = Number(item.default_rate || 0).toFixed(2);
                return `<option value="${item.id}" data-rate="${rate}">
                            ${item.name}
                        </option>`;
            })
            .join('');

        row.innerHTML = `
            <td>
                <select class="billing-item-select">
                    <option value="">Custom item...</option>
                    ${optionsHtml}
                </select>
                <input
                    type="text"
                    class="billing-item-desc"
                    placeholder="Description"
                >
            </td>
            <td>
                <input
                    type="number"
                    min="1"
                    value="1"
                    class="billing-item-qty"
                >
            </td>
            <td>
                <input
                    type="number"
                    min="0"
                    step="0.01"
                    value="0.00"
                    class="billing-item-rate"
                >
            </td>
            <td class="billing-item-total">$0.00</td>
            <td>
                <button type="button"
                        class="btn icon-btn billing-remove-item"
                        title="Remove line">
                    &times;
                </button>
            </td>
        `;

        itemsBody.appendChild(row);

        const select   = row.querySelector('.billing-item-select');
        const desc     = row.querySelector('.billing-item-desc');
        const qty      = row.querySelector('.billing-item-qty');
        const rate     = row.querySelector('.billing-item-rate');
        const totalTd  = row.querySelector('.billing-item-total');
        const remove   = row.querySelector('.billing-remove-item');

        function recalcRow() {
            const q = parseFloat(qty.value) || 0;
            const r = parseFloat(rate.value) || 0;
            const lineTotal = q * r;
            totalTd.textContent = lineTotal.toLocaleString('en-US', {
                style: 'currency',
                currency: 'USD',
            });
            recalcTotals();
        }

        // When they pick a saved item, fill description + rate
        select.addEventListener('change', () => {
            const id = select.value;
            if (!id) {
                // Custom item
                return recalcRow();
            }
            const item = availableItems.find(
                (i) => String(i.id) === String(id)
            );
            if (item) {
                if (!desc.value.trim()) {
                    desc.value = item.name;
                }
                rate.value = Number(item.default_rate || 0).toFixed(2);
            }
            recalcRow();
        });

        [qty, rate].forEach((input) => {
            input.addEventListener('input', recalcRow);
        });

        if (remove) {
            remove.addEventListener('click', () => {
                row.remove();
                recalcTotals();
            });
        }

        recalcRow();
    }

    function recalcTotals() {
        if (!subtotalSpan) return;
        let subtotal = 0;

        itemsBody.querySelectorAll('.billing-item-total').forEach((cell) => {
            const text = cell.textContent.replace(/[^0-9.]/g, '');
            const value = parseFloat(text) || 0;
            subtotal += value;
        });

        subtotalSpan.textContent = subtotal.toLocaleString('en-US', {
            style: 'currency',
            currency: 'USD',
        });
    }

    // ---------- 7. BUILD QUOTE PAYLOAD ----------
    function collectQuotePayload(status) {
        const clientId = clientSelect.value || null;
        const title    = titleField ? titleField.value.trim() : '';
        const notes    = notesField ? notesField.value.trim() : '';

        const items = [];
        itemsBody.querySelectorAll('.billing-item-row').forEach((row) => {
            const select  = row.querySelector('.billing-item-select');
            const desc    = row.querySelector('.billing-item-desc');
            const qty     = row.querySelector('.billing-item-qty');
            const rate    = row.querySelector('.billing-item-rate');

            const itemId      = select && select.value ? Number(select.value) : null;
            const description = desc ? desc.value.trim() : '';
            const quantity    = qty ? Number(qty.value || 0) : 0;
            const rateValue   = rate ? Number(rate.value || 0) : 0;
            const lineTotal   = quantity * rateValue;

            if (!description && !itemId) {
                // Ignore completely empty lines
                return;
            }

            items.push({
                item_id: itemId,
                description,
                quantity,
                rate: rateValue,
                line_total: lineTotal,
            });
        });

        return {
            status,                 // 'draft' or 'issued'
            client_id: clientId ? Number(clientId) : null,
            title,
            notes,
            items,
        };
    }

    // ---------- 8. SAVE QUOTE TO BACKEND ----------
    async function saveQuote(status) {
        const payload = collectQuotePayload(status);

        if (!payload.client_id) {
            alert('Please select a client before saving the quote.');
            return;
        }
        if (!payload.items.length) {
            alert('Please add at least one line item.');
            return;
        }

        try {
            const response = await fetch('api/create_quote.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const text = await response.text();
                console.error('Server error:', text);
                alert('Error saving quote (server).');
                return;
            }

            const data = await response.json();
            if (!data.success) {
                alert(data.error || 'Error saving quote.');
                return;
            }

            alert(
                status === 'issued'
                    ? 'Quote issued and saved.'
                    : 'Draft quote saved.'
            );

            // Refresh sidebar list
            loadQuoteList();
        } catch (err) {
            console.error(err);
            alert('Network error saving quote.');
        }
    }

    // ---------- 9. BUTTON HANDLERS ----------
    if (saveDraftBtn) {
        saveDraftBtn.addEventListener('click', () => {
            saveQuote('draft');
        });
    }

    if (issueQuoteBtn) {
        issueQuoteBtn.addEventListener('click', () => {
            saveQuote('issued');
        });
    }
});
