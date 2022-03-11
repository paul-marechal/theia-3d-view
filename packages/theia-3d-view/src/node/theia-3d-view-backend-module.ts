import { ContainerModule } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node';
import { Theia3dViewFileServer } from './theia-3d-view-file-server';

export default new ContainerModule(bind => {
    bind(BackendApplicationContribution).to(Theia3dViewFileServer).inSingletonScope();
});
