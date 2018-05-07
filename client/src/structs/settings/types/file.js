/**
 * BetterDiscord File Setting Struct
 * Copyright (c) 2015-present Jiiks/JsSucks - https://github.com/Jiiks / https://github.com/JsSucks
 * All rights reserved.
 * https://betterdiscord.net
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { ThemeManager } from 'modules';
import { FileUtils, ClientIPC } from 'common';
import Setting from './basesetting';
import path from 'path';

export default class FileSetting extends Setting {

    /**
     * The value to use when the setting doesn't have a value.
     */
    get defaultValue() {
        return [];
    }

    /**
     * An object that will be passed to electron.dialog.showOpenDialog.
     */
    get dialogOptions() {
        return this.args.dialogOptions || {};
    }

    /**
     * Opens the file selection dialog and sets this file setting's value to an array of selected file paths.
     * @return {Promise}
     */
    async openDialog() {
        if (this.disabled) return;

        const filenames = await ClientIPC.send('bd-native-open', this.dialogOptions);
        if (filenames)
            this.value = filenames;
    }

    /**
     * Returns a representation of this setting's value in SCSS.
     * @return {String|Promise}
     */
    async toSCSS() {
        if (!this.value || !this.value.length) return '()';

        const files = [];
        for (let filepath of this.value) {
            const buffer = await FileUtils.readFileBuffer(path.resolve(this.path, filepath));
            const type = await FileUtils.getFileType(buffer);
            files.push(`(data: ${ThemeManager.toSCSSString(buffer.toString('base64'))}, type: ${ThemeManager.toSCSSString(type.mime)}, url: ${ThemeManager.toSCSSString(await FileUtils.toDataURI(buffer, type.mime))})`);
        }

        return files.length ? files.join(', ') : '()';
    }

}
