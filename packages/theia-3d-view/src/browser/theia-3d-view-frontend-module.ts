import { ContainerModule } from 'inversify';
import { Theia3dViewWidget } from './theia-3d-view-widget';
import { Theia3dViewContribution } from './theia-3d-view-contribution';
import { bindViewContribution, FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';

import '../../src/browser/style/index.css';

export default new ContainerModule(bind => {
    bindViewContribution(bind, Theia3dViewContribution);
    bind(FrontendApplicationContribution).toService(Theia3dViewContribution);
    bind(Theia3dViewWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: Theia3dViewWidget.ID,
        createWidget: () => ctx.container.get<Theia3dViewWidget>(Theia3dViewWidget)
    })).inSingletonScope();
});
