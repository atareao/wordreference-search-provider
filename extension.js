/*
 * This file is part of wordreference-search-provider
 *
 * Copyright (c) 2018 Lorenzo Carbonell Cerezo <a.k.a. atareao>
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

// To debug: log('blah');
// And run: journalctl /usr/bin/gnome-session -f -o cat | grep LOG
const {St, Gio, Gtk, GLib, Clutter} = imports.gi;
const Main = imports.ui.main;
const Util = imports.misc.util;

const Extension = imports.misc.extensionUtils.getCurrentExtension();
const WordReferenceClient = Extension.imports.wordreference_client;
const Convenience = Extension.imports.convenience;

const Gettext = imports.gettext.domain(Extension.metadata.uuid);
const _ = Gettext.gettext;

class WordReferenceSearchProvider{
    constructor(){

        //this._settings = Convenience.getSettings();
        Gtk.IconTheme.get_default().append_search_path(
            Extension.dir.get_child('icons').get_path());
        // Use the default app for opening https links as the app for
        // launching full search.
        this.appInfo = Gio.AppInfo.get_default_for_uri_scheme('https');
        // Fake the name and icon of the app
        this.appInfo.get_name = ()=>{
            return 'WordReference Search Provider';
        };
        this.appInfo.get_icon = ()=>{
            return Gio.icon_new_for_string(Extension.path + '/icons/dictionary.svg');
        };

        // Custom messages that will be shown as search results
        this._messages = {
            '__loading__': {
                id: '__loading__',
                name: _('WordReference'),
                description : _('Loading items from WordReference, please wait...'),
                createIcon: ()=>{}
            },
            '__error__': {
                id: '__error__',
                name: _('WordReference'),
                description : _('Oops, an error occurred while searching.'),
                createIcon: ()=>{}
            },
            '__nothing_found__': {
                id: '__nothing_found__',
                name: _('WordReference'),
                description : _('Oops, I did\'nt found what you are looking for.'),
                createIcon: ()=>{}
            }
        };
        // API results will be stored here
        this.resultsMap = new Map();
        this._api = new WordReferenceClient.WordReferenceClient();
        // Wait before making an API request
        this._timeoutId = 0;


    }

    /**
     * Launch the search in the default app (i.e. browser)
     * @param {String[]} terms
     */
    /*
    launchSearch(terms) {
        Util.trySpawnCommandLine(
            "xdg-open " + this._api.getFullSearchUrl(this._getQuery(terms)));
    }
    */
    /**
     * Open the url in default app
     * @param {String} identifier
     * @param {Array} terms
     * @param timestamp
     */
    activateResult(identifier, terms, timestamp) {
        let result;
        // only do something if the result is not a custom message
        if (!(identifier in this._messages)) {
            result = this.resultsMap.get(identifier);
            if (result) {
                Util.trySpawnCommandLine(
                    "xdg-open " + result.url);
            }
        }
    }
    /**
     * Run callback with results
     * @param {Array} identifiers
     * @param {Function} callback
     */
    getResultMetas(identifiers, callback) {
        let metas = [];
        for (let i = 0; i < identifiers.length; i++) {
            // return predefined message if it exists
            if (identifiers[i] in this._messages) {
                metas.push(this._messages[identifiers[i]]);
            } else {
                // TODO: check for messages that don't exist, show generic error message
                let meta = this.resultsMap.get(identifiers[i]);
                if (meta){
                    log("Id: " + meta.id + " Name: "+ meta.label);
                    log("Description: " + meta.description);
                    metas.push({
                        id: meta.id,
                        name: meta.description,
                        //description : meta.description,
                        createIcon: ()=>{}
                    });
                }
            }
        }
        callback(metas);
    }

    /**
     * Search API if the query is a Wikidata query.
     * Wikidata query must start with a 'wd' as the first term.
     * @param {Array} terms
     * @param {Function} callback
     * @param {Gio.Cancellable} cancellable
     */
    getInitialResultSet(terms, callback, cancellable) {
        // terms holds array of search items
        // The first term must start with a 'wd' (=wikidata).
        // It can be of the form 'wd', 'wd-en', 'wd-ru'. The part after
        // the dash is the search language.

        if (terms != null && terms.length >= 1 && (terms[0].substring(0, 2) === 'd:' || terms[0].substring(0, 2) === 's:')) {
            // show the loading message
            this.showMessage('__loading__', callback);
            // remove previous timeout
            if (this._timeoutId > 0) {
                GLib.source_remove(this._timeoutId);
                this._timeoutId = 0;
            }
            this._timeoutId = GLib.timeout_add(GLib.PRIORITY_DEFAULT, 800, () => {
                // now search
                this._api.get(
                    this._getQuery(terms.join(' ')),
                    this._getResultSet.bind(this),
                    callback,
                    this._timeoutId
                );
                return false;
            });
        } else {
            // return an emtpy result set
            this._getResultSet(null, {}, callback, 0);
        }
    }

    /**
     * Show any message as a search item
     * @param {String} identifier Message identifier
     * @param {Function} callback Callback that pushes the result to search
     * overview
     */
    showMessage(identifier, callback) {
        callback([identifier]);
    }

    /**
     * TODO: implement
     * @param {Array} previousResults
     * @param {Array} terms
     * @returns {Array}
     */
    getSubsearchResultSet(previousResults, terms, callback, cancellable) {
        //this.getInitialResultSet(terms, callback);
    }

    /**
     * Return subset of results
     * @param {Array} results
     * @param {number} max
     * @returns {Array}
     */
    filterResults(results, max) {
        // override max for now
        max = this._api.limit;
        return results.slice(0, max);
    }

    /**
     * Return query string from terms array
     * @param {String[]} terms
     * @returns {String}
     */
    _getQuery(terms) {
        return terms;
    }

    /**
     * Parse results that we get from the API and save them in this.resultsMap.
     * Inform the user if no results are found.
     * @param {null|String} error
     * @param {Object|null} result
     * @param {Function} callback
     * @private
     */
    _getResultSet(error, result, callback, timeoutId) {
        let results = [];
        if (timeoutId === this._timeoutId && result && result.length > 0) {
            result.forEach((aresult) => {
                this.resultsMap.set(aresult.id, aresult);
                results.push(aresult.id);
            });
            callback(results);
        } else if (error) {
            // Let the user know that an error has occurred.
            this.showMessage('__error__', callback);
        }
    }

    /**
     * Create meta icon
     * @param size
     * @param {Object} meta
     */
    createIcon(size) {
        let box = new Clutter.Box();
        let icon = new St.Icon({gicon: new Gio.ThemedIcon({name: 'dictionary'}),
                                icon_size: size});
        box.add_child(icon);
        return box;
    }
}

let wordReferenceSearchProvider = null;

function init() {
    Convenience.initTranslations();
}

function enable() {
    if (!wordReferenceSearchProvider) {
        wordReferenceSearchProvider = new WordReferenceSearchProvider();
        Main.overview.viewSelector._searchResults._registerProvider(
            wordReferenceSearchProvider
        );
    }
}

function disable() {
    if (wordReferenceSearchProvider){
        Main.overview.viewSelector._searchResults._unregisterProvider(
            wordReferenceSearchProvider
        );
        wordReferenceSearchProvider = null;
    }
}
