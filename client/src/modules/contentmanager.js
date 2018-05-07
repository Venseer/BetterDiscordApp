/**
 * BetterDiscord Content Manager Module
 * Copyright (c) 2015-present Jiiks/JsSucks - https://github.com/Jiiks / https://github.com/JsSucks
 * All rights reserved.
 * https://betterdiscord.net
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
*/

import Content from './content';
import Globals from './globals';
import Database from './database';
import { Utils, FileUtils, ClientLogger as Logger } from 'common';
import { Events } from 'modules';
import { SettingsSet, ErrorEvent } from 'structs';
import { Modals } from 'ui';
import path from 'path';
import Combokeys from 'combokeys';

/**
 * Base class for managing external content
 */
export default class {

    /**
     * Any errors that happened.
     * @return {Array}
     */
    static get errors() {
        return this._errors || (this._errors = []);
    }

    /**
     * Locally stored content.
     * @return {Array}
     */
    static get localContent() {
        return this._localContent ? this._localContent : (this._localContent = []);
    }

    /**
     * The type of content this content manager manages.
     */
    static get contentType() {
        return undefined;
    }

    /**
     * The name of this content manager.
     */
    static get moduleName() {
        return undefined;
    }

    /**
     * The path used to store this content manager's content.
     */
    static get pathId() {
        return undefined;
    }

    /**
     * Local path for content.
     * @return {String}
     */
    static get contentPath() {
        return Globals.getPath(this.pathId);
    }

    /**
     * Load all locally stored content.
     * @param {bool} suppressErrors Suppress any errors that occur during loading of content
     */
    static async loadAllContent(suppressErrors = false) {
        try {
            await FileUtils.ensureDirectory(this.contentPath);
            const directories = await FileUtils.listDirectory(this.contentPath);

            for (let dir of directories) {
                try {
                    await FileUtils.directoryExists(path.join(this.contentPath, dir));
                } catch (err) { continue; }

                try {
                    await this.preloadContent(dir);
                } catch (err) {
                    this.errors.push(new ErrorEvent({
                        module: this.moduleName,
                        message: `Failed to load ${dir}`,
                        err
                    }));

                    Logger.err(this.moduleName, err);
                }
            }

            if (this.errors.length && !suppressErrors) {
                Modals.error({
                    header: `${this.moduleName} - ${this.errors.length} ${this.contentType}${this.errors.length !== 1 ? 's' : ''} failed to load`,
                    module: this.moduleName,
                    type: 'err',
                    content: this.errors
                });
                this._errors = [];
            }
        } catch (err) {
            throw err;
        }
    }

    /**
     * Refresh locally stored content
     * @param {bool} suppressErrors Suppress any errors that occur during loading of content
     */
    static async refreshContent(suppressErrors = false) {
        if (!this.localContent.length) return this.loadAllContent();

        try {
            await FileUtils.ensureDirectory(this.contentPath);
            const directories = await FileUtils.listDirectory(this.contentPath);

            for (let dir of directories) {
                // If content is already loaded this should resolve
                if (this.getContentByDirName(dir)) continue;

                try {
                    await FileUtils.directoryExists(path.join(this.contentPath, dir));
                } catch (err) { continue; }

                try {
                    // Load if not
                    await this.preloadContent(dir);
                } catch (err) {
                    // We don't want every plugin/theme to fail loading when one does
                    this.errors.push(new ErrorEvent({
                        module: this.moduleName,
                        message: `Failed to load ${dir}`,
                        err
                    }));

                    Logger.err(this.moduleName, err);
                }
            }

            for (let content of this.localContent) {
                if (directories.includes(content.dirName)) continue;

                try {
                    // Plugin/theme was deleted manually, stop it and remove any reference
                    await this.unloadContent(content);
                } catch (err) {
                    this.errors.push(new ErrorEvent({
                        module: this.moduleName,
                        message: `Failed to unload ${content.dirName}`,
                        err
                    }));

                    Logger.err(this.moduleName, err);
                }
            }

            if (this.errors.length && !suppressErrors) {
                Modals.error({
                    header: `${this.moduleName} - ${this.errors.length} ${this.contentType}${this.errors.length !== 1 ? 's' : ''} failed to load`,
                    module: this.moduleName,
                    type: 'err',
                    content: this.errors
                });
                this._errors = [];
            }
        } catch (err) {
            throw err;
        }
    }

