import * as express from 'express';
import { injectable } from '@theia/core/shared/inversify';
import { FileUri } from '@theia/core/lib/node';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { Theia3dViewFileServerPath } from '../common/theia-3d-view-protocol';

@injectable()
export class Theia3dViewFileServer implements BackendApplicationContribution {
    configure(app: express.Application) {
        // This will expose **ANY** file from your system through HTTP.
        // Make sure to start the backend with limited permissions!
        app.get(`${Theia3dViewFileServerPath}/:uri`, (request, response) => {
            const file = FileUri.fsPath(request.params.uri);
            console.log(`SENDING FILE: ${file}`);
            response.sendFile(file);
        });
    }
}
