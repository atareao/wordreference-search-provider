/*
 * WordReference Search Provider
 * An extension to search definitions and synonyms in WordReference
 * with GNOME Shell
 *
 * Copyright (C) 2018
 *     Lorenzo Carbonell <lorenzo.carbonell.cerezo@gmail.com>,
 * https://www.atareao.es
 *
 * This file is part of WordReference Search Provider
 * 
 * WordReference Search Provider is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * WordReference Search Provider is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell-extension-openweather.
 * If not, see <http://www.gnu.org/licenses/>.
  */
 
const Soup = imports.gi.Soup;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Convenience = Extension.imports.convenience;

const PROTOCOL = 'https';
const BASE_URL = 'www.wordreference.com';
const USER_AGENT = 'GNOME Shell - WordReferenceSearchProvider - extension';
const HTTP_TIMEOUT = 10;

const DICTIONARY = {
    0: "definicio",
    1: "definition",
    2: "definicion",
    3: "definizione",
}
const SYNONYMS = {
    0: "synonyms",
    1: "sinonimos"
}
class WordReferenceClient{
    constructor(params){
        this._protocol = PROTOCOL;
        this._base_url = BASE_URL;
        this._settings = Convenience.getSettings();
        this._dictionary = DICTIONARY[this._settings.get_enum('dictionary')];
        this._synonyms = SYNONYMS[this._settings.get_enum('synonyms')];
        this._settings.connect("changed", ()=>{
            this._dictionary = DICTIONARY[this._settings.get_enum('dictionary')];
            this._synonyms = SYNONYMS[this._settings.get_enum('synonyms')];
        });
    }

    _build_query_url(word){
        let dictionary;
        if(word.substring(0, 1) == 'd'){
            dictionary = this._dictionary;
        }else{
            dictionary = this._synonyms;
        }
        word = word.substring(2).trim();
        let url = '%s://%s/%s/%s'.format(
            this._protocol,
            this._base_url,
            dictionary,
            encodeURIComponent(word)
        );
        return url;
    }
    get(word, callback, p1, p2) {
        let query_url = this._build_query_url(word);
        let request = Soup.Message.new('GET', query_url);

        _get_soup_session().queue_message(request,
            (http_session, message) => {
                if(message.status_code !== Soup.KnownStatusCode.OK) {
                    let error_message =
                        "WordReference.Client:get(): Error code: %s".format(
                            message.status_code
                        );
                    callback(error_message, null);
                    return;
                }else{
                    let result = null;
                    try {
                        result = request.response_body.data;
                        let regexp_content;
                        if (word.substring(0, 1) == 'd' && this._dictionary == 'definizione'){
                            regexp_content = /^<li\s*class='definition'[^>]*>(.*)<\/li[^>]*>/gm;
                            let m;
                            let results = [];
                            let i = 0;
                            while ((m = regexp_content.exec(result)) !== null) {
                                // This is necessary to avoid infinite loops with zero-width matches
                                if (m.index === regexp_content.lastIndex) {
                                    regexp_content.lastIndex++;
                                }
                                if (m) {
                                    let item = m[1].replace(/<li[^>]*>/gm, ' ')
                                    item = item.replace(/<br>/gm, ' ');
                                    item = item.replace(/<[^>]*>/gm, '').trim();
                                    results.push({
                                        id: 'index_'+i,
                                        label: word.substring(2).trim(),
                                        url: query_url,
                                        description: item
                                    });
                                    i+=1;
                                }
                            }
                            if(results.length > 0){
                                callback(null, results, p1, p2);
                                return;
                            }
                        }else if(word.substring(0, 1) == 's' && this._synonyms == 'synonyms'){
                            regexp_content = /<div\s*class=[',"]clickable engthes[',"][^>]*>(.*)<\/div>/gm;
                            let main_match = regexp_content.exec(result);
                            if (main_match){
                                let m;
                                let results = [];
                                let i = 0;
                                regexp_content = /<span>([^<]*)<\/span>/gm
                                while ((m = regexp_content.exec(main_match[1])) !== null) {
                                    // This is necessary to avoid infinite loops with zero-width matches
                                    if (m.index === regexp_content.lastIndex) {
                                        regexp_content.lastIndex++;
                                    }
                                    if (m) {
                                        let item = m[1].replace(/<li[^>]*>/gm, ' ')
                                        item = item.replace(/<br>/gm, ' ');
                                        item = item.replace(/<[^>]*>/gm, '').trim();
                                        results.push({
                                            id: 'index_'+i,
                                            label: word.substring(2).trim(),
                                            url: query_url,
                                            description: item
                                        });
                                        i+=1;
                                    }
                                }
                                if(results.length > 0){
                                    callback(null, results, p1, p2);
                                    return;
                                }
                            }
                        }else{
                            if (word.substring(0, 1) == 'd'){
                                regexp_content = /<ol[^>]*>(.*)<\/ol[^>]*>/gm;
                            }else{
                                regexp_content = /<ul[^>]*>(.*)<\/ul[^>]*>/gm;
                            }
                            //let regexp_content = /<ol>(.*)<\/ol>/;
                            let matches = regexp_content.exec(result);
                            if(matches){
                                result = matches[1].replace(/<li[^>]*>/gm, '\r\n')
                                result = result.replace(/<br>/gm, ' ');
                                result = result.replace(/<[^>]*>/gm, '');
                                //result = result.replace(/^\s+/gm,'');
                                let lines = "";
                                let results = [];
                                let i = 0;
                                result.split('\n').forEach(function(item){
                                    if(item != null && item.length > 0 && item != '\n'){
                                        item = item.trim();
                                        if (item.length > 0){
                                            results.push({
                                                id: 'index_'+i,
                                                label: word.substring(2).trim(),
                                                url: query_url,
                                                description: item.trim()
                                            });
                                        }
                                    }
                                    i+=1;
                                });
                                if(results.length > 0){
                                    callback(null, results, p1, p2);
                                    return;
                                }
                            }
                        }
                    }
                    catch(e) {
                        let message = "WordReference.Client:get(): %s".format(e);
                        callback(message, null, p1, p2);
                        return;
                    }
                }
            }
        );
        let message = "Nothing found";
        callback(message, null, p1, p2);
    }
    destroy() {
        _get_soup_session().run_dispose();
        _SESSION = null;
    }

    get protocol() {
        return this._protocol;
    }

    set protocol(protocol) {
        this._protocol = protocol;
    }

    get base_url() {
        return this._base_url;
    }

    set base_url(url) {
        this._base_url = url;
    }
}

let _SESSION = null;

function _get_soup_session() {
    if(_SESSION === null) {
        _SESSION = new Soup.SessionAsync();
        Soup.Session.prototype.add_feature.call(
            _SESSION,
            new Soup.ProxyResolverDefault()
        );
        _SESSION.user_agent = USER_AGENT;
        _SESSION.timeout = HTTP_TIMEOUT;
    }

    return _SESSION;
}