    /**
     * Common loading procedure for loading content before passing it to the actual loader
     * @param {any} dirName Base directory for content
     * @param {any} reload Is content being reloaded
     * @param {any} index Index of content in {localContent}
     */
    static async preloadContent(dirName, reload = false, index) {
        try {
            const contentPath = path.join(this.contentPath, dirName);

            await FileUtils.directoryExists(contentPath);

            if (!reload && this.getContentByPath(contentPath))
                throw { 'message': `Attempted to load already loaded user content: ${path}` };

            const configPath = path.resolve(contentPath, 'config.json');
            const readConfig = await FileUtils.readJsonFromFile(configPath);
            const mainPath = path.join(contentPath, readConfig.main || 'index.js');

            const defaultConfig = new SettingsSet({
                settings: readConfig.defaultConfig,
                schemes: readConfig.configSchemes
            });

            const userConfig = {
                enabled: false,
                config: undefined,
                data: {}
            };

            try {
                const id = readConfig.info.id || readConfig.info.name.toLowerCase().replace(/[^a-zA-Z0-9-]/g, '-').replace(/--/g, '-');
                const readUserConfig = await Database.find({ type: `${this.contentType}-config`, id });
                if (readUserConfig.length) {
                    userConfig.enabled = readUserConfig[0].enabled || false;
                    userConfig.config = readUserConfig[0].config;
                    userConfig.data = readUserConfig[0].data || {};
                }
            } catch (err) {
                // We don't care if this fails it either means that user config doesn't exist or there's something wrong with it so we revert to default config
                Logger.warn(this.moduleName, [`Failed reading config for ${this.contentType} ${readConfig.info.name} in ${dirName}`, err]);
            }

            userConfig.config = defaultConfig.clone({ settings: userConfig.config });
            userConfig.config.setSaved();

            for (let setting of userConfig.config.findSettings(() => true)) {
                // This will load custom settings
                // Setting the content's path on only the live config (and not the default config) ensures that custom settings will not be loaded on the default settings
                setting.setContentPath(contentPath);
            }

            Utils.deepfreeze(defaultConfig, object => object instanceof Combokeys);

            const configs = {
                defaultConfig,
                schemes: userConfig.schemes,
                userConfig
            };

            const paths = {
                contentPath,
                dirName,
                mainPath
            };

            const content = await this.loadContent(paths, configs, readConfig.info, readConfig.main, readConfig.dependencies, readConfig.permissions);
            if (!content) return undefined;
            if (!reload && this.getContentById(content.id))
                throw {message: `A ${this.contentType} with the ID ${content.id} already exists.`};

            if (reload) this.localContent.splice(index, 1, content);
            else this.localContent.push(content);
            return content;
        } catch (err) {
            throw err;
        }
    }

    /**
     * Unload content.
     * @param {Content|String} content Content to unload
     * @param {Boolean} reload Whether to reload the content after
     * @return {Content}
     */
    static async unloadContent(content, reload) {
        content = this.findContent(content);
        if (!content) throw {message: `Could not find a ${this.contentType} from ${content}.`};

        try {
            await content.disable(false);
            await content.emit('unload', reload);

            const index = this.getContentIndex(content);

            delete window.require.cache[window.require.resolve(content.paths.mainPath)];

            if (reload) {
                const newcontent = await this.preloadContent(content.dirName, true, index);
                if (newcontent.enabled) {
                    newcontent.userConfig.enabled = false;
                    newcontent.start(false);
                }
                return newcontent;
            } else this.localContent.splice(index, 1);
        } catch (err) {
            Logger.err(this.moduleName, err);
            throw err;
        }
    }

    /**
     * Reload content.
     * @param {Content|String} content Content to reload
     * @return {Content}
     */
    static reloadContent(content) {
        return this.unloadContent(content, true);
    }

    /**
     * Checks if the passed object is an instance of this content type.
     * @param {Any} content Object to check
     * @return {Boolean}
     */
    static isThisContent(content) {
        return content instanceof Content;
    }

    /**
     * Returns the first content where calling {function} returns true.
     * @param {Function} function A function to call to filter content
     */
    static find(f) {
        return this.localContent.find(f);
    }

    /**
     * Wildcard content finder
     * @param {String} wild Content ID / directory name / path / name
     * @param {Boolean} nonunique Allow searching attributes that may not be unique
     * @return {Content}
     */
    static findContent(wild, nonunique) {
        if (this.isThisContent(wild)) return wild;
        let content;
        content = this.getContentById(wild); if (content) return content;
        content = this.getContentByDirName(wild); if (content) return content;
        content = this.getContentByPath(wild); if (content) return content;
        content = this.getContentByName(wild); if (content && nonunique) return content;
    }

    static getContentIndex(content) { return this.localContent.findIndex(c => c === content) }
    static getContentById(id) { return this.localContent.find(c => c.id === id) }
    static getContentByDirName(dirName) { return this.localContent.find(c => c.dirName === dirName) }
    static getContentByPath(path) { return this.localContent.find(c => c.contentPath === path) }
    static getContentByName(name) { return this.localContent.find(c => c.name === name) }

    /**
     * Wait for content to load
     * @param {String} content_id
     * @return {Promise}
     */
    static waitForContent(content_id) {
        return new Promise((resolve, reject) => {
            const check = () => {
                const content = this.getContentById(content_id);
                if (content) return resolve(content);

                setTimeout(check, 100);
            };
            check();
        });
    }

}
