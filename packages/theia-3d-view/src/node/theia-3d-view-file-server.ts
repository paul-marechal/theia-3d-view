import * as express from 'express';
import { injectable } from 'inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { Theia3dViewFileServerPath } from '../common/theia-3d-view-protocol';

@injectable()
export class Theia3dViewFileServer implements BackendApplicationContribution {
    configure(app: express.Application) {
        app.get(`${Theia3dViewFileServerPath}/:path`, (request, response) => {
            response.sendFile(request.params.path);
        });
    }
}
