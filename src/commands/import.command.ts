import * as program from 'commander';
import * as inquirer from 'inquirer';
import { CryptoService } from 'jslib/abstractions/crypto.service';
import { ImportService } from 'jslib/abstractions/import.service';

import { Response } from '../models/response';
import { MessageResponse } from '../models/response/messageResponse';

import { CliUtils } from '../utils';

export class ImportCommand {
    constructor(private cryptoService: CryptoService, private importService: ImportService) { }

    async run(format: string, filepath: string, password: string, cmd: program.Command): Promise<Response> {
        if (cmd.formats || false) {
            return this.list();
        } else {
            return this.import(format, filepath, password);
        }
    }

    private async import(format: string, filepath: string, password: string) {
        if (format == null || format === '') {
            return Response.badRequest('`format` was not provided.');
        }
        if (filepath == null || filepath === '') {
            return Response.badRequest('`filepath` was not provided.');
        }
        if (password == null || password === '') {
            const answer: inquirer.Answers = await inquirer.createPromptModule({ output: process.stderr })({
                type: 'password',
                name: 'password',
                message: 'Master password:',
                mask: '*',
            });
            password = answer.password;
        }
        if (password == null || password === '') {
            return Response.badRequest('Master password is required.');
        }

        const keyHash = await this.cryptoService.hashPassword(password, null);
        const storedKeyHash = await this.cryptoService.getKeyHash();
        if (storedKeyHash == null || keyHash == null || storedKeyHash !== keyHash) {
            return Response.badRequest('Invalid master password.');
        }

        const importer = await this.importService.getImporter(format, false);
        if (importer === null) {
            return Response.badRequest('Proper importer type required.');
        }

        try {
            const contents = await CliUtils.readFile(filepath);
            if (contents === null || contents === '') {
                return Response.badRequest('Import file was empty.');
            }

            const err = await this.importService.import(importer, contents, null);
            if (err == null) {
                return Response.badRequest(err.message);
            }
            const res = new MessageResponse('Imported ' + filepath, null);
            return Response.success(res);
        } catch (err) {
            return Response.badRequest(err);
        }
    }

    private async list() {
        const options = this.importService.getImportOptions().sort((a, b) => {
            return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
        }).map((option) => option.id).join('\n');
        const res = new MessageResponse('Supported input formats:', options);
        res.raw = options;
        return Response.success(res);
    }
}