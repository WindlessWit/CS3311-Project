// billing.js - Billing page client logic (quotes + invoices)

document.addEventListener('DOMContentLoaded', () => {
  // ---------- 0. TAB SWITCHING (Quotes / Invoices) ----------
  const tabs = document.querySelectorAll('[data-billing-tab]');
  const panels = document.querySelectorAll('[data-billing-panel]');
  const sidebars = document.querySelectorAll('[data-sidebar]');

  function setActiveTab(target) {
    tabs.forEach((t) => {
      const name = t.getAttribute('data-billing-tab');
      t.classList.toggle('active', name === target);
    });

    panels.forEach((panel) => {
      const name = panel.getAttribute('data-billing-panel');
      panel.hidden = name !== target;
    });

    sidebars.forEach((sidebar) => {
      const name = sidebar.getAttribute('data-sidebar');
      sidebar.hidden = name !== target;
    });
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.getAttribute('data-billing-tab');
      setActiveTab(target);
    });
  });

  // Default tab
  setActiveTab('quotes');

  // ---------- 1. ELEMENT REFERENCES ----------

  // Quotes editor
  const quoteClientSelect  = document.getElementById('billing-client-select');
  const quoteClientError   = document.getElementById('billing-clients-error');
  const quoteTitleField    = document.getElementById('billing-quote-title');
  const quoteNotesField    = document.getElementById('billing-notes');
  const quoteItemsBody     = document.getElementById('billing-items-body');
  const quoteSubtotalSpan  = document.getElementById('billing-subtotal');
  const quoteAddItemBtn    = document.getElementById('billing-add-item');
  const saveDraftBtn       = document.getElementById('billing-save-draft');
  const issueQuoteBtn      = document.getElementById('billing-issue-quote');
  const convertQuoteBtn    = document.getElementById('billing-convert-to-invoice');

  // Quotes list (sidebar)
  const quoteListEl        = document.getElementById('billing-quotes-list');
  const quoteListEmptyEl   = document.getElementById('billing-quotes-empty');
  const quoteListErrorEl   = document.getElementById('billing-quotes-error');

  // Invoices sidebar + details panel
  const invoiceListEl      = document.getElementById('billing-invoices-list');
  const invoiceListEmptyEl = document.getElementById('billing-invoices-empty');
  const invoiceListErrorEl = document.getElementById('billing-invoices-error');

  const invoiceDetailsTitle = document.getElementById('invoice-details-title');
  const invoiceDetailsBody  = document.getElementById('invoice-details-body');

  // If we’re not actually on the billing page, quietly stop.
  if (!quoteClientSelect || !quoteItemsBody) {
    return;
  }

  // ---------- 2. STATE + HELPERS ----------
  let availableItems = [];
  let clientsById = {};
  let currentQuoteId = null;

  function escapeHtml(str) {
    return String(str).replace(/[&<>\"']/g, (c) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[c] || c));
  }

  function formatCurrency(value) {
    const n = typeof value === 'number' ? value : parseFloat(value || 0);
    return n.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
    });
  }

  // ---------- 3. INITIAL LOAD ----------
  loadClients();
  loadItems().then(() => {
    // Start with one empty line item row
    quoteAddItemRow();
  });
  loadQuoteList();
  loadInvoiceList();

  // ---------- 4. LOAD CLIENTS ----------
  async function loadClients() {
    try {
      if (quoteClientError) {
        quoteClientError.hidden = true;
        quoteClientError.textContent = '';
      }

      const response = await fetch('api/billing_clients.php');
      if (!response.ok) {
        throw new Error('Network error: ' + response.status);
      }

      const data = await response.json();
      const results = Array.isArray(data.results) ? data.results : [];

      // Reset map + select
      clientsById = {};
      quoteClientSelect.innerHTML = '<option value="">Select a client...</option>';

      results.forEach((c) => {
        clientsById[c.id] = c;
        const opt = document.createElement('option');
        opt.value = c.id;
        opt.textContent = c.name + (c.city ? ' (' + c.city + ')' : '');
        quoteClientSelect.appendChild(opt);
      });
    } catch (err) {
      console.error(err);
      if (quoteClientError) {
        quoteClientError.hidden = false;
        quoteClientError.textContent = 'Error loading clients.';
      }
    }
  }

  // ---------- 5. LOAD ITEMS ----------
  async function loadItems() {
    try {
      const response = await fetch('api/billing_items.php');
      if (!response.ok) {
        throw new Error('Network error: ' + response.status);
      }
      const data = await response.json();
      availableItems = Array.isArray(data.results) ? data.results : [];
    } catch (err) {
      console.error(err);
      alert('Error loading items for billing table.');
    }
  }

  // ---------- 6. QUOTE LINE ITEMS ----------
  function quoteAddItemRow(initialData) {
    const row = document.createElement('tr');
    row.className = 'billing-item-row';

    const optionsHtml = availableItems
      .map((item) => {
        const rate = Number(item.default_rate || 0).toFixed(2);
        return '<option value="' + item.id + '" data-rate="' + rate + '">' +
               escapeHtml(item.name) +
               '</option>';
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

    quoteItemsBody.appendChild(row);

    const selectEl = row.querySelector('.billing-item-select');
    const descEl   = row.querySelector('.billing-item-desc');
    const qtyEl    = row.querySelector('.billing-item-qty');
    const rateEl   = row.querySelector('.billing-item-rate');
    const totalTd  = row.querySelector('.billing-item-total');
    const removeBtn= row.querySelector('.billing-remove-item');

    // Pre-fill if we were given snapshot data (from existing quote)
    if (initialData) {
      if (initialData.item_id) {
        selectEl.value = String(initialData.item_id);
      }
      if (initialData.description) {
        descEl.value = initialData.description;
      }
      if (typeof initialData.quantity !== 'undefined') {
        qtyEl.value = String(initialData.quantity);
      }
      if (typeof initialData.rate !== 'undefined') {
        rateEl.value = Number(initialData.rate).toFixed(2);
      }
    }

    function recalcRow() {
      const q = parseFloat(qtyEl.value) || 0;
      const r = parseFloat(rateEl.value) || 0;
      const lineTotal = q * r;
      totalTd.textContent = formatCurrency(lineTotal);
      quoteRecalcTotals();
    }

    selectEl.addEventListener('change', () => {
      const id = selectEl.value;
      if (!id) {
        recalcRow();
        return;
      }
      const item = availableItems.find((i) => String(i.id) === String(id));
      if (item) {
        if (!descEl.value.trim()) {
          descEl.value = item.name;
        }
        rateEl.value = Number(item.default_rate || 0).toFixed(2);
      }
      recalcRow();
    });

    qtyEl.addEventListener('input', recalcRow);
    rateEl.addEventListener('input', recalcRow);

    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        row.remove();
        quoteRecalcTotals();
      });
    }

    recalcRow();
  }

  function quoteRecalcTotals() {
    let subtotal = 0;
    quoteItemsBody.querySelectorAll('.billing-item-total').forEach((cell) => {
      const text = cell.textContent.replace(/[^0-9.]/g, '');
      const value = parseFloat(text) || 0;
      subtotal += value;
    });
    quoteSubtotalSpan.textContent = formatCurrency(subtotal);
  }

  if (quoteAddItemBtn) {
    quoteAddItemBtn.addEventListener('click', () => {
      quoteAddItemRow();
    });
  }

  // ---------- 7. COLLECT QUOTE PAYLOAD ----------
  function collectQuotePayload(status) {
    const clientVal = quoteClientSelect.value;
    const clientId = clientVal ? parseInt(clientVal, 10) : 0;
    const title = quoteTitleField ? quoteTitleField.value.trim() : '';
    const notes = quoteNotesField ? quoteNotesField.value.trim() : '';

    const items = [];
    quoteItemsBody.querySelectorAll('.billing-item-row').forEach((row) => {
      const selectEl = row.querySelector('.billing-item-select');
      const descEl   = row.querySelector('.billing-item-desc');
      const qtyEl    = row.querySelector('.billing-item-qty');
      const rateEl   = row.querySelector('.billing-item-rate');

      const itemId      = selectEl && selectEl.value ? parseInt(selectEl.value, 10) : null;
      const description = descEl ? descEl.value.trim() : '';
      const quantity    = qtyEl ? parseFloat(qtyEl.value || '0') : 0;
      const rate        = rateEl ? parseFloat(rateEl.value || '0') : 0;
      const lineTotal   = quantity * rate;

      if (!description && !itemId) {
        return; // skip empty line
      }

      items.push({
        item_id: itemId,
        description,
        quantity,
        rate,
        line_total: lineTotal,
      });
    });

    return {
      id: currentQuoteId || null,
      client_id: clientId,
      status,
      title,
      notes,
      items,
    };
  }

  // ---------- 8. SAVE QUOTE ----------
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Server error:', text);
        alert('Error saving quote on the server.');
        return;
      }

      const data = await response.json();
      if (!data.success || !data.id) {
        console.error('Response error:', data);
        alert(data.error || 'Error saving quote.');
        return;
      }

      currentQuoteId = data.id;
      alert(
        status === 'issued'
          ? 'Quote issued and saved.'
          : 'Draft quote saved.'
      );

      await loadQuoteList();
    } catch (err) {
      console.error(err);
      alert('Network error while saving quote.');
    }
  }

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

  // ---------- 9. LOAD QUOTES LIST ----------
  async function loadQuoteList() {
    if (!quoteListEl) return;

    try {
      if (quoteListErrorEl) {
        quoteListErrorEl.hidden = true;
        quoteListErrorEl.textContent = '';
      }

      const response = await fetch('api/list_quotes.php');
      if (!response.ok) {
        throw new Error('Network error: ' + response.status);
      }

      const data = await response.json();
      const quotes = Array.isArray(data.results) ? data.results : [];

      quoteListEl.innerHTML = '';

      if (!quotes.length) {
        if (quoteListEmptyEl) quoteListEmptyEl.hidden = false;
        return;
      }

      if (quoteListEmptyEl) quoteListEmptyEl.hidden = true;

      quotes.forEach((q) => {
        const li = document.createElement('li');
        li.className = 'billing-quote-item';

        const totalFormatted =
          typeof q.total === 'number'
            ? formatCurrency(q.total)
            : '';

        li.innerHTML = `
          <button type="button" class="billing-quote-row" data-quote-id="${q.id}">
            <div class="billing-quote-row-main">
              <span class="billing-quote-title">
                ${escapeHtml(q.title || ('Quote #' + q.id))}
              </span>
              ${
                totalFormatted
                  ? `<span class="billing-quote-total">${totalFormatted}</span>`
                  : ''
              }
            </div>
            <div class="billing-quote-row-meta">
              <span class="status-pill status-${q.status}">
                ${escapeHtml(q.status)}
              </span>
              <span class="billing-quote-client">
                ${escapeHtml(q.client_name || ('Client #' + q.client_id))}
              </span>
              <span class="billing-quote-date">
                ${q.created_at ? escapeHtml(q.created_at.substring(0, 10)) : ''}
              </span>
            </div>
          </button>
        `;

        const btn = li.querySelector('button[data-quote-id]');
        if (btn) {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-quote-id'), 10);
            if (id) {
              loadQuoteIntoEditor(id);
            }
          });
        }

        quoteListEl.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      if (quoteListErrorEl) {
        quoteListErrorEl.hidden = false;
        quoteListErrorEl.textContent = 'Error loading quotes list.';
      }
    }
  }

  // ---------- 10. LOAD SINGLE QUOTE INTO EDITOR ----------
  async function loadQuoteIntoEditor(quoteId) {
    try {
      const response = await fetch(
        'api/billing_quote_get.php?id=' + encodeURIComponent(quoteId)
      );
      if (!response.ok) {
        throw new Error('Network error: ' + response.status);
      }

      const data = await response.json();
      if (!data.quote) {
        throw new Error('Quote not found.');
      }

      currentQuoteId = data.quote.id;

      // Client dropdown
      const cidStr = String(data.quote.client_id);
      if (quoteClientSelect) {
        const opt = Array.from(quoteClientSelect.options)
          .find((o) => o.value === cidStr);
        if (opt) {
          quoteClientSelect.value = cidStr;
        } else {
          const newOpt = document.createElement('option');
          newOpt.value = cidStr;
          newOpt.textContent = data.quote.client_name || ('Client #' + cidStr);
          quoteClientSelect.appendChild(newOpt);
          quoteClientSelect.value = cidStr;
        }
      }

      // Title + notes
      if (quoteTitleField) {
        quoteTitleField.value = data.quote.title || '';
      }
      if (quoteNotesField) {
        quoteNotesField.value = data.quote.notes || '';
      }

      // Line items
      quoteItemsBody.innerHTML = '';
      const items = Array.isArray(data.items) ? data.items : [];
      if (!items.length) {
        quoteAddItemRow();
      } else {
        items.forEach((it) => {
          quoteAddItemRow({
            item_id: it.item_id,
            description: it.description,
            quantity: it.quantity,
            rate: it.rate,
          });
        });
      }

      quoteRecalcTotals();
      setActiveTab('quotes');
    } catch (err) {
      console.error(err);
      alert('Failed to load quote into editor.');
    }
  }

  // ---------- 11. CONVERT QUOTE -> INVOICE ----------
  async function convertCurrentQuoteToInvoice() {
    if (!currentQuoteId) {
      alert('Save or load a quote first before converting.');
      return;
    }

    if (!confirm('Convert this quote to an invoice?')) {
      return;
    }

    try {
      const response = await fetch('api/convert_quote_to_invoice.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote_id: currentQuoteId }),
      });

      if (!response.ok) {
        const text = await response.text();
        console.error('Server error:', text);
        alert('Error converting quote to invoice.');
        return;
      }

      const data = await response.json();
      if (!data.success || !data.invoice_id) {
        console.error('Response error:', data);
        alert(data.error || 'Error converting quote.');
        return;
      }

      alert('Quote converted to invoice #' + data.invoice_id + '.');

      await loadQuoteList();
      await loadInvoiceList();

      setActiveTab('invoices');
      loadInvoiceDetails(data.invoice_id);
    } catch (err) {
      console.error(err);
      alert('Network error converting quote to invoice.');
    }
  }

  if (convertQuoteBtn) {
    convertQuoteBtn.addEventListener('click', convertCurrentQuoteToInvoice);
  }

  // ---------- 12. INVOICE LIST + DETAILS (READ-ONLY) ----------
  async function loadInvoiceList() {
    if (!invoiceListEl) return;

    try {
      if (invoiceListErrorEl) {
        invoiceListErrorEl.hidden = true;
        invoiceListErrorEl.textContent = '';
      }

      const response = await fetch('api/list_invoices.php');
      if (!response.ok) {
        throw new Error('Network error: ' + response.status);
      }

      const data = await response.json();
      const invoices = Array.isArray(data.results) ? data.results : [];

      invoiceListEl.innerHTML = '';

      if (!invoices.length) {
        if (invoiceListEmptyEl) invoiceListEmptyEl.hidden = false;
        return;
      }

      if (invoiceListEmptyEl) invoiceListEmptyEl.hidden = true;

      invoices.forEach((inv) => {
        const li = document.createElement('li');
        li.className = 'billing-quote-item';

        const totalFormatted =
          typeof inv.total === 'number'
            ? formatCurrency(inv.total)
            : '';

        li.innerHTML = `
          <button type="button" class="billing-quote-row" data-invoice-id="${inv.id}">
            <div class="billing-quote-row-main">
              <span class="billing-quote-title">
                Invoice #${inv.id}
              </span>
              ${
                totalFormatted
                  ? `<span class="billing-quote-total">${totalFormatted}</span>`
                  : ''
              }
            </div>
            <div class="billing-quote-row-meta">
              <span class="status-pill status-${inv.status}">
                ${escapeHtml(inv.status)}
              </span>
              <span class="billing-quote-client">
                ${escapeHtml(inv.client_name || ('Client #' + inv.client_id))}
              </span>
              <span class="billing-quote-date">
                ${
                  inv.issued_date
                    ? escapeHtml(inv.issued_date)
                    : (inv.created_at ? escapeHtml(inv.created_at.substring(0, 10)) : '')
                }
              </span>
            </div>
          </button>
        `;

        const btn = li.querySelector('button[data-invoice-id]');
        if (btn) {
          btn.addEventListener('click', () => {
            const id = parseInt(btn.getAttribute('data-invoice-id'), 10);
            if (id) {
              loadInvoiceDetails(id);
            }
          });
        }

        invoiceListEl.appendChild(li);
      });
    } catch (err) {
      console.error(err);
      if (invoiceListErrorEl) {
        invoiceListErrorEl.hidden = false;
        invoiceListErrorEl.textContent = 'Error loading invoices list.';
      }
    }
  }

  async function loadInvoiceDetails(invoiceId) {
    try {
      const response = await fetch(
        'api/billing_invoice_get.php?id=' + encodeURIComponent(invoiceId)
      );
      if (!response.ok) {
        throw new Error('Network error: ' + response.status);
      }

      const data = await response.json();
      if (!data.invoice) {
        throw new Error('Invoice not found.');
      }

      const inv = data.invoice;
      const items = Array.isArray(data.items) ? data.items : [];

      if (invoiceDetailsTitle) {
        invoiceDetailsTitle.textContent =
          'Invoice #' + inv.id +
          (inv.client_name ? (' – ' + inv.client_name) : '');
      }

      if (invoiceDetailsBody) {
        let html = '';

        html += '<div class="invoice-meta">';
        html += '<p><strong>Status:</strong> ' + escapeHtml(inv.status) + '</p>';
        if (inv.issued_date) {
          html += '<p><strong>Issued:</strong> ' +
                  escapeHtml(inv.issued_date) + '</p>';
        }
        if (inv.due_date) {
          html += '<p><strong>Due:</strong> ' +
                  escapeHtml(inv.due_date) + '</p>';
        }
        if (inv.paid_date) {
          html += '<p><strong>Paid:</strong> ' +
                  escapeHtml(inv.paid_date) + '</p>';
        }
        html += '</div>';

        if (inv.notes) {
          html += '<div class="invoice-notes">';
          html += '<h3>Notes</h3>';
          html += '<p>' + escapeHtml(inv.notes) + '</p>';
          html += '</div>';
        }

        if (items.length) {
          html += '<div class="table-wrapper">';
          html += '<table class="job-table billing-table">';
          html += '<thead><tr>' +
                  '<th style="width: 55%;">Description</th>' +
                  '<th style="width: 10%;">Qty</th>' +
                  '<th style="width: 15%;">Rate</th>' +
                  '<th style="width: 20%;">Line total</th>' +
                  '</tr></thead><tbody>';

          let subtotal = 0;
          items.forEach((it) => {
            const qty = it.quantity || 0;
            const rate = it.rate || 0;
            const total = it.line_total || (qty * rate);
            subtotal += total;

            html += '<tr>';
            html += '<td>' + escapeHtml(it.description || '') + '</td>';
            html += '<td>' + String(qty) + '</td>';
            html += '<td>' + formatCurrency(rate) + '</td>';
            html += '<td>' + formatCurrency(total) + '</td>';
            html += '</tr>';
          });

          html += '</tbody></table></div>';

          html += '<div class="quote-summary invoice-summary">';
          html += '<div class="quote-total-row">';
          html += '<span>Total</span>';
          html += '<span>' + formatCurrency(subtotal) + '</span>';
          html += '</div></div>';
        } else {
          html += '<p>No line items on this invoice.</p>';
        }

        invoiceDetailsBody.innerHTML = html;
      }

      setActiveTab('invoices');
    } catch (err) {
      console.error(err);
      alert('Failed to load invoice details.');
    }
  }
});
