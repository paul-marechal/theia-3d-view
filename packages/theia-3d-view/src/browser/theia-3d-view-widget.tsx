import * as three from 'three';
import { injectable, postConstruct, inject } from 'inversify';
import URI from '@theia/core/lib/common/uri';
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import { Disposable } from '@theia/core';
import { BaseWidget, Widget, Message } from '@theia/core/lib/browser';
import { Theia3dViewFileServerPath } from '../common/theia-3d-view-protocol';

export const Theia3dViewWidgetOptions = Symbol('Theia3dViewWidgetOptions');
export interface Theia3dViewWidgetOptions {
    uri: string,
    fov?: number,
}

export function defaultTheia3dViewOptions(options: Theia3dViewWidgetOptions): Required<Theia3dViewWidgetOptions> {
    return {
        fov: 90,
        ...options,
    };
}

@injectable()
export class Theia3dViewWidget extends BaseWidget {

    static readonly ID = 'theia-3d-view:widget';
    static readonly LABEL = '3D Viewer';
    static readonly OBJLOADER = new OBJLoader()

    /**
     * URI of the opened 3d file.
     */
    protected readonly _uri: URI;

    protected readonly _scene: three.Scene;
    protected readonly _renderer: three.WebGLRenderer;

    protected readonly _camera: three.PerspectiveCamera;
    protected readonly _viewPosition: three.Object3D;
    protected readonly _viewRotation: three.Object3D;

    protected readonly _object: Promise<three.Object3D>

    protected _rendering = false;

    protected _register<T extends Disposable>(disposable: T): T {
        this.toDispose.push(disposable);
        return disposable;
    }

    constructor(
        @inject(Theia3dViewWidgetOptions) options: Required<Theia3dViewWidgetOptions>,
    ) {
        super();
        this._uri = new URI(options.uri);
        try {
            this._renderer = this._register(new three.WebGLRenderer({ alpha: true }));
            this._scene = this._register(new three.Scene());
            this._renderer.domElement.tabIndex = 1;

            const light = new three.PointLight(0xFFFFFF, 1, 100);
            light.position.set(10, 10, 10);
            this._scene.add(light);

            this._camera = new three.PerspectiveCamera(options.fov, this.node.clientWidth / this.node.clientHeight, 0.1, 1000);
            this._camera.position.z = 5;

            this._viewRotation = new three.Object3D();
            this._viewPosition = this._createCameraControlObject();

            this._viewRotation.add(this._camera);
            this._viewPosition.add(this._viewRotation);
            this._scene.add(this._viewPosition);


            this._object = new Promise((resolve, reject) => {
                Theia3dViewWidget.OBJLOADER.load(
                    `${Theia3dViewFileServerPath}/${encodeURIComponent(this._uri.path.toString())}`,
                    object => {
                        if (!this.toDispose.disposed) {
                            this._scene.add(object);
                        }
                        resolve(object);
                    },
                    xhr => undefined,
                    error => {
                        console.error(error);
                        reject(error);
                    },
                );
            })

            this._renderer.setClearAlpha(0); // See through canvas
            this._attachEvents() // Orbital View + Zoom

        } catch (error) {
            this.dispose();
            throw error;
        }
    }

    protected _createCameraControlObject(): three.Object3D {
        const handle = new three.Object3D();
        for (const [x, y, z, color] of [
            [1., .1, .1, 0xFF0000],
            [.1, 1., .1, 0x00FF00],
            [.1, .1, 1., 0x0000FF],
        ]) {
            const geometry = new three.BoxGeometry(x, y, z);
            const material = new three.MeshBasicMaterial({ color });
            const mesh = new three.Mesh(geometry, material);
            mesh.position.add(new three.Vector3(x / 2, y / 2, z / 2));
            handle.add(mesh);
        }
        return handle;
    }

    protected _attachEvents() {

        // Orbital view controls
        const orbitalView = (event: PointerEvent) => {
            const leftButton = Boolean(event.buttons & 0b00001);
            const middleButton = Boolean(event.buttons & 0b00100);

            if (!leftButton && !middleButton) {
                document.exitPointerLock();

            } else if (middleButton) {
                const cameraControlPosition = new three.Vector3();
                const cameraPosition = new three.Vector3();

                this._viewPosition.getWorldPosition(cameraControlPosition);
                this._camera.getWorldPosition(cameraPosition);

                const direction = cameraControlPosition.clone();
                direction.sub(cameraPosition);
                direction.y = 0;
                direction.normalize();

                const rotation = new three.Quaternion()
                rotation.setFromUnitVectors(new three.Vector3(0, 0, -1), direction);
                const movement = new three.Vector3(-event.movementX, 0, -event.movementY)
                movement.applyQuaternion(rotation);

                this._viewPosition.position.x += movement.x * 0.1;
                this._viewPosition.position.z += movement.z * 0.1;

            } else if (leftButton) {
                this._viewRotation.rotateOnWorldAxis(new three.Vector3(0, 1, 0), event.movementX * -0.01);
                this._viewRotation.rotateOnAxis(new three.Vector3(1, 0, 0), event.movementY * -0.01);
            }
        };
        document.addEventListener('pointerlockchange', event => {
            if (document.pointerLockElement === this._renderer.domElement) {
                document.addEventListener('mousemove', orbitalView, false);
            } else {
                document.removeEventListener('mousemove', orbitalView, false);
            }
        })
        this._renderer.domElement.addEventListener('mousedown', event => {
            if (event.buttons & 0b00101 /* left + middle button */) {
                this._renderer.domElement.requestPointerLock();
            }
        });

        // Zoom level control
        this._renderer.domElement.addEventListener('wheel', event => {
            this._camera.position.z *= 1 + event.deltaY * 0.1
        });

    }

    @postConstruct()
    protected async init(): Promise <void> {
        this.id = Theia3dViewWidget.ID;
        this.title.label = this._uri.path.base;
        this.title.caption = this._uri.path.toString();
        this.title.iconClass = 'fa fa-cube';
        this.title.closable = true;
        this.update();
    }

    protected _renderLoop() {
        if (!this.toDispose.disposed && this._rendering) {
            this._renderer.render(this._scene, this._camera);
            requestAnimationFrame(() => this._renderLoop());
        }
    }

    protected onAfterAttach(message: Message) {
        super.onAfterAttach(message);
        this.node.appendChild(this._renderer.domElement);
        this._renderer.domElement.focus();
        this._rendering = true;
        this._renderLoop();
    }

    protected onBeforeDetach(message: Message) {
        super.onBeforeDetach(message);
        this._renderer.domElement.remove();
        this._rendering = false;
    }

    protected onResize(message: Widget.ResizeMessage) {
        super.onResize(message);
        this._renderer.setSize(message.width, message.height);
        this._camera.aspect = message.width / message.height;
        this._camera.updateProjectionMatrix();
    }

}
