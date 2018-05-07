/**
 * BetterDiscord Theme Module
 * Copyright (c) 2015-present Jiiks/JsSucks - https://github.com/Jiiks / https://github.com/JsSucks
 * All rights reserved.
 * https://betterdiscord.net
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
*/

import Content from './content';
import Settings from './settings';
import ThemeManager from './thememanager';
import { DOM } from 'ui';
import { FileUtils, ClientIPC, ClientLogger as Logger } from 'common';
import filewatcher from 'filewatcher';

export default class Theme extends Content {

    constructor(internals) {
        super(internals);

        const watchfiles = Settings.getSetting('css', 'default', 'watch-files');
        if (watchfiles.value) this.watchfiles = this.files;
        watchfiles.on('setting-updated', event => {
            if (event.value) this.watchfiles = this.files;
            else this.watchfiles = [];
        });
    }

    get type() { return 'theme' }
    get css() { return this.data.css }

    /**
     * Called when settings are updated.
     * This can be overridden by other content types.
     */
    __settingsUpdated(event) {
        return this.recompile();
    }

    /**
     * This is called when the theme is enabled.
     */
    async onstart() {
        if (!this.css) await this.recompile();
        DOM.injectTheme(this.css, this.id);
    }

    /**
     * This is called when the theme is disabled.
     */
    onstop() {
        DOM.deleteTheme(this.id);
    }

    /**
     * Compiles the theme and returns an object containing the CSS and an array of files that were included.
     * @return {Promise}
     */
    async compile() {
        Logger.log(this.name, 'Compiling CSS');

        if (this.info.type === 'sass') {
            const config = await ThemeManager.getConfigAsSCSS(this.settings);

            const result = await ClientIPC.send('bd-compileSass', {
                data: config,
                path: this.paths.mainPath.replace(/\\/g, '/')
            });

            Logger.log(this.name, ['Finished compiling theme', new class Info {
                get SCSS_variables() { console.log(config); }
                get Compiled_SCSS() { console.log(result.css.toString()); }
                get Result() { console.log(result); }
            }]);

            return {
                css: result.css.toString(),
                files: result.stats.includedFiles
            };
        } else {
            return {
                css: await FileUtils.readFile(this.paths.mainPath)
            };
        }
    }

    /**
     * Compiles the theme and updates and saves the CSS and the list of include files.
     * @return {Promise}
     */
    async recompile() {
        const data = await this.compile();
        this.data.css = data.css;
        this.files = data.files;

        await this.saveConfiguration();

        if (this.enabled) {
            DOM.deleteTheme(this.id);
            DOM.injectTheme(this.css, this.id);
        }
    }

    /**
     * An array of files that are imported in the theme's SCSS.
     * @return {Array} Files being watched
     */
    get files() {
        return this.data.files || (this.data.files = []);
    }

    /**
     * Sets all files that are imported in the theme's SCSS.
     * @param {Array} files Files to watch
     */
    set files(files) {
        this.data.files = files;

        if (Settings.get('css', 'default', 'watch-files'))
            this.watchfiles = files;
    }

    /**
     * A filewatcher instance.
     */
    get filewatcher() {
        if (this._filewatcher) return this._filewatcher;
        this._filewatcher = filewatcher();
        this._filewatcher.on('change', (file, stat) => {
            // Recompile SCSS
            this.recompile();
        });
        return this._filewatcher;
    }

    /**
     * An array of files that are being watched for changes.
     * @return {Array} Files being watched
     */
    get watchfiles() {
        return this._watchfiles || (this._watchfiles = []);
    }

    /**
     * Sets all files to be watched.
     * @param {Array} files Files to watch
     */
    set watchfiles(files) {
        if (!files) files = [];

        for (let file of files) {
            if (!this.watchfiles.includes(file)) {
                this.filewatcher.add(file);
                this.watchfiles.push(file);
                Logger.log(this.name, `Watching file ${file} for changes`);
            }
        }

        for (let index in this.watchfiles) {
            let file = this.watchfiles[index];
            while (file && !files.find(f => f === file)) {
                this.filewatcher.remove(file);
                this.watchfiles.splice(index, 1);
                Logger.log(this.name, `No longer watching file ${file} for changes`);
                file = this.watchfiles[index];
            }
        }
    }

}
