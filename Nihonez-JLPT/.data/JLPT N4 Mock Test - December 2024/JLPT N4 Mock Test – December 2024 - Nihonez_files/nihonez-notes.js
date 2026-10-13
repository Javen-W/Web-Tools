/**
 * NihonEZ shared notes panel — frontend module.
 *
 * Auto-initializes any element with class `.nihonez-notes-panel`. Each panel
 * reads its config (target type/id, categories, initial notes) from a
 * window.nihonezNotesPanels[panelId] entry rendered by PHP.
 *
 * Backed by the REST API in mu-plugins/nihonez-user-notes.php.
 */
(function ($) {
    'use strict';

    if (typeof window.nihonezNotesConfig === 'undefined') return;

    var globalCfg = window.nihonezNotesConfig;
    var panelData = window.nihonezNotesPanels || {};

    var DEFAULT_CATEGORIES = [
        { value: 'general',  label: 'General'       },
        { value: 'vocab',    label: 'Vocab'         },
        { value: 'kanji',    label: 'Kanji'         },
        { value: 'grammar',  label: 'Grammar'       },
        { value: 'mnemonic', label: 'Mnemonic'      },
        { value: 'opinion',  label: 'Opinion'       },
        { value: 'question', label: 'Question'      },
        { value: 'example',  label: 'Example'       },
        { value: 'diary',    label: 'Diary'         },
        { value: 'strategy', label: 'Test Strategy' },
        { value: 'trap',     label: 'Trap'          },
        { value: 'mistake',  label: 'Mistake'       }
    ];

    function initPanel($panel) {
        var panelId = $panel.attr('id');
        var cfg     = panelData[panelId] || {};
        var $list   = $panel.find('.nihonez-notes-list').first();
        var $addBtn = $panel.find('.nihonez-notes-add-btn').first();
        var $status = $panel.find('.nihonez-notes-status').first();
        var $viewBtns = $panel.find('.nihonez-notes-view-btn');
        if (!$list.length || !globalCfg.isLoggedIn) return;

        var notesBase  = globalCfg.restRoot + 'nihonez/v1/notes';
        var nonce      = globalCfg.restNonce;
        var targetType = cfg.targetType || $panel.data('target-type') || '';
        // targetId can legitimately be 0 (standalone notebook entries),
        // so we use == null rather than truthiness.
        var targetId = (cfg.targetId != null) ? cfg.targetId : $panel.data('target-id');
        targetId = (targetId == null || targetId === '') ? NaN : parseInt(targetId, 10);
        var categories = (cfg.categories && cfg.categories.length) ? cfg.categories : DEFAULT_CATEGORIES;
        var initialNotes = Array.isArray(cfg.initialNotes) ? cfg.initialNotes : [];
        var emptyText  = cfg.emptyText || 'No notes yet.';
        var defaultCat = categories[0].value;
        var activeReqs = 0;

        if (!targetType || isNaN(targetId) || targetId < 0) return;

        function normalizeCategory(value) {
            value = (value || '').toString().toLowerCase();
            for (var i = 0; i < categories.length; i++) {
                if (categories[i].value === value) return value;
            }
            return defaultCat;
        }

        function categoryLabel(value) {
            for (var i = 0; i < categories.length; i++) {
                if (categories[i].value === value) return categories[i].label;
            }
            return value;
        }

        function applyCategoryClass($card, category) {
            for (var i = 0; i < categories.length; i++) {
                $card.removeClass('nihonez-note-category-' + categories[i].value);
            }
            $card.addClass('nihonez-note-category-' + normalizeCategory(category));
        }

        function setStatus(text, kind) {
            $status.text(text || '');
            $status.attr('data-kind', kind || '');
        }

        function onSaveStart() {
            activeReqs++;
            setStatus('Saving…', 'pending');
        }

        function onSaveDone(ok) {
            activeReqs = Math.max(0, activeReqs - 1);
            if (activeReqs === 0) {
                if (ok) {
                    setStatus('Saved', 'ok');
                    setTimeout(function () { if (activeReqs === 0) setStatus('', ''); }, 1500);
                } else {
                    setStatus('Save failed', 'error');
                }
            }
        }

        function showEmpty() {
            if ($list.find('.nihonez-note-card').length === 0) {
                $list.append('<div class="nihonez-notes-empty"></div>').find('.nihonez-notes-empty').last().text(emptyText);
            }
        }

        function formatDate(iso) {
            if (!iso) return '';
            var d = new Date(iso.replace(' ', 'T'));
            if (isNaN(d.getTime())) return '';
            return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        }

        function renderCard(note, opts) {
            opts = opts || {};
            var initialCategory = normalizeCategory(note.category);
            var $card = $('<div class="nihonez-note-card"></div>').data('note-db-id', note.id || null);
            applyCategoryClass($card, initialCategory);
            if (opts.expanded) $card.addClass('is-expanded');

            var pencilSVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>';
            var trashSVG  = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>';

            var initialLabel = categoryLabel(initialCategory);
            var initialDate  = formatDate(note.updated_at || note.created_at);

            var $header     = $('<div class="nihonez-note-card-header"></div>');
            var $pencilBtn  = $('<button type="button" class="nihonez-note-pencil-btn" title="Edit note" aria-label="Edit note"></button>').html(pencilSVG);
            var $titleWrap  = $('<div class="nihonez-note-title-wrap"></div>');
            var $titleInp   = $('<input type="text" class="nihonez-note-title-input" placeholder="Untitled note">').val(note.title || '');
            var $titleMeta  = $('<div class="nihonez-note-title-meta"></div>');
            var $titleBadge = $('<span class="nihonez-note-category-badge nihonez-note-category-badge--title"></span>').text(initialLabel);
            var $titleDate  = $('<span class="nihonez-note-date nihonez-note-date--title"></span>').text(initialDate);
            $titleMeta.append($titleBadge).append($titleDate);
            var $preview    = $('<div class="nihonez-note-preview"></div>').text(note.content || '');
            $titleWrap.append($titleInp).append($titleMeta).append($preview);
            var $meta       = $('<div class="nihonez-note-meta"></div>');
            var $catBadge   = $('<span class="nihonez-note-category-badge nihonez-note-category-badge--meta"></span>').text(initialLabel);
            var $date       = $('<span class="nihonez-note-date nihonez-note-date--meta"></span>').text(initialDate);
            $meta.append($catBadge).append($date);
            $header.append($pencilBtn).append($titleWrap).append($meta);

            var $body      = $('<div class="nihonez-note-card-body"></div>');
            var $catSelect = $('<select class="nihonez-note-category-select" title="Category" aria-label="Category"></select>');
            categories.forEach(function (c) {
                var $opt = $('<option></option>').attr('value', c.value).text(c.label);
                if (c.value === initialCategory) $opt.attr('selected', 'selected');
                $catSelect.append($opt);
            });
            var $textarea = $('<textarea class="nihonez-note-textarea" rows="4" placeholder="Write your notes here…"></textarea>').val(note.content || '');
            var $footer   = $('<div class="nihonez-note-card-footer"></div>');
            var $delBtn   = $('<button type="button" class="nihonez-note-delete-btn" title="Delete note" aria-label="Delete note"></button>').html(trashSVG);
            $footer.append($catSelect).append($delBtn);
            $body.append($textarea).append($footer);

            $card.append($header).append($body);

            $pencilBtn.on('click', function (e) {
                e.stopPropagation();
                var willExpand = !$card.hasClass('is-expanded');
                $card.toggleClass('is-expanded', willExpand);
                if (willExpand) $textarea.focus();
            });

            var cardTimer = null;
            var lastSaved = { title: note.title || '', content: note.content || '', category: initialCategory };
            var creating    = false;
            var pendingSave = false;

            function saveCard(useKeepalive) {
                var title    = $titleInp.val();
                var content  = $textarea.val();
                var category = normalizeCategory($catSelect.val());
                if (
                    title    === lastSaved.title &&
                    content  === lastSaved.content &&
                    category === lastSaved.category
                ) return;

                var dbId = $card.data('note-db-id');
                // Don't create a new row in the DB for an empty note.
                if (!dbId && title.trim() === '' && content.trim() === '') return;

                // If the initial POST is still in flight, defer this save —
                // otherwise we'd issue a second POST and create a duplicate row.
                if (!dbId && creating) {
                    pendingSave = true;
                    return;
                }

                var method = dbId ? 'PUT' : 'POST';
                var url    = dbId ? notesBase + '/' + dbId : notesBase;
                var body   = dbId
                    ? { title: title, content: content, category: category }
                    : { target_type: targetType, target_id: targetId, title: title, content: content, category: category };

                if (!dbId) creating = true;

                onSaveStart();
                var opts = {
                    method: method,
                    headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
                    body: JSON.stringify(body)
                };
                if (useKeepalive) opts.keepalive = true;

                function finish() {
                    creating = false;
                    if (pendingSave) {
                        pendingSave = false;
                        saveCard();
                    }
                }

                fetch(url, opts)
                    .then(function (resp) {
                        if (!resp.ok) throw new Error('HTTP ' + resp.status);
                        return resp.json();
                    })
                    .then(function (data) {
                        if (data.id) $card.data('note-db-id', data.id);
                        if (data.updated_at) {
                            var d = formatDate(data.updated_at);
                            $date.text(d);
                            $titleDate.text(d);
                        }
                        lastSaved = { title: title, content: content, category: category };
                        onSaveDone(true);
                        finish();
                    })
                    .catch(function () {
                        onSaveDone(false);
                        finish();
                    });
            }

            function scheduleCardSave() {
                clearTimeout(cardTimer);
                cardTimer = setTimeout(saveCard, 800);
            }

            $titleInp.on('input', scheduleCardSave);
            $textarea.on('input', function () {
                $preview.text($textarea.val());
                scheduleCardSave();
            });
            $textarea.on('blur', function () { clearTimeout(cardTimer); saveCard(); });
            $catSelect.on('change', function () {
                var next = normalizeCategory($catSelect.val());
                applyCategoryClass($card, next);
                var label = categoryLabel(next);
                $catBadge.text(label);
                $titleBadge.text(label);
                clearTimeout(cardTimer);
                saveCard();
            });

            $delBtn.on('click', function () {
                if (!confirm('Delete this note?')) return;
                var dbId = $card.data('note-db-id');
                $card.remove();
                showEmpty();
                if (!dbId) return;
                fetch(notesBase + '/' + dbId, {
                    method: 'DELETE',
                    headers: { 'X-WP-Nonce': nonce }
                });
            });

            $(window).on('beforeunload', function () {
                var t = $titleInp.val();
                var c = $textarea.val();
                var cat = normalizeCategory($catSelect.val());
                if (t !== lastSaved.title || c !== lastSaved.content || cat !== lastSaved.category) {
                    var dbId = $card.data('note-db-id');
                    if (!dbId && t.trim() === '' && c.trim() === '') return;
                    var method = dbId ? 'PUT' : 'POST';
                    var url    = dbId ? notesBase + '/' + dbId : notesBase;
                    var body   = dbId
                        ? { title: t, content: c, category: cat }
                        : { target_type: targetType, target_id: targetId, title: t, content: c, category: cat };
                    fetch(url, {
                        method: method,
                        headers: { 'Content-Type': 'application/json', 'X-WP-Nonce': nonce },
                        body: JSON.stringify(body),
                        keepalive: true
                    });
                }
            });

            return $card;
        }

        if (initialNotes.length === 0) {
            showEmpty();
        } else {
            initialNotes.forEach(function (note) { $list.append(renderCard(note, { expanded: true })); });
        }

        $addBtn.on('click', function () {
            $list.find('.nihonez-notes-empty').remove();
            var $card = renderCard({ id: null, title: '', content: '' }, { expanded: true });
            $list.append($card);
            $card.find('.nihonez-note-title-input').focus();
        });

        // Optional rows/columns view toggle (per panel, persisted per browser).
        if ($viewBtns.length) {
            var VIEW_STORAGE_KEY = 'nihonezNotesView:' + targetType;

            function applyView(view) {
                view = (view === 'columns') ? 'columns' : 'rows';
                $list.removeClass('is-rows is-columns').addClass('is-' + view);
                $viewBtns.each(function () {
                    var $b      = $(this);
                    var isMatch = $b.data('view') === view;
                    $b.toggleClass('is-active', isMatch);
                    $b.attr('aria-pressed', isMatch ? 'true' : 'false');
                });
                try { localStorage.setItem(VIEW_STORAGE_KEY, view); } catch (_) {}
            }

            var savedView = 'rows';
            try { savedView = localStorage.getItem(VIEW_STORAGE_KEY) || 'rows'; } catch (_) {}
            applyView(savedView);

            $viewBtns.on('click', function () { applyView($(this).data('view')); });
        }
    }

    $(function () {
        $('.nihonez-notes-panel').each(function () {
            initPanel($(this));
        });
    });
})(jQuery);
